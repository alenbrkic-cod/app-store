import { LISTING_LIMITS } from './constants.js'
import { sleep } from './sleep.js'
import { publicationListingFacts, textWithinByteLimit, validateManifestUrl } from './domain.js'

export const SETUP_COMPLETIONS_KEY = 'mobius:setup-complete:v1'
export const SYSTEM_SETUP_READY_KEY = 'mobius:system-setup-ready:v1'

function communityHeaders(token, idempotencyKey = '') {
  return {
    Authorization: `Bearer ${token}`,
    ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
  }
}

// A version 4 UUID. `crypto.randomUUID` exists only in secure contexts, so a
// Möbius served over plain HTTP builds one from random bytes instead.
export function randomUuid() {
  const native = globalThis.crypto?.randomUUID?.()
  if (native) return native
  const bytes = new Uint8Array(16)
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(bytes)
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256)
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

function communityRequestKey(action) {
  return `store:${action}:${randomUuid()}`.slice(0, 127)
}

async function communityResponse(response, fallback) {
  if (response.ok) return response.status === 204 ? {} : response.json()
  const detail = await readErrorDetail(response, fallback)
  throw Object.assign(new Error(detail), { status: response.status })
}

export async function loadCommunityIdentity(token) {
  const response = await fetch('/api/community/identity', {
    headers: communityHeaders(token),
  })
  return communityResponse(response, 'Community identity could not be loaded.')
}

// App Store inherits the platform-owned GitHub connection through the same
// read-only capability used by Contribute. The stored credential never enters
// the iframe; this endpoint returns only GitHub's public user profile.
export async function loadLocalGithubIdentity(token) {
  const response = await fetch('/api/community/github-status', {
    headers: communityHeaders(token),
  })
  if (!response.ok) {
    const detail = await readErrorDetail(response, 'GitHub connection could not be checked.')
    throw new Error(detail)
  }
  const profile = await response.json()
  return {
    connected: profile?.connected === true && !!profile?.login,
    login: String(profile?.login || ''),
  }
}

export async function loadCommunityApps(token, { query = '', limit = 50, offset = 0, signal } = {}) {
  const params = new URLSearchParams({ q: query, limit: String(limit), offset: String(offset) })
  const response = await fetch(`/api/community/apps?${params}`, {
    signal,
    headers: communityHeaders(token),
  })
  return communityResponse(response, 'Community apps could not be loaded.')
}

export async function loadCommunityApp(token, appId, { signal } = {}) {
  const response = await fetch(`/api/community/apps/${encodeURIComponent(appId)}`, {
    signal,
    headers: communityHeaders(token),
  })
  return communityResponse(response, 'This app could not be refreshed.')
}

export async function loadCommunityReviews(token, appId) {
  const response = await fetch(`/api/community/apps/${encodeURIComponent(appId)}/reviews`, {
    headers: communityHeaders(token),
  })
  return communityResponse(response, 'Ratings and reviews could not be loaded.')
}

export async function loadEditorialSpotlight(token) {
  const response = await fetch('/api/community/editorial/spotlight', {
    headers: communityHeaders(token),
  })
  return communityResponse(response, 'Spotlight could not be refreshed.')
}

function fileDataBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('That image could not be read.'))
    reader.onload = () => {
      const encoded = String(reader.result || '').split(',', 2)[1]
      if (!encoded) reject(new Error('That image is empty.'))
      else resolve(encoded)
    }
    reader.readAsDataURL(file)
  })
}

export async function uploadEditorialArtwork(token, file) {
  if (!file || file.size <= 0) throw new Error('Choose an artwork image.')
  if (file.size > 1_350_000) throw new Error('Artwork must be 1.35 MB or smaller.')
  const supported = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/avif'])
  if (!supported.has(file.type)) throw new Error('Use PNG, JPEG, WebP, or AVIF artwork.')
  const response = await fetch('/api/community/editorial/assets', {
    method: 'POST',
    headers: {
      ...communityHeaders(token, communityRequestKey('editorial-artwork')),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      mime_type: file.type,
      data_base64: await fileDataBase64(file),
    }),
  })
  return communityResponse(response, 'Spotlight artwork could not be uploaded.')
}

export async function publishEditorialSpotlight(token, items) {
  const response = await fetch('/api/community/editorial/spotlight', {
    method: 'PUT',
    headers: {
      ...communityHeaders(token, communityRequestKey('editorial-feed')),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ items }),
  })
  return communityResponse(response, 'Spotlight could not be published.')
}

export async function loadCommunityPublications(token, { limit = 100, offset = 0 } = {}) {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) })
  const response = await fetch(`/api/community/publications?${params}`, {
    headers: communityHeaders(token),
  })
  return communityResponse(response, 'Publication status could not be loaded.')
}

// Ratings and release facts live on each public listing. One reader per
// session reads them a few at a time across all callers, after the base rows
// have rendered, so many apps never burst requests and one slow listing never
// holds the others. A read that fails or hangs past the timeout reports
// `unavailable` rather than looking like "no ratings". A listing read in the
// last minute is reused across tab visits, and a caller asking for an app
// already being read joins that read. Only `force` (for example after the
// owner's own review) starts a new read: it aborts the one in progress, and
// only the newest read of an app may report, so older facts never win.
const PUBLICATION_LISTING_CONCURRENCY = 4
const PUBLICATION_LISTING_TIMEOUT_MS = 15_000
const PUBLICATION_LISTING_FRESH_MS = 60_000

export function createPublicationListingReader(token, onListing, {
  concurrency = PUBLICATION_LISTING_CONCURRENCY,
  timeoutMs = PUBLICATION_LISTING_TIMEOUT_MS,
  freshMs = PUBLICATION_LISTING_FRESH_MS,
  now = () => Date.now(),
} = {}) {
  const generation = new Map()
  const readyAt = new Map()
  // The queued or running read of each app: { id, turn, controller, settled }.
  const pending = new Map()
  const queue = []
  let active = 0

  async function readOne(id, signal) {
    try {
      return publicationListingFacts(await loadCommunityApp(token, id, { signal }))
    } catch {
      return { status: 'unavailable' }
    }
  }

  function finish(job) {
    if (pending.get(job.id) === job) pending.delete(job.id)
    job.done()
  }

  function pump() {
    while (active < concurrency && queue.length) {
      const job = queue.shift()
      if (job.controller.signal.aborted) { finish(job); continue }
      active += 1
      const timer = setTimeout(() => job.controller.abort(), timeoutMs)
      readOne(job.id, job.controller.signal).then((listing) => {
        if (generation.get(job.id) !== job.turn) return
        if (listing.status === 'ready') readyAt.set(job.id, now())
        else readyAt.delete(job.id)
        onListing(job.id, listing)
      }).finally(() => { clearTimeout(timer); active -= 1; finish(job); pump() })
    }
  }

  function schedule(id) {
    const turn = (generation.get(id) || 0) + 1
    generation.set(id, turn)
    const job = { id, turn, controller: new AbortController() }
    job.settled = new Promise((done) => { job.done = done })
    pending.set(id, job)
    queue.push(job)
    return job.settled
  }

  return function read(rows, { force = false } = {}) {
    const ids = [...new Set((rows || [])
      .filter((row) => row?.status === 'live' && typeof row.community_app_id === 'string' && row.community_app_id)
      .map((row) => row.community_app_id))]
      .filter((id) => force || !(now() - (readyAt.get(id) ?? -Infinity) < freshMs))
    const settled = ids.map((id) => {
      const current = pending.get(id)
      if (current && !force) return current.settled
      current?.controller.abort()
      return schedule(id)
    })
    pump()
    return Promise.all(settled)
  }
}

export async function loadLocalPublicationPreview(token, appId) {
  const params = new URLSearchParams({ app_id: String(appId) })
  const response = await fetch(`/api/community/publications/github/preview?${params}`, {
    headers: communityHeaders(token),
  })
  return normalizePublicationPreview(
    await communityResponse(response, 'This app listing could not be prepared.'),
  )
}

// New previews include an editable draft even when the listing is unfinished.
// Older previews contain only a validated listing; preserve its fields too.
export function normalizePublicationPreview(preview) {
  if (!preview || typeof preview !== 'object') return preview
  return {
    ...preview,
    ready: typeof preview.ready === 'boolean' ? preview.ready : !!preview.listing,
    draft: preview.draft || { ...preview.listing, hero: preview.listing?.hero?.path || '' },
    checklist: Array.isArray(preview.checklist) ? preview.checklist : [],
    // `asset_base` points at the revision's static/ folder while listing
    // paths are repository-relative (`static/store/…`); the root is its parent.
    asset_root: preview.asset_root || String(preview.asset_base || '').replace(/static\/$/, ''),
  }
}

export async function saveLocalListing(token, appId, listing) {
  const response = await fetch(`/api/apps/${encodeURIComponent(appId)}/store-listing`, {
    method: 'PUT',
    headers: { ...communityHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(listing),
  })
  return communityResponse(response, 'The listing could not be saved.')
}

const LISTING_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp'])
const LISTING_IMAGE_MAX_SIDE = 2400
const LISTING_IMAGE_KEEP_BYTES = 1_500_000

// Read one chosen listing image as base64, shrinking a large photo or phone
// screenshot so a full listing stays a small upload. Small PNGs are sent
// untouched so interface screenshots stay pixel-exact.
export async function prepareListingImage(file) {
  if (!file || file.size <= 0) throw new Error('That image is empty.')
  if (!LISTING_IMAGE_TYPES.has(file.type)) throw new Error('Use a PNG, JPEG, or WebP image.')
  let bitmap = null
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    throw new Error('That image could not be read.')
  }
  const longest = Math.max(bitmap.width, bitmap.height)
  if (file.size <= LISTING_IMAGE_KEEP_BYTES && longest <= LISTING_IMAGE_MAX_SIDE) {
    bitmap.close?.()
    const data = await fileDataBase64(file)
    return { data, url: `data:${file.type};base64,${data}` }
  }
  const scale = Math.min(1, LISTING_IMAGE_MAX_SIDE / longest)
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(bitmap.width * scale))
  canvas.height = Math.max(1, Math.round(bitmap.height * scale))
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close?.()
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', 0.9))
  if (!blob) throw new Error('That image could not be prepared.')
  const data = await fileDataBase64(blob)
  return { data, url: `data:${blob.type};base64,${data}` }
}

export async function registerCommunityRevision(
  token,
  { repository, commitSha, publicIdentity = 'github' },
) {
  const response = await fetch('/api/community/apps', {
    method: 'POST',
    headers: {
      ...communityHeaders(token, communityRequestKey('register')),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      repository,
      commit_sha: commitSha,
      public_identity: publicIdentity,
    }),
  })
  return communityResponse(response, 'This GitHub release could not be listed.')
}

export async function publishLocalAppToGithub(token, appId, repositoryName) {
  const response = await fetch('/api/community/publications/github', {
    method: 'POST',
    headers: {
      ...communityHeaders(token, communityRequestKey('publish-local')),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      app_id: appId,
      repository_name: repositoryName,
      confirm_source_public: true,
      public_identity: 'github',
    }),
  })
  const payload = await communityResponse(response, 'This local app could not be published.')
  // The route names the accepted revision it actually published; the request
  // cannot pin one, so callers compare it with the revision the owner reviewed.
  const published = response.headers.get('X-Mobius-Accepted-Source-Commit') || payload?.accepted_commit || ''
  return { ...payload, published_commit: String(published).toLowerCase() }
}

export async function saveCommunityReview(token, appId, stars, reviewText = null) {
  const response = await fetch(`/api/community/apps/${encodeURIComponent(appId)}/review`, {
    method: 'PUT',
    headers: {
      ...communityHeaders(token, communityRequestKey('review')),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ stars, review_text: reviewText }),
  })
  return communityResponse(response, 'Your rating or review could not be saved.')
}

export async function withdrawCommunityApp(token, appId) {
  const response = await fetch(`/api/community/apps/${encodeURIComponent(appId)}/withdraw`, {
    method: 'POST',
    headers: communityHeaders(token, communityRequestKey('withdraw')),
  })
  return communityResponse(response, 'This app could not be withdrawn.')
}

export async function recordCommunityInstall(token, appId, revisionId, localAppId) {
  const response = await fetch(
    `/api/community/apps/${encodeURIComponent(appId)}/revisions/${encodeURIComponent(revisionId)}/installs`,
    {
      method: 'POST',
      headers: {
        ...communityHeaders(token, communityRequestKey('install')),
        'Content-Type': 'application/json',
      },
      // The owner may open the newly installed app before Store's iframe settles.
      keepalive: true,
      body: JSON.stringify({ local_app_id: localAppId }),
    },
  )
  return communityResponse(response, 'This exact release could not be preserved.')
}

export async function confirmCommunityInstallReceipt(token, appId, revisionId, localAppId) {
  await recordCommunityInstall(token, appId, revisionId, localAppId)
  return loadCommunityApp(token, appId)
}

export function openInstalledApp(id, { intent, onUnembedded } = {}) {
  if (window.parent === window) {
    if (onUnembedded) onUnembedded()
    return
  }
  const msg = { type: 'moebius:open-app', appId: id }
  if (typeof intent === 'string' && intent) msg.intent = intent
  window.parent.postMessage(
    msg,
    window.location.origin,
  )
}

export function readSetupCompletions() {
  if (typeof window === 'undefined' || !window.localStorage) return {}
  try {
    const parsed = JSON.parse(window.localStorage.getItem(SETUP_COMPLETIONS_KEY) || '{}')
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

export function hasConnectedProvider(status) {
  if (!status || typeof status !== 'object') return false
  return Object.values(status).some((value) => value && value.configured)
}

export function readSystemSetupReady() {
  if (typeof window === 'undefined' || !window.localStorage) return false
  try {
    const parsed = JSON.parse(window.localStorage.getItem(SYSTEM_SETUP_READY_KEY) || 'null')
    return !!(parsed && typeof parsed === 'object' && parsed.completedAt)
  } catch {
    return false
  }
}

export function openSystemSettings(section = 'ai-providers', onUnembedded) {
  if (window.parent === window) {
    if (onUnembedded) onUnembedded()
    return
  }
  window.parent.postMessage(
    { type: 'moebius:open-settings', section },
    window.location.origin,
  )
}

// GET /api/apps/ returns the full app list. Catalog matching happens by
// canonical manifest identity in domain.js; this helper keeps the existing
// state intact on transient failures by throwing instead of returning [].
export async function loadInstalledApps(token, opts = {}) {
  const retries = opts.retries ?? 2
  const delayMs = opts.retryDelayMs ?? 250
  return await withReadDeadline(opts, async ({ signal, wait }) => {
    let lastError = null

    for (let attempt = 0; attempt <= retries; attempt++) {
      let r
      try {
        r = await fetch('/api/apps/', {
          signal,
          headers: { Authorization: `Bearer ${token}` },
        })
      } catch (err) {
        lastError = err
        if (!signal.aborted && attempt < retries && retryableFetchError(err)
          && await wait(retryDelay(null, attempt, delayMs))) continue
        throw new Error(transientFetchMessage('Installed apps'))
      }

      if (r.ok) return await jsonWithin(r, signal, 'Installed apps')
      if (attempt < retries && retryableFetchStatus(r.status)
        && await wait(retryDelay(r, attempt, delayMs))) continue
      throw new Error(`Installed apps could not be loaded (${r.status}).`)
    }

    throw new Error(lastError?.message || 'Installed apps could not be loaded.')
  })
}

// Browser background probes have a wall-clock deadline and degrade to unknown
// when it expires. This is independent of the server's Git inactivity bound
// and notify-updates.py's socket inactivity timeout; neither is a total deadline.
export const UPDATE_CHECK_DEADLINE_MS = 120_000

// GET /api/apps/{id}/update-check — the backend's git-native "does the app
// repo's actual content differ from the recorded upstream?" probe. It is
// authoritative over the client-side semver compare precisely because it
// catches a release that shipped new content without bumping mobius.json's
// version. Returns source-provenance facts or null:
//   available true/false — the authoritative content comparison
//   pendingUpdateState  — none, needs_resolution, replay_pending, or unknown
//   null                — UNKNOWN: the app has no repo or the fetch failed. The
//                         caller keeps it usable and never guesses from version.
// NEVER throws and NEVER retries: it runs from focus/visibility listeners whose
// callers have no rejection handler, so a read-only availability probe must
// degrade to null rather than let a rejection escape and strand the grid.
// A check that outlives UPDATE_CHECK_DEADLINE_MS is likewise null: the Store
// could not check right now, which is not an error.
export async function fetchUpdateCheck(appId, token, candidateManifestUrl = '') {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), UPDATE_CHECK_DEADLINE_MS)
  try {
    const query = candidateManifestUrl
      ? `?manifest_url=${encodeURIComponent(validateManifestUrl(candidateManifestUrl))}`
      : ''
    const r = await fetch(`/api/apps/${appId}/update-check${query}`, {
      signal: controller.signal,
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!r.ok) return null
    const body = await r.json()
    return {
      available: typeof body?.update_available === 'boolean'
        ? body.update_available
        : null,
      pendingUpdateState: body.pending_update_state,
      upstreamVersion: body?.upstream_version || null,
      installedSourceRevision: body?.installed_source_revision || null,
      candidateSourceDigest: body?.candidate_source_digest || null,
      // Why a fetched candidate is not offered (identity_mismatch,
      // repository_moved, or a newer code read the same way); null otherwise.
      candidateRejected: typeof body?.candidate_rejected?.message === 'string' && body.candidate_rejected.message
        ? { code: String(body.candidate_rejected.code || ''), message: body.candidate_rejected.message }
        : null,
      checkedAt: body?.checked_at || null,
    }
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

export async function loadProviderStatus(token, opts = {}) {
  const retries = opts.retries ?? 1
  const delayMs = opts.retryDelayMs ?? 250
  return await withReadDeadline(opts, async ({ signal, wait }) => {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const r = await fetch('/api/auth/providers/status', {
          signal,
          headers: { Authorization: `Bearer ${token}` },
        })
        if (r.ok) return await r.json()
        if (!retryableFetchStatus(r.status) || attempt === retries) return null
      } catch (err) {
        if (signal.aborted || !retryableFetchError(err) || attempt === retries) return null
      }
      if (!await wait(retryDelay(null, attempt, delayMs))) return null
    }
    return null
  })
}

// External resources (catalog manifests + icons) live on public git hosts
// (raw.githubusercontent.com etc). Prod's CSP is connect-src 'self' /
// img-src 'self' data:, so a direct fetch() or <img src="https://…"> to
// those hosts is BLOCKED. Everything external goes through the same-origin
// server proxy instead, which is authenticated (Bearer) and same-origin
// (so it clears the connect-src 'self' rule). The proxy streams the raw
// upstream body back with the upstream status + content-type, so callers
// treat the response exactly like a direct fetch.
export function proxyUrl(extUrl) {
  return `/api/proxy?url=${encodeURIComponent(extUrl)}`
}

function retryableFetchStatus(status) {
  return status === 408 || (status >= 500 && status < 600)
}

function retryableFetchError(error) {
  if (!error) return false
  if (error.name === 'AbortError') return true
  const msg = String(error.message || error)
  return /failed to fetch|networkerror|network request failed|load failed|fetch failed/i.test(msg)
}

function retryDelay(_res, attempt, fallbackMs) {
  return fallbackMs * (attempt + 1)
}

function rateLimitMessage(url, res) {
  let host = 'upstream'
  try { host = new URL(url).hostname } catch {}
  const service = host.includes('github') ? 'GitHub' : host
  const retryAfter = Number(res.headers?.get?.('retry-after'))
  if (Number.isFinite(retryAfter) && retryAfter > 0) {
    const seconds = Math.ceil(retryAfter)
    return `${service} rate-limited this request. Try again in ${seconds} second${seconds === 1 ? '' : 's'}.`
  }
  return `${service} rate-limited this request. Please wait a minute and try again.`
}

// Reads the Store waits on (installed apps, provider status, the registry and
// its manifests) share one deadline across every attempt, retry delay and body
// read, so a stalled connection ends in a clear error instead of a page that
// never settles. Retries never extend it.
export const READ_DEADLINE_MS = 8_000

// `wait(ms)` is a retry delay inside the deadline. It answers false at once
// when the delay would not end before the deadline, so the read reports its
// last answer (a server status) rather than an unreachable server.
async function withReadDeadline(opts, read) {
  const deadlineMs = opts.deadlineMs ?? READ_DEADLINE_MS
  const deadlineAt = Date.now() + deadlineMs
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), deadlineMs)
  const { signal } = controller
  const wait = async ms => {
    if (ms >= deadlineAt - Date.now()) return false
    await sleep(ms, signal)
    return !signal.aborted
  }
  try {
    return await read({ signal, wait })
  } finally {
    clearTimeout(timer)
  }
}

async function jsonWithin(res, signal, kind) {
  try {
    return await res.json()
  } catch (error) {
    throw signal.aborted ? new Error(transientFetchMessage(kind)) : error
  }
}

function transientFetchMessage(kind) {
  return `${kind} could not be reached. Check the connection and try again.`
}

export async function fetchManifest(url, token, opts = {}) {
  const manifestUrl = validateManifestUrl(url)
  const retries = opts.retries ?? 2
  const delayMs = opts.retryDelayMs ?? 350
  return await withReadDeadline(opts, async ({ signal, wait }) => {
    let lastError = null

    for (let attempt = 0; attempt <= retries; attempt++) {
      let r
      try {
        r = await fetch(proxyUrl(manifestUrl), {
          cache: 'no-cache',
          signal,
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })
      } catch (error) {
        lastError = new Error(transientFetchMessage('Manifest'))
        if (signal.aborted || !retryableFetchError(error) || attempt === retries
          || !await wait(retryDelay(null, attempt, delayMs))) break
        continue
      }
      if (r.ok) return await jsonWithin(r, signal, 'Manifest')

      if (r.status === 429) {
        lastError = new Error(rateLimitMessage(manifestUrl, r))
        break
      }

      lastError = new Error(`Manifest fetch failed: ${r.status}`)
      if (!retryableFetchStatus(r.status) || attempt === retries
        || !await wait(retryDelay(r, attempt, delayMs))) break
    }

    throw lastError || new Error('Manifest fetch failed')
  })
}

// Fetch the web registry (catalog.json) via the proxy and return a validated
// list of catalog entries, or throw. Schema 1 is the only supported contract;
// each entry must carry a string id and https
// manifest_url + raw_base; malformed entries are dropped rather than trusted.
// Top-level `name`/`description`/`summary` (sanitized) pass through as
// discovery copy. `collection` gives curated catalogs a stable browse shelf;
// callers derive a shelf from categories when it is absent.
// Release manifests never belong in the live registry. The caller merges these
// discovery fields over the checked-in CATALOG, preserving its generated
// snapshot for known apps and fetching only genuinely new entries.
export async function fetchCatalog(url, token, opts = {}) {
  const retries = opts.retries ?? 2
  const delayMs = opts.retryDelayMs ?? 350
  const body = await withReadDeadline(opts, async ({ signal, wait }) => {
    let r
    let lastError = null
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        r = await fetch(proxyUrl(url), {
          cache: 'no-cache',
          signal,
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })
      } catch (error) {
        lastError = new Error(transientFetchMessage('Catalog'))
        if (signal.aborted || !retryableFetchError(error) || attempt === retries
          || !await wait(retryDelay(null, attempt, delayMs))) throw lastError
        continue
      }
      if (r.ok || !retryableFetchStatus(r.status) || attempt === retries) break
      if (!await wait(retryDelay(r, attempt, delayMs))) break
    }
    if (!r) throw lastError || new Error('Catalog fetch failed')
    if (!r.ok) throw new Error(`Catalog fetch failed: ${r.status}`)
    return await jsonWithin(r, signal, 'Catalog')
  })
  if (body?.schema !== 1 || !Array.isArray(body.apps)) {
    throw new Error('Catalog schema is unsupported')
  }
  const raw = body.apps
  const httpsStr = (v) => typeof v === 'string' && /^https:\/\//.test(v)
  const sameHost = (a, b) => { try { return new URL(a).host === new URL(b).host } catch { return false } }
  const cleanString = (value) => typeof value === 'string' ? value.trim() || undefined : undefined
  const cleanList = (list) => {
    if (!Array.isArray(list)) return []
    const seen = new Set()
    const out = []
    for (const raw of list) {
      if (typeof raw !== 'string') continue
      const value = cleanString(raw)
      if (!value) continue
      const key = value.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      out.push(value)
    }
    return out
  }
  const normalizeSetup = (setup) => {
    if (!setup || typeof setup !== 'object' || Array.isArray(setup)) return null
    const scope = ['system', 'app', 'none'].includes(setup.scope) ? setup.scope : 'app'
    const rawSection = cleanString(setup.section)
    const section = ['ai-providers', 'background-agents', 'image-generation', 'models'].includes(rawSection)
      ? rawSection
      : (scope === 'system' ? 'background-agents' : '')
    const fields = cleanList(setup.fields)
    return {
      required: setup.required === true,
      scope,
      section,
      label: cleanString(setup.label) || (scope === 'system' ? 'System setup' : 'Setup'),
      description: cleanString(setup.description) || '',
      action: cleanString(setup.action) || (scope === 'system' ? 'Open Settings' : 'Open app'),
      fields,
    }
  }
  const cleanAsset = (value) => typeof value === 'string'
    && /^[a-z0-9][a-z0-9._-]*\.(?:png|webp|jpe?g)$/i.test(value.trim())
    ? value.trim()
    : undefined
  const normalizeListing = (listing) => {
    if (!listing || typeof listing !== 'object' || Array.isArray(listing)) return null
    const hero = cleanAsset(typeof listing.hero === 'string' ? listing.hero : listing.hero?.path)
    const screenshots = []
    if (Array.isArray(listing.screenshots)) {
      for (const rawShot of listing.screenshots.slice(0, LISTING_LIMITS.screenshots)) {
        const src = cleanAsset(typeof rawShot === 'string' ? rawShot : rawShot?.src)
        if (!src) continue
        screenshots.push({
          src,
          alt: textWithinByteLimit(rawShot?.alt, LISTING_LIMITS.altBytes) || '',
          label: textWithinByteLimit(rawShot?.label, LISTING_LIMITS.captionBytes) || '',
        })
      }
    }
    const tagline = textWithinByteLimit(listing.tagline, LISTING_LIMITS.taglineBytes)
    const description = textWithinByteLimit(listing.description, LISTING_LIMITS.descriptionBytes)
    if (!hero && screenshots.length === 0 && !tagline && !description) return null
    return {
      ...(hero ? { hero } : {}),
      ...(screenshots.length ? { screenshots } : {}),
      ...(tagline ? { tagline } : {}),
      ...(description ? { description } : {}),
      featured: listing.featured === true,
    }
  }
  const seen = new Set()
  const entries = []
  for (const e of raw) {
    if (!e || typeof e !== 'object') continue
    if (typeof e.id !== 'string' || !e.id) continue
    if (!httpsStr(e.manifest_url) || !httpsStr(e.raw_base)) continue
    // raw_base MUST share the manifest's host. The manifest is what the user
    // reviews and trusts on install, so the source + icon files it pulls must
    // come from the SAME origin — otherwise a registry could show a benign,
    // trusted-host manifest while sourcing code from an attacker origin.
    if (!sameHost(e.manifest_url, e.raw_base)) continue
    // First id wins; drop later duplicates so card / update / version state
    // can't collide on a repeated React key.
    if (seen.has(e.id)) continue
    seen.add(e.id)
    const audience = e.audience === 'developer' || e.audience === 'general'
      ? e.audience
      : null
    const collection = [
      'productivity', 'everyday', 'create', 'explore', 'play', 'developer',
    ].includes(e.collection) ? e.collection : null
    // The catalog summary plays the listing tagline's role, so it shares its bound.
    const summary = textWithinByteLimit(e.summary, LISTING_LIMITS.taglineBytes)
    const preview = typeof e.preview === 'string' && /^[a-z0-9][a-z0-9._-]*\.png$/i.test(e.preview)
      ? e.preview
      : undefined
    const listing = normalizeListing(e.listing)
    entries.push({
      id: e.id,
      name: cleanString(e.name),
      description: textWithinByteLimit(e.description, LISTING_LIMITS.descriptionBytes),
      ...(summary ? { summary } : {}),
      ...(preview ? { preview } : {}),
      ...(listing ? { listing } : {}),
      repo: typeof e.repo === 'string' ? e.repo : undefined,
      manifest_url: e.manifest_url,
      raw_base: e.raw_base,
      ...(audience ? { audience } : {}),
      ...(collection ? { collection } : {}),
      categories: cleanList(e.categories),
      keywords: cleanList(e.keywords),
      capabilities: cleanList(e.capabilities),
      setup: normalizeSetup(e.setup),
    })
  }
  return entries
}

function installRequestBody({
  manifest_url, manifest, raw_base, reviewed_capability_digest,
  reviewed_source_digest, update_app_id, reviewed_upstream_commit,
}) {
  const body = {}
  if (manifest_url) {
    body.manifest_url = manifest_url
  } else {
    if (manifest) body.manifest = manifest
    if (raw_base) body.raw_base = raw_base
  }
  if (reviewed_capability_digest) {
    body.reviewed_capability_digest = reviewed_capability_digest
  }
  if (reviewed_source_digest) {
    body.reviewed_source_digest = reviewed_source_digest
  }
  // An update installs exactly the commit its review showed, already fetched
  // on the instance, instead of fetching the branch again.
  if (update_app_id && reviewed_upstream_commit) {
    body.update_app_id = update_app_id
    body.reviewed_upstream_commit = reviewed_upstream_commit
  }
  return body
}

export async function previewApp({ manifest_url, manifest, raw_base, token }) {
  const res = await fetch('/api/apps/preview', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(installRequestBody({ manifest_url, manifest, raw_base })),
  })
  return await readJsonOrThrow(res, 'Capability preview failed')
}

export class CapabilityChangedError extends Error {
  constructor(detail) {
    super(detail?.message || 'The app capabilities changed. Review them and try again.')
    this.name = 'CapabilityChangedError'
    this.code = 'capability_changed'
    this.preview = {
      manifest: detail?.manifest,
      capability_contract: detail?.capability_contract,
      capability_digest: detail?.capability_digest,
      access_rows: detail?.access_rows,
      // The platform that sent these rows built them; no earlier record exists.
      installed_access_rows: Array.isArray(detail?.access_rows) ? [] : undefined,
      installed_contract: null,
      capability_diff: { unknown_previous: true, added: [], removed: [], changed: [] },
    }
  }
}

export class UpdateChangedError extends Error {
  constructor(detail = {}) {
    super(detail.message || 'The app source changed after review.')
    this.name = 'UpdateChangedError'
    this.code = 'update_changed'
  }
}

export async function installApp({
  manifest_url, manifest, raw_base, token, reviewed_capability_digest,
  reviewed_source_digest, update_app_id, reviewed_upstream_commit,
}) {
  const body = installRequestBody({
    manifest_url, manifest, raw_base, reviewed_capability_digest,
    reviewed_source_digest, update_app_id, reviewed_upstream_commit,
  })
  const res = await fetch('/api/apps/install', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text()
    let parsed = null
    try { parsed = text ? JSON.parse(text) : null } catch {}
    const detail = parsed?.detail ?? parsed
    if (res.status === 409 && detail?.code === 'capability_changed') {
      throw new CapabilityChangedError(detail)
    }
    if (res.status === 409 && detail?.code === 'update_changed') {
      throw new UpdateChangedError(detail)
    }
    throw responseError(res.status, text)
  }
  const out = await res.json()
  return {
    id: out.id,
    slug: out.slug,
    name: out.name,
    version: out.version,
    mode: out.mode,
    divergence: out.divergence,
    conflict_paths: out.conflict_paths || [],
    warnings: out.warnings || [],
    updated_at: out.updated_at,
  }
}

function formatErrorDetail(detail) {
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    const messages = detail.map((entry) => {
      if (typeof entry === 'string') return entry
      const location = Array.isArray(entry?.loc) ? entry.loc.join('.') : ''
      const message = typeof entry?.msg === 'string' ? entry.msg : ''
      return [location, message].filter(Boolean).join(': ')
    }).filter(Boolean)
    if (messages.length) return messages.join('; ')
  }
  if (detail && typeof detail === 'object') {
    if (typeof detail.message === 'string' && detail.message.trim()) {
      return detail.message.trim()
    }
    try { return JSON.stringify(detail) } catch {}
  }
  return ''
}

/** Read a failed response body exactly once, then decode JSON when possible. */
export async function readErrorDetail(res, fallback) {
  const text = await res.text()
  if (!text) return fallback || `HTTP ${res.status}`
  try {
    const body = JSON.parse(text)
    return formatErrorDetail(body?.detail ?? body) || fallback || `HTTP ${res.status}`
  } catch {
    return text
  }
}

// Statuses the platform's installer itself treats as transient.
const TRANSIENT_STATUSES = new Set([429, 502, 503, 504])

// A failed response as an Error that keeps the server's structured detail:
// `status`, its `code`, and whether the same request may later succeed
// (`retryable`: the detail says so, or the status is transient).
export function responseError(status, text, fallback) {
  let detail = null
  let message = text || ''
  try {
    const body = text ? JSON.parse(text) : null
    detail = body?.detail ?? body
    message = formatErrorDetail(detail)
  } catch {}
  const error = new Error(message || fallback || `HTTP ${status}`)
  error.status = status
  error.detail = detail
  error.code = typeof detail?.code === 'string' ? detail.code : null
  error.retryable = detail?.retryable === true || TRANSIENT_STATUSES.has(status)
  return error
}

async function responseErrorOf(res, fallback) {
  return responseError(res.status, await res.text().catch(() => ''), fallback)
}

export async function readJsonOrThrow(res, fallback) {
  if (res.ok) return await res.json()
  throw await responseErrorOf(res, fallback || `HTTP ${res.status}`)
}

// Read-only preview of the currently published candidate. This fetches the
// incoming release before anything is applied. Reviewing an update is
// user-initiated, so there is deliberately no client deadline: the server
// bounds its own candidate fetch, the caller shows progress, and `signal`
// lets the owner cancel. A candidate install would refuse is a 409 whose
// detail is `{code, message}` (identity_mismatch, repository_moved).
export async function loadUpdateCandidatePreview(appId, manifestUrl, token, { signal } = {}) {
  const query = manifestUrl
    ? `?manifest_url=${encodeURIComponent(manifestUrl)}`
    : ''
  const res = await fetch(`/api/apps/${appId}/update-candidate-preview${query}`, {
    signal,
    headers: { Authorization: `Bearer ${token}` },
  })
  return await readJsonOrThrow(res, 'Update changes could not be loaded')
}

export async function createConflictResolverChat(appId, resolutionPolicy, token) {
  const res = await fetch(`/api/apps/${appId}/conflict-resolver-chat`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ resolution_policy: resolutionPolicy }),
  })
  return await readJsonOrThrow(res, 'Could not open resolver chat')
}

export async function createConflictResolverBatch(appIds, resolutionPolicy, token) {
  const res = await fetch('/api/apps/conflict-resolver-batch', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ app_ids: appIds, resolution_policy: resolutionPolicy }),
  })
  if (res.status === 409) {
    const error = await responseErrorOf(res, 'Could not open resolver chat')
    // Apps already bound to a running resolver reuse that chat; `app_ids`
    // names only the apps it covers.
    if (error.code === 'conflict_resolver_running' && error.detail?.chat_id) {
      return {
        chat_id: error.detail.chat_id, app_ids: error.detail.app_ids || [], started: false, existing: true,
        // Why the chat is reused (for example, it is still resolving an
        // earlier update): shown instead of the generic resolving note.
        message: typeof error.detail.message === 'string' ? error.detail.message : '',
      }
    }
    throw error
  }
  return await readJsonOrThrow(res, 'Could not open resolver chat')
}

// Whether an update-batch request failed because this Möbius has no batch
// routes (it predates mobius-os/mobius#1843), rather than for a reason the
// routes gave. Only FastAPI's generic answers count: "Not Found" or "Method
// Not Allowed", or the 422 an older `GET /api/apps/{app_id}` route gives when
// it reads "update-batches" as an app id. "App not found." is a real answer.
export function batchRoutesMissing(error) {
  const detail = error?.detail
  if (error?.status === 404) return detail === 'Not Found'
  if (error?.status === 405) return detail === 'Method Not Allowed'
  if (error?.status === 422 && Array.isArray(detail)) {
    return detail.some(item => Array.isArray(item?.loc) && item.loc[0] === 'path' && item.loc.includes('app_id'))
  }
  return false
}

// Server-run update batches (platform: POST/GET /api/apps/update-batches).
// The batch id is chosen here, so resending the same request after a lost
// answer attaches to the batch already running instead of starting another.
export async function submitUpdateBatch(payload, token) {
  const res = await fetch('/api/apps/update-batches', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return await readJsonOrThrow(res, 'The updates could not be started.')
}

export async function loadUpdateBatches(token) {
  const res = await fetch('/api/apps/update-batches', { headers: { Authorization: `Bearer ${token}` } })
  return await readJsonOrThrow(res, 'Update progress could not be loaded.')
}

export async function loadUpdateBatch(id, token, { signal } = {}) {
  const res = await fetch(`/api/apps/update-batches/${encodeURIComponent(id)}`, {
    signal, headers: { Authorization: `Bearer ${token}` },
  })
  return await readJsonOrThrow(res, 'Update progress could not be loaded.')
}

// Server-sent events: one `data: <snapshot>` frame per change, comment
// keepalives in between, ending after the `complete` snapshot. Resolves when
// the stream ends; the caller re-reads and reconnects if work remains.
export async function watchUpdateBatch(id, token, onSnapshot, { signal } = {}) {
  const res = await fetch(`/api/apps/update-batches/${encodeURIComponent(id)}/events`, {
    signal, headers: { Authorization: `Bearer ${token}`, Accept: 'text/event-stream' },
  })
  if (!res.ok) throw await responseErrorOf(res, 'Update progress stream unavailable.')
  if (!res.body) throw new Error('Update progress stream unavailable.')
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  const deliver = frame => {
    const data = frame.split('\n').filter(line => line.startsWith('data:'))
      .map(line => line.slice(5).replace(/^ /, '')).join('\n')
    if (!data) return false
    const snapshot = JSON.parse(data)
    onSnapshot(snapshot)
    return snapshot?.phase === 'complete'
  }
  try {
    while (!signal?.aborted) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true }).replace(/\r\n?/g, '\n')
      let boundary
      while ((boundary = buffer.indexOf('\n\n')) !== -1) {
        const frame = buffer.slice(0, boundary)
        buffer = buffer.slice(boundary + 2)
        if (deliver(frame)) return
      }
    }
    if (!signal?.aborted && buffer.trim()) deliver(buffer)
  } finally {
    reader.cancel().catch(() => {})
  }
}

export async function createAppChat(title, token, { ownerVisible = false, scope, scopeLabel } = {}) {
  const res = await fetch('/api/app-chats', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title,
      owner_visible: ownerVisible,
      ...(scope ? { scope, scope_label: scopeLabel || undefined } : {}),
    }),
  })
  return await readJsonOrThrow(res, 'Could not create review chat')
}

// The Store's newest chat in one scope (most recent first from the server),
// with whether its agent is working now or waiting for the owner; null when
// there is none. Rows are matched by their own scope: a Möbius that predates
// scoped chats ignores the filter, and reusing an unrelated chat would be
// worse than starting a new one.
export async function latestScopedAppChat(scope, token) {
  const res = await fetch(`/api/app-chats?${new URLSearchParams({ scope })}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const rows = await readJsonOrThrow(res, 'Could not read the agent chat')
  const chat = Array.isArray(rows) ? rows.find((row) => row?.scope === scope) : null
  return chat?.id ? { id: chat.id, running: !!chat.running, awaitingOwner: !!chat.awaiting_owner } : null
}

export async function seedChatMessage(chatId, content, token) {
  const res = await fetch(`/api/chats/${chatId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ content }),
  })
  if (!res.ok) {
    await readJsonOrThrow(res, 'Could not seed chat message')
  }
}

export function openChat(chatId) {
  window.parent.postMessage(
    { type: 'moebius:open-chat', chatId },
    window.location.origin,
  )
}

// Apps uninstalled within their recovery window. Only a hint for the app page, so a failure shows no note.
export async function fetchUninstalledApps(token) {
  const res = await fetch('/api/apps/uninstalled', { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) return []
  const rows = await res.json()
  return Array.isArray(rows) ? rows : []
}
