import assert from 'node:assert/strict'
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'
import test from 'node:test'
import { hasConnectedProvider } from '../api.js'
import { MICROPHONE, platformContract, platformPreview } from './capability-fixtures.mjs'

const root = dirname(fileURLToPath(import.meta.url))
const buildDir = join(root, '.build')
const bundled = join(buildDir, 'index.mjs')
const reactStub = join(root, 'react-stub.mjs')
const iconStub = join(root, 'sdk-icon-stub.mjs')

test('setup readiness follows the canonical configured provider status', () => {
  assert.equal(hasConnectedProvider({ claude: { configured: true } }), true)
  assert.equal(
    hasConnectedProvider({ claude: { configured: false, authenticated: true } }),
    false,
    'the retired authenticated alias must not make setup ready',
  )
})

// Möbius compiles mini-apps with Rolldown, so the tests bundle the same way.
// CI points MOBIUS_FRONTEND_NODE_MODULES at the shell's installed frontend;
// outside CI, a local install resolves it normally.
async function loadRolldown() {
  const frontend = process.env.MOBIUS_FRONTEND_NODE_MODULES
  if (!frontend) return import('rolldown')
  const requireFromFrontend = createRequire(join(frontend, 'package.json'))
  return import(pathToFileURL(requireFromFrontend.resolve('rolldown')).href)
}

async function bundle() {
  await rm(buildDir, { recursive: true, force: true })
  await mkdir(buildDir, { recursive: true })
  const { rolldown } = await loadRolldown()
  const build = await rolldown({
    input: join(root, '..', 'index.jsx'),
    platform: 'node',
    tsconfig: false,
    resolve: {
      alias: {
        'react/jsx-runtime': reactStub,
        react: reactStub,
        '@openai/apps-sdk-ui/components/Icon': iconStub,
      },
    },
    transform: { jsx: 'react-jsx' },
  })
  await build.write({ file: bundled, format: 'es' })
  await build.close()
  return import(pathToFileURL(bundled))
}

test('canonicalIdentityKey matches backend-style manifest identities', async () => {
  const { canonicalIdentityKey } = await bundle()

  assert.equal(
    canonicalIdentityKey('https://raw.githubusercontent.com/mobius-os/app-news/main/mobius.json?cache=1#old', 'news'),
    'https://raw.githubusercontent.com/mobius-os/app-news/main#manifest-id=news',
  )
  assert.equal(
    canonicalIdentityKey('https://example.test/apps/custom/manifest.json', 'custom'),
    'https://example.test/apps/custom#manifest-id=custom',
  )
})

test('store artwork resolves only through the accepted manifest mapping', async () => {
  const { catalogAssetFilename, catalogAssetUrl, storeAssetSource, storeAssetUrl } = await bundle()
  const imageSource = await readFile(join(root, '..', 'ui', 'StoreImage.jsx'), 'utf8')
  const manifest = {
    static_assets: {
      'listing/hero.png': 'listing-assets/hero.immutable.png',
    },
  }
  assert.equal(
    storeAssetSource(manifest, 'listing/hero.png'),
    'listing-assets/hero.immutable.png',
  )
  assert.equal(
    storeAssetUrl({ manifest, raw_base: 'https://raw.example/revision/' }, 'listing/hero.png'),
    'https://raw.example/revision/listing-assets/hero.immutable.png',
  )
  assert.equal(
    storeAssetUrl({ manifest, local_asset_base: '/app-assets/by-id/7/static/' }, 'listing/hero.png'),
    '/app-assets/by-id/7/static/listing/hero.png',
  )
  assert.equal(
    storeAssetUrl(
      { manifest, raw_base: 'https://raw.example/revision/' },
      'https://www.mobius.you/v1/community/editorial/assets/' + 'a'.repeat(64) + '.webp',
    ),
    'https://www.mobius.you/v1/community/editorial/assets/' + 'a'.repeat(64) + '.webp',
  )
  assert.equal(
    storeAssetUrl(
      { manifest, raw_base: 'https://raw.example/revision/' },
      'https://attacker.test/v1/community/editorial/assets/' + 'a'.repeat(64) + '.webp',
    ),
    '',
  )
  assert.equal(
    storeAssetUrl(
      { manifest, raw_base: 'https://raw.example/revision/' },
      'https://www.mobius.you/v1/community/editorial/assets/not-a-digest.webp',
    ),
    '',
  )
  assert.equal(
    storeAssetUrl(
      { manifest, raw_base: 'https://raw.example/revision/' },
      'https://www.mobius.you/v1/community/editorial/assets/' + 'a'.repeat(64) + '.webp?mutable=1',
    ),
    '',
  )
  assert.equal(catalogAssetFilename('voice-screen.png'), 'voice-screen.png')
  assert.equal(catalogAssetFilename('../identity-screen.png'), '')
  assert.equal(catalogAssetFilename('https://attacker.test/hero.png'), '')
  assert.equal(catalogAssetUrl(39, 'voice-screen.png'), '/app-assets/by-id/39/previews/voice-screen.webp')
  assert.equal(catalogAssetUrl(39, 'community-shot.png'), '/app-assets/by-id/39/previews/community-shot.png')
  assert.equal(catalogAssetUrl(39, '../identity-screen.png'), '')
  assert.equal(catalogAssetUrl('not-an-app', 'voice-screen.png'), '')
  assert.match(imageSource, /URL\.revokeObjectURL\(objectUrl\)/)
  assert.doesNotMatch(imageSource, /const resolvedImages = new Map/)
})

test('catalog listing artwork is bounded and sanitized before it reaches the UI', async () => {
  const { fetchCatalog } = await bundle()
  const oldFetch = globalThis.fetch
  globalThis.fetch = async () => new Response(JSON.stringify({
    schema: 1,
    apps: [{
      id: 'voice',
      manifest_url: 'https://raw.example/apps/voice/mobius.json',
      raw_base: 'https://raw.example/apps/voice/',
      listing: {
        hero: '../private.png',
        tagline: '  A private voice   for your agent.  ',
        screenshots: [
          { src: 'voice-screen.png', alt: ' Voice screen ', label: ' Choose a voice ' },
          { src: 'https://attacker.test/tracker.png', alt: 'Remote tracker' },
          { src: '../identity-screen.png', alt: 'Private data' },
        ],
        featured: true,
      },
    }],
  }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  try {
    const [item] = await fetchCatalog('https://raw.example/catalog.json', 'owner-token')
    assert.deepEqual(item.listing, {
      screenshots: [{
        src: 'voice-screen.png',
        alt: 'Voice screen',
        label: 'Choose a voice',
      }],
      tagline: 'A private voice   for your agent.',
      featured: true,
    })
  } finally {
    globalThis.fetch = oldFetch
  }
})

test('every curated listing asset is packaged by the App Store', async () => {
  const manifest = JSON.parse(await readFile(new URL('../mobius.json', import.meta.url), 'utf8'))
  const catalog = JSON.parse(await readFile(new URL('../catalog.json', import.meta.url), 'utf8'))
  const referenced = new Set()
  for (const item of catalog.apps) {
    if (item.listing?.hero) referenced.add(item.listing.hero)
    for (const shot of item.listing?.screenshots || []) referenced.add(shot.src)
  }
  assert.equal(referenced.size, 18)
  for (const filename of referenced) {
    assert.equal(
      manifest.static_assets[`previews/${filename.replace(/\.png$/, '.webp')}`],
      `listing-assets/${filename.replace(/\.png$/, '.webp')}`,
      `${filename} is missing from static_assets`,
    )
  }
})

test('community listings join the ordinary install path with source provenance', async () => {
  const { communityCatalogItems } = await bundle()
  const [item] = communityCatalogItems({ items: [{
    id: 'app_public_1234',
    manifest: {
      id: 'shared-notes',
      name: 'Shared Notes',
      description: 'Notes made together.',
      store: { tagline: 'Notes made together.', description: 'Shared notes.' },
    },
    latest_revision: {
      id: 'rev_public_1234',
      manifest_url: 'https://raw.githubusercontent.com/example/shared-notes/main/mobius.json',
      raw_base: 'https://raw.githubusercontent.com/example/shared-notes/main/',
      cache: { kind: 'content_addressed', revision_id: 'rev_public_1234' },
    },
    publisher: { kind: 'github', login: 'octo-owner' },
    repository_url: 'https://github.com/example/shared-notes',
    repository_update: {
      commit_sha: 'd'.repeat(40),
      ref: 'refs/heads/main',
      status: 'available_for_review',
    },
    rating: { average: 4.6, count: 12 },
    user_review: { stars: 5, review_text: 'Excellent.' },
    review_eligibility: 'eligible',
  }] })
  assert.equal(item.id, 'community:app_public_1234')
  assert.equal(item.collection, 'community')
  assert.equal(item.community.revision_id, 'rev_public_1234')
  assert.equal(item.community.author.handle, 'octo-owner')
  assert.equal(item.community.verified_repository_url, 'https://github.com/example/shared-notes')
  assert.equal(item.community.repository_update.commit_sha, 'd'.repeat(40))
  assert.equal(item.community.repository_update.status, 'available_for_review')
  assert.equal(item.community.cache.kind, 'content_addressed')
  assert.equal(item.community.publication_status, 'live')
  assert.equal(item.community.rating_average, 4.6)
  assert.equal(item.community.rating_count, 12)
  assert.deepEqual(item.community.user_review, { stars: 5, review_text: 'Excellent.' })
  assert.equal(item.community.review_eligibility, 'eligible')
  assert.deepEqual(item.community.reviews, [])
})

test('official catalog apps absorb verified feedback and omit colliding package ids', async () => {
  const { communityCatalogItems, mergeOfficialCommunityFeedback } = await bundle()
  const official = {
    id: 'voice',
    repo: 'mobius-os/app-voice',
    manifest_url: 'https://raw.githubusercontent.com/mobius-os/app-voice/main/mobius.json',
    manifest: { id: 'voice', author: 'mobius-os', name: 'Voice' },
  }
  const duplicate = {
    id: 'community:app_voice',
    manifest_url: 'https://raw.githubusercontent.com/mobius-os/app-voice/main/mobius.json',
    manifest: { id: 'voice', author: 'mobius-os', name: 'Voice' },
    community: {
      id: 'app_voice', revision_id: 'revision_voice', rating_average: 4.8,
      repository_url: 'https://github.com/mobius-os/app-voice',
      verified_repository_url: 'https://github.com/mobius-os/app-voice',
    },
  }
  const [impersonatingFork] = communityCatalogItems({ items: [{
    id: 'app_voice_fork',
    manifest: {
      id: 'voice', author: 'mobius-os', name: 'Voice fork',
      homepage: 'https://github.com/mobius-os/app-voice',
    },
    latest_revision: {
      id: 'revision_voice_fork',
      manifest_url: 'https://raw.githubusercontent.com/other-publisher/app-voice/main/mobius.json',
      raw_base: 'https://raw.githubusercontent.com/other-publisher/app-voice/main/',
    },
    rating: { average: 1.2, count: 1 },
  }] })
  assert.equal(impersonatingFork.community.repository_url, 'https://github.com/mobius-os/app-voice')
  assert.equal(impersonatingFork.community.verified_repository_url, '')
  const unrelated = {
    id: 'community:app_notes',
    manifest: { id: 'notes', author: 'octo-owner' },
    community: { id: 'app_notes', revision_id: 'revision_notes' },
  }

  const merged = mergeOfficialCommunityFeedback([official], [duplicate, impersonatingFork, unrelated])
  assert.deepEqual(merged.map((item) => item.id), [
    'voice', 'community:app_notes',
  ])
  assert.equal(merged[0].manifest_url, official.manifest_url)
  assert.equal(merged[0].community, undefined)
  assert.equal(merged[0].community_feedback.rating_average, 4.8)
  assert.equal(merged[1].community.id, 'app_notes')
})

test('community catalog pages preserve source offsets and deduplicate appended apps', async () => {
  const { communityCatalogPage, mergeCommunityCatalog } = await bundle()
  const listing = (id) => ({
    id,
    manifest: { id, name: id, description: id },
    latest_revision: {
      id: `revision-${id}`,
      manifest_url: `https://example.test/${id}/mobius.json`,
      raw_base: `https://example.test/${id}/`,
    },
  })
  const first = communityCatalogPage({
    items: [listing('one')],
    next_offset: 1,
    viewer: { github: { connected: true, login: 'octo-owner' } },
  }, 24)
  const second = communityCatalogPage({ items: [listing('one'), listing('two')], next_offset: null }, 24)
  assert.equal(first.hasMore, true)
  assert.equal(first.rowCount, 1)
  assert.deepEqual(first.viewer, {
    github: { connected: true, login: 'octo-owner' },
  })
  assert.equal(second.hasMore, false)
  assert.deepEqual(
    mergeCommunityCatalog(first.items, second.items).map((item) => item.id),
    ['community:one', 'community:two'],
  )
  const partial = communityCatalogPage({
    items: [listing('valid'), { id: 'invalid' }],
    next_offset: 2,
  }, 24)
  assert.equal(partial.items.length, 1)
  assert.equal(partial.rowCount, 2)
})

test('community publication state and source links stay truthful', async () => {
  const { communityPublicationStatus, communityRepositoryUrl } = await bundle()
  assert.equal(communityPublicationStatus({ status: 'checking' }), 'checking')
  assert.equal(communityPublicationStatus({ latest_revision: { id: 'rev_1' } }), 'live')
  assert.equal(communityPublicationStatus({}), 'pending')
  assert.equal(
    communityRepositoryUrl('https://github.com/example/shared-notes.git'),
    'https://github.com/example/shared-notes',
  )
  assert.equal(communityRepositoryUrl('javascript:alert(1)'), '')
  assert.equal(communityRepositoryUrl('https://example.test/example/shared-notes'), '')
})

test('source availability distinguishes the immutable Host cache from a repository revision', async () => {
  const { sourceAvailabilityStatus } = await bundle()
  assert.equal(sourceAvailabilityStatus().key, 'repository')
  assert.equal(sourceAvailabilityStatus({ kind: 'content_addressed' }).key, 'preserved')
})

test('switching Store journeys resets the shared scroll surface', async () => {
  const source = await readFile(new URL('../index.jsx', import.meta.url), 'utf8')
  assert.match(source, /const selectTab = useCallback\(\(next\) => \{[\s\S]*gridScrollRef\.current\.scrollTop = 0[\s\S]*setTab\(next\)/)
  assert.match(source, /onClick=\{\(\) => selectTab\('publish'\)\}/)
  assert.match(source, /onClick=\{\(\) => \{ selectTab\('library'\)/)
})

test('the Store uses shared listings rather than a raw link-install tab', async () => {
  const source = await readFile(join(root, '..', 'index.jsx'), 'utf8')
  assert.match(source, /Publish/)
  assert.doesNotMatch(source, />Install from link</)
  assert.match(source, /loadCommunityApps/)
  assert.match(source, /registerCommunityRevision/)
  assert.match(source, /saveCommunityReview/)
  assert.match(source, /loadCommunityReviews/)
  assert.doesNotMatch(source, /remixCommunityApp/)
})

test('ratings and optional written reviews use one account-bound community mutation', async () => {
  const { saveCommunityReview } = await bundle()
  const oldFetch = globalThis.fetch
  const calls = []
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options })
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  try {
    await saveCommunityReview('owner-token', 'app_public_notes', 5, null)
    await saveCommunityReview('owner-token', 'app_public_notes', 4, 'Clear and useful.')
  } finally {
    globalThis.fetch = oldFetch
  }
  assert.equal(calls[0].url, '/api/community/apps/app_public_notes/review')
  assert.equal(calls[0].options.method, 'PUT')
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    stars: 5, review_text: null,
  })
  assert.match(calls[0].options.headers['Idempotency-Key'], /^store:review:/)
  assert.equal(calls[1].url, '/api/community/apps/app_public_notes/review')
  assert.equal(calls[1].options.method, 'PUT')
  assert.deepEqual(JSON.parse(calls[1].options.body), {
    stars: 4, review_text: 'Clear and useful.',
  })
  assert.match(calls[1].options.headers['Idempotency-Key'], /^store:review:/)
})

test('install receipt retries use the exact installed release and enable feedback on acceptance', async () => {
  const {
    rememberCommunityInstallRevision, installedCommunityRevision,
    attemptCommunityReceiptOnce, confirmCommunityInstallReceipt,
  } = await bundle()
  const values = new Map()
  const storage = {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, value),
  }
  const installed = {
    id: 42, slug: 'notes', updated_at: '2026-09-26T00:00:00Z',
    source_manifest: {
      url: 'https://www.mobius.you/v1/community/source/app_notes123/current/mobius.json',
    },
  }
  const community = { id: 'app_notes123', revision_id: 'rev_installed123' }
  assert.equal(rememberCommunityInstallRevision(installed, community, storage), true)
  assert.equal(installedCommunityRevision(installed, community.id, storage), 'rev_installed123')
  assert.equal(installedCommunityRevision({ ...installed, updated_at: 'later' }, community.id, storage), null)
  assert.equal(installedCommunityRevision({
    ...installed,
    source_manifest: { url: 'https://www.mobius.you/v1/community/source/app_notes123/rev_older123/mobius.json' },
  }, community.id, null), 'rev_older123')

  const oldFetch = globalThis.fetch
  const calls = []
  let offline = true
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url, options })
    if (options.method === 'POST' && offline) {
      offline = false
      throw new Error('offline')
    }
    return new Response(JSON.stringify(options.method === 'POST'
      ? { recorded: true }
      : { has_verified_install: true, review_eligibility: 'eligible' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  try {
    const attempts = new Set()
    const key = 'app_notes123:rev_installed123:42'
    let eligibility = 'install_required'
    const confirm = async () => {
      try {
        const refreshed = await confirmCommunityInstallReceipt(
          'owner-token', community.id, installedCommunityRevision(installed, community.id, storage),
          'app:42:notes',
        )
        eligibility = refreshed.review_eligibility
        return true
      } catch {
        return false
      }
    }
    const first = attemptCommunityReceiptOnce(attempts, key, confirm)
    assert.equal(attemptCommunityReceiptOnce(attempts, key, confirm), null,
      'an in-flight receipt must not be duplicated')
    assert.equal(await first, false)
    assert.equal(attempts.has(key), false, 'a failed receipt can be retried')
    assert.equal(await attemptCommunityReceiptOnce(attempts, key, confirm), true)
    assert.equal(eligibility, 'eligible')
    assert.equal(attemptCommunityReceiptOnce(attempts, key, confirm), null,
      'an accepted receipt must not be repeated')
    assert.equal(calls.filter((call) => call.options.method === 'POST').length, 2)
    assert.equal(calls.filter((call) => !call.options.method).length, 1)
    assert.equal(calls[1].url,
      '/api/community/apps/app_notes123/revisions/rev_installed123/installs')
    assert.equal(calls[1].options.keepalive, true)
  } finally {
    globalThis.fetch = oldFetch
  }
})

test('ratings and optional reviews use one account gate and scoped errors', async () => {
  const appSource = await readFile(join(root, '..', 'index.jsx'), 'utf8')
  const detailSource = await readFile(join(root, '..', 'ui', 'DetailView.jsx'), 'utf8')
  const feedbackSource = await readFile(join(root, '..', 'ui', 'CommunityFeedback.jsx'), 'utf8')

  assert.match(appSource, /feedback\.review_eligibility !== 'eligible'/)
  assert.match(appSource, /communityActionError\.key === detailCommunityFeedbackKey/)
  assert.match(detailSource, /communityFeedback\?\.review_eligibility === 'eligible'/)
  assert.match(detailSource, /canRate=\{verifiedCommunityInstall\}/)
  assert.match(feedbackSource, /disabled=\{busy \|\| !canRate\}/)
  assert.match(feedbackSource, /Add a written review \(optional\)/)
  assert.match(feedbackSource, /feedback\.user_review \? 'Update' : 'Post'/)
  assert.match(feedbackSource, /Updating with an empty box removes your public written review/)
  assert.doesNotMatch(feedbackSource, /Connect GitHub/)
})

test('distributed publishing submits one immutable GitHub revision', async () => {
  const { registerCommunityRevision } = await bundle()
  const oldFetch = globalThis.fetch
  const calls = []
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options })
    return new Response(JSON.stringify({ id: 'app_public_notes' }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  try {
    await registerCommunityRevision('owner-token', {
      repository: 'example/notes',
      commitSha: 'a'.repeat(40),
      publicIdentity: 'github',
    })
  } finally {
    globalThis.fetch = oldFetch
  }
  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, '/api/community/apps')
  assert.equal(calls[0].options.method, 'POST')
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    repository: 'example/notes',
    commit_sha: 'a'.repeat(40),
    public_identity: 'github',
  })
  assert.match(calls[0].options.headers['Idempotency-Key'], /^store:register:/)
})

test('local publishing is one reviewed action through the inherited GitHub account', async () => {
  const { publishLocalAppToGithub } = await bundle()
  const publisherSource = await readFile(join(root, '..', 'ui', 'PublisherTab.jsx'), 'utf8')
  const oldFetch = globalThis.fetch
  const calls = []
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options })
    return new Response(JSON.stringify({ id: 'app_public_notes' }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  try {
    await publishLocalAppToGithub('owner-token', 42, 'pocket-list')
  } finally {
    globalThis.fetch = oldFetch
  }
  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, '/api/community/publications/github')
  assert.equal(calls[0].options.method, 'POST')
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    app_id: 42,
    repository_name: 'pocket-list',
    confirm_source_public: true,
    public_identity: 'github',
  })
  assert.match(calls[0].options.headers['Idempotency-Key'], /^store:publish-local:/)
  assert.match(publisherSource, /want this exact source revision to become public/)
  assert.match(publisherSource, /onPublishLocal/)
  assert.match(publisherSource, /app\.icon_url/)
  assert.doesNotMatch(publisherSource, /\/api\/apps\/\$\{app\.id\}\/icon/)
  assert.doesNotMatch(publisherSource, /Return here with the repository and exact commit/)
  assert.equal(
    publisherSource.match(/onClick=\{\(\) => onOpenContributions\?\.\(\)\}/g)?.length,
    2,
    'Contribute buttons must not forward click events as local app ids',
  )
})

test('publish identity prompt sends the owner to Möbius · You instead of a dead label', async () => {
  const publisherSource = await readFile(join(root, '..', 'ui', 'PublisherTab.jsx'), 'utf8')
  assert.doesNotMatch(publisherSource, /Link identity/)
  assert.doesNotMatch(publisherSource, /Link a Möbius identity before publishing/)
  assert.match(publisherSource, /Log in to Möbius · You/)
  assert.match(publisherSource, /onLogInToMobiusYou\?\.\(\)/)
})

test('hosted Spotlight reads and publishes an ordered app-and-artwork feed', async () => {
  const { loadEditorialSpotlight, publishEditorialSpotlight } = await bundle()
  const oldFetch = globalThis.fetch
  const calls = []
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url, options })
    return new Response(JSON.stringify({ revision: 2, items: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  try {
    await loadEditorialSpotlight('owner-token')
    await publishEditorialSpotlight('owner-token', [
      { app_id: 'voice', artwork_asset: 'a'.repeat(64) + '.webp' },
      { app_id: 'maps', artwork_asset: null },
    ])
  } finally {
    globalThis.fetch = oldFetch
  }
  assert.equal(calls[0].url, '/api/community/editorial/spotlight')
  assert.equal(calls[1].url, '/api/community/editorial/spotlight')
  assert.equal(calls[1].options.method, 'PUT')
  assert.deepEqual(JSON.parse(calls[1].options.body), { items: [
    { app_id: 'voice', artwork_asset: 'a'.repeat(64) + '.webp' },
    { app_id: 'maps', artwork_asset: null },
  ] })
  assert.match(calls[1].options.headers['Idempotency-Key'], /^store:editorial-feed:/)
})

test('publisher preview accepts only the latest app after back navigation', async () => {
  const { createPublicationPreviewGate } = await bundle()
  const publisherSource = await readFile(join(root, '..', 'ui', 'PublisherTab.jsx'), 'utf8')
  const gate = createPublicationPreviewGate()
  const accepted = []
  let finishFirst
  let finishSecond
  const first = new Promise((resolve) => { finishFirst = resolve })
  const second = new Promise((resolve) => { finishSecond = resolve })

  async function prepare(label, result) {
    const requestId = gate.begin()
    const preview = await result
    if (gate.isCurrent(requestId)) accepted.push({ label, preview })
  }

  const firstRun = prepare('first app', first)
  gate.invalidate() // The owner navigates back while the first preview is pending.
  const secondRun = prepare('second app', second)
  finishSecond({ name: 'Second listing' })
  await secondRun
  finishFirst({ name: 'First listing' })
  await firstRun

  assert.deepEqual(accepted, [{
    label: 'second app',
    preview: { name: 'Second listing' },
  }])
  const requests = publisherSource.match(/const requestId = previewGateRef\.current\.begin\(\)/g)?.length || 0
  assert.ok(requests >= 1)
  assert.equal(
    publisherSource.match(/if \(!previewGateRef\.current\.isCurrent\(requestId\)\) return/g)?.length,
    requests * 2,
    'both fulfilled and rejected stale previews must be ignored for every request',
  )
  assert.match(publisherSource, /function closePreview[\s\S]*previewGateRef\.current\.invalidate\(\)/)
})

test('the centered Store header preserves the full desktop brand rail', async () => {
  const source = await readFile(join(root, '..', 'theme.js'), 'utf8')
  assert.match(
    source,
    /grid-template-columns: minmax\(120px, 1fr\) minmax\(320px, 560px\) minmax\(120px, 1fr\)/,
  )
  assert.match(source, /\.st-header \{ width: min\(100%, 1120px\); margin-inline: auto; \}/)
})

test('agent productivity apps share a dedicated discovery collection', async () => {
  const catalog = JSON.parse(await readFile(join(root, '..', 'catalog.json'), 'utf8'))
  for (const id of ['skills', 'tasks']) {
    const entry = catalog.apps.find((item) => item.id === id)
    assert.equal(entry.collection, 'productivity')
    assert.ok(entry.categories.includes('productivity'))
  }
})

test('publisher lifecycle records bind back to their local app', async () => {
  const { communityPublicationsByLocalApp } = await bundle()
  const states = communityPublicationsByLocalApp({ items: [{
    id: 'publication_public_1',
    local_app_id: 'app:41:shared-notes',
    status: 'checking',
    repository_url: 'https://github.com/example/shared-notes',
  }] })
  assert.equal(states[41].status, 'checking')
  assert.equal(states[41].repository_url, 'https://github.com/example/shared-notes')
})

test('catalog app intents preserve origin checks and resolve one safe action', async () => {
  const {
    catalogItemIdFromIntent,
    catalogItemIdFromMessage,
    resolveCatalogItemIntent,
  } = await import(
    pathToFileURL(join(root, '..', 'domain.js'))
  )

  assert.equal(catalogItemIdFromIntent('app:voice'), 'voice')
  assert.equal(catalogItemIdFromIntent('  app:NEWS  '), 'news')
  assert.equal(catalogItemIdFromIntent('setup'), null)
  assert.equal(catalogItemIdFromIntent('app:../voice'), null)
  assert.equal(catalogItemIdFromIntent(null), null)

  const parent = {}
  const message = {
    origin: 'https://mobius.test',
    source: parent,
    data: { type: 'moebius:app-intent', intent: 'app:voice' },
  }
  assert.equal(catalogItemIdFromMessage(message, 'https://mobius.test', parent), 'voice')
  assert.equal(catalogItemIdFromMessage(
    { ...message, origin: 'https://attacker.test' },
    'https://mobius.test',
    parent,
  ), null)
  assert.equal(catalogItemIdFromMessage(
    { ...message, source: {} },
    'https://mobius.test',
    parent,
  ), null)
  assert.equal(catalogItemIdFromMessage(
    { ...message, data: { type: 'unrelated', intent: 'app:voice' } },
    'https://mobius.test',
    parent,
  ), null)

  const voice = { id: 'voice', name: 'Voice', manifest: { id: 'voice' } }
  assert.deepEqual(resolveCatalogItemIntent([voice], 'voice'), {
    action: 'open',
    item: voice,
  })
  assert.deepEqual(resolveCatalogItemIntent([{ id: 'maps', name: 'Maps' }], 'maps'), {
    action: 'needs-connection',
    item: { id: 'maps', name: 'Maps' },
    query: 'Maps',
    toast: {
      kind: 'info',
      message: 'Maps needs a connection before its details can load.',
    },
  })
  assert.deepEqual(resolveCatalogItemIntent([], 'missing'), {
    action: 'unavailable',
    toast: { kind: 'error', message: 'That app is not available in this catalog.' },
  })
})

test('live catalog metadata preserves baked snapshots and appends new entries', async () => {
  const { mergeCatalogEntries } = await bundle()
  const bakedManifest = { id: 'notes', version: '1.2.3' }
  const merged = mergeCatalogEntries([
    { id: 'notes', summary: 'Old copy', manifest: bakedManifest },
  ], [
    { id: 'notes', summary: 'Fresh copy' },
    { id: 'new-app', summary: 'New app' },
  ])

  assert.deepEqual(merged, [
    { id: 'notes', summary: 'Fresh copy', manifest: bakedManifest },
    { id: 'new-app', summary: 'New app' },
  ])
})

test('openInstalledApp has one options contract for intent and fallback', async () => {
  const { openInstalledApp } = await import(pathToFileURL(join(root, '..', 'api.js')))
  const oldWindow = globalThis.window
  try {
    const messages = []
    const parent = { postMessage: (...args) => messages.push(args) }
    globalThis.window = { parent, location: { origin: 'https://mobius.test' } }
    openInstalledApp(34, { intent: 'setup' })
    assert.deepEqual(messages, [[
      { type: 'moebius:open-app', appId: 34, intent: 'setup' },
      'https://mobius.test',
    ]])

    let fellBack = false
    globalThis.window = { location: { origin: 'https://mobius.test' } }
    globalThis.window.parent = globalThis.window
    openInstalledApp(34, { onUnembedded: () => { fellBack = true } })
    assert.equal(fellBack, true)
  } finally {
    globalThis.window = oldWindow
  }
})

test('published apps outside the catalog stay usable and updatable without false provenance', async () => {
  const {
    appLifecycleFor,
    otherInstalledCatalogItems,
    sourceBackedInstalledApps,
  } = await bundle()
  const linked = {
    id: 34,
    name: 'Linked App',
    description: 'Installed from a shared source.',
    version: '1.1.2',
    manifest_url: 'https://example.test/apps/linked#manifest-id=linked-app',
    source_manifest: {
      id: 'linked-app',
      url: 'https://example.test/apps/linked/mobius.json',
    },
  }
  const curated = {
    id: 8,
    name: 'Notes',
    manifest_url: 'https://raw.githubusercontent.com/mobius-os/app-notes/main#manifest-id=notes',
    source_manifest: {
      id: 'notes',
      url: 'https://raw.githubusercontent.com/mobius-os/app-notes/main/mobius.json',
    },
  }
  const catalog = [{
    id: 'notes',
    manifest_url: 'https://raw.githubusercontent.com/mobius-os/app-notes/main/mobius.json',
    manifest: { id: 'notes' },
  }]

  assert.deepEqual(otherInstalledCatalogItems([linked, curated], catalog), [{
    id: 'other-installed-34',
    source_manifest: {
      id: 'linked-app',
      url: 'https://example.test/apps/linked/mobius.json',
    },
    collection: 'other-installed',
    manifest_url: 'https://example.test/apps/linked/mobius.json',
    raw_base: 'https://example.test/apps/linked/',
    name: 'Linked App',
    manifest: {
      id: 'linked-app',
      name: 'Linked App',
      version: '1.1.2',
      description: 'Installed from a shared source.',
    },
    error: null,
  }])
  assert.deepEqual(otherInstalledCatalogItems([{ id: 99, source_manifest: null }], []), [])
  assert.deepEqual(sourceBackedInstalledApps([linked, { id: 99 }], {
    excludeAppIds: ['34'],
  }), [])
  assert.deepEqual(otherInstalledCatalogItems([linked], [], {
    // App ids arrive from the route as text while installed rows use numbers.
    excludeAppIds: ['34'],
  }), [])

  const hydrated = {
    ...otherInstalledCatalogItems([linked], [])[0],
    manifest: { id: 'linked-app', name: 'Linked App', version: '1.1.3' },
  }
  const lifecycle = appLifecycleFor(hydrated, {
    installed: [linked],
    updateChecks: { 34: { available: true, pendingUpdateState: 'none' } },
  })
  assert.equal(lifecycle.key, 'update')
  assert.equal(lifecycle.actionKind, 'update')

  const unavailable = appLifecycleFor(otherInstalledCatalogItems([linked], [])[0], {
    installed: [linked],
    updateChecks: { 34: { available: null, pendingUpdateState: 'none' } },
  })
  assert.equal(unavailable.key, 'unverified')
  assert.equal(unavailable.actionKind, 'open')

  const renamedManifest = {
    ...hydrated,
    manifest: { ...hydrated.manifest, id: 'linked-app-next' },
  }
  assert.equal(appLifecycleFor(renamedManifest, {
    installed: [linked],
    updateChecks: { 34: { available: true, pendingUpdateState: 'none' } },
  }).key, 'update')
})

test('findInstalled matches canonical manifest identity, not slug', async () => {
  const { findInstalled } = await bundle()
  const installed = [
    {
      id: 55,
      slug: 'cuberun-2',
      name: 'CubeRun',
      manifest_url: 'https://raw.githubusercontent.com/mobius-os/app-cuberun/main#manifest-id=cuberun',
      version: '1.0.0-mobius.4',
    },
  ]
  const item = {
    id: 'cuberun',
    manifest_url: 'https://raw.githubusercontent.com/mobius-os/app-cuberun/main/mobius.json',
    manifest: { id: 'cuberun' },
  }

  assert.equal(findInstalled(installed, item), installed[0])
})

test('findInstalled matches a verified local publication identity', async () => {
  const { findInstalled } = await bundle()
  const installed = [{
    id: 119,
    slug: 'common',
    manifest_url: null,
    source_manifest: null,
    distribution_manifest: {
      id: 'social',
      url: 'https://raw.githubusercontent.com/mobius-os/app-social/main/mobius.json',
      kind: 'published',
    },
  }]
  const item = {
    id: 'social',
    manifest_url: 'https://raw.githubusercontent.com/mobius-os/app-social/main/mobius.json',
    manifest: { id: 'social' },
    repository: 'mobius-os/app-social',
  }

  assert.equal(findInstalled(installed, item), installed[0])
})

test('findInstalled treats trusted catalog commit pins as the same installed app', async () => {
  const { findInstalled } = await bundle()
  const pinned = {
    id: 7,
    slug: 'memory',
    manifest_url: 'https://raw.githubusercontent.com/mobius-os/app-memory/0123456789abcdef0123456789abcdef01234567#manifest-id=memory',
    version: '1.0.0',
  }
  const catalogItem = {
    id: 'memory',
    manifest_url: 'https://raw.githubusercontent.com/mobius-os/app-memory/main/mobius.json',
    manifest: { id: 'memory' },
  }

  assert.equal(findInstalled([pinned], catalogItem), pinned)
  assert.equal(findInstalled([{
    ...pinned,
    manifest_url: 'https://raw.githubusercontent.com/mobius-os/app-reflection/main#manifest-id=memory',
  }], catalogItem), null)
  assert.equal(findInstalled([{
    ...pinned,
    manifest_url: 'https://raw.githubusercontent.com/mobius-os/app-memory/main/examples#manifest-id=memory',
  }], catalogItem), null)
})

test('update candidate URLs match installed apps and keep the first catalog source', async () => {
  const { updateCandidateUrlsByInstalledId } = await bundle()
  const installed = [{
    id: 7,
    slug: 'memory',
    manifest_url: 'https://raw.githubusercontent.com/mobius-os/app-memory/0123456789abcdef0123456789abcdef01234567#manifest-id=memory',
  }]
  const unrelated = {
    id: 'reflection',
    manifest_url: 'https://raw.githubusercontent.com/mobius-os/app-reflection/main/mobius.json',
    manifest: { id: 'reflection' },
  }
  const preferred = {
    id: 'memory',
    manifest_url: 'https://raw.githubusercontent.com/mobius-os/app-memory/main/mobius.json',
    manifest: { id: 'memory' },
  }
  const duplicate = {
    ...preferred,
    manifest_url: 'https://raw.githubusercontent.com/mobius-os/app-memory/next/mobius.json',
  }

  assert.deepEqual(updateCandidateUrlsByInstalledId(installed, [unrelated]), {})
  assert.deepEqual(
    updateCandidateUrlsByInstalledId(installed, [unrelated, preferred, duplicate]),
    { 7: preferred.manifest_url },
  )
})

test('findInstalled matches a trusted mobius-os app across any manifest-id skew', async () => {
  const { findInstalled } = await bundle()
  const installedRow = {
    id: 102,
    slug: 'subagents',
    manifest_url: 'https://raw.githubusercontent.com/mobius-os/app-subagents/main#manifest-id=subagents',
    version: '0.4.1',
  }

  // A stale baked snapshot still advertises the pre-rename id `codex` because
  // the live manifest refresh has not landed. The installed row already carries
  // the renamed id `subagents`. Repo identity matches regardless of the skew, so
  // the app is not mislabeled "Not installed" and is not duplicated.
  const staleSnapshotItem = {
    id: 'subagents',
    manifest_url: 'https://raw.githubusercontent.com/mobius-os/app-subagents/main/mobius.json',
    manifest: { id: 'codex', version: '0.4.1' },
  }
  assert.equal(findInstalled([installedRow], staleSnapshotItem), installedRow)

  // The reverse skew is symmetric: a pre-rename installed row (`codex`) matches
  // a catalog entry advertising the renamed id.
  const legacyRow = {
    ...installedRow,
    manifest_url: 'https://raw.githubusercontent.com/mobius-os/app-subagents/main#manifest-id=codex',
  }
  const renamedItem = {
    id: 'subagents',
    manifest_url: 'https://raw.githubusercontent.com/mobius-os/app-subagents/main/mobius.json',
    manifest: { id: 'subagents' },
  }
  assert.equal(findInstalled([legacyRow], renamedItem), legacyRow)

  // Repo-scoped: the same manifest-id string in a different mobius-os repo is a
  // different app and must never be adopted.
  const foreignRow = {
    ...installedRow,
    manifest_url: 'https://raw.githubusercontent.com/mobius-os/app-other/main#manifest-id=subagents',
  }
  assert.equal(findInstalled([foreignRow], renamedItem), null)
})

test('findInstalled follows an explicit package and repository rename', async () => {
  const { findInstalled } = await bundle()
  const installed = {
    id: 88,
    slug: 'artifacts',
    manifest_url: 'https://raw.githubusercontent.com/mobius-os/app-artifacts/main#manifest-id=artifacts',
    version: '0.6.4',
  }
  const renamed = {
    id: 'pages',
    repository: 'mobius-os/app-pages',
    manifest_url: 'https://raw.githubusercontent.com/mobius-os/app-pages/main/mobius.json',
    manifest: {
      id: 'pages',
      previous_id: 'artifacts',
      previous_manifest_url: 'https://raw.githubusercontent.com/mobius-os/app-artifacts/main/mobius.json',
    },
  }

  assert.equal(findInstalled([installed], renamed), installed)
  assert.equal(findInstalled([{
    ...installed,
    manifest_url: 'https://raw.githubusercontent.com/someone-else/app-artifacts/main#manifest-id=artifacts',
  }], renamed), null)
})

test('catalog predecessor repositories update the existing app through its trusted source', async () => {
  const { catalogUpdateItemForInstalled, findInstalled } = await bundle()
  const installed = {
    id: 9,
    slug: 'common',
    manifest_url: 'https://raw.githubusercontent.com/hamzamerzic/app-social/e729622a3df49f21fa6b2e54bc912e2013c926bc#manifest-id=common',
    version: '0.1.1',
  }
  const catalogItem = {
    id: 'social',
    repository: 'mobius-os/app-social',
    manifest_url: 'https://raw.githubusercontent.com/mobius-os/app-social/main/mobius.json',
    previous_repositories: ['hamzamerzic/app-social'],
    manifest: { id: 'social', previous_id: 'common', version: '0.3.0' },
  }

  assert.equal(findInstalled([installed], catalogItem), installed)
  assert.deepEqual(catalogUpdateItemForInstalled(catalogItem, installed), {
    ...catalogItem,
    manifest_url: 'https://raw.githubusercontent.com/hamzamerzic/app-social/main/mobius.json',
    raw_base: 'https://raw.githubusercontent.com/hamzamerzic/app-social/main',
  })
})

test('immutable package identity advances a staged repository handoff', async () => {
  const { catalogUpdateItemForInstalled, findInstalled } = await bundle()
  const packageId = 'urn:uuid:5130825e-905c-4527-8ad0-4bdd2a7357c0'
  const installed = {
    id: 7,
    slug: 'kanban',
    manifest_url: 'https://raw.githubusercontent.com/hamzamerzic/app-kanban/main#manifest-id=kanban',
  }
  const catalogItem = {
    id: 'kanban',
    manifest_url: 'https://raw.githubusercontent.com/mobius-os/app-kanban/main/mobius.json',
    raw_base: 'https://raw.githubusercontent.com/mobius-os/app-kanban/main/',
    previous_repositories: ['hamzamerzic/app-kanban'],
    manifest: { id: 'kanban', package_id: packageId },
  }

  assert.equal(findInstalled([installed], catalogItem), installed)
  assert.equal(
    catalogUpdateItemForInstalled(catalogItem, installed).manifest_url,
    'https://raw.githubusercontent.com/hamzamerzic/app-kanban/main/mobius.json',
  )

  const stamped = { ...installed, package_id: packageId }
  assert.equal(findInstalled([stamped], catalogItem), stamped)
  assert.equal(catalogUpdateItemForInstalled(catalogItem, stamped), catalogItem)
  assert.equal(findInstalled([stamped], {
    ...catalogItem,
    package_id: 'app.unreviewed.catalog-claim',
  }), stamped)
})

test('catalog predecessor metadata cannot redirect an unrelated install', async () => {
  const { catalogUpdateItemForInstalled, findInstalled } = await bundle()
  const installed = {
    id: 9,
    slug: 'common',
    manifest_url: 'https://raw.githubusercontent.com/someone-else/app-social/main#manifest-id=common',
  }
  const catalogItem = {
    id: 'common',
    repository: 'mobius-os/app-social',
    manifest_url: 'https://raw.githubusercontent.com/mobius-os/app-social/main/mobius.json',
    previous_repositories: ['hamzamerzic/app-social'],
    manifest: { id: 'common' },
  }

  assert.equal(findInstalled([installed], catalogItem), null)
  assert.equal(catalogUpdateItemForInstalled(catalogItem, installed), catalogItem)
})

test('otherInstalledCatalogItems does not duplicate a curated app under id skew', async () => {
  const { otherInstalledCatalogItems } = await bundle()
  // The installed row carries the renamed id and a source_manifest, so it is a
  // candidate for an "other installed" card. The curated catalog entry still
  // shows the stale pre-rename snapshot id. It must still be recognized as
  // represented by the catalog, so no second card is emitted for it.
  const installed = [{
    id: 102,
    slug: 'subagents',
    name: 'Subagents',
    manifest_url: 'https://raw.githubusercontent.com/mobius-os/app-subagents/main#manifest-id=subagents',
    source_manifest: {
      id: 'subagents',
      url: 'https://raw.githubusercontent.com/mobius-os/app-subagents/main/mobius.json',
    },
    version: '0.4.1',
  }]
  const catalog = [{
    id: 'subagents',
    manifest_url: 'https://raw.githubusercontent.com/mobius-os/app-subagents/main/mobius.json',
    manifest: { id: 'codex', version: '0.4.1' },
  }]

  assert.deepEqual(otherInstalledCatalogItems(installed, catalog), [])
})

test('otherInstalledCatalogItems does not duplicate a live community listing', async () => {
  const { otherInstalledCatalogItems } = await bundle()
  const source = await readFile(join(root, '..', 'index.jsx'), 'utf8')
  const installed = [{
    id: 119,
    slug: 'common',
    name: 'Social',
    manifest_url: 'https://raw.githubusercontent.com/mobius-os/app-social/main#manifest-id=social',
    source_manifest: {
      id: 'social',
      url: 'https://raw.githubusercontent.com/mobius-os/app-social/main/mobius.json',
    },
    version: '1.0.0',
  }]
  const communityCatalog = [{
    id: 'community:app_social',
    collection: 'community',
    manifest_url: 'https://raw.githubusercontent.com/mobius-os/app-social/main/mobius.json',
    manifest: { id: 'social', name: 'Social', version: '1.0.0' },
    community: { id: 'app_social', revision_id: 'revision_social' },
  }]

  assert.deepEqual(otherInstalledCatalogItems(installed, communityCatalog), [])
  assert.match(source, /otherInstalledCatalogItems\(installed, listedCatalog/)
})

test('installed catalog apps refresh their live manifest for update detection', async () => {
  const { needsLiveManifestFirst } = await bundle()
  const item = {
    id: 'beat-machine',
    manifest_url: 'https://raw.githubusercontent.com/mobius-os/app-beat-machine/main/mobius.json',
    manifest: { id: 'beat-machine', version: '1.0.16' },
  }
  const installed = [{
    id: 55,
    manifest_url: 'https://raw.githubusercontent.com/mobius-os/app-beat-machine/main#manifest-id=beat-machine',
    version: '1.0.14',
  }]

  assert.equal(needsLiveManifestFirst(item, installed), true)
  assert.equal(needsLiveManifestFirst(item, []), false)
  assert.equal(needsLiveManifestFirst({ ...item, manifest: null }, []), true)
})

test('only the bundled snapshot object counts as a cached manifest', async () => {
  // Import the source modules directly: identity only holds within one module graph.
  const { showsSnapshotManifest } = await import(pathToFileURL(join(root, '..', 'domain.js')))
  const { MANIFEST_SNAPSHOTS } = await import(pathToFileURL(join(root, '..', 'manifest-snapshots.js')))
  const snapshot = MANIFEST_SNAPSHOTS.voice
  assert.equal(showsSnapshotManifest({ id: 'voice', manifest: snapshot }), true)
  assert.equal(showsSnapshotManifest({ id: 'voice', manifest: { ...snapshot } }), false,
    'a live read with identical content is no longer the placeholder')
  assert.equal(showsSnapshotManifest({ id: 'voice', manifest: null }), false)
  assert.equal(showsSnapshotManifest({ id: 'community:voice', manifest: snapshot }), false)
})

test('appIcon paints installed icons directly and keeps remote icons as discovery fallback', async () => {
  const { appIcon } = await bundle()
  const catalogItem = {
    raw_base: 'https://raw.githubusercontent.com/mobius-os/app-notes/main/',
    manifest: { icon: 'icon.png' },
  }

  assert.deepEqual(appIcon({
    ...catalogItem,
    installed_icon_url: '/api/apps/66/icon?size=128',
  }), {
    url: '/api/apps/66/icon?size=128',
    external: false,
  })
  assert.deepEqual(appIcon(catalogItem), {
    url: 'https://raw.githubusercontent.com/mobius-os/app-notes/main/icon.png',
    external: true,
  })
})

test('findInstalled ignores legacy platform rows without canonical identity', async () => {
  const { findInstalled } = await bundle()
  const memory = {
    id: 9,
    slug: 'memory',
    name: 'Memory',
    manifest_url: null,
    source_dir: '/data/platform/core-apps/memory',
    version: '1.6.3',
  }
  const custom = {
    id: 10,
    slug: 'notes',
    name: 'Notes',
    manifest_url: null,
    source_dir: '/data/platform/core-apps/notes',
    version: '0.1.0',
  }

  assert.equal(findInstalled([memory], {
    id: 'memory',
    manifest_url: 'https://raw.githubusercontent.com/mobius-os/app-memory/main/mobius.json',
    manifest: { id: 'memory' },
  }), null)
  assert.equal(findInstalled([custom], {
    id: 'notes',
    manifest_url: 'https://raw.githubusercontent.com/mobius-os/app-notes/main/mobius.json',
    manifest: { id: 'notes' },
  }), null)
})

test('findInstalled rejects a catalog item without canonical source identity', async () => {
  const { findInstalled } = await bundle()
  const installed = [{
    id: 11,
    slug: 'notes',
    manifest_url: 'https://raw.githubusercontent.com/mobius-os/app-notes/main#manifest-id=notes',
  }]

  assert.equal(findInstalled(installed, {
    id: '',
    manifest_url: null,
    manifest: null,
  }), null)
  assert.equal(findInstalled(installed, {
    id: 'notes',
    manifest_url: 'https://raw.githubusercontent.com/mobius-os/app-notes/main/mobius.json',
    manifest: { id: 'notes' },
  }), installed[0])
})

test('validateManifestUrl only accepts http(s) manifest URLs', async () => {
  const { validateManifestUrl } = await bundle()

  assert.equal(validateManifestUrl(' https://example.test/mobius.json '), 'https://example.test/mobius.json')
  assert.equal(validateManifestUrl('http://localhost:3000/mobius.json'), 'http://localhost:3000/mobius.json')
  assert.throws(() => validateManifestUrl('file:///tmp/mobius.json'), /http/)
  assert.throws(() => validateManifestUrl('/mobius.json'), /valid/)
})

test('fetchManifest retries transient manifest failures', async () => {
  const oldFetch = globalThis.fetch
  let calls = 0
  globalThis.fetch = async (_url, _opts) => {
    calls += 1
    if (calls === 1) {
      return new Response('temporarily unavailable', { status: 503 })
    }
    return new Response(JSON.stringify({ id: 'notes', version: '1.0.0' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }
  try {
    const { fetchManifest } = await bundle()
    const manifest = await fetchManifest('https://example.test/mobius.json', 'tok', {
      retries: 1,
      retryDelayMs: 0,
    })
    assert.equal(calls, 2)
    assert.deepEqual(manifest, { id: 'notes', version: '1.0.0' })
  } finally {
    globalThis.fetch = oldFetch
  }
})

test('fetchManifest retries transient network errors with a friendly message', async () => {
  const oldFetch = globalThis.fetch
  let calls = 0
  globalThis.fetch = async (_url, _opts) => {
    calls += 1
    if (calls === 1) throw new TypeError('Failed to fetch')
    return new Response(JSON.stringify({ id: 'notes', version: '1.0.0' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }
  try {
    const { fetchManifest } = await bundle()
    const manifest = await fetchManifest('https://example.test/mobius.json', 'tok', {
      retries: 1,
      retryDelayMs: 0,
    })
    assert.equal(calls, 2)
    assert.deepEqual(manifest, { id: 'notes', version: '1.0.0' })
  } finally {
    globalThis.fetch = oldFetch
  }
})

test('fetchManifest does not rapidly retry upstream rate limits', async () => {
  const oldFetch = globalThis.fetch
  let calls = 0
  globalThis.fetch = async (_url, _opts) => {
    calls += 1
    return new Response('rate limited', {
      status: 429,
      headers: { 'retry-after': '60' },
    })
  }
  try {
    const { fetchManifest } = await bundle()
    await assert.rejects(
      () => fetchManifest('https://raw.githubusercontent.com/mobius-os/app-notes/main/mobius.json', 'tok', {
        retries: 2,
        retryDelayMs: 0,
      }),
      /GitHub rate-limited.*60 seconds/,
    )
    assert.equal(calls, 1)
  } finally {
    globalThis.fetch = oldFetch
  }
})

test('readErrorDetail handles non-JSON update errors without rereading the body', async () => {
  const { readErrorDetail } = await bundle()
  const response = new Response('upstream returned an invalid manifest', { status: 502 })

  assert.equal(
    await readErrorDetail(response, 'Update failed'),
    'upstream returned an invalid manifest',
  )
})

test('readErrorDetail formats FastAPI validation payloads', async () => {
  const { readErrorDetail } = await bundle()
  const response = new Response(JSON.stringify({
    detail: [{ loc: ['body', 'manifest_url'], msg: 'Field required' }],
  }), {
    status: 422,
    headers: { 'content-type': 'application/json' },
  })

  assert.equal(
    await readErrorDetail(response, 'Update failed'),
    'body.manifest_url: Field required',
  )
})

test('a not-ready listing opens one agent brief that fixes it without publishing', async () => {
  const { buildListingAgentMessage } = await bundle()
  const app = { id: 7, name: 'Scorekeeper', slug: 'scorekeeper', source_dir: '/data/apps/scorekeeper' }
  const brief = buildListingAgentMessage({
    app,
    problem: 'Add a Store listing with a tagline, description, and screenshots before publishing.',
  })
  assert.match(brief, /cannot publish Scorekeeper yet/)
  assert.match(brief, /Add a Store listing with a tagline/)
  assert.match(brief, /\/data\/apps\/scorekeeper/)
  assert.match(brief, /"Store listing" in \/data\/shared\/skills\/building-apps\.md/)
  assert.match(brief, /preview\?app_id=7/)
  assert.match(brief, /never the owner's own data/)
  assert.match(brief, /Do not publish/)

  const revise = buildListingAgentMessage({ app, problem: '' })
  assert.match(revise, /wants to revise the App Store listing of Scorekeeper/)
})

test('a checklist item hands an agent just that part of the listing', async () => {
  const { buildListingAgentMessage } = await bundle()
  const app = { id: 7, name: 'Scorekeeper', slug: 'scorekeeper', source_dir: '/data/apps/scorekeeper' }
  const brief = buildListingAgentMessage({ app, problem: '', focus: 'screenshots' })
  assert.match(brief, /one part of the App Store listing of Scorekeeper/)
  assert.match(brief, /1–5 truthful screenshots/)
  assert.match(brief, /keep what the owner already wrote/)
  assert.match(brief, /Do not publish/)
  const details = buildListingAgentMessage({ app, problem: '', focus: 'details' })
  assert.match(details, /Inspect the app source/)
  assert.match(details, /If it has a scheduled job/)
  assert.doesNotMatch(details, /It is an older app that runs a scheduled job/)
})

test('chosen listing image previews need no object URL lifetime', async () => {
  const { prepareListingImage } = await import('../api.js')
  const oldReader = globalThis.FileReader
  const oldBitmap = globalThis.createImageBitmap
  let closed = false
  globalThis.FileReader = class {
    readAsDataURL(file) {
      this.result = `data:${file.type};base64,QUJD`
      this.onload()
    }
  }
  globalThis.createImageBitmap = async () => ({
    width: 10, height: 10, close() { closed = true },
  })
  try {
    assert.deepEqual(await prepareListingImage({ size: 3, type: 'image/png' }), {
      data: 'QUJD', url: 'data:image/png;base64,QUJD',
    })
    assert.equal(closed, true)
  } finally {
    globalThis.FileReader = oldReader
    globalThis.createImageBitmap = oldBitmap
  }
})

test('an edited listing saves as one whole listing, keeping unchanged images by path', async () => {
  const { listingDraftFromPreview, listingPayload } = await bundle()
  const preview = {
    asset_root: '/api/x/',
    draft: {
      tagline: ' Small. ', description: 'Calm.', icon: 'icon.png', hero: 'static/store/h.png',
      screenshots: [{ src: 'static/store/a.png', alt: 'A', label: '' }, { src: '', alt: 'gone', label: '' }],
    },
  }
  const draft = listingDraftFromPreview(preview, { icon_url: '/icon' })
  assert.equal(draft.icon.url, '/api/x/icon.png')
  assert.equal(draft.screenshots[0].url, '/api/x/static/store/a.png')
  const unchanged = listingPayload(draft)
  assert.deepEqual(unchanged, {
    tagline: 'Small.', description: 'Calm.',
    hero: { path: 'static/store/h.png' },
    screenshots: [{ path: 'static/store/a.png', alt: 'A' }],
  })
  const edited = listingPayload({
    ...draft, iconChanged: true, icon: { data: 'ICON', url: 'blob:1' }, hero: null,
    screenshots: [...draft.screenshots, { key: 'n', data: 'SHOT', url: 'blob:2', alt: ' New ', label: 'Cap' }],
  })
  assert.deepEqual(edited.icon, { data_base64: 'ICON' })
  assert.equal(edited.hero, null)
  assert.deepEqual(edited.screenshots[1], { data_base64: 'SHOT', alt: 'New', label: 'Cap' })
  const legacy = listingDraftFromPreview({ draft: { screenshots: [] } }, { icon_url: '/icon' })
  assert.equal(legacy.icon.url, '/icon')
  assert.equal(listingPayload(legacy).icon, undefined)
})

test('the publish review lets the owner fill in the listing by hand', async () => {
  const source = await readFile(join(root, '..', 'ui', 'PublisherTab.jsx'), 'utf8')
  const editor = await readFile(join(root, '..', 'ui', 'ListingEditor.jsx'), 'utf8')
  assert.match(source, /<ListingChecklist/)
  assert.match(source, /<ListingEditor/)
  assert.match(source, /Edit listing/)
  assert.match(editor, /Save listing/)
  assert.match(editor, /Ask an agent/)
  assert.match(editor, /Do it all with an agent/)
  assert.match(editor, /not your own/)
})

test('editing and accepting a new listing revision invalidate publish consent', async () => {
  const source = await readFile(join(root, '..', 'ui', 'PublisherTab.jsx'), 'utf8')
  const showPreview = source.slice(source.indexOf('function showPreview('), source.indexOf('async function prepare('))
  const saveListing = source.slice(source.indexOf('async function saveListing('), source.indexOf('function closePreview('))
  assert.match(showPreview, /setConfirmed\(false\)/)
  assert.match(saveListing, /setConfirmed\(false\)/)
  assert.match(source, /onClick=\{\(\) => \{ setConfirmed\(false\); setEditing\(true\) \}\}/)
  assert.match(source, /const publishDisabled = !confirmed \|\| !localRepositoryValid/)
  assert.equal(source.match(/disabled=\{publishDisabled\}/g)?.length, 2, 'Publish and Publish anyway both need consent')
})

test('a late image preparation cannot change a different listing draft', async () => {
  const source = await readFile(join(root, '..', 'ui', 'PublisherTab.jsx'), 'utf8')
  const editor = await readFile(join(root, '..', 'ui', 'ListingEditor.jsx'), 'utf8')
  // The editor remounts (ending any pending pick) for another app or a full
  // reload; an agent's part merging into the same draft does not remount it.
  assert.match(source, /key=\{`\$\{candidate\.id\}:\$\{editorEpoch\}`\}/)
  assert.match(source, /function showPreview\([^)]*\) \{[\s\S]*?setEditorEpoch\(\(epoch\) => epoch \+ 1\)[\s\S]*?\n  \}/)
  assert.match(editor, /useEffect\(\(\) => \(\) => \{ pickSession\.current \+= 1 \}, \[\]\)/)
  assert.match(editor, /const session = pickSession\.current/)
  assert.match(editor, /if \(session === pickSession\.current\) apply\(image\)/)
})

test('the publish review offers a way forward instead of a dead end', async () => {
  const source = await readFile(join(root, '..', 'ui', 'PublisherTab.jsx'), 'utf8')
  assert.match(source, /This app isn’t ready to publish yet/)
  assert.match(source, /Get it ready with an agent/)
  assert.match(source, /Revise with an agent/)
  assert.doesNotMatch(source, /Finish the Store listing first/)
})

test('readErrorDetail shows a structured error as its sentence, not raw JSON', async () => {
  const { readErrorDetail } = await bundle()
  const response = new Response(JSON.stringify({
    detail: {
      code: 'listing_incomplete',
      message: 'Add a Store listing with a tagline, description, and screenshots before publishing.',
    },
  }), {
    status: 409,
    headers: { 'content-type': 'application/json' },
  })

  assert.equal(
    await readErrorDetail(response, 'This app listing could not be prepared.'),
    'Add a Store listing with a tagline, description, and screenshots before publishing.',
  )
})

test('loadInstalledApps retries transient app-list failures', async () => {
  const oldFetch = globalThis.fetch
  let calls = 0
  globalThis.fetch = async (_url, _opts) => {
    calls += 1
    if (calls === 1) {
      return new Response('temporarily unavailable', { status: 503 })
    }
    return new Response(JSON.stringify([{ id: 1, slug: 'notes' }]), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }
  try {
    const { loadInstalledApps } = await bundle()
    const apps = await loadInstalledApps('tok', { retries: 1, retryDelayMs: 0 })
    assert.equal(calls, 2)
    assert.deepEqual(apps, [{ id: 1, slug: 'notes' }])
  } finally {
    globalThis.fetch = oldFetch
  }
})

test('loadInstalledApps throws on non-retryable app-list failures', async () => {
  const oldFetch = globalThis.fetch
  let calls = 0
  globalThis.fetch = async (_url, _opts) => {
    calls += 1
    return new Response('unauthorized', { status: 401 })
  }
  try {
    const { loadInstalledApps } = await bundle()
    await assert.rejects(
      () => loadInstalledApps('tok', { retries: 2, retryDelayMs: 0 }),
      /Installed apps could not be loaded \(401\)/,
    )
    assert.equal(calls, 1)
  } finally {
    globalThis.fetch = oldFetch
  }
})

test('fetchCatalog retries transient failures and preserves app metadata', async () => {
  const oldFetch = globalThis.fetch
  let calls = 0
  globalThis.fetch = async (_url, _opts) => {
    calls += 1
    if (calls === 1) {
      return new Response('temporarily unavailable', { status: 503 })
    }
    return new Response(JSON.stringify({
    schema: 1,
    apps: [
      {
        id: 'notes',
        audience: 'general',
        collection: 'everyday',
        summary: 'Capture notes without losing your train of thought.',
        repo: 'mobius-os/app-notes',
        manifest_url: 'https://raw.githubusercontent.com/mobius-os/app-notes/main/mobius.json',
        raw_base: 'https://raw.githubusercontent.com/mobius-os/app-notes/main/',
        categories: ['productivity', 'writing', 'writing'],
        keywords: ['notes', 'markdown'],
        capabilities: ['write markdown notes'],
        setup: {
          required: true,
          scope: 'app',
          label: 'Notes setup',
          description: 'Configure notes.',
          fields: ['theme'],
        },
      },
      {
        id: 'bad-snapshot',
        manifest_url: 'https://raw.githubusercontent.com/mobius-os/app-bad/main/mobius.json',
        raw_base: 'https://raw.githubusercontent.com/mobius-os/app-bad/main/',
      },
    ],
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }
  try {
    const { fetchCatalog } = await bundle()
    const entries = await fetchCatalog('https://example.test/catalog.json', 'tok', {
      retries: 1,
      retryDelayMs: 0,
    })
    assert.equal(calls, 2)
    assert.equal(entries.length, 2)
    assert.equal(entries[0].audience, 'general')
    assert.equal(entries[0].collection, 'everyday')
    assert.equal(entries[0].summary, 'Capture notes without losing your train of thought.')
    assert.deepEqual(entries[0].categories, ['productivity', 'writing'])
    assert.deepEqual(entries[0].keywords, ['notes', 'markdown'])
    assert.deepEqual(entries[0].capabilities, ['write markdown notes'])
    assert.deepEqual(entries[0].setup, {
      required: true,
      scope: 'app',
      section: '',
      label: 'Notes setup',
      description: 'Configure notes.',
      action: 'Open app',
      fields: ['theme'],
    })
    assert.equal(Object.hasOwn(entries[0], 'manifest'), false)
    assert.equal(Object.hasOwn(entries[1], 'manifest'), false)
    assert.equal(Object.hasOwn(entries[1], 'audience'), false)
    assert.equal(Object.hasOwn(entries[1], 'collection'), false)
    assert.equal(Object.hasOwn(entries[1], 'summary'), false)
  } finally {
    globalThis.fetch = oldFetch
  }
})

test('fetchCatalog rejects pre-schema and unknown registry shapes', async () => {
  const oldFetch = globalThis.fetch
  try {
    const { fetchCatalog } = await bundle()
    for (const body of [[], { apps: [] }, { schema: 2, apps: [] }]) {
      globalThis.fetch = async () => new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
      await assert.rejects(
        () => fetchCatalog('https://example.test/catalog.json', 'tok', { retries: 0 }),
        /Catalog schema is unsupported/,
      )
    }
  } finally {
    globalThis.fetch = oldFetch
  }
})

test('installApp prefers live manifest_url over embedded manifest snapshots', async () => {
  const oldFetch = globalThis.fetch
  const bodies = []
  globalThis.fetch = async (url, opts) => {
    assert.equal(url, '/api/apps/install')
    bodies.push(JSON.parse(opts.body))
    return new Response(JSON.stringify({
      id: 12,
      slug: 'notes',
      name: 'Notes',
      version: '1.2.4',
      mode: 'update',
      divergence: 'fast_forward',
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }
  try {
    const { installApp } = await bundle()
    const result = await installApp({
      manifest_url: 'https://raw.githubusercontent.com/mobius-os/app-notes/main/mobius.json',
      manifest: { id: 'notes', name: 'Notes', version: '1.0.0', entry: 'index.jsx' },
      raw_base: 'https://raw.githubusercontent.com/mobius-os/app-notes/main/',
      token: 'tok',
    })
    assert.equal(result.version, '1.2.4')
    assert.deepEqual(bodies, [{
      manifest_url: 'https://raw.githubusercontent.com/mobius-os/app-notes/main/mobius.json',
    }])
  } finally {
    globalThis.fetch = oldFetch
  }
})

test('a reviewed update installs exactly the previewed commit of that app', async () => {
  const oldFetch = globalThis.fetch
  const bodies = []
  globalThis.fetch = async (url, opts) => {
    bodies.push(JSON.parse(opts.body))
    return new Response(JSON.stringify({ id: 12, mode: 'update' }), {
      status: 200, headers: { 'content-type': 'application/json' },
    })
  }
  try {
    const { installApp } = await bundle()
    await installApp({
      manifest_url: 'https://raw.githubusercontent.com/mobius-os/app-notes/main/mobius.json',
      token: 'tok',
      reviewed_capability_digest: 'c'.repeat(64),
      reviewed_source_digest: 's'.repeat(64),
      update_app_id: 12,
      reviewed_upstream_commit: 'e'.repeat(40),
    })
    assert.deepEqual(bodies, [{
      manifest_url: 'https://raw.githubusercontent.com/mobius-os/app-notes/main/mobius.json',
      reviewed_capability_digest: 'c'.repeat(64),
      reviewed_source_digest: 's'.repeat(64),
      update_app_id: 12,
      reviewed_upstream_commit: 'e'.repeat(40),
    }])
  } finally {
    globalThis.fetch = oldFetch
  }
})

test('review digests bind capability and source previews to install', async () => {
  const oldFetch = globalThis.fetch
  const calls = []
  const digest = 'a'.repeat(64)
  globalThis.fetch = async (url, opts) => {
    calls.push({ url, body: JSON.parse(opts.body) })
    if (url === '/api/apps/preview') {
      return new Response(JSON.stringify({
        manifest: { id: 'memory', name: 'Memory', version: '2.0.0', description: 'Memory', entry: 'index.jsx' },
        capability_contract: { schema: 1, system_app: true, agent: {}, data: {}, background: null },
        capability_digest: digest,
        installed_contract: null,
        capability_diff: { unknown_previous: true, added: [], removed: [], changed: [] },
      }), { status: 200, headers: { 'content-type': 'application/json' } })
    }
    return new Response(JSON.stringify({
      id: 57, slug: 'memory', name: 'Memory', version: '2.0.0', mode: 'install',
    }), { status: 201, headers: { 'content-type': 'application/json' } })
  }
  try {
    const { previewApp, installApp } = await bundle()
    const source = 'https://raw.githubusercontent.com/mobius-os/app-memory/main/mobius.json'
    const preview = await previewApp({ manifest_url: source, token: 'tok' })
    await installApp({
      manifest_url: source,
      reviewed_capability_digest: preview.capability_digest,
      reviewed_source_digest: 'c'.repeat(64),
      token: 'tok',
    })
    assert.deepEqual(calls, [
      { url: '/api/apps/preview', body: { manifest_url: source } },
      {
        url: '/api/apps/install',
        body: {
          manifest_url: source,
          reviewed_capability_digest: digest,
          reviewed_source_digest: 'c'.repeat(64),
        },
      },
    ])
  } finally {
    globalThis.fetch = oldFetch
  }
})

test('source-change 409 asks the UI to refresh instead of applying', async () => {
  const oldFetch = globalThis.fetch
  globalThis.fetch = async () => new Response(JSON.stringify({ detail: {
    code: 'update_changed',
    message: 'Source changed.',
  } }), { status: 409, headers: { 'content-type': 'application/json' } })
  try {
    const { installApp } = await bundle()
    await assert.rejects(
      installApp({
        manifest_url: 'https://example.test/mobius.json',
        reviewed_source_digest: 'c'.repeat(64),
        token: 'tok',
      }),
      (error) => error.code === 'update_changed',
    )
  } finally {
    globalThis.fetch = oldFetch
  }
})

test('capability-change 409 exposes the new contract without retrying install', async () => {
  const oldFetch = globalThis.fetch
  let calls = 0
  globalThis.fetch = async () => {
    calls += 1
    return new Response(JSON.stringify({ detail: {
      code: 'capability_changed',
      message: 'Capabilities changed.',
      manifest: { id: 'memory', version: '2.0.1' },
      capability_contract: { schema: 1, system_app: true },
      capability_digest: 'b'.repeat(64),
      access_rows: [{ id: 'manage_apps', title: 'Install and remove apps', text: 'Can install and uninstall apps on your behalf.', level: null, rank: 1, critical: true }],
    } }), { status: 409, headers: { 'content-type': 'application/json' } })
  }
  try {
    const { installApp } = await bundle()
    await assert.rejects(
      installApp({
        manifest_url: 'https://example.test/mobius.json',
        reviewed_capability_digest: 'a'.repeat(64),
        token: 'tok',
      }),
      (error) => {
        assert.equal(error.code, 'capability_changed')
        assert.equal(error.preview.capability_digest, 'b'.repeat(64))
        assert.deepEqual(error.preview.access_rows.map(row => row.id), ['manage_apps'], 'the rows the owner must see survive a failed follow-up preview')
        return true
      },
    )
    assert.equal(calls, 1, 'the failed install is never auto-retried')
  } finally {
    globalThis.fetch = oldFetch
  }
})

test('an update review summarises one row per changed capability, keyed by capability', async () => {
  const { capabilityChangeRows } = await bundle()
  const search = { name: 'search', description: 'Find notes.', input_schema: { type: 'object' } }
  const installed = platformContract({ tools: [search] })
  const candidate = platformContract({
    tools: [{ ...search, description: 'Find notes and tasks.' }],
    skills: ['notes.md'],
    data: { manage_skills: true },
    runtime: { 'media.microphone.capture': MICROPHONE },
  })
  const preview = platformPreview(installed, candidate)
  assert.ok(preview.capability_diff.added.includes('runtime.media.microphone.capture.title'), 'the fixture carries the platform\'s dotted leaf paths')
  assert.deepEqual(capabilityChangeRows(preview).map(({ kind, label, previous, proposed }) => [kind, label, previous, proposed]), [
    ['Added', 'Use manage_skills', undefined, 'Can use manage_skills.'],
    ['Added', 'Record audio', undefined, 'Use the device microphone while this app is visible.'],
    ['Added', 'Bundled skills', undefined, '1 · Installs notes.md while the app is active.'],
    ['Changed', 'Agent tool “search”', 'Agent tool · Find notes.', 'Agent tool · Find notes and tasks.'],
  ])
  assert.deepEqual(capabilityChangeRows(platformPreview(candidate, installed)).map(row => [row.kind, row.label]), [
    ['Changed', 'Agent tool “search”'], ['Removed', 'Use manage_skills'], ['Removed', 'Record audio'], ['Removed', 'Bundled skills'],
  ])
  // Without a recorded previous contract there is nothing to compare.
  assert.deepEqual(capabilityChangeRows({ ...preview, capability_diff: { ...preview.capability_diff, unknown_previous: true } }), [])
  assert.deepEqual(capabilityChangeRows({ ...preview, installed_contract: null }), [])
})

test('a limit-only increase shows both values, because the platform row text carries them', async () => {
  const { capabilityChangeRows } = await bundle()
  const row = text => ({ id: 'device.asset-cache', title: 'Store large files', text, level: null, rank: 1, critical: false })
  const preview = {
    ...platformPreview(platformContract(), platformContract()),
    access_rows: [row('Download verified assets. Limits: max_bytes 2 GiB.')],
    installed_access_rows: [row('Download verified assets. Limits: max_bytes 256 MiB.')],
  }
  assert.deepEqual(capabilityChangeRows(preview).map(({ kind, previous, proposed }) => [kind, previous, proposed]), [
    ['Changed', 'Download verified assets. Limits: max_bytes 256 MiB.', 'Download verified assets. Limits: max_bytes 2 GiB.'],
  ])
})

test('a preview without access rows cannot be approved', async () => {
  const { hasAccessRows } = await bundle()
  assert.equal(hasAccessRows({ access_rows: [], installed_access_rows: [] }), true, 'an empty list is a real "nothing requested"')
  assert.equal(hasAccessRows({ capability_contract: {} }), false, 'an older platform sends no rows')
  assert.equal(hasAccessRows({ access_rows: [] }), false, 'an older platform defaults the list to empty, which proves nothing')
  assert.equal(hasAccessRows(null), false)
})

test('the system prompt row states its real scope and activation', async () => {
  const { capabilityRows } = await bundle()
  const promptRow = prompt => capabilityRows([], platformContract({ systemPrompt: prompt })).find(row => row.key === 'agent.system_prompt')
  const installedOnly = promptRow({ file: 'agent.md', scope: 'chats_started_while_installed', activation: 'chat_start' })
  assert.equal(installedOnly.tag, 'New chats')
  assert.equal(installedOnly.summary, 'Adds system instructions to agent chats started while it is installed when the chat starts (agent.md).')
  const everywhere = promptRow({ file: 'core.md', scope: 'all_agent_chats', activation: 'next_turn' })
  assert.equal(everywhere.tag, 'All chats')
  assert.match(everywhere.summary, /every agent chat on its next turn \(core\.md\)/)
  const unknown = promptRow({ file: 'x.md', scope: 'future_scope', activation: 'future_activation' })
  assert.match(unknown.summary, /future_scope[\s\S]*future_activation/, 'an unknown scope is shown, not hidden')
})

test('permission rows come from the platform; the Store adds only what the app ships', async () => {
  const { capabilityRows } = await bundle()
  const accessRows = [
    { id: 'chat_log_access', title: 'Read chat history', text: 'Can read redacted chat text.', level: 'redacted', rank: 1, critical: false },
    { id: 'identity_manage', title: 'Manage your sign-in identity', text: 'Can manage the sign-in link.', level: null, rank: 1, critical: true },
  ]
  const contract = platformContract({
    skills: ['notes.md'],
    tools: [{ name: 'search', description: 'Find notes.', input_schema: { type: 'object' } }],
  })
  const rows = capabilityRows(accessRows, contract)
  assert.deepEqual(rows.map(row => [row.key, row.label, row.tag, row.critical || false]), [
    ['chat_log_access', 'Read chat history', 'Redacted', false],
    ['identity_manage', 'Manage your sign-in identity', '', true],
    ['agent.skills', 'Bundled skills', '1', false],
    ['agent.tools:search', 'Agent tool “search”', 'Agent tool', false],
  ])
  assert.deepEqual(capabilityRows(undefined, platformContract()), [], 'no rows from an older platform is not an invented list')
})

test('both update entry points use one reviewed server batch with bound digests', async () => {
  const indexSource = await readFile(join(root, '..', 'index.jsx'), 'utf8')
  const controller = await readFile(join(root, '..', 'update-batch.js'), 'utf8')
  assert.match(indexSource, /loadUpdateCandidatePreview\(\s*installedApp\.id, updateItem\.manifest_url, token, \{ signal \}/)
  assert.match(indexSource, /openUpdateBatch\(\)\?\.check\(\[item\]\)/)
  assert.match(indexSource, /openUpdateBatch\(\)\?\.check\(updateItems\)/)
  assert.match(indexSource, /submit: payload => submitUpdateBatch\(payload, token\)/)
  assert.match(indexSource, /onConfirm=\{\(\) => updateBatchRef\.current\?\.confirm\(\)\}/)
  // The browser never applies a reviewed update itself.
  assert.doesNotMatch(indexSource, /updateAppId: entry|deferResolver|batch: true/)
  assert.doesNotMatch(controller, /installApp/)
  for (const reviewed of ['capability_digest', 'source_digest', 'upstream_commit', 'manifest_url', 'app_id']) {
    assert.match(controller, new RegExp(`${reviewed}: entry\\.prepared`))
  }
  // A fresh install carries no digest and waits for no access check; an app asks at first open.
  assert.ok(!indexSource.includes('reviewed_capability_digest: _opts.capabilityDigest'))
  // The per-app fallback for a Möbius without batches binds the same review.
  assert.ok(indexSource.includes('reviewed_source_digest: preview.source_digest'))
  assert.ok(indexSource.includes('reviewed_upstream_commit: preview.upstream_commit'))
})

test('candidate review requests the exact catalog manifest selected by the user', async () => {
  const { loadUpdateCandidatePreview } = await import(
    pathToFileURL(join(root, '..', 'api.js'))
  )
  const oldFetch = globalThis.fetch
  let requested = ''
  globalThis.fetch = async (url) => {
    requested = String(url)
    return new Response(JSON.stringify({
      app_id: 80,
      upstream_version: '2.0.0',
      upstream_diff: '',
      source_digest: 'a'.repeat(64),
    }), { status: 200, headers: { 'content-type': 'application/json' } })
  }
  try {
    const manifestUrl = (
      'https://raw.githubusercontent.com/mobius-os/' +
      'app-contribute/main/mobius.json'
    )
    await loadUpdateCandidatePreview(80, manifestUrl, 'token')
    assert.equal(
      requested,
      '/api/apps/80/update-candidate-preview?manifest_url=' +
        encodeURIComponent(manifestUrl),
    )
  } finally {
    globalThis.fetch = oldFetch
  }
})

test('resolver chat request binds the selected whole-tree policy', async () => {
  const { createConflictResolverChat } = await import(
    pathToFileURL(join(root, '..', 'api.js'))
  )
  const oldFetch = globalThis.fetch
  let request = null
  globalThis.fetch = async (url, options) => {
    request = { url: String(url), options }
    return new Response(JSON.stringify({
      chat_id: 'resolver-chat', created: true, started: true,
    }), { status: 200, headers: { 'content-type': 'application/json' } })
  }
  try {
    await createConflictResolverChat(80, 'preserve_local', 'token')
    assert.equal(request.url, '/api/apps/80/conflict-resolver-chat')
    assert.equal(request.options.method, 'POST')
    assert.equal(request.options.headers['Content-Type'], 'application/json')
    assert.deepEqual(JSON.parse(request.options.body), {
      resolution_policy: 'preserve_local',
    })
  } finally {
    globalThis.fetch = oldFetch
  }
})

test('confirmed conflicts are handed to one preserving resolver chat', async () => {
  const { createConflictResolverBatch } = await import(
    pathToFileURL(join(root, '..', 'api.js'))
  )
  const indexSource = await readFile(join(root, '..', 'index.jsx'), 'utf8')
  const oldFetch = globalThis.fetch
  let request = null
  globalThis.fetch = async (url, options) => {
    request = { url: String(url), options }
    return new Response(JSON.stringify({ chat_id: 'one-chat' }), {
      status: 200, headers: { 'content-type': 'application/json' },
    })
  }
  try {
    assert.deepEqual(await createConflictResolverBatch([80, 81], 'preserve_local', 'token'), {
      chat_id: 'one-chat',
    })
    // An app already bound to a running resolver reuses that chat, for the
    // apps the server names.
    globalThis.fetch = async () => new Response(JSON.stringify({ detail: {
      code: 'conflict_resolver_running', message: 'Voice is already being resolved', chat_id: 'existing-chat', app_ids: [81],
    } }), { status: 409, headers: { 'content-type': 'application/json' } })
    assert.deepEqual(await createConflictResolverBatch([80, 81], 'preserve_local', 'token'), {
      chat_id: 'existing-chat', app_ids: [81], started: false, existing: true,
      message: 'Voice is already being resolved',
    })
    assert.equal(request.url, '/api/apps/conflict-resolver-batch')
    assert.deepEqual(JSON.parse(request.options.body), {
      app_ids: [80, 81],
      resolution_policy: 'preserve_local',
    })
  } finally {
    globalThis.fetch = oldFetch
  }
  // Batch conflicts are never handed to an agent without the owner's Resolve.
  assert.match(indexSource, /resolve: appIds => createConflictResolverBatch\(appIds, 'preserve_local', token\)/)
})

test('Update all applies verified non-widening releases and reviews wider access', async () => {
  const { capabilityDiffNeedsReview, updateBatchDisposition } = await bundle()
  assert.equal(capabilityDiffNeedsReview(null), true)
  assert.equal(capabilityDiffNeedsReview({ unknown_previous: true, added: [], removed: [], changed: [] }), true)
  assert.equal(capabilityDiffNeedsReview({ unknown_previous: false, added: ['data.manage_apps'], removed: [], changed: [] }), true)
  assert.equal(capabilityDiffNeedsReview({ unknown_previous: false, added: [], removed: [], changed: ['background.agent'] }), true)
  assert.equal(capabilityDiffNeedsReview({ unknown_previous: false, added: [], removed: [], changed: [] }), false)
  assert.equal(capabilityDiffNeedsReview({ unknown_previous: true, widens: false, added: [], removed: [], changed: [] }), true)
  assert.equal(capabilityDiffNeedsReview({ unknown_previous: false, widens: false, added: [], removed: ['data.github_access'], changed: [] }), false)
  assert.equal(capabilityDiffNeedsReview({ unknown_previous: false, widens: true, added: [], removed: [], changed: [] }), true)
  assert.equal(capabilityDiffNeedsReview({ unknown_previous: false, widens: false, added: [], removed: [] }), true)

  const verified = {
    preview: { source_digest: 'a'.repeat(64) },
    capabilityReview: {
      preview: {
        capability_diff: { unknown_previous: false, added: [], removed: [], changed: [] },
      },
    },
  }
  assert.deepEqual(updateBatchDisposition(verified), { kind: 'ready', reason: null })
  assert.deepEqual(updateBatchDisposition({
    ...verified,
    capabilityReview: { preview: { capability_diff: {
      unknown_previous: false, widens: false,
      added: [], removed: ['data.github_access'], changed: [],
    } } },
  }), { kind: 'ready', reason: null })
  assert.deepEqual(updateBatchDisposition({
    ...verified,
    capabilityReview: { preview: { capability_diff: {
      unknown_previous: false, widens: true,
      added: [], removed: [], changed: [],
    } } },
  }), { kind: 'review', reason: 'access_changed' })
  assert.deepEqual(
    updateBatchDisposition({ ...verified, preview: {} }),
    { kind: 'review', reason: 'source_unverified' },
  )
  assert.deepEqual(
    updateBatchDisposition({
      ...verified,
      capabilityReview: {
        preview: {
          capability_diff: { unknown_previous: true, added: [], removed: [], changed: [] },
        },
      },
    }),
    { kind: 'review', reason: 'access_unrecorded' },
  )
  assert.deepEqual(
    updateBatchDisposition({
      ...verified,
      capabilityReview: {
        preview: {
          capability_diff: { unknown_previous: false, added: ['data.manage_apps'], removed: [], changed: [] },
        },
      },
    }),
    { kind: 'review', reason: 'access_changed' },
  )
})

test('automatic updates have no duplicate trust preference path', async () => {
  const source = await readFile(join(root, '..', 'index.jsx'), 'utf8')
  const detail = await readFile(join(root, '..', 'ui', 'DetailView.jsx'), 'utf8')
  assert.doesNotMatch(source, /trusted-updates\.json|trustedUpdate|toggleTrusted/)
  assert.doesNotMatch(detail, /Trust routine updates|Require review|Review every update/)
  assert.match(source, /openUpdateBatch\(\)\?\.check\(updateItems\)/)
})

test('filterCatalog matches categories, descriptions, and setup metadata', async () => {
  const { collectCategories, filterCatalog } = await bundle()
  const items = [
    {
      id: 'news',
      categories: ['information', 'agents'],
      keywords: ['digest'],
      setup: { description: 'Choose the fallback model.' },
      manifest: { name: 'News', description: 'Daily digest' },
    },
    {
      id: 'atlas',
      categories: ['reference'],
      keywords: ['globe'],
      manifest: { name: 'Atlas', description: 'Explore Earth' },
    },
  ]
  assert.deepEqual(collectCategories(items), ['information', 'agents', 'reference'])
  assert.deepEqual(filterCatalog(items, { category: 'agents' }).map(i => i.id), ['news'])
  assert.deepEqual(filterCatalog(items, { query: 'fallback model' }).map(i => i.id), ['news'])
  assert.deepEqual(filterCatalog(items, { query: 'earth', category: 'reference' }).map(i => i.id), ['atlas'])
})

test('catalog cards prefer concise discovery copy and use stable browse collections', async () => {
  const {
    CARD_DESCRIPTION_LIMIT,
    catalogAudience,
    catalogCardDescription,
    catalogCollection,
  } = await bundle()
  const description = catalogCardDescription({
    summary: 'A concise promise for everyday browsing.',
    manifest: {
      description: 'A longer technical description that belongs in app information.',
    },
  })
  assert.equal(description, 'A concise promise for everyday browsing.')

  const truncated = catalogCardDescription({
    manifest: {
      description: 'Build, use, and share agent-powered tools without reading a long technical description that belongs in app information.',
    },
  })
  assert.ok(truncated.length <= CARD_DESCRIPTION_LIMIT)
  assert.match(truncated, /…$/)
  assert.equal(catalogAudience({ categories: ['system', 'agents'] }), 'developer')
  assert.equal(catalogAudience({ categories: ['writing'] }), 'general')
  assert.equal(catalogCollection({ collection: 'play' }), 'play')
  // A dual-channel app (curated + community) lives in its curated collection;
  // only community-only apps land in the community section.
  assert.equal(catalogCollection({ community: { source_url: 'https://example.test/app' }, collection: 'everyday' }), 'everyday')
  assert.equal(catalogCollection({ community: { source_url: 'https://example.test/app' } }), 'community')
  assert.equal(catalogCollection({ id: 'skills', collection: 'developer' }), 'productivity')
  assert.equal(catalogCollection({ id: 'tasks', collection: 'developer' }), 'productivity')
  assert.equal(catalogCollection({ categories: ['reference'] }), 'explore')
  assert.equal(catalogCollection({
    audience: 'general',
    categories: ['development', 'system'],
  }), 'developer')
})

test('sortCatalogForDisplay promotes system apps without scrambling groups', async () => {
  const { collectCategories, sortCatalogForDisplay } = await bundle()
  const items = [
    { id: 'notes', categories: ['writing'] },
    { id: 'skills', categories: ['system', 'agents'] },
    { id: 'memory', categories: ['system', 'agents'] },
    { id: 'tasks', categories: ['productivity'] },
    { id: 'contribute', categories: ['development', 'system'] },
  ]
  const sorted = sortCatalogForDisplay(items)
  assert.deepEqual(sorted.map(i => i.id), ['skills', 'memory', 'contribute', 'notes', 'tasks'])
  assert.deepEqual(collectCategories(sorted).slice(0, 3), ['system', 'agents', 'development'])
})

test('manifestCapabilityRows makes agent-facing trust surfaces explicit', async () => {
  const { manifestCapabilityRows } = await bundle()
  const rows = manifestCapabilityRows({
    permissions: { chat_log_access: 'summary' },
    system_prompt: 'memory-core.md',
    skills: ['memory.md', 'reflection.md'],
    embeds_agent: true,
  })

  assert.deepEqual(rows.map(row => row.key), [
    'chat_log_access',
    'system_prompt',
    'skills',
    'embeds_agent',
  ])
  assert.equal(rows[0].info.tag, 'Redacted')
  assert.match(rows[0].info.hint, /tool calls/)
  assert.match(rows[2].info.summary, /2 reusable agent skills/)
  assert.match(rows[2].info.hint, /Uninstall deactivates/)
  assert.match(rows[1].info.hint, /next turn/)
})

test('manifestCapabilityRows shows no chat access and omits undeclared agent powers', async () => {
  const { manifestCapabilityRows } = await bundle()
  const rows = manifestCapabilityRows({})

  assert.deepEqual(rows.map(row => row.key), ['chat_log_access'])
  assert.equal(rows[0].level, 'none')
  assert.match(rows[0].info.summary, /Cannot read/)
})

test('manifestCapabilityRows explains that full chat access is not active yet', async () => {
  const { manifestCapabilityRows } = await bundle()
  const [row] = manifestCapabilityRows({
    permissions: { chat_log_access: 'full' },
  })

  assert.equal(row.info.tag, 'Full requested')
  assert.match(row.info.hint, /not yet enabled/)
})

test('manifestCapabilityRows exposes unsupported chat access instead of hiding it', async () => {
  const { manifestCapabilityRows } = await bundle()
  const [row] = manifestCapabilityRows({
    permissions: { chat_log_access: 'everything' },
  })

  assert.equal(row.level, 'everything')
  assert.equal(row.info.tag, 'Unsupported')
  assert.match(row.info.hint, /cannot be installed/)
})

test('appLifecycleFor chooses one primary action per catalog state', async () => {
  const { appLifecycleFor } = await bundle()
  const item = {
    id: 'news',
    manifest_url: 'https://raw.githubusercontent.com/mobius-os/app-news/main/mobius.json',
    raw_base: 'https://raw.githubusercontent.com/mobius-os/app-news/main/',
    setup: { required: true, scope: 'app' },
    manifest: { id: 'news', name: 'News', version: '1.2.0' },
  }
  const installed = [{
    id: 3,
    slug: 'news',
    manifest_url: 'https://raw.githubusercontent.com/mobius-os/app-news/main#manifest-id=news',
    version: '1.1.0',
  }]

  assert.equal(appLifecycleFor(item).actionKind, 'install')
  // A changed version label cannot manufacture an update.
  assert.equal(appLifecycleFor(item, { installed }).actionKind, 'open')
  assert.equal(appLifecycleFor(item, {
    installed,
    installedUnavailable: true,
    updateChecks: { 3: { available: true, pendingUpdateState: 'none' } },
  }).actionKind, 'retry')
  assert.equal(appLifecycleFor({
    ...item,
    manifest: { ...item.manifest, version: '1.1.0' },
  }, { installed }).actionKind, 'open')
  assert.equal(appLifecycleFor({
    ...item,
    manifest: { ...item.manifest, version: '1.1.0' },
  }, { installed }).statusLabel, 'Installed')
  assert.equal(appLifecycleFor({
    ...item,
    manifest: { ...item.manifest, version: '1.1.0' },
  }, { installed }).setupRequired, true)
  assert.equal(appLifecycleFor({
    ...item,
    manifest: { ...item.manifest, version: '1.1.0' },
  }, { installed }).setupNeedsAttention, true)
  assert.equal(appLifecycleFor({
    ...item,
    manifest: { ...item.manifest, version: '1.1.0' },
  }, {
    installed,
    setupCompletions: { 3: { completedAt: '2026-07-10T00:00:00.000Z' } },
  }).setupNeedsAttention, false)
  assert.equal(appLifecycleFor({
    ...item,
    setup: { required: true, scope: 'system' },
    manifest: { ...item.manifest, version: '1.1.0' },
  }, {
    installed,
    systemSetupReady: true,
  }).setupNeedsAttention, false)

  // Git-native update-check (keyed by the installed row's numeric id) is the
  // sole authority. Version labels cannot hide or manufacture an update.
  const upToDate = { ...item, manifest: { ...item.manifest, version: '1.1.0' } }
  // false + newer package label => open.
  assert.equal(appLifecycleFor(item, { installed, updateChecks: {
    3: { available: false, pendingUpdateState: 'none' },
  } }).actionKind, 'open')
  // false + equal package label => open.
  assert.equal(appLifecycleFor(upToDate, { installed, updateChecks: {
    3: { available: false, pendingUpdateState: 'none' },
  } }).actionKind, 'open')
  // true => update even though the labels match (source changed, no bump).
  assert.equal(appLifecycleFor(upToDate, { installed, updateChecks: {
    3: { available: true, pendingUpdateState: 'none' },
  } }).actionKind, 'update')
  // null / absent never falls back to a label comparison.
  assert.equal(appLifecycleFor(item, { installed, updateChecks: { 3: null } }).actionKind, 'open')
  assert.equal(appLifecycleFor(upToDate, { installed, updateChecks: {} }).actionKind, 'open')

  // A pending receipt is not synonymous with an unresolved conflict. Only the
  // click-gated conflict opens a resolver; marker-free committed source is a
  // replay/update retry and the resolver endpoint correctly rejects it.
  const unresolved = appLifecycleFor(upToDate, {
    installed,
    updateChecks: { 3: {
      available: true,
      pendingUpdateState: 'needs_resolution',
    } },
  })
  assert.equal(unresolved.actionKind, 'resolve')
  assert.equal(unresolved.statusLabel, 'Update blocked')
  assert.deepEqual(unresolved.resolutionNotice, {
    kind: 'conflict',
    itemId: 'news',
    appId: 3,
    message: 'This copy has local changes, so updating needs a quick reconcile.',
  })
  const replayPending = appLifecycleFor(upToDate, {
    installed,
    updateChecks: { 3: {
      available: true,
      pendingUpdateState: 'replay_pending',
    } },
  })
  assert.equal(replayPending.actionKind, 'update')
  assert.equal(replayPending.pendingUpdateState, 'replay_pending')
  const unknownPending = appLifecycleFor(upToDate, {
    installed,
    updateChecks: { 3: {
      available: true,
      pendingUpdateState: 'unknown',
    } },
  })
  assert.equal(unknownPending.actionKind, 'update')
  assert.equal(unknownPending.pendingUpdateState, 'unknown')
})

test('fetchUpdateCheck maps the current backend contract', async () => {
  const { fetchUpdateCheck } = await bundle()
  const oldFetch = globalThis.fetch
  const requests = []
  const replies = [
    {
      update_available: true,
      pending_update_state: 'replay_pending',
      upstream_version: '2.0.0',
      installed_source_revision: 'a'.repeat(40),
      candidate_source_digest: 'b'.repeat(64),
      checked_at: '2026-08-07T12:00:00Z',
    },
    { update_available: true, pending_update_state: 'unknown', upstream_version: '2.0.0' },
    { update_available: false, pending_update_state: 'none', upstream_version: '1.0.0' },
    {
      update_available: null, pending_update_state: 'none',
      candidate_rejected: { code: 'repository_moved', message: 'The catalog lists this app in another repository.' },
    },
  ]
  globalThis.fetch = async (url) => {
    requests.push(url)
    return new Response(JSON.stringify(replies.shift()), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }
  try {
    assert.deepEqual(await fetchUpdateCheck(1, 'token', 'https://example.com/apps/news/mobius.json'), {
      available: true,
      pendingUpdateState: 'replay_pending',
      upstreamVersion: '2.0.0',
      installedSourceRevision: 'a'.repeat(40),
      candidateSourceDigest: 'b'.repeat(64),
      candidateRejected: null,
      checkedAt: '2026-08-07T12:00:00Z',
    })
    assert.deepEqual(await fetchUpdateCheck(1, 'token'), {
      available: true,
      pendingUpdateState: 'unknown',
      upstreamVersion: '2.0.0',
      installedSourceRevision: null,
      candidateSourceDigest: null,
      candidateRejected: null,
      checkedAt: null,
    })
    assert.deepEqual(await fetchUpdateCheck(1, 'token'), {
      available: false,
      pendingUpdateState: 'none',
      upstreamVersion: '1.0.0',
      installedSourceRevision: null,
      candidateSourceDigest: null,
      candidateRejected: null,
      checkedAt: null,
    })
    assert.equal(
      requests[0],
      '/api/apps/1/update-check?manifest_url=https%3A%2F%2Fexample.com%2Fapps%2Fnews%2Fmobius.json',
    )
    assert.equal(requests[1], '/api/apps/1/update-check')
    assert.equal(requests[2], '/api/apps/1/update-check')
    // A candidate install would refuse says why, with update_available null.
    const rejected = await fetchUpdateCheck(1, 'token')
    assert.equal(rejected.available, null)
    assert.deepEqual(rejected.candidateRejected, {
      code: 'repository_moved', message: 'The catalog lists this app in another repository.',
    })
  } finally {
    globalThis.fetch = oldFetch
  }
})

test('successful updates clear stale git update checks and inline errors', async () => {
  const { mergeUpdateChecks } = await bundle()
  const stale = { 61: { available: true, pendingUpdateState: 'replay_pending' } }
  const current = {
    available: false,
    pendingUpdateState: 'none',
    upstreamVersion: '2.0.0',
  }
  const settled = mergeUpdateChecks(stale, { 61: current })
  assert.deepEqual(settled, { 61: current })
  assert.notEqual(settled, stale)

  const alreadySettled = { 61: current }
  assert.equal(mergeUpdateChecks(alreadySettled, { 61: { ...current } }), alreadySettled)

  const priorConflict = {
    61: {
      available: true,
      pendingUpdateState: 'needs_resolution',
      upstreamVersion: '2.0.0',
    },
  }
  const uncertain = mergeUpdateChecks(priorConflict, {
    61: {
      available: true,
      pendingUpdateState: 'unknown',
      upstreamVersion: '2.0.1',
    },
  })
  assert.deepEqual(uncertain[61], {
    available: true,
    pendingUpdateState: 'needs_resolution',
    upstreamVersion: '2.0.1',
  })
  assert.equal(mergeUpdateChecks({}, {
    61: { available: true, pendingUpdateState: 'unknown', upstreamVersion: null },
  })[61].pendingUpdateState, 'unknown')
  const previouslyClear = mergeUpdateChecks({
    61: { available: false, pendingUpdateState: 'none', upstreamVersion: '2.0.0' },
  }, {
    61: { available: true, pendingUpdateState: 'unknown', upstreamVersion: '2.0.1' },
  })
  assert.deepEqual(previouslyClear[61], {
    available: true,
    pendingUpdateState: 'unknown',
    upstreamVersion: '2.0.1',
  })

  const source = await readFile(join(root, '..', 'index.jsx'), 'utf8')
  assert.ok(source.includes("pendingUpdateState: 'none'"))
  assert.ok(source.includes("pendingUpdateState: 'needs_resolution'"))
  assert.ok(source.includes('if (r.check !== null) out[r.id] = r.check'))
  assert.ok(source.includes('setCardErrors(prev => withoutKey(prev, item.id))'))
  assert.ok(source.includes('clearSettledUpdateArtifacts(itemIdsSettledByChecks'))
  const detailSource = await readFile(join(root, '..', 'ui', 'DetailView.jsx'), 'utf8')
  assert.ok(detailSource.includes('!blockedUpdate && hasUpdate'))
})

test('app details keep stable access information in a bottom disclosure', async () => {
  const source = await readFile(join(root, '..', 'ui', 'DetailView.jsx'), 'utf8')
  const disclosure = source.indexOf('className={`st-technical-details')
  const capability = source.indexOf('<CapabilityContract', disclosure)
  const footer = source.indexOf('className="st-detail-footer"', disclosure)
  assert.ok(disclosure >= 0)
  assert.ok(capability > disclosure)
  assert.ok(footer > capability)
  assert.match(source, /Privacy, access & technical details/)
  assert.match(source, /Update source/)
  assert.match(source, /Installed source revision/)
  assert.match(source, /Last verified/)
  assert.doesNotMatch(source, /Access and agent integration/)
  const selfUpdateSource = await readFile(join(root, '..', 'ui', 'SelfUpdateBanner.jsx'), 'utf8')
  assert.match(selfUpdateSource, /fetchUpdateCheck\(appId, token, STORE_SELF\.manifest_url\)/)
  assert.match(selfUpdateSource, /loadUpdateCandidatePreview\(appId, STORE_SELF\.manifest_url, token\)/)
  assert.match(selfUpdateSource, /reviewed_upstream_commit: review\.candidate\.upstream_commit/)
  assert.doesNotMatch(selfUpdateSource, /semverCmp/)
  assert.match(selfUpdateSource, /if \(needsAccessReview && !showReview\)/)
  assert.match(selfUpdateSource, /'Update App Store'/)
  assert.match(selfUpdateSource, /later updates stop only when access changes/)
})

test('desktop measure applies to every direct scroll child without a class allowlist', async () => {
  const theme = await readFile(join(root, '..', 'theme.js'), 'utf8')

  assert.match(theme, /\.st-scroll > \* \{\s*\n\s*max-width: 840px;\s*\n\s*margin-inline: auto;/)
  assert.doesNotMatch(theme, /\.st-scroll > \.st-[a-z-]+,\s*$/m)
})

test('app details share the browse rail while keeping prose readable', async () => {
  const detail = await readFile(join(root, '..', 'ui', 'DetailView.jsx'), 'utf8')
  const theme = await readFile(join(root, '..', 'theme.js'), 'utf8')

  assert.match(detail, /className="st-scroll is-detail"/)
  assert.match(detail, /className="st-detail-desc-wrap"/)
  assert.match(theme, /\.st-scroll\.is-detail > \* \{ max-width: 1180px; \}/)
  assert.match(theme, /\.st-detail-desc \{ max-width: 72ch;/)
  assert.match(theme, /\.st-detail-footer \{[\s\S]*?max-width: 1180px;/)
})

test('late detail artwork rules preserve the desktop centering margin', async () => {
  const theme = await readFile(join(root, '..', 'theme.js'), 'utf8')

  const galleryRule = theme.match(/\.st-detail-gallery \{([^}]*)\}/)?.[1] || ''
  const bylineRule = theme.match(/\.st-detail-byline \{([^}]*)\}/)?.[1] || ''
  assert.match(galleryRule, /margin-block:\s*0 22px/)
  assert.match(bylineRule, /margin-block:\s*-14px 26px/)
  assert.doesNotMatch(galleryRule, /(?:^|;)\s*margin:/)
  assert.doesNotMatch(bylineRule, /(?:^|;)\s*margin:/)
})

test('busy labels stay tied to the action that started', async () => {
  const { appLifecycleFor, busyLabelForAction } = await bundle()
  const item = {
    id: 'cuberun',
    manifest_url: 'https://raw.githubusercontent.com/mobius-os/app-cuberun/main/mobius.json',
    manifest: { id: 'cuberun', name: 'CubeRun', version: '1.0.2-mobius.17' },
  }
  const installedBefore = [{
    id: 60,
    slug: 'cuberun',
    manifest_url: 'https://raw.githubusercontent.com/mobius-os/app-cuberun/main#manifest-id=cuberun',
    version: '1.0.2-mobius.16',
  }]
  const installedAfter = [{ ...installedBefore[0], version: '1.0.2-mobius.17' }]

  assert.equal(appLifecycleFor(item, {
    installed: installedBefore,
    updateChecks: { 60: { available: true, pendingUpdateState: 'none' } },
  }).actionKind, 'update')
  assert.equal(appLifecycleFor(item, {
    installed: installedAfter,
    updateChecks: { 60: { available: false, pendingUpdateState: 'none' } },
  }).actionKind, 'open')

  assert.equal(busyLabelForAction('update'), 'Updating…')
  assert.equal(busyLabelForAction('batch_update'), 'Updating all…')
  assert.equal(busyLabelForAction('open'), 'Opening…')
  assert.equal(busyLabelForAction('checking_update'), 'Loading changes…')

  const source = await readFile(join(root, '..', 'index.jsx'), 'utf8')
  const cardSource = await readFile(join(root, '..', 'ui', 'CatalogCard.jsx'), 'utf8')
  const detailSource = await readFile(join(root, '..', 'ui', 'DetailView.jsx'), 'utf8')
  // handleInstall only installs; updates show their busy state from the batch.
  assert.ok(source.includes("setBusyActionKind('install')"))
  assert.ok(source.includes("updatingItemIds.includes(detail.id) ? 'update'"))
  assert.ok(cardSource.includes('busyActionKind || lifecycle.actionKind'))
  assert.ok(cardSource.includes("lifecycle.actionKind === 'install'"))
  assert.ok(!cardSource.includes("'Review & install'"))
  assert.ok(detailSource.includes('busyActionKind || lifecycle.actionKind'))
})

test('scheduleSummary handles cron and on-demand jobs', async () => {
  const { scheduleSummary } = await bundle()

  assert.equal(scheduleSummary({ default: '0 6 * * *' }), 'Runs daily at 06:00 UTC')
  assert.equal(scheduleSummary({ job: 'build.sh' }), 'Runs on demand from inside the app')
  assert.equal(scheduleSummary(null), '')
})

test('STORE_VERSION stays in lockstep with mobius.json', async () => {
  const manifest = JSON.parse(await readFile(join(root, '..', 'mobius.json'), 'utf8'))
  const { STORE_VERSION } = await bundle()
  assert.equal(STORE_VERSION, manifest.version)
})

test('offline contract preserves bundled browsing without claiming network actions', async () => {
  const manifest = JSON.parse(await readFile(join(root, '..', 'mobius.json'), 'utf8'))
  assert.equal(manifest.offline_capable, true)
  assert.equal(manifest.offline.reads, true)
  assert.equal(manifest.offline.writes, 'none')
  assert.equal(manifest.offline.execution, 'partial')
  assert.match(manifest.offline.reads_detail, /bundled catalog/i)
})

// Browse must remain useful when the external proxy is slow or unavailable,
// without coupling the live discovery index to every app release. The generated
// fallback still carries first-paint manifests; install/update always resolves
// the live manifest_url.
test('catalog is a release-independent discovery index with a baked snapshot floor', async () => {
  const catalog = JSON.parse(await readFile(join(root, '..', 'catalog.json'), 'utf8'))
  const constants = await readFile(join(root, '..', 'constants.js'), 'utf8')
  const snapshots = await readFile(join(root, '..', 'manifest-snapshots.js'), 'utf8')
  const refresh = await readFile(join(root, '..', 'scripts', 'refresh-manifest-snapshots.mjs'), 'utf8')
  const collections = new Set(['productivity', 'everyday', 'create', 'explore', 'play', 'developer'])

  assert.ok(Array.isArray(catalog.apps) && catalog.apps.length > 0)
  for (const entry of catalog.apps) {
    assert.equal(entry.manifest, undefined,
      `${entry.id}: live discovery entries must not carry release snapshots`)
    assert.match(entry.id, /^[a-z0-9-]+$/)
    assert.ok(entry.name, `${entry.id}: discovery entries carry a name`)
    assert.ok(entry.description, `${entry.id}: discovery entries carry a description`)
    assert.ok(entry.summary, `${entry.id}: discovery entries carry a concise summary`)
    assert.ok(entry.summary.length <= 52, `${entry.id}: summary stays within 52 characters`)
    assert.ok(collections.has(entry.collection), `${entry.id}: discovery collection is known`)
    assert.match(entry.manifest_url, /^https:\/\//)
    assert.match(entry.raw_base, /^https:\/\//)
    assert.equal(new URL(entry.manifest_url).host, new URL(entry.raw_base).host,
      `${entry.id}: raw_base must share manifest_url's host`)
  }
  assert.match(constants, /import CATALOG_REGISTRY from '.\/catalog\.json'/)
  assert.match(constants, /CATALOG_REGISTRY\.apps\.map/)
  assert.match(constants, /manifest: MANIFEST_SNAPSHOTS\[entry\.id\] \|\| null/)
  assert.doesNotMatch(constants, /id:\s*'voice'/,
    'catalog entries must not be copied into constants.js')
  assert.match(snapshots, /export const MANIFEST_SNAPSHOTS = \{/)
  assert.doesNotMatch(refresh, /entry\.manifest\s*=/)
  assert.doesNotMatch(refresh, /writeFile\(catalogPath/)
})

test('catalog publication requires one complete baked snapshot per entry', async () => {
  const catalog = JSON.parse(await readFile(join(root, '..', 'catalog.json'), 'utf8'))
  const { MANIFEST_SNAPSHOTS } = await import(
    pathToFileURL(join(root, '..', 'manifest-snapshots.js'))
  )
  const { assertCompleteCatalogSnapshots } = await import(
    pathToFileURL(join(root, '..', 'scripts', 'catalog-snapshot-contract.mjs'))
  )

  assert.doesNotThrow(() => assertCompleteCatalogSnapshots(catalog, MANIFEST_SNAPSHOTS))

  const missingVoice = { ...MANIFEST_SNAPSHOTS }
  delete missingVoice.voice
  assert.throws(
    () => assertCompleteCatalogSnapshots(catalog, missingVoice),
    /voice: snapshot is missing/,
  )

  assert.throws(
    () => assertCompleteCatalogSnapshots(catalog, {
      ...MANIFEST_SNAPSHOTS,
      voice: { ...MANIFEST_SNAPSHOTS.voice, version: '' },
    }),
    /voice: snapshot is missing version/,
  )
})

test('snapshot drift names each app whose live manifest moved', async () => {
  const { catalogSnapshotDrift } = await import(
    pathToFileURL(join(root, '..', 'scripts', 'catalog-snapshot-contract.mjs'))
  )
  const notes = { id: 'notes', version: '1.0.0', description: 'Notes.' }
  const voice = { id: 'voice', version: '2.0.0', description: 'Voice.' }

  assert.deepEqual(catalogSnapshotDrift({ notes, voice }, { notes: { ...notes }, voice }), [])
  assert.deepEqual(
    catalogSnapshotDrift(
      { notes, voice },
      { notes: { ...notes, version: '1.1.0', description: 'Better notes.' }, voice, kanban: voice },
    ),
    [
      { id: 'kanban', fields: ['added'] },
      { id: 'notes', fields: ['description', 'version'], from: '1.0.0', to: '1.1.0' },
    ],
  )
  assert.deepEqual(catalogSnapshotDrift({ notes }, {}), [{ id: 'notes', fields: ['removed'] }])
})

test('app publication requires a complete source_files import tree', async () => {
  const manifest = JSON.parse(await readFile(join(root, '..', 'mobius.json'), 'utf8'))
  const { assertCompleteSourceManifest } = await import(
    pathToFileURL(join(root, '..', 'scripts', 'source-manifest-contract.mjs'))
  )

  await assert.doesNotReject(() => assertCompleteSourceManifest(join(root, '..'), manifest))

  await assert.rejects(
    () => assertCompleteSourceManifest(join(root, '..'), {
      ...manifest,
      source_files: manifest.source_files.filter((path) => path !== 'ui/UpdateReviewModal.jsx'),
    }),
    /index\.jsx: relative import \.\/ui\/UpdateReviewModal\.jsx is not declared in source_files/,
  )
})

test('app publication requires an executable scheduled job with a shebang', async () => {
  const { assertCompleteSourceManifest } = await import(
    pathToFileURL(join(root, '..', 'scripts', 'source-manifest-contract.mjs'))
  )
  const pkg = await mkdtemp(join(tmpdir(), 'store-job-contract-'))
  try {
    await writeFile(join(pkg, 'index.jsx'), 'export default function App() { return null }\n')
    await writeFile(join(pkg, 'theme.js'), 'export const theme = {}\n')
    const manifest = { entry: 'index.jsx', source_files: ['theme.js'], schedule: { job: 'job.py' } }

    await writeFile(join(pkg, 'job.py'), '#!/usr/bin/env python3\nprint("ok")\n')
    await chmod(join(pkg, 'job.py'), 0o644)
    await assert.rejects(() => assertCompleteSourceManifest(pkg, manifest), /job\.py: schedule job must be executable/)

    await chmod(join(pkg, 'job.py'), 0o755)
    await assert.doesNotReject(() => assertCompleteSourceManifest(pkg, manifest))

    await writeFile(join(pkg, 'job.py'), 'print("ok")\n')
    await assert.rejects(() => assertCompleteSourceManifest(pkg, manifest), /job\.py: schedule job must start with a shebang/)
  } finally {
    await rm(pkg, { recursive: true, force: true })
  }
})

test('Beat Machine discovery entry sells beat-making in one short promise', async () => {
  const catalog = JSON.parse(await readFile(join(root, '..', 'catalog.json'), 'utf8'))
  const entry = catalog.apps.find((item) => item.id === 'beat-machine')

  assert.ok(entry, 'catalog contains Beat Machine')
  assert.match(entry.summary, /make beats/i)
  assert.match(entry.summary, /32 steps/i)
  assert.ok(entry.summary.length <= 52)
  assert.ok(entry.keywords.includes('sequencer'))
  assert.ok(entry.capabilities.some((capability) => /32-step/.test(capability)))
})

test('Maps discovery entry exposes saved-map and skill capabilities', async () => {
  const catalog = JSON.parse(await readFile(join(root, '..', 'catalog.json'), 'utf8'))
  const entry = catalog.apps.find((item) => item.id === 'maps')

  assert.ok(entry, 'catalog contains Maps')
  assert.equal(entry.repo, 'mobius-os/app-maps')
  assert.ok(entry.keywords.includes('geocoding'))
  assert.ok(entry.capabilities.some((capability) => /source chats/.test(capability)))
  assert.equal(entry.manifest, undefined)
})

test('Subagents discovery entry exposes guarded provider delegation', async () => {
  const catalog = JSON.parse(await readFile(join(root, '..', 'catalog.json'), 'utf8'))
  const entry = catalog.apps.find((item) => item.id === 'subagents')

  assert.ok(entry, 'catalog contains Subagents')
  assert.equal(entry.repo, 'mobius-os/app-subagents')
  assert.equal(entry.collection, 'developer')
  assert.ok(entry.keywords.includes('claude'))
  assert.ok(entry.keywords.includes('codex'))
  assert.ok(entry.capabilities.some((capability) => /guarded subagent delegation/.test(capability)))
  assert.equal(entry.manifest, undefined)
})

test('community and curated channels merge to one row with curated placement', async () => {
  const { mergeOfficialCommunityFeedback, catalogCollection } = await import('../domain.js')
  const curated = [{
    id: 'kanban', collection: 'everyday', manifest: { id: 'kanban' },
    manifest_url: 'https://raw.githubusercontent.com/hamzamerzic/app-kanban/main/mobius.json',
  }]
  const community = [{
    id: 'community:app_1', collection: 'community', manifest: { id: 'kanban' },
    manifest_url: 'https://www.mobius.you/v1/community/source/app_1/current/mobius.json',
    repository: 'hamzamerzic/app-kanban', publisher: { login: 'hamzamerzic' },
    community: { id: 'app_1' },
  }]
  const merged = mergeOfficialCommunityFeedback(curated, community)
  assert.equal(merged.length, 1)
  assert.equal(catalogCollection(merged[0]), 'everyday')
  assert.equal(merged[0].community, undefined) // never becomes a community-install item
  assert.ok(merged[0].community_feedback)
  assert.match(merged[0].manifest_url, /githubusercontent/)
  // A different repository cannot create a second row by reusing the stable
  // package identity, and its unverified feedback is never merged.
  const collision = {
    ...community[0],
    id: 'community:app_2',
    repository: 'someoneelse/app-kanban',
    publisher: { login: 'someoneelse' },
    community: { id: 'app_2', rating_average: 1.2 },
  }
  const withoutCollision = mergeOfficialCommunityFeedback(curated, [collision])
  assert.equal(withoutCollision.length, 1)
  assert.equal(withoutCollision[0].community_feedback, undefined)
  // A community-only app still lands in the community section.
  const pure = mergeOfficialCommunityFeedback([], community)
  assert.equal(pure.length, 1)
  assert.equal(catalogCollection(pure[0]), 'community')
})

test('installed matching recognizes repo identity and viewer-owned publications', async () => {
  const { findInstalled, setInstalledMatchViewer } = await import('../domain.js')
  setInstalledMatchViewer('hamzamerzic')
  const canonicalInstall = [{
    slug: 'voice',
    manifest_url: 'https://raw.githubusercontent.com/mobius-os/app-voice/main#manifest-id=voice',
  }]
  const communityVoice = {
    id: 'x', manifest: { id: 'voice' },
    manifest_url: 'https://www.mobius.you/v1/community/source/app_1/current/mobius.json',
    repository: 'mobius-os/app-voice',
  }
  assert.equal(findInstalled(canonicalInstall, communityVoice)?.slug, 'voice')
  const authored = [{ slug: 'kanban', manifest_url: '' }]
  const curatedOwn = {
    id: 'kanban', manifest: { id: 'kanban' },
    manifest_url: 'https://raw.githubusercontent.com/hamzamerzic/app-kanban/main/mobius.json',
  }
  assert.equal(findInstalled(authored, curatedOwn)?.slug, 'kanban')
  const foreign = {
    id: 'k2', manifest: { id: 'kanban' },
    manifest_url: 'https://www.mobius.you/v1/community/source/app_2/current/mobius.json',
    repository: 'someoneelse/app-kanban', publisher: { login: 'someoneelse' },
  }
  assert.equal(findInstalled(authored, foreign), null)
  setInstalledMatchViewer('')
})

test('community feedback resolves from either the community or curated channel', async () => {
  const { communityFeedbackOf } = await import('../domain.js')
  const block = { id: 'app_x', revision_id: 'rev_1' }
  assert.equal(communityFeedbackOf({ community: block }), block)
  assert.equal(communityFeedbackOf({ community_feedback: block }), block)
  const folded = { id: 'app_folded', revision_id: 'rev_2' }
  assert.equal(communityFeedbackOf({ community_feedback: folded, community: block }), folded)
  assert.equal(communityFeedbackOf({}), null)
  assert.equal(communityFeedbackOf(null), null)
})

test('an official app installed from its curated row sends a receipt for its community listing', async () => {
  // The real merge keeps the curated GitHub source and folds the listing's
  // social block in as `community_feedback`; installing that row must still
  // send the owner's receipt, or official apps can never be reviewed.
  const { mergeOfficialCommunityFeedback, communityReceiptAfterInstall, attemptCommunityReceiptOnce } =
    await import('../domain.js')
  const { confirmCommunityInstallReceipt } = await import('../api.js')
  const curated = [{
    id: 'notes', collection: 'everyday', manifest: { id: 'notes' },
    manifest_url: 'https://raw.githubusercontent.com/octo/app-notes/main/mobius.json',
  }]
  const community = [{
    id: 'community:app_x', collection: 'community', manifest: { id: 'notes' },
    manifest_url: 'https://www.mobius.you/v1/community/source/app_x/current/mobius.json',
    repository: 'octo/app-notes', publisher: { login: 'octo' },
    community: { id: 'app_x', revision_id: 'rev_9' },
  }]
  const [row] = mergeOfficialCommunityFeedback(curated, community)
  assert.equal(row.community, undefined)
  const identity = { linked: true, issuer: 'iss', subject: 'sub', instance_id: 'inst' }
  const installedApp = { id: 42, slug: 'notes' }
  const receipt = communityReceiptAfterInstall(row, installedApp, identity)
  assert.deepEqual(receipt, {
    communityId: 'app_x', revisionId: 'rev_9', attemptKey: 'iss:sub:inst:app_x:rev_9:42',
  })
  const calls = []
  const oldFetch = globalThis.fetch
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url, options })
    return new Response(JSON.stringify(options.method === 'POST'
      ? { recorded: true }
      : { has_verified_install: true, review_eligibility: 'eligible' }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    })
  }
  try {
    const attempts = new Set()
    const refreshed = await attemptCommunityReceiptOnce(attempts, receipt.attemptKey, () => (
      confirmCommunityInstallReceipt('owner-token', receipt.communityId, receipt.revisionId, 'app:42:notes')
    ))
    assert.equal(refreshed.review_eligibility, 'eligible')
    assert.equal(attemptCommunityReceiptOnce(attempts, receipt.attemptKey, () => null), null,
      'the same install is not receipted twice in one Store session')
  } finally {
    globalThis.fetch = oldFetch
  }
  const posts = calls.filter(call => call.options.method === 'POST')
  assert.equal(posts.length, 1)
  assert.equal(posts[0].url, '/api/community/apps/app_x/revisions/rev_9/installs')
  assert.deepEqual(JSON.parse(posts[0].options.body), { local_app_id: 'app:42:notes' })
})

test('install receipts need a linked identity and an installed row', async () => {
  const { communityReceiptAfterInstall } = await import('../domain.js')
  const listing = { community: { id: 'app_x', revision_id: 'rev_9' } }
  const linked = { linked: true, issuer: 'iss', subject: 'sub', instance_id: 'inst' }
  assert.equal(communityReceiptAfterInstall(listing, { id: 42 }, { linked: false }), null,
    'an unlinked owner gets neither a rejected receipt nor its failure message')
  assert.equal(communityReceiptAfterInstall(listing, {}, linked), null)
  assert.equal(communityReceiptAfterInstall({ manifest: { id: 'x' } }, { id: 42 }, linked), null)
  assert.equal(communityReceiptAfterInstall(listing, { id: 42 }, linked).revisionId, 'rev_9')
})

test('a nested or missing rating aggregate never renders NaN', async () => {
  const { communityRatingAggregate } = await import('../domain.js')
  const current = { rating_average: 4.2, rating_count: 10 }
  assert.deepEqual(
    communityRatingAggregate({ rating_average: 4.6, rating_count: 12 }, current),
    { rating_average: 4.6, rating_count: 12 },
  )
  assert.deepEqual(
    communityRatingAggregate({ rating: { average: 4.6, count: 12 } }, current),
    { rating_average: 4.6, rating_count: 12 },
  )
  const kept = communityRatingAggregate({ user_review: { stars: 5 } }, current)
  assert.deepEqual(kept, { rating_average: 4.2, rating_count: 10 })
  assert.deepEqual(communityRatingAggregate({}, undefined), { rating_average: 0, rating_count: 0 })
})

test('opening an app reconciles its receipt by the service\'s per-app eligibility', async () => {
  const { communityReceiptToReconcile } = await import('../domain.js')
  const identity = { linked: true, issuer: 'iss', subject: 'sub', instance_id: 'inst' }
  const githubSource = 'https://raw.githubusercontent.com/octo/app-notes/main/mobius.json'
  const curatedRow = {
    id: 'notes', manifest: { id: 'notes' }, manifest_url: githubSource,
    community_feedback: { id: 'app_x', revision_id: 'rev_9', has_verified_install: false },
  }
  // An official app installed from GitHub before receipts existed recorded no
  // community revision: label its receipt with the listed revision instead of
  // asking the owner to update first.
  const preFeatureInstall = {
    id: 42, slug: 'notes', updated_at: '2026-09-01T00:00:00Z',
    manifest_url: githubSource, source_manifest: { id: 'notes', url: githubSource },
  }
  const receipt = communityReceiptToReconcile(curatedRow, [preFeatureInstall], identity, null)
  assert.equal(receipt.installedApp, preFeatureInstall)
  assert.deepEqual([receipt.communityId, receipt.revisionId, receipt.attemptKey],
    ['app_x', 'rev_9', 'iss:sub:inst:app_x:rev_9:42'])
  // A revision the Store remembered at install time names that exact revision,
  // even after the listing moved on.
  const { rememberCommunityInstallRevision } = await import('../domain.js')
  const currentSource = 'https://www.mobius.you/v1/community/source/app_x/current/mobius.json'
  const communityRow = {
    id: 'community:app_x', manifest: { id: 'notes' }, manifest_url: currentSource,
    community: { id: 'app_x', revision_id: 'rev_9' },
  }
  const communityInstall = {
    id: 7, slug: 'notes', updated_at: '2026-09-20T00:00:00Z',
    manifest_url: currentSource, source_manifest: { id: 'notes', url: currentSource },
  }
  const saved = new Map()
  const storage = { getItem: key => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, value) }
  assert.ok(rememberCommunityInstallRevision(communityInstall, { id: 'app_x', revision_id: 'rev_4' }, storage))
  assert.equal(communityReceiptToReconcile(communityRow, [communityInstall], identity, storage).revisionId, 'rev_4')
  assert.equal(communityReceiptToReconcile(communityRow, [communityInstall], identity, null).revisionId, 'rev_9')
  // Any verified install already makes the account eligible: nothing to send.
  const verified = { ...curatedRow, community_feedback: { ...curatedRow.community_feedback, has_verified_install: true } }
  assert.equal(communityReceiptToReconcile(verified, [preFeatureInstall], identity, null), null)
  // No detail open, not installed, or no linked identity: nothing to send, and no throw.
  assert.equal(communityReceiptToReconcile(null, [preFeatureInstall], identity, null), null)
  assert.equal(communityReceiptToReconcile(curatedRow, [], identity, null), null)
  assert.equal(communityReceiptToReconcile(curatedRow, undefined, identity, null), null)
  assert.equal(communityReceiptToReconcile(curatedRow, [preFeatureInstall], { linked: false }, null), null)
})

test('the Store sends and reconciles receipts through the shared decisions', async () => {
  const appSource = await readFile(join(root, '..', 'index.jsx'), 'utf8')
  const detailSource = await readFile(join(root, '..', 'ui', 'DetailView.jsx'), 'utf8')
  const feedbackSource = await readFile(join(root, '..', 'ui', 'CommunityFeedback.jsx'), 'utf8')
  assert.match(appSource, /communityReceiptAfterInstall\(item, result, communityIdentity\)/)
  assert.match(appSource, /communityReceiptToReconcile\(detail, installed, communityIdentity\)/)
  assert.doesNotMatch(appSource, /const communityFeedback = item\.community\b/)
  assert.doesNotMatch(appSource, /older install has no recorded release/)
  // Review access is the service's per-app eligibility, not a current install.
  assert.match(detailSource, /verifiedCommunityInstall = communityIdentityLinked\n\s*&& communityFeedback\?\.review_eligibility === 'eligible'/)
  // Only a missing account asks the owner to sign in.
  assert.match(feedbackSource, /review_eligibility === 'account_required'/)
})

test('review prompts that need an account or handle hand off to Möbius · You', async () => {
  const { reviewAccountAction } = await import('../domain.js')
  assert.equal(reviewAccountAction('account_required'), 'Sign in with Möbius · You')
  assert.equal(reviewAccountAction('handle_required'), 'Choose a handle')
  assert.equal(reviewAccountAction('eligible'), null)
  assert.equal(reviewAccountAction('install_required'), null)
  assert.equal(reviewAccountAction(undefined), null)
  const appSource = await readFile(join(root, '..', 'index.jsx'), 'utf8')
  const detailSource = await readFile(join(root, '..', 'ui', 'DetailView.jsx'), 'utf8')
  assert.match(appSource, /onLogInToMobiusYou=\{logInToMobiusYou\}/)
  assert.match(detailSource, /onLogInToMobiusYou=\{onLogInToMobiusYou\}/)
})
