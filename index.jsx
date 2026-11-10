import { mapWithConcurrency, createUpdateBatch, updateBatchBusy, newestBatchSnapshot, normalizeBatchSnapshot, batchProgress as batchProgressOf } from './update-batch.js'
import { openDetailEntry, closeDetailEntry } from './store-navigation.js'
import { restoredStoreLocation, storeLocation } from './store-location.js'
import { watchCatalogFreshness, loadCommunityWindow } from './catalog-freshness.js'
// App Store — thin app shell. The module tree is declared in mobius.json's
// source_files; the multi-file installer fetches each path and Rolldown bundles
// from this entry, resolving the relative imports below at compile time.
//
//   constants.js  — curated catalog, self-update constants, trusted hosts,
//                    and permission explanation tables
//   theme.js      — the single app stylesheet (CSS)
//   domain.js     — pure + DOM-level URL, version, schedule, and update-message logic
//   api.js        — catalog fetch, install/update, app list, and chat API helpers
//   ui/*.jsx      — one React component per file
//
// Only App lives here: it owns top-level catalog/install/navigation state and
// mounts marketplace browsing, publishing, app details, update review, and toast.
import React, { useState, useEffect, useLayoutEffect, useCallback, useMemo, useRef } from 'react'
import { CATALOG, CATALOG_URL } from './constants.js'
import { CSS } from './theme.js'
import {
  buildUpdateFailureMessage,
  buildUpdateReviewMessage,
  buildListingAgentMessage,
  listingAgentScope,
  buildPublishCheckMessage,
  buildPublishFixMessage,
  listingDraftFromPreview,
  listingPayload,
  utf8Length,
  appLifecycleFor,
  busyLabelForAction,
  storeDestinationFromMessage,
  capabilityDiffNeedsReview,
  hasAccessRows,
  catalogUpdateItemForInstalled,
  collectCategories,
  sourceAvailabilityStatus,
  communityCatalogPage,
  communityCatalogItems,
  communityPublicationStatus,
  communityPublicationsByLocalApp,
  publicationViewerHandle,
  communityRepositoryUrl,
  filterCatalog,
  findInstalled,
  isSystemCatalogItem,
  mergeCatalogEntries,
  mergeCommunityCatalog,
  mergeOfficialCommunityFeedback,
  otherInstalledCatalogItems,
  communityFeedbackOf,
  communityRatingAggregate,
  communityReceiptAfterInstall,
  communityReceiptToReconcile,
  rememberCommunityInstallRevision,
  installedCommunityRevision,
  attemptCommunityReceiptOnce,
  manifestCapabilityRows,
  resolveCatalogItemIntent,
  setInstalledMatchViewer,
  sourceBackedInstalledApps,
  needsLiveManifestFirst,
  showsSnapshotManifest,
  sortCatalogForDisplay,
  updateCandidateUrlsByInstalledId,
} from './domain.js'
import {
  createAppChat,
  latestScopedAppChat,
  createConflictResolverChat,
  createConflictResolverBatch,
  submitUpdateBatch,
  batchRoutesMissing,
  randomUuid,
  loadUpdateBatches,
  loadUpdateBatch,
  watchUpdateBatch,
  fetchCatalog,
  fetchManifest,
  fetchUninstalledApps,
  fetchUpdateCheck,
  hasConnectedProvider,
  installApp,
  loadCommunityApps,
  loadCommunityApp,
  loadCommunityReviews,
  loadCommunityIdentity,
  loadEditorialSpotlight,
  loadLocalGithubIdentity,
  loadCommunityPublications,
  loadLocalPublicationPreview,
  createPublicationListingReader,
  prepareListingImage,
  saveLocalListing,
  loadInstalledApps,
  loadProviderStatus,
  loadUpdateCandidatePreview,
  publishLocalAppToGithub,
  publishEditorialSpotlight,
  registerCommunityRevision,
  saveCommunityReview,
  withdrawCommunityApp,
  confirmCommunityInstallReceipt,
  uploadEditorialArtwork,
  openChat,
  openInstalledApp,
  openSystemSettings,
  previewApp,
  readSetupCompletions,
  readSystemSetupReady,
  seedChatMessage,
  SETUP_COMPLETIONS_KEY,
  SYSTEM_SETUP_READY_KEY,
} from './api.js'
import { CatalogList } from './ui/CatalogList.jsx'
import { CatalogFilters } from './ui/CatalogFilters.jsx'
import { CatalogSkeleton } from './ui/CatalogSkeleton.jsx'
import { DetailView } from './ui/DetailView.jsx'
import { LibraryHealth } from './ui/LibraryHealth.jsx'
import { PublisherTab } from './ui/PublisherTab.jsx'
import { SelfUpdateBanner } from './ui/SelfUpdateBanner.jsx'
import { UninstallConfirmModal } from './ui/UninstallConfirmModal.jsx'
import { UpdateReviewModal } from './ui/UpdateReviewModal.jsx'
import { Search, X } from '@openai/apps-sdk-ui/components/Icon'

export {
  appLifecycleFor,
  buildListingAgentMessage,
  listingDraftFromPreview,
  listingPayload,
  utf8Length,
  busyLabelForAction,
  catalogItemIdFromIntent,
  catalogItemIdFromMessage,
  storeDestinationFromIntent,
  storeDestinationFromMessage,
  capabilityDiffNeedsReview,
  hasAccessRows,
  catalogUpdateItemForInstalled,
  canonicalIdentityKey,
  CARD_DESCRIPTION_LIMIT,
  catalogAudience,
  catalogCardDescription,
  catalogCollection,
  collectCategories,
  sourceAvailabilityStatus,
  communityCatalogPage,
  communityCatalogItems,
  communityPublicationStatus,
  communityPublicationsByLocalApp,
  communityRepositoryUrl,
  filterCatalog,
  findInstalled,
  isSystemCatalogItem,
  mergeCatalogEntries,
  mergeCommunityCatalog,
  mergeOfficialCommunityFeedback,
  otherInstalledCatalogItems,
  communityFeedbackOf,
  communityRatingAggregate,
  communityReceiptAfterInstall,
  communityReceiptToReconcile,
  rememberCommunityInstallRevision,
  installedCommunityRevision,
  attemptCommunityReceiptOnce,
  manifestCapabilityRows,
  resolveCatalogItemIntent,
  humanCron,
  isTrustedHost,
  scheduleSummary,
  sourceBackedInstalledApps,
  needsLiveManifestFirst,
  showsSnapshotManifest,
  sortCatalogForDisplay,
  updateBatchDisposition,
  updateCandidateUrlsByInstalledId,
  validateManifestUrl,
} from './domain.js'
export { STORE_VERSION } from './constants.js'
export {
  fetchCatalog,
  fetchManifest,
  fetchUpdateCheck,
  installApp,
  loadCommunityApps,
  loadCommunityApp,
  loadCommunityReviews,
  loadCommunityIdentity,
  loadEditorialSpotlight,
  loadLocalGithubIdentity,
  loadCommunityPublications,
  loadLocalPublicationPreview,
  loadInstalledApps,
  publishLocalAppToGithub,
  publishEditorialSpotlight,
  registerCommunityRevision,
  saveCommunityReview,
  confirmCommunityInstallReceipt,
  withdrawCommunityApp,
  uploadEditorialArtwork,
  previewApp,
  proxyUrl,
  readErrorDetail,
} from './api.js'
export { capabilityChangeRows, capabilityRows, changedCapabilityPaths } from './ui/CapabilityContract.jsx'
export { appIcon, installedIconUrl } from './ui/IconBox.jsx'
export { catalogAssetFilename, catalogAssetUrl, storeAssetSource, storeAssetUrl } from './ui/StoreImage.jsx'
export { createPublicationPreviewGate } from './ui/PublisherTab.jsx'

// Snapshot-less catalogs (catalog.json is now a pure discovery index) hydrate
// every entry's manifest from its repo on open — ~16 fetches — so a 3-wide pool
// left first paint needlessly slow. 6 keeps concurrency modest against the raw
// CDN while roughly halving the hydrate wall time.
const MANIFEST_FETCH_CONCURRENCY = 6

function Toast({ toast, onDismiss }) {
  if (!toast) return null
  const className = `st-toast${toast.kind === 'success' ? ' is-success' : toast.kind === 'error' ? ' is-error' : ''}`
  return (
    <div
      className={className}
      role="status"
      aria-live={toast.kind === 'error' ? 'assertive' : 'polite'}
    >
      <div className="st-toast-msg">{toast.message}</div>
      <div className="st-toast-actions">
        {toast.action && (
          <button
            className="st-toast-btn st-toast-btn-primary"
            onClick={() => {
              onDismiss()
              toast.action.onClick?.()
            }}
          >
            {toast.action.label}
          </button>
        )}
        <button className="st-toast-btn st-toast-btn-secondary" onClick={onDismiss}>
          OK
        </button>
      </div>
    </div>
  )
}

// Why the platform refuses a candidate for an installed app (the update
// preview's 409 detail, as update-check's `candidate_rejected`).
const CANDIDATE_REJECTION_CODES = new Set(['identity_mismatch', 'repository_moved'])

// Probe GET /api/apps/{id}/update-check for the given installed rows and return
// a { [numericAppId]: source-provenance facts } map.
// Use the same bounded pool as manifest refetches. fetchUpdateCheck never
// throws; callers merge answered ids and leave unavailable rows unknown. Every
// source-backed installed row shares this authority.
async function fetchUpdateChecksFor(rows, token, catalogItems = []) {
  if (!rows.length) return {}
  const candidateUrls = updateCandidateUrlsByInstalledId(rows, catalogItems)
  const results = await mapWithConcurrency(rows, MANIFEST_FETCH_CONCURRENCY, async (app) => ({
    id: app.id,
    check: await fetchUpdateCheck(app.id, token, candidateUrls[app.id]),
  }))
  const out = {}
  for (const r of results) {
    // A transport/404 failure is not a fresh state answer. Preserve any prior
    // durable conflict/replay state until a later successful check replaces it;
    // a first-load miss has no key and never invents an update from semver.
    if (r.check !== null) out[r.id] = r.check
  }
  return out
}

function sameUpdateCheck(left, right) {
  if (left === right) return true
  if (!left || !right || typeof left !== 'object' || typeof right !== 'object') {
    return false
  }
  return left.available === right.available &&
    left.pendingUpdateState === right.pendingUpdateState &&
    left.upstreamVersion === right.upstreamVersion &&
    left.installedSourceRevision === right.installedSourceRevision &&
    left.candidateSourceDigest === right.candidateSourceDigest &&
    left.candidateRejected?.code === right.candidateRejected?.code &&
    left.candidateRejected?.message === right.candidateRejected?.message &&
    left.checkedAt === right.checkedAt
}

function knownPendingUpdateState(check) {
  if (!check || typeof check !== 'object') return null
  if (
    check.pendingUpdateState === 'needs_resolution' ||
    check.pendingUpdateState === 'replay_pending'
  ) return check.pendingUpdateState
  return null
}

// Merge fresh update-check answers into the prior map, but return the SAME
// reference when nothing changed so React bails out of the re-render — an
// up-to-date store must not re-render its grid on every focus regain (mirrors
// the manifest-refetch skip). Only newly-answered or flipped ids force a new
// object.
export function mergeUpdateChecks(prev, incoming) {
  let next = prev
  for (const k in incoming) {
    let value = incoming[k]
    if (value?.pendingUpdateState === 'unknown') {
      // Git could not classify the current receipt. Keep the new availability
      // and provenance facts, but never let uncertainty erase a previously known
      // durable resolution/replay phase.
      const priorState = knownPendingUpdateState(prev[k])
      if (priorState) value = { ...value, pendingUpdateState: priorState }
    }
    if (sameUpdateCheck(prev[k], value)) continue
    if (next === prev) next = { ...prev }
    next[k] = value
  }
  return next
}

function withoutKey(prev, key) {
  if (!key || !Object.prototype.hasOwnProperty.call(prev, key)) return prev
  const next = { ...prev }
  delete next[key]
  return next
}

function itemIdsSettledByChecks(items, apps, checks) {
  const settled = new Set()
  for (const item of items || []) {
    const app = findInstalled(apps || [], item)
    const check = app ? checks?.[app.id] : undefined
    const available = check?.available
    if (app && available === false) settled.add(item.id)
  }
  return settled
}

export default function App({ appId, token }) {
  const [savedLocation] = useState(() => {
    const nav = window.mobius?.nav
    return typeof nav?.setLocation === 'function' ? restoredStoreLocation(nav.location) : null
  })
  const [tab, setTab] = useState(savedLocation?.tab || 'browse')
  const [query, setQuery] = useState(savedLocation?.query || '')
  const [activeCollection, setActiveCollection] = useState(null)
  const collectionNavRef = useRef(null)
  const shelfScrollRef = useRef({})
  const homeScrollRef = useRef(0)
  const [category, setCategory] = useState(savedLocation?.category || 'all')
  const [catalog, setCatalog] = useState(() =>
    CATALOG.map(c => ({ ...c, manifest: c.manifest || null, error: null }))
  )
  const [communityCatalog, setCommunityCatalog] = useState([])
  const communityCatalogRef = useRef(communityCatalog)
  useEffect(() => { communityCatalogRef.current = communityCatalog }, [communityCatalog])
  const [communityError, setCommunityError] = useState('')
  const [communityLoading, setCommunityLoading] = useState(false)
  const [communityHasMore, setCommunityHasMore] = useState(false)
  const [communityOffset, setCommunityOffset] = useState(0)
  const [communityIdentity, setCommunityIdentity] = useState(null)
  const [communityIdentityError, setCommunityIdentityError] = useState('')
  const [spotlightFeed, setSpotlightFeed] = useState(null)
  const [githubIdentity, setGithubIdentity] = useState(null)
  const [githubIdentityError, setGithubIdentityError] = useState('')
  const [publishingId, setPublishingId] = useState(null)
  const [publication, setPublication] = useState(null)
  const [publicationError, setPublicationError] = useState('')
  const [publicationStates, setPublicationStates] = useState({})
  const [publicationStatesError, setPublicationStatesError] = useState('')
  const [publisherHandle, setPublisherHandle] = useState('')
  // Public listing facts (ratings, release) per community app id; see
  // createPublicationListingReader.
  const [publicationListings, setPublicationListings] = useState({})
  const [communityActionBusy, setCommunityActionBusy] = useState(false)
  const [communityActionError, setCommunityActionError] = useState({ key: '', message: '' })
  // Retry an old interrupted install receipt once when its detail opens.
  const communityReceiptAttemptsRef = useRef(new Set())
  const [otherInstalledCatalog, setOtherInstalledCatalog] = useState([])
  const otherInstalledCatalogRef = useRef(otherInstalledCatalog)
  useEffect(() => { otherInstalledCatalogRef.current = otherInstalledCatalog }, [otherInstalledCatalog])
  // Mirror of the hydrated curated catalog for foreground cleanup. Keeping it
  // out of the refresh callback's dependencies avoids rebinding browser event
  // listeners after every manifest refresh.
  const catalogRef = useRef(catalog)
  useEffect(() => { catalogRef.current = catalog }, [catalog])
  const [installed, setInstalled] = useState([])
  const installedRef = useRef(installed)
  installedRef.current = installed
  const contributeApp = useMemo(
    () => installed.find((app) => app?.slug === 'contribute') || null,
    [installed],
  )
  const identityApp = useMemo(
    () => installed.find((app) => app?.slug === 'identity') || null,
    [installed],
  )
  // Git-native update state per installed app, keyed by numeric app id. Each
  // answered check carries availability and the pending resolution/replay
  // phase; a missing/null answer is unknown and never becomes a version-based
  // update guess.
  const [updateChecks, setUpdateChecks] = useState({})
  const [setupCompletions, setSetupCompletions] = useState(() => readSetupCompletions())
  const [systemSetupComplete, setSystemSetupComplete] = useState(() => readSystemSetupReady())
  const [providerStatus, setProviderStatus] = useState(null)
  const [detail, setDetail] = useState(null)  // {id, manifest, raw_base}
  // Apps still recoverable after an uninstall. Read together with the installed apps (see refreshInstalled), so
  // both lists change on the same triggers and a note never outlives its app.
  const [uninstalledApps, setUninstalledApps] = useState([])
  // A section the open detail should scroll to ('reviews'), owned by the
  // navigation entry that requested it; see openDetailEntry.
  const [detailFocus, setDetailFocus] = useState('')
  const showDetail = useCallback((item, focus = '') => {
    setDetail(item)
    setDetailFocus(item ? focus : '')
  }, [])
  // Only nested destinations need data and host Back ownership. Scalars are
  // already restored on first paint, without waiting for network hydration.
  const [intentDestination, setIntentDestination] = useState(() =>
    savedLocation?.collection || savedLocation?.detail
      ? savedLocation.collection
        ? { kind: 'collection', collectionId: savedLocation.collection, itemId: savedLocation.detail, restored: true }
        : { kind: 'app', itemId: savedLocation.detail, restored: true } : null
  )
  // Cancel synchronously before an owner action can reuse a pending Back entry.
  const cancelDestinationRef = useRef(null)
  const cancelPendingDestination = useCallback(() => {
    const cancel = cancelDestinationRef.current
    cancelDestinationRef.current = null
    cancel?.()
    setIntentDestination(null)
  }, [])
  const [capabilityReviews, setCapabilityReviews] = useState({})
  const navDetailRef = useRef(null)  // host-owned reversible detail entry
  // B1: preserve the catalog grid's scroll across opening a detail and coming
  // back — the grid unmounts while a detail shows, so it would otherwise
  // re-mount scrolled to the top.
  const gridScrollRef = useRef(null)
  const savedGridScrollRef = useRef(0)
  const selectTab = useCallback((next) => {
    if (next === 'browse') setCategory('all')
    if (next === tab) return
    collectionNavRef.current?.close()
    collectionNavRef.current = null
    setActiveCollection(null)
    savedGridScrollRef.current = 0
    if (gridScrollRef.current) gridScrollRef.current.scrollTop = 0
    setTab(next)
  }, [tab])
  const [pendingUninstall, setPendingUninstall] = useState(null)
  // pendingUninstall: the installed app row from /api/apps/.
  // Browser modal dialogs are silently no-op'd inside the AppCanvas
  // iframe (sandbox lacks `allow-modals`), so we stage the
  // confirmation as in-app state and render our own modal.
  const [busy, setBusy] = useState(false)
  const [busyItemId, setBusyItemId] = useState(null)
  const [busyActionKind, setBusyActionKind] = useState(null)
  // Candidate loading state for the pre-apply update review. The review opens
  // from either a catalog card or DetailView, so this stays item-scoped.
  const [checkingUpdateItemId, setCheckingUpdateItemId] = useState(null)
  const [checkingAllUpdates, setCheckingAllUpdates] = useState(false)
  const [resolvingAll, setResolvingAll] = useState(false)
  const [toast, setToast] = useState(null)
  // Single and batch updates share one reviewed transaction: read-only checks,
  // one explicit confirmation, then a server-run batch the dialog follows.
  const [updateTransaction, setUpdateTransaction] = useState(null)
  const updateBatchRef = useRef(null)
  // Recent server batches (running, or with results to act on) and every
  // controller following one, keyed by batch id.
  const [updateBatches, setUpdateBatches] = useState([])
  const [batchLoadError, setBatchLoadError] = useState(null)
  const reloadUpdateBatchesRef = useRef(null)
  const batchControllersRef = useRef(new Map())
  useEffect(() => () => {
    updateBatchRef.current?.dispose()
    for (const controller of batchControllersRef.current.values()) controller.dispose()
  }, [])
  const [agentReviewingUpdate, setAgentReviewingUpdate] = useState(false)
  const [agentErrorItemId, setAgentErrorItemId] = useState(null)
  const [cardErrors, setCardErrors] = useState({})
  // A card error the same action may get past offers "Try again" (keyed by
  // item id) instead of "Ask agent".
  const [cardErrorRetries, setCardErrorRetries] = useState({})
  const [searchOpen, setSearchOpen] = useState(false)
  const searchVisible = searchOpen || !!query
  // Covers every control, including assistive clicks, before it can reuse a
  // restore-owned Back entry. Programmatic restoration dispatches no DOM events.
  const ownerInteraction = {
    onPointerDownCapture: cancelPendingDestination,
    onKeyDownCapture: cancelPendingDestination,
    onClickCapture: cancelPendingDestination,
  }
  const searchInputRef = useRef(null)
  // A complete baked snapshot is usable on the very first render. Installed
  // state and the remote registry hydrate independently; neither should make a
  // healthy catalog flash a skeleton or feel network-bound. Catalog releases
  // are required to carry a snapshot for every entry (guarded in CI).
  // Do not expose catalog cards until installed identity has resolved. The
  // previous snapshot fast path rendered every app as "not installed" for one
  // pass, which selected the asynchronous remote-icon path and visibly painted
  // letters before the same-origin installed icons replaced them. A stable
  // skeleton for this one local read gives the first real card render its final,
  // browser-cached icon URL on its first meaningful paint.
  const [loadingCatalog, setLoadingCatalog] = useState(true)
  const [catalogHydrated, setCatalogHydrated] = useState(false)
  const [catalogLoadError, setCatalogLoadError] = useState(false)
  const [installedLoadError, setInstalledLoadError] = useState('')
  // Seed the foreground debounce at mount so focus/pageshow cannot duplicate
  // the startup check before catalog hydration finishes.
  const lastUpdateCheckRef = useRef(Date.now())
  const installedReadGenerationRef = useRef(0)
  const latestInstalledReadRef = useRef(null)
  // Local mutations and targeted events supersede only their own check answers,
  // independently of installed reads and unrelated probes in a full round.
  const checkGenerationRef = useRef(0)
  const checkGenerationsRef = useRef(new Map())
  const fullCheckRoundRef = useRef(null)
  const catalogReadyRef = useRef(false)
  const pendingCheckIdsRef = useRef(new Set())
  const fullCheckPendingRef = useRef(false)

  useEffect(() => {
    function onIntent(event) {
      const destination = storeDestinationFromMessage(
        event,
        window.location.origin,
        window.parent,
      )
      if (destination) {
        cancelPendingDestination()
        setIntentDestination(destination)
      }
    }
    window.addEventListener('message', onIntent)
    return () => window.removeEventListener('message', onIntent)
  }, [cancelPendingDestination])

  const clearSettledUpdateArtifacts = useCallback((itemIds) => {
    if (!itemIds?.size) return
    const clear = prev => {
      let next = prev
      for (const id of itemIds) next = withoutKey(next, id)
      return next
    }
    setCardErrors(clear)
    setCardErrorRetries(clear)
  }, [])

  // `force` checks exactly `apps` now, for a caller that needs the answer
  // (a resolver that finished in its own chat).
  const refreshUpdateChecks = useCallback((apps, { force = false } = {}) => {
    const pendingIds = pendingCheckIdsRef.current
    const fullCheck = fullCheckPendingRef.current
    if (!catalogReadyRef.current || (!force && !fullCheck && document.visibilityState !== 'visible')) return
    // A forced check of a few apps leaves any due full round pending.
    if (!force) fullCheckPendingRef.current = false
    // Reuse a slow full round, but still let events replace only their own
    // probes immediately. Never invalidate unrelated answers in that round.
    const startFullCheck = !force && fullCheck && !fullCheckRoundRef.current
    if (!force && !startFullCheck && !pendingIds.size) return fullCheckRoundRef.current
    const rows = sourceBackedInstalledApps(apps, { excludeAppIds: [appId] })
      .filter(app => force || startFullCheck || pendingIds.has(String(app.id)))
    if (force) for (const app of rows) pendingIds.delete(String(app.id))
    else pendingIds.clear()
    const generation = ++checkGenerationRef.current
    for (const app of rows) checkGenerationsRef.current.set(String(app.id), generation)
    const round = fetchUpdateChecksFor(rows, token, [
      ...catalogRef.current, ...communityCatalogRef.current, ...otherInstalledCatalogRef.current,
    ]).then(checks => {
      const currentChecks = Object.fromEntries(Object.entries(checks)
        .filter(([id]) => checkGenerationsRef.current.get(id) === generation))
      setUpdateChecks(prev => mergeUpdateChecks(prev, currentChecks))
      clearSettledUpdateArtifacts(itemIdsSettledByChecks(
        [...catalogRef.current, ...otherInstalledCatalogRef.current], apps, currentChecks,
      ))
      return currentChecks
    }).finally(() => {
      if (fullCheckRoundRef.current === round) fullCheckRoundRef.current = null
    })
    if (startFullCheck) {
      lastUpdateCheckRef.current = Date.now()
      fullCheckRoundRef.current = round
    }
    return round
  }, [appId, token, clearSettledUpdateArtifacts])

  // Every caller follows the latest authoritative read. Supersession is not a
  // failure, and a newer read never waits for an older read or background checks.
  const refreshInstalled = useCallback(({ checkAll = false } = {}) => {
    if (checkAll) fullCheckPendingRef.current = true
    const generation = ++installedReadGenerationRef.current
    const invalidation = ++checkGenerationRef.current
    for (const id of pendingCheckIdsRef.current) checkGenerationsRef.current.set(id, invalidation)
    const read = (async () => {
      let apps
      try {
        apps = await loadInstalledApps(token)
      } catch (err) {
        if (generation !== installedReadGenerationRef.current) return latestInstalledReadRef.current
        setInstalledLoadError(err?.message || 'Installed apps could not be loaded.')
        return null
      }
      if (generation !== installedReadGenerationRef.current) return latestInstalledReadRef.current
      setInstalled(apps)
      setInstalledLoadError('')
      void fetchUninstalledApps(token).then(rows => {
        if (generation === installedReadGenerationRef.current) setUninstalledApps(rows)
      }).catch(() => {})
      void refreshUpdateChecks(apps)
      return apps
    })()
    latestInstalledReadRef.current = read
    return read
  }, [token, refreshUpdateChecks])

  // Initial fetch: catalog manifests + installed apps.
  // Every await is guarded so a single failing network call can't leave the
  // grid stuck on the skeleton: loadInstalledApps rejects (not just returns
  // []) on a transport-level error, and the per-manifest hydrate already
  // catches per-item — so the only thing that could strand loadingCatalog
  // is an unguarded reject. The finally clears the skeleton unconditionally.
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        // Start the dynamic registry immediately, but do not put it on the
        // first-paint critical path. The baked snapshot catalog is already a
        // complete, usable floor; only the installed-app list may delay the
        // initial cards. Provider setup status decorates actions after paint
        // and must not hold the whole catalog behind its retry path.
        const remoteCatalogPromise = fetchCatalog(CATALOG_URL, token)
          .catch(() => null)
        const providerStatusPromise = loadProviderStatus(token)
        const apps = await refreshInstalled() || []
        if (cancelled) return
        setSetupCompletions(readSetupCompletions())
        setSystemSetupComplete(readSystemSetupReady())
        if (CATALOG.every((entry) => entry.manifest)) {
          setLoadingCatalog(false)
        }
        providerStatusPromise.then((nextProviderStatus) => {
          if (!cancelled && nextProviderStatus) setProviderStatus(nextProviderStatus)
        })
        // Resolve the catalog SOURCE by MERGING the web registry (catalog.json,
        // fetched via the proxy) OVER the baked CATALOG — never replacing it.
        // Baked is the floor: an app in the baked list can never vanish because
        // the registry is stale/partial (which would drop it from Browse + its
        // update/rehydrate flows). The registry overrides a known app's URL
        // fields and can ADD new apps. This is what lets a newly-published app
        // appear without a store-app redeploy — appending it to catalog.json on
        // main is enough. On fetch failure /
        // empty result, the baked CATALOG carries the store untouched.
        const remote = await remoteCatalogPromise
        if (cancelled) return
        setCatalogLoadError(remote === null)
        const entries = mergeCatalogEntries(CATALOG, remote)
        // A baked manifest gives every discovery card a fast first paint, but
        // it must not freeze a listing at the last Store release. Installed
        // apps refresh here, before the startup source check; every other
        // listing refreshes in the background once the catalog has settled.
        const hydrated = await mapWithConcurrency(
          entries,
          MANIFEST_FETCH_CONCURRENCY,
          async (c) => {
            if (!needsLiveManifestFirst(c, apps)) {
              return { ...c, error: null }
            }
            try {
              const manifest = await fetchManifest(c.manifest_url, token)
              return { ...c, manifest, error: null }
            } catch (e) {
              // A failed live read keeps the baked manifest: the card stays as
              // it painted. Only an entry with nothing to show reports it.
              // The trade-off: a permanent failure (a 404 for a moved or
              // deleted repository) is not shown here either. For an installed
              // app the update check still reports its source; installing a
              // listing reports the failure when it fetches the release.
              return c.manifest
                ? { ...c, error: null }
                : { ...c, manifest: null, error: e.message || String(e) }
            }
          },
        )
        if (cancelled) return
        catalogRef.current = hydrated
        catalogReadyRef.current = true
        setCatalog(hydrated)
        lastUpdateCheckRef.current = Date.now()
        // Always run the startup check with the live catalog and a fresh
        // installed list, even if an event superseded the first-paint read.
        void refreshInstalled({ checkAll: true })
        void refreshSnapshotListings(entries.filter((c) => !needsLiveManifestFirst(c, apps)))
      } finally {
        if (!cancelled) {
          setLoadingCatalog(false)
          setCatalogHydrated(true)
        }
      }
    }
    // Replace each remaining snapshot with its live manifest in one commit, so
    // the grid re-renders once; an open detail page takes it in place. A
    // failed read keeps the snapshot, which the detail view labels as cached.
    async function refreshSnapshotListings(listings) {
      const live = new Map()
      await mapWithConcurrency(listings, MANIFEST_FETCH_CONCURRENCY, async (c) => {
        try {
          live.set(c.id, await fetchManifest(c.manifest_url, token))
        } catch {
          // Keep the snapshot; the next Store open tries again.
        }
      })
      if (cancelled || live.size === 0) return
      const withLive = (c) => (
        c && live.has(c.id) && showsSnapshotManifest(c) ? { ...c, manifest: live.get(c.id) } : c
      )
      setCatalog((current) => current.map(withLive))
      setDetail(withLive)
    }
    load()
    return () => {
      cancelled = true
      installedReadGenerationRef.current += 1
      latestInstalledReadRef.current = null
      fullCheckRoundRef.current = null
      checkGenerationsRef.current.clear()
      catalogReadyRef.current = false
      pendingCheckIdsRef.current.clear()
      fullCheckPendingRef.current = false
    }
  }, [appId, token, refreshInstalled])

  // Reflection counts real opens from app_ready, so it fires once the first
  // usable catalog has painted, not after the background registry refresh,
  // which a slow upstream can hold open long after the Store is in use.
  // It also fires after a failed installed-apps read: the Store is open and
  // shows its reconnect state, which is still a real open.
  const appReadySignalledRef = useRef(false)
  useEffect(() => {
    if (loadingCatalog || appReadySignalledRef.current) return
    appReadySignalledRef.current = true
    window.mobius?.signal?.('app_ready', { installed_count: installed.length })
  }, [loadingCatalog, installed.length])

  const communityRequestRef = useRef(0)
  const communityAbortRef = useRef(null)
  const communityBusyRef = useRef(false)
  const refreshCommunity = useCallback(async ({ append = false, background = false } = {}) => {
    if (background && communityBusyRef.current) return
    communityAbortRef.current?.abort()
    const controller = new AbortController()
    communityAbortRef.current = controller
    communityBusyRef.current = true
    const requestId = communityRequestRef.current + 1
    communityRequestRef.current = requestId
    const limit = 24
    const offset = append ? communityOffset : 0
    if (!background) setCommunityLoading(true)
    try {
      // Refresh the loaded window atomically: do not discard pages the owner
      // already loaded, or replace them with a partial failed refresh.
      const target = background ? Math.max(limit, communityOffset) : limit
      const page = await loadCommunityWindow(
        params => loadCommunityApps(token, { ...params, query: query.trim(), signal: controller.signal }),
        { offset, limit, target: append ? offset + limit : target },
      )
      if (communityRequestRef.current !== requestId) return
      setCommunityCatalog((current) => append
        ? mergeCommunityCatalog(current, page.items)
        : page.items)
      setCommunityOffset(page.nextOffset)
      setCommunityHasMore(page.hasMore)
      setCommunityError('')
    } catch (error) {
      if (communityRequestRef.current !== requestId || controller.signal.aborted) return
      setCommunityError(error?.message || 'Community apps are unavailable right now.')
    } finally {
      if (communityRequestRef.current === requestId) {
        communityBusyRef.current = false
        setCommunityLoading(false)
      }
    }
  }, [token, query, communityOffset])

  const refreshPublicationListings = useMemo(() => createPublicationListingReader(
    token, (id, listing) => setPublicationListings((current) => ({ ...current, [id]: listing })),
  ), [token])

  const showPublications = useCallback((payload) => {
    setPublicationStates(communityPublicationsByLocalApp(payload))
    setPublisherHandle(publicationViewerHandle(payload))
    setPublicationStatesError('')
    refreshPublicationListings(payload?.items)
  }, [refreshPublicationListings])

  const refreshPublicationStates = useCallback(async () => {
    try {
      showPublications(await loadCommunityPublications(token))
    } catch (error) {
      setPublicationStatesError(error?.message || 'Publication status is unavailable right now.')
    }
  }, [token, showPublications])

  useEffect(() => {
    let cancelled = false
    Promise.allSettled([
      loadCommunityIdentity(token),
      loadCommunityPublications(token),
      loadLocalGithubIdentity(token),
      loadEditorialSpotlight(token),
    ]).then(([identityResult, publicationsResult, githubResult, spotlightResult]) => {
      if (cancelled) return
      if (identityResult.status === 'fulfilled') {
        setCommunityIdentity(identityResult.value)
        setCommunityIdentityError('')
      } else {
        setCommunityIdentityError(identityResult.reason?.message || 'Identity is unavailable right now.')
      }
      if (publicationsResult.status === 'fulfilled') {
        showPublications(publicationsResult.value)
      } else {
        setPublicationStatesError(publicationsResult.reason?.message || 'Publication status is unavailable right now.')
      }
      if (githubResult.status === 'fulfilled') {
        setGithubIdentity(githubResult.value)
        setGithubIdentityError('')
      } else {
        setGithubIdentity({ connected: false, login: '' })
        setGithubIdentityError(githubResult.reason?.message || 'GitHub connection is unavailable right now.')
      }
      if (spotlightResult.status === 'fulfilled') {
        setSpotlightFeed(spotlightResult.value)
      }
    })
    return () => { cancelled = true }
  }, [token, showPublications])

  useEffect(() => {
    if (tab !== 'browse') return undefined
    const timer = window.setTimeout(() => {
      setCommunityOffset(0)
      refreshCommunity({ append: false })
    }, query ? 250 : 0)
    return () => {
      window.clearTimeout(timer)
      communityAbortRef.current?.abort()
      communityRequestRef.current += 1
      communityBusyRef.current = false
    }
  // Pagination state changes after a page arrives; only query/tab changes or
  // an explicit Load more action should issue another request.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, token, query])

  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus()
  }, [searchOpen])

  const refreshCommunityRef = useRef(refreshCommunity)
  useLayoutEffect(() => { refreshCommunityRef.current = refreshCommunity }, [refreshCommunity])
  useEffect(() => {
    if (tab !== 'browse') return undefined
    return watchCatalogFreshness(() => refreshCommunityRef.current({ background: true }))
  }, [tab])


  const refreshGithubIdentity = useCallback(async () => {
    try {
      setGithubIdentity(await loadLocalGithubIdentity(token))
      setGithubIdentityError('')
    } catch (error) {
      setGithubIdentityError(error?.message || 'GitHub connection is unavailable right now.')
    }
  }, [token])

  // Contribute owns connection setup. Refresh the inherited status when the
  // owner comes back from it; App Store never starts a second OAuth flow.
  useEffect(() => {
    if (tab !== 'publish' || githubIdentity?.connected) return undefined
    const onFocus = () => { void refreshGithubIdentity() }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [githubIdentity, refreshGithubIdentity, tab])

  useEffect(() => {
    setInstalledMatchViewer(githubIdentity?.login || '')
  }, [githubIdentity])

  const handleRegisterCommunity = useCallback(async (release) => {
    if (publishingId) return false
    setPublishingId('github-release')
    setPublication(null)
    setPublicationError('')
    try {
      const result = await registerCommunityRevision(token, release)
      const listed = result?.app || result
      setPublication({
        ...listed,
        name: listed?.manifest?.name || release.repository,
        status: communityPublicationStatus(listed),
        repository_url: communityRepositoryUrl(
          listed?.repository_url || `https://github.com/${release.repository}`,
        ),
      })
      await Promise.allSettled([refreshCommunity(), refreshPublicationStates()])
      return true
    } catch (error) {
      setPublicationError(error?.message || 'This GitHub release could not be listed.')
      return false
    } finally {
      setPublishingId(null)
    }
  }, [publishingId, refreshCommunity, refreshPublicationStates, token])

  const handlePublishLocal = useCallback(async (localAppId, repositoryName, reviewedCommit = '') => {
    if (publishingId) return false
    setPublishingId(localAppId)
    setPublication(null)
    setPublicationError('')
    try {
      const result = await publishLocalAppToGithub(token, localAppId, repositoryName)
      const listed = result?.app || result
      setPublication({
        ...listed,
        name: listed?.manifest?.name || repositoryName,
        status: communityPublicationStatus(listed),
        repository_url: communityRepositoryUrl(listed?.repository_url || (
          githubIdentity?.login ? `https://github.com/${githubIdentity.login}/${repositoryName}` : ''
        )),
        // Publishing takes whatever revision is accepted at that moment.
        revision_moved: !!(reviewedCommit && result?.published_commit
          && result.published_commit !== String(reviewedCommit).toLowerCase()),
      })
      await Promise.allSettled([refreshCommunity(), refreshPublicationStates()])
      return true
    } catch (error) {
      setPublicationError(error?.message || 'This local app could not be published.')
      return false
    } finally {
      setPublishingId(null)
    }
  }, [githubIdentity, publishingId, refreshCommunity, refreshPublicationStates, token])

  const updateCommunityFeedback = useCallback((communityId, updater) => {
    setCommunityCatalog((items) => items.map((item) => (
      item.community?.id === communityId
        ? { ...item, community: updater(item.community) }
        : item
    )))
    setDetail((item) => {
      if (item?.community?.id === communityId) {
        return { ...item, community: updater(item.community) }
      }
      if (item?.community_feedback?.id === communityId) {
        return { ...item, community_feedback: updater(item.community_feedback) }
      }
      return item
    })
  }, [])

  const confirmCommunityInstall = useCallback(async (item, installedApp, revisionId) => {
    const feedback = communityFeedbackOf(item)
    if (!feedback?.id || !revisionId || !installedApp?.id) return false
    const feedbackKey = `${feedback.id}:${feedback.revision_id}`
    try {
      const refreshed = await confirmCommunityInstallReceipt(
        token,
        feedback.id,
        revisionId,
        `app:${installedApp.id}:${installedApp.slug || item.manifest?.id || 'community'}`,
      )
      updateCommunityFeedback(feedback.id, (current) => ({
        ...current,
        review_eligibility: String(refreshed.review_eligibility || current.review_eligibility),
        has_verified_install: refreshed.has_verified_install === true,
        user_review: refreshed.user_review || null,
      }))
      setCommunityActionError((current) => (
        current.key === feedbackKey ? { key: feedbackKey, message: '' } : current
      ))
      return true
    } catch (error) {
      setCommunityActionError({
        key: feedbackKey,
        message: error?.message || 'Your installation could not be verified for rating.',
      })
      return false
    }
  }, [token, updateCommunityFeedback])

  // Reconcile a missed receipt when an installed app's detail opens; see
  // communityReceiptToReconcile for when one is due and which revision it names.
  useEffect(() => {
    const receipt = communityReceiptToReconcile(detail, installed, communityIdentity)
    if (!receipt) return
    void attemptCommunityReceiptOnce(
      communityReceiptAttemptsRef.current,
      receipt.attemptKey,
      () => confirmCommunityInstall(detail, receipt.installedApp, receipt.revisionId),
    )
  }, [communityIdentity, confirmCommunityInstall, detail, installed])

  useEffect(() => {
    const communityId = communityFeedbackOf(detail)?.id
    if (!communityId) return undefined
    let active = true
    loadCommunityReviews(token, communityId).then((result) => {
      if (!active) return
      updateCommunityFeedback(communityId, (current) => ({
        ...current,
        reviews: Array.isArray(result.items) ? result.items : [],
        reviews_loaded: true,
        reviews_error: '',
      }))
    }).catch((error) => {
      if (!active) return
      updateCommunityFeedback(communityId, (current) => ({
        ...current,
        reviews_loaded: true,
        reviews_error: error?.message || 'Ratings and reviews could not be loaded.',
      }))
    })
    return () => { active = false }
  }, [detail?.community?.id, detail?.community_feedback?.id, token, updateCommunityFeedback])

  const handleCommunityFeedback = useCallback(async (stars, body) => {
    const feedback = communityFeedbackOf(detail)
    if (!feedback
      || communityActionBusy
      || !communityIdentity?.linked
      || feedback.review_eligibility !== 'eligible'
      || !Number.isInteger(stars) || stars < 1 || stars > 5) {
      return false
    }
    const feedbackKey = `${feedback.id}:${feedback.revision_id}`
    setCommunityActionBusy(true)
    setCommunityActionError({ key: feedbackKey, message: '' })
    try {
      const result = await saveCommunityReview(token, feedback.id, stars, body)
      // Only this app's rating changed; re-read its listing if it is one of yours.
      if (Object.values(publicationStates).some((state) => state.community_app_id === feedback.id)) {
        refreshPublicationListings([{ status: 'live', community_app_id: feedback.id }], { force: true })
      }
      updateCommunityFeedback(feedback.id, (current) => ({
        ...current,
        user_review: result.user_review || null,
        // The registry may return the aggregate flat, nested under `rating`, or
        // not at all; never let a missing or nested shape render NaN.
        ...communityRatingAggregate(result, current),
        review_eligibility: String(result.review_eligibility || current.review_eligibility),
      }))
      try {
        const reviews = await loadCommunityReviews(token, feedback.id)
        updateCommunityFeedback(feedback.id, (current) => ({
          ...current,
          reviews: Array.isArray(reviews.items) ? reviews.items : [],
          reviews_loaded: true,
          reviews_error: '',
        }))
      } catch (readError) {
        updateCommunityFeedback(feedback.id, (current) => ({
          ...current,
          reviews_error: readError?.message || 'Review saved, but the list could not refresh.',
        }))
      }
      return true
    } catch (error) {
      setCommunityActionError({
        key: feedbackKey,
        message: error?.message || 'Your rating or review could not be saved.',
      })
      return false
    } finally {
      setCommunityActionBusy(false)
    }
  }, [communityActionBusy, communityIdentity, detail, token, updateCommunityFeedback, publicationStates, refreshPublicationListings])

  const handleUploadSpotlightArtwork = useCallback(
    (file) => uploadEditorialArtwork(token, file),
    [token],
  )

  const handlePublishSpotlight = useCallback(async (items) => {
    const next = await publishEditorialSpotlight(token, items)
    setSpotlightFeed(next)
    setToast({ kind: 'success', message: 'The shared Spotlight lineup is live.' })
    return next
  }, [token])

  const listedCatalog = useMemo(
    () => mergeOfficialCommunityFeedback(catalog, communityCatalog),
    [catalog, communityCatalog],
  )

  // Published apps may exist outside both the curated registry and the live
  // community catalog. Hydrate only those genuinely unrepresented installs,
  // while excluding this Store's own row. A cancelled effect cannot replace a
  // newer installed-state result after focus refresh.
  const otherInstalledCatalogSources = useMemo(
    () => otherInstalledCatalogItems(installed, listedCatalog, { excludeAppIds: [appId] }),
    [appId, installed, listedCatalog],
  )
  useEffect(() => {
    let cancelled = false
    if (!otherInstalledCatalogSources.length) {
      setOtherInstalledCatalog([])
      return () => { cancelled = true }
    }
    mapWithConcurrency(otherInstalledCatalogSources, MANIFEST_FETCH_CONCURRENCY, async (item) => {
      try {
        const manifest = await fetchManifest(item.manifest_url, token)
        return { ...item, manifest, error: null }
      } catch (error) {
        return { ...item, error: error.message || String(error) }
      }
    }).then((items) => {
      if (!cancelled) setOtherInstalledCatalog(items)
    })
    return () => { cancelled = true }
  }, [otherInstalledCatalogSources, token])

  const REHYDRATE_DEBOUNCE_MS = 50_000
  const handleRetryInstalled = useCallback(() => refreshInstalled({ checkAll: true }), [refreshInstalled])

  const refreshSetupState = useCallback(async () => {
    setSetupCompletions(readSetupCompletions())
    setSystemSetupComplete(readSystemSetupReady())
    const nextProviderStatus = await loadProviderStatus(token)
    if (nextProviderStatus) setProviderStatus(nextProviderStatus)
  }, [token])

  useEffect(() => {
    function onStorage(e) {
      if (e.key === SETUP_COMPLETIONS_KEY) setSetupCompletions(readSetupCompletions())
      if (e.key === SYSTEM_SETUP_READY_KEY) setSystemSetupComplete(readSystemSetupReady())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  // Parent events only invalidate IDs; installed state always comes from the
  // API. Coalesce a message burst in one microtask and defer hidden-frame work
  // until foreground return. No polling, and no waiting for older requests.
  useEffect(() => {
    let active = true
    let queued = false
    let foreground = false
    function scheduleRefresh() {
      if (queued || document.visibilityState !== 'visible') return
      queued = true
      queueMicrotask(() => {
        queued = false
        if (!active || document.visibilityState !== 'visible') return
        const checkAll = foreground
          && Date.now() - lastUpdateCheckRef.current >= REHYDRATE_DEBOUNCE_MS
        foreground = false
        void refreshInstalled({ checkAll })
      })
    }
    function onForeground() {
      if (document.visibilityState !== 'visible') return
      foreground = true
      refreshSetupState().catch(() => {})
      scheduleRefresh()
    }
    function onManagedAppEvent(event) {
      if (event.source !== window.parent || event.data?.type !== 'moebius:managed-app-event') return
      const id = event.data.event?.appId
      if (typeof id !== 'string' && typeof id !== 'number') return
      pendingCheckIdsRef.current.add(String(id))
      scheduleRefresh()
    }
    window.addEventListener('message', onManagedAppEvent)
    document.addEventListener('visibilitychange', onForeground)
    window.addEventListener('focus', onForeground)
    window.addEventListener('pageshow', onForeground)
    return () => {
      active = false
      window.removeEventListener('message', onManagedAppEvent)
      document.removeEventListener('visibilitychange', onForeground)
      window.removeEventListener('focus', onForeground)
      window.removeEventListener('pageshow', onForeground)
    }
  }, [refreshInstalled, refreshSetupState])

  // Re-fetch a single catalog manifest. Wired into CatalogCard's
  // "Try again" affordance — replaces the previous behavior where a
  // failed manifest stayed dead until the whole app reloaded.
  const retryCatalogItem = useCallback(async (item) => {
    setCatalog(prev => prev.map(c =>
      c.id === item.id ? { ...c, manifest: null, error: null, _retrying: true } : c
    ))
    try {
      const manifest = await fetchManifest(item.manifest_url, token)
      setCatalog(prev => prev.map(c =>
        c.id === item.id ? { ...c, manifest, error: null, _retrying: false } : c
      ))
    } catch (e) {
      setCatalog(prev => prev.map(c =>
        c.id === item.id ? { ...c, manifest: null, error: e.message || String(e), _retrying: false } : c
      ))
    }
  }, [token])

  // Wire the moebius:open-app postMessage with a toast fallback for
  // the (defensive) standalone case. The shell handler validates the
  // appId before navigating; we don't need an ack here.
  const handleOpenInstalled = useCallback((id) => {
    openInstalledApp(id, {
      onUnembedded: () => {
        setToast({
          kind: 'error',
          message: 'Open this app from the drawer.',
        })
      },
    })
  }, [])

  const handleSetup = useCallback((item, installedApp) => {
    const setup = item?.setup || {}
    if (setup.scope === 'system') {
      openSystemSettings(setup.section || 'background-agents', () => {
        setToast({
          kind: 'error',
          message: 'Open Settings from the drawer.',
        })
      })
      return
    }
    if (installedApp?.id) {
      openInstalledApp(installedApp.id, {
        intent: 'setup',
        onUnembedded: () => {
          setToast({
            kind: 'error',
            message: 'Open this app from the drawer.',
          })
        },
      })
    }
  }, [])

  const reviewCapabilities = useCallback(async (item) => {
    if (!item?.id) return
    setCapabilityReviews(prev => ({
      ...prev,
      [item.id]: { status: 'loading', preview: null, error: '' },
    }))
    try {
      const preview = await previewApp({
        manifest_url: item.manifest_url,
        manifest: item.manifest,
        raw_base: item.raw_base,
        token,
      })
      setCapabilityReviews(prev => ({
        ...prev,
        [item.id]: { status: 'ready', preview, error: '' },
      }))
    } catch (error) {
      setCapabilityReviews(prev => ({
        ...prev,
        [item.id]: {
          status: 'error', preview: null,
          error: error.message || 'Capabilities could not be checked.',
        },
      }))
    }
  }, [token])

  // Fresh installs run inline from DetailView, with no access check first. Reviewed updates never come here:
  // they run as batches (see createBatchController). `busy` keeps the
  // initiating surface dimensionally stable while the install is in flight.
  const handleInstall = async item => {
    if (busy) return { ok: false, reason: 'busy' }
    setBusy(true)
    setBusyItemId(item?.id || null)
    setBusyActionKind('install')
    setCardErrors(prev => withoutKey(prev, item.id))
    setCardErrorRetries(prev => withoutKey(prev, item.id))
    try {
      // GitHub-backed apps install from manifest_url so the backend fetches
      // the latest release at click time. The in-memory manifest is only the
      // preview/fallback path for entries without a durable URL.
      const result = await installApp({
        manifest_url: item.manifest_url,
        manifest: item.manifest,
        raw_base: item.raw_base,
        token,
      })
      // A local mutation is newer than any background probe already in flight.
      // Invalidate only this app's answer; unrelated checks can still finish.
      if (result.id) checkGenerationsRef.current.set(String(result.id), ++checkGenerationRef.current)

      if (result.id) {
        // A successful install/update just made this app current. The
        // git-native probe is authoritative over version strings, so leaving a
        // stale `true` here keeps the card/detail CTA on "Update" until the
        // next debounced recheck. Clear it optimistically; later focus checks
        // can flip it back if upstream moves again.
        setUpdateChecks(prev => mergeUpdateChecks(prev, {
          [result.id]: {
            available: false,
            pendingUpdateState: 'none',
            upstreamVersion: result.version || null,
          },
        }))
      }
      const communityFeedback = communityFeedbackOf(item)
      if (communityFeedback?.id && communityFeedback?.revision_id && result.id) {
        rememberCommunityInstallRevision(result, communityFeedback)
      }
      setCardErrors(prev => withoutKey(prev, item.id))
      await refreshInstalled()
      // Only a linked mobius.you identity gets a receipt (and its failure
      // message): an unlinked owner can still install a public listing.
      const receipt = communityReceiptAfterInstall(item, result, communityIdentity)
      if (receipt) {
        // Do not hold the completed install UI on an external community call.
        // The receipt request itself uses keepalive if the owner opens the app.
        void attemptCommunityReceiptOnce(
          communityReceiptAttemptsRef.current,
          receipt.attemptKey,
          () => confirmCommunityInstall(item, result, receipt.revisionId),
        )?.then((confirmed) => {
          if (!confirmed) setToast({
            kind: 'error',
            message: 'App installed, but rating access could not be verified. Reopen Store to retry.',
          })
        })
      }
      const openAction = result.id
        ? {
            label: 'Open App',
            onClick: () => handleOpenInstalled(result.id),
          }
        : null
      const appName = result.name || item.manifest?.name || item.id
      const versionText = result.version || item.manifest?.version

      const verb = result.mode === 'update' ? 'updated' : 'installed'
      const installNotes = result.warnings || []
      const warnSuffix = installNotes.length
        ? ` (with notes: ${installNotes.join('; ')})`
        : ''
      if (result.mode === 'update') {
        window.mobius?.signal?.('app_updated', { slug: result.id || item.id })
      } else {
        window.mobius?.signal?.('app_installed', { slug: result.id || item.id })
      }
      // No "reload to see it in the drawer" hint — the backend emits an
      // app_updated SSE event after install/update, and the shell listens
      // for that and refreshes its drawer automatically. The toast just
      // confirms what happened.
      setToast({
        kind: 'success',
        message: `${appName} ${verb}${warnSuffix}.`,
        action: openAction,
      })
      return { ok: true, result }
      // Stay on the detail view. Two reasons: (1) closing here would
      // bounce the user back to the catalog grid mid-action, which felt
      // like the app didn't acknowledge the tap. (2) after refreshInstalled
      // resolves the detail re-renders with the installed state — the
      // primary CTA flips from "Install" to "Open App", confirming the
      // commit on the same surface the user committed it from. The user
      // can use the back arrow / device-back to dismiss when ready.
    } catch (e) {
      const message = e.message || String(e)
      // A transient failure (the platform says `retryable`, or the request
      // never got an answer) offers the same reviewed install again.
      const retry = e?.retryable === true || !e?.status
        ? () => { void handleInstallRef.current(item) }
        : null
      setCardErrors(prev => ({ ...prev, [item.id]: message }))
      setCardErrorRetries(prev => retry ? { ...prev, [item.id]: retry } : withoutKey(prev, item.id))
      window.mobius?.signal?.('error', { message, source: 'install' })
      // Installs start from DetailView, where no card shows this error.
      setToast({ kind: 'error', message, action: retry ? { label: 'Try again', onClick: retry } : null })
      return { ok: false, reason: 'error', error: message }
    } finally {
      setBusy(false)
      setBusyItemId(null)
      setBusyActionKind(null)
    }
  }
  const handleInstallRef = useRef(handleInstall)
  handleInstallRef.current = handleInstall

  const handleReviewUpdate = async (notice) => {
    if (busy || !notice) return
    setBusy(true)
    setBusyItemId(notice.itemId || null)
    setBusyActionKind('resolve')
    setCardErrors(prev => withoutKey(prev, notice.itemId))
    setCardErrorRetries(prev => withoutKey(prev, notice.itemId))
    try {
      const resolver = await createConflictResolverChat(
        notice.appId,
        'preserve_local',
        token,
      )
      openChat(resolver.chat_id)
    } catch (e) {
      const message = e.message || String(e)
      const retry = e?.retryable === true || !e?.status
        ? () => { void handleReviewUpdateRef.current(notice) }
        : null
      setCardErrors(prev => ({ ...prev, [notice.itemId]: message }))
      if (retry) setCardErrorRetries(prev => ({ ...prev, [notice.itemId]: retry }))
      // A card shows this error; the detail page has no card, so it gets a toast.
      if (detail) setToast({ kind: 'error', message, action: retry ? { label: 'Try again', onClick: retry } : null })
    } finally {
      setBusy(false)
      setBusyItemId(null)
      setBusyActionKind(null)
    }
  }
  const handleReviewUpdateRef = useRef(handleReviewUpdate)
  handleReviewUpdateRef.current = handleReviewUpdate

  // Stage the uninstall — DetailView's Uninstall button calls this,
  // and the modal's Confirm calls confirmUninstall to actually run
  // the DELETE. Splitting these out is required because the iframe
  // sandbox blocks browser modal dialogs; see pendingUninstall comment.
  const handleUninstall = (app) => {
    setPendingUninstall(app)
  }

  const confirmUninstall = async () => {
    const app = pendingUninstall
    if (!app) return
    setBusy(true)
    setBusyItemId(detail?.id || null)
    setBusyActionKind('uninstall')
    try {
      const r = await fetch(`/api/apps/${app.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!r.ok && r.status !== 204) {
        const text = await r.text()
        throw new Error(`Uninstall failed: ${r.status} ${text}`)
      }
      checkGenerationsRef.current.set(String(app.id), ++checkGenerationRef.current)
      await refreshInstalled()
      window.mobius?.signal?.('app_uninstalled', { slug: app.slug || app.id })
      setToast({ kind: 'success', message: `${app.name} uninstalled.` })
      setPendingUninstall(null)
      closeDetail()
    } catch (e) {
      setToast({ kind: 'error', message: e.message || String(e) })
      setPendingUninstall(null)
    } finally {
      setBusy(false)
      setBusyItemId(null)
      setBusyActionKind(null)
    }
  }

  // Toast auto-dismiss.
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 6000)
    return () => clearTimeout(t)
  }, [toast])

  // Each nested level owns one reversible host entry. No iframe history or
  // timeout fallback: an unowned view would strand the device's Back gesture.
  const openDetail = useCallback((item, signal, { focus = '' } = {}) => openDetailEntry(navDetailRef, item, {
    nav: window.mobius.nav,
    show: showDetail,
    signal,
    focus,
    cancelPendingDestination,
    prepare: target => {
      reviewCapabilities(target)
      if (!navDetailRef.current) savedGridScrollRef.current = gridScrollRef.current?.scrollTop || 0
    },
  }), [reviewCapabilities, cancelPendingDestination, showDetail])

  const openCollection = useCallback(async (id, signal) => {
    if (collectionNavRef.current) return
    homeScrollRef.current = gridScrollRef.current?.scrollTop || 0
    const leave = () => {
      cancelPendingDestination()
      collectionNavRef.current = null
      savedGridScrollRef.current = homeScrollRef.current
      setActiveCollection(null)
    }
    let handle
    handle = window.mobius.nav.open('app-store-collection', {
      onBack: leave,
      onForward: () => {
        setTab('browse')
        cancelPendingDestination()
        setCategory('all')
        collectionNavRef.current = handle
        savedGridScrollRef.current = 0
        setActiveCollection(id)
      },
    })
    collectionNavRef.current = handle
    const cancel = () => {
      if (collectionNavRef.current === handle) collectionNavRef.current = null
      handle.close()
    }
    signal?.addEventListener('abort', cancel, { once: true })
    const {status} = await handle.outcome
    signal?.removeEventListener('abort', cancel)
    if (collectionNavRef.current !== handle) { handle.close(); return }
    if (status !== 'owned') { collectionNavRef.current = null; return }
    savedGridScrollRef.current = 0
    setActiveCollection(id)
  }, [cancelPendingDestination])

  const closeCollection = useCallback(() => {
    collectionNavRef.current?.close()
    collectionNavRef.current = null
    savedGridScrollRef.current = homeScrollRef.current
    setActiveCollection(null)
  }, [])

  useEffect(() => () => {
    cancelDestinationRef.current?.()
    cancelDestinationRef.current = null
    navDetailRef.current?.handle.close()
    collectionNavRef.current?.close()
  }, [])

  const prepareCatalogUpdate = useCallback(async (item, { signal } = {}) => {
    const installedApp = findInstalled(installed, item)
    if (!installedApp) throw new Error('Installed app could not be matched for review.')
    const updateItem = catalogUpdateItemForInstalled(item, installedApp)
    let candidate
    try {
      candidate = await loadUpdateCandidatePreview(
        installedApp.id, updateItem.manifest_url, token, { signal },
      )
    } catch (error) {
      if (error?.status === 409 && CANDIDATE_REJECTION_CODES.has(error.code)) {
        // The platform would not apply this candidate to the installed app
        // (a moved repository, or another package). The card says why too.
        // Other coded 409s (a Git source that could not be read) are ordinary
        // failures, with Try again when they are retryable.
        checkGenerationsRef.current.set(String(installedApp.id), ++checkGenerationRef.current)
        setUpdateChecks(prev => mergeUpdateChecks(prev, {
          [installedApp.id]: {
            ...prev[installedApp.id],
            available: null,
            candidateRejected: { code: error.code, message: error.message },
          },
        }))
      }
      throw error
    }
    if (candidate?.pending_update_state === 'needs_resolution') {
      // The update-check that offered "Update" was stale. The preview is newer
      // than any probe in flight, so record the conflict and let the card
      // offer "Resolve in chat" instead of another Update that hits it again.
      checkGenerationsRef.current.set(String(installedApp.id), ++checkGenerationRef.current)
      setUpdateChecks(prev => mergeUpdateChecks(prev, {
        [installedApp.id]: {
          ...prev[installedApp.id],
          available: true,
          pendingUpdateState: 'needs_resolution',
        },
      }))
    }
    const capabilityPreview = candidate.capability_preview
    const capabilityReview = {
      status: capabilityDiffNeedsReview(capabilityPreview?.capability_diff)
        ? 'changed'
        : 'ready',
      preview: capabilityPreview,
      error: '',
    }
    if (capabilityPreview) setCapabilityReviews(prev => ({ ...prev, [item.id]: capabilityReview }))
    return {
      item: updateItem,
      installedApp,
      preview: candidate,
      capabilityReview,
    }
  }, [installed, token])
  const prepareCatalogUpdateRef = useRef(prepareCatalogUpdate)
  prepareCatalogUpdateRef.current = prepareCatalogUpdate

  // Mirror one controller's state into the open dialog.
  const showTransaction = (review) => {
    setUpdateTransaction(review)
    setCheckingAllUpdates(review.phase === 'checking')
    setCheckingUpdateItemId(review.phase === 'checking' && review.entries.length === 1
      ? review.entries[0].item.id : null)
  }

  // A batch outcome updates its card only when this Store saw the entry
  // still running: an old finished batch must not hide a newer release.
  const runningBatchEntriesRef = useRef(new Set())
  const reportBatchOutcomes = useCallback((snapshot) => {
    const running = runningBatchEntriesRef.current
    const changes = {}
    for (const entry of snapshot.entries) {
      const key = `${snapshot.id}:${entry.app_id}`
      if (entry.status === 'queued' || entry.status === 'applying') { running.add(key); continue }
      if (!running.delete(key) || !['updated', 'conflict'].includes(entry.status)) continue
      // The server's outcome is newer than any check in flight for this app.
      checkGenerationsRef.current.set(String(entry.app_id), ++checkGenerationRef.current)
      changes[entry.app_id] = entry.status === 'updated'
        ? { available: false, pendingUpdateState: 'none', upstreamVersion: entry.version || null }
        : { available: true, pendingUpdateState: 'needs_resolution', upstreamVersion: entry.version || null }
    }
    if (Object.keys(changes).length) setUpdateChecks(prev => mergeUpdateChecks(prev, changes))
  }, [])

  // A Möbius without server batches (no mobius#1843) gets the per-app
  // reviewed update the Store used before: the same /install request, bound
  // to the reviewed source and access digests, one app at a time.
  const applyReviewedUpdate = async (entry) => {
    const { item, installedApp, preview, capabilityReview } = entry.prepared
    // A failure throws: the batch controller records it like any other.
    const result = await installApp({
      manifest_url: item.manifest_url,
      manifest: item.manifest,
      raw_base: item.raw_base,
      token,
      reviewed_capability_digest: capabilityReview.preview.capability_digest,
      reviewed_source_digest: preview.source_digest,
      update_app_id: installedApp.id,
      reviewed_upstream_commit: preview.upstream_commit,
    })
    const conflict = result.mode === 'conflict'
    const id = result.id || installedApp.id
    checkGenerationsRef.current.set(String(id), ++checkGenerationRef.current)
    setUpdateChecks(prev => mergeUpdateChecks(prev, {
      [id]: conflict
        ? { available: true, pendingUpdateState: 'needs_resolution', upstreamVersion: result.version || null }
        : { available: false, pendingUpdateState: 'none', upstreamVersion: result.version || null },
    }))
    if (!conflict) window.mobius?.signal?.('app_updated', { slug: id })
    return { status: conflict ? 'conflict' : 'updated', version: result.version || null, warnings: result.warnings || [] }
  }

  // Whether this Möbius has server batches, decided in one place: from the
  // batch list (or, before it answers, the same generic route-missing answer
  // on submit). 'unknown' | 'supported' | 'missing'.
  const batchSupportRef = useRef('unknown')
  const batchesMissing = (error) => {
    if (batchSupportRef.current === 'unknown' && batchRoutesMissing(error)) batchSupportRef.current = 'missing'
    return batchSupportRef.current === 'missing'
  }

  const createBatchController = (entries = []) => {
    const batch = createUpdateBatch({
      prepare: (item, options) => prepareCatalogUpdateRef.current(item, options),
      submit: payload => submitUpdateBatch(payload, token),
      read: (id, options) => loadUpdateBatch(id, token, options),
      watch: (id, onSnapshot, options) => watchUpdateBatch(id, token, onSnapshot, options),
      newId: randomUuid,
      resolve: appIds => createConflictResolverBatch(appIds, 'preserve_local', token),
      refresh: () => refreshInstalled(),
      applyOne: applyReviewedUpdate,
      batchesMissing,
      // The platform refused this id, so nothing runs under it: drop the
      // Library placeholder a closed dialog may have left.
      onRefused: id => {
        if (batchControllersRef.current.get(id) === batch) batchControllersRef.current.delete(id)
        setUpdateBatches(previous => previous.filter(item => !(item.id === id && item.phase === 'unknown')))
      },
      onSnapshot: snapshot => {
        for (const [id, controller] of batchControllersRef.current) {
          if (controller === batch && id !== snapshot.id) batchControllersRef.current.delete(id)
        }
        const previous = batchControllersRef.current.get(snapshot.id)
        if (previous && previous !== batch && previous !== updateBatchRef.current) previous.dispose()
        batchControllersRef.current.set(snapshot.id, batch)
        reportBatchOutcomes(snapshot)
        setUpdateBatches(previous => {
          const current = previous.find(item => item.id === snapshot.id)
          return [newestBatchSnapshot(current, snapshot), ...previous.filter(item => item.id !== snapshot.id)]
        })
      },
      onChange: review => {
        if (review.phase === 'submitting' && review.batchId) {
          // This Store is submitting these entries: their outcome is news.
          for (const entry of review.entries) {
            if (entry.status === 'ready') runningBatchEntriesRef.current.add(`${review.batchId}:${entry.prepared.installedApp.id}`)
          }
        }
        if (updateBatchRef.current === batch) showTransaction(review)
      },
    }, entries)
    return batch
  }

  const openUpdateBatch = (entries = []) => {
    if (updateBatchRef.current) return null
    const batch = createBatchController(entries)
    updateBatchRef.current = batch
    showTransaction(batch.state)
    return batch
  }

  // Closing the dialog never cancels server work. A batch the server has (or
  // may have) accepted keeps its controller, so Library can show its progress.
  const closeUpdateTransaction = () => {
    const batch = updateBatchRef.current
    if (!batch) return
    updateBatchRef.current = null
    const { batchId, phase, entries } = batch.state
    if (!batchId) batch.dispose()
    else {
      batchControllersRef.current.set(batchId, batch)
      if (phase === 'submitting' || batch.uncertain) {
        // Accepted or not, this id may be running: keep a placeholder until
        // the server lists it.
        setUpdateBatches(previous => previous.some(item => item.id === batchId) ? previous : [{
          id: batchId, phase: 'unknown', entries: entries.filter(entry => entry.status === 'ready').map(entry => ({
            app_id: entry.prepared.installedApp.id, status: 'queued',
          })),
        }, ...previous])
      }
    }
    setCheckingAllUpdates(false)
    setCheckingUpdateItemId(null)
    setUpdateTransaction(null)
  }

  useEffect(() => {
    if (!token) return undefined
    let live = true
    let generation = 0
    // One read at a time: events that arrive during a read coalesce into one
    // more read after it.
    let inFlight = null
    let again = false
    const readOnce = () => {
      const requestGeneration = ++generation
      return loadUpdateBatches(token).then(result => {
        if (!live || requestGeneration !== generation) return
        batchSupportRef.current = 'supported'
        const batches = (Array.isArray(result?.batches) ? result.batches : []).map(normalizeBatchSnapshot).filter(Boolean)
        setBatchLoadError(null)
        setUpdateBatches(previous => [
          ...batches.map(snapshot => newestBatchSnapshot(previous.find(item => item.id === snapshot.id), snapshot)),
          // A placeholder stays only while its controller still holds that
          // possibly accepted id.
          ...previous.filter(item => item.phase === 'unknown' && !batches.some(current => current.id === item.id)
            && batchControllersRef.current.get(item.id)?.state.batchId === item.id),
        ])
        for (const snapshot of batches) reportBatchOutcomes(snapshot)
        // Only a submission that may or may not have started needs its own
        // read; listed batches already came with their snapshot.
        for (const [id, controller] of batchControllersRef.current) {
          if (controller.uncertain && !batches.some(item => item.id === id)) void controller.refreshSnapshot().catch(() => {})
        }
        for (const snapshot of batches) {
          const controller = batchControllersRef.current.get(snapshot.id)
          if (controller) {
            controller.offer(snapshot)
          } else if (snapshot.phase === 'applying') {
            // Started elsewhere or before this Store opened: follow it live.
            const background = createBatchController()
            batchControllersRef.current.set(snapshot.id, background)
            background.recover(snapshot)
          }
        }
      }).catch(error => {
        if (!live || requestGeneration !== generation) return
        if (batchRoutesMissing(error)) {
          // This Möbius predates server batches: nothing to show, and updates
          // use the per-app fallback.
          batchSupportRef.current = 'missing'
          setBatchLoadError(null)
          return
        }
        setBatchLoadError({ message: error?.message || 'Update progress is unavailable.', status: error?.status || 0 })
      })
    }
    const reload = () => {
      if (inFlight) { again = true; return inFlight }
      inFlight = readOnce().finally(() => {
        inFlight = null
        if (again && live) { again = false; void reload() }
      })
      return inFlight
    }
    reloadUpdateBatchesRef.current = reload
    void reload()
    const foreground = () => { if (document.visibilityState === 'visible') void reload() }
    const managed = event => {
      if (event.source !== window.parent || event.data?.type !== 'moebius:managed-app-event') return
      void reload()
    }
    window.addEventListener('focus', foreground)
    document.addEventListener('visibilitychange', foreground)
    window.addEventListener('message', managed)
    return () => {
      live = false
      if (reloadUpdateBatchesRef.current === reload) reloadUpdateBatchesRef.current = null
      window.removeEventListener('focus', foreground)
      document.removeEventListener('visibilitychange', foreground)
      window.removeEventListener('message', managed)
    }
  }, [token, reportBatchOutcomes])

  const catalogItemForAppId = (appId) => displayCatalog.find(
    candidate => lifecycleById.get(candidate.id)?.installedApp?.id === Number(appId),
  )

  // Reopen a batch's progress or results. Reading it never resubmits it.
  const openingBatchRef = useRef(false)
  const openStoredUpdateBatch = async (id) => {
    if (!id || updateBatchRef.current || openingBatchRef.current) return
    const seed = appIds => appIds.flatMap(appId => {
      const item = catalogItemForAppId(appId)
      return item ? [{ item, prepared: { installedApp: { id: Number(appId) } } }] : []
    })
    const existing = batchControllersRef.current.get(id)
    if (existing?.state.batchId === id) {
      existing.seedEntries(seed(existing.state.entries.map(entry => entry.prepared?.installedApp?.id)))
      updateBatchRef.current = existing
      showTransaction(existing.state)
      void existing.refreshSnapshot().catch(() => {})
      return
    }
    // One open at a time: a double click or a background reload during the
    // read cannot create a second controller for this batch.
    openingBatchRef.current = true
    try {
      const snapshot = normalizeBatchSnapshot(await loadUpdateBatch(id, token))
      if (!snapshot) throw new Error('Update progress could not be read.')
      if (updateBatchRef.current) return
      let batch = batchControllersRef.current.get(id)
      if (batch?.state.batchId === id) {
        batch.seedEntries(seed(snapshot.entries.map(row => row.app_id)))
        batch.offer(snapshot)
      } else {
        batch?.dispose()
        batch = createBatchController(seed(snapshot.entries.map(row => row.app_id))
          .map(entry => ({ ...entry, status: 'queued' })))
        batchControllersRef.current.set(id, batch)
        batch.recover(snapshot)
      }
      updateBatchRef.current = batch
      showTransaction(batch.state)
    } catch (error) {
      setToast({ kind: 'error', message: error.message || 'Update progress could not be read.' })
    } finally {
      openingBatchRef.current = false
    }
  }

  const handleOpenRunningBatch = (id) => {
    closeUpdateTransaction()
    void openStoredUpdateBatch(id)
  }

  // Individual and batch updates use the same read-only candidate contract.
  const handleCatalogUpdate = async (item, opts = {}) => {
    if (!opts.isUpdate) {
      openDetail(item)
      return
    }
    if (busy || updateBatchRef.current) return
    setCardErrors(prev => withoutKey(prev, item.id))
    setCardErrorRetries(prev => withoutKey(prev, item.id))
    await openUpdateBatch()?.check([item])
  }

  // A resolver agent finishes in its own chat, outside this iframe. When the
  // shell reports an app change (or the owner returns to the Store), read the
  // resolving apps' state so the open results settle by themselves.
  const resolvingAppKey = (updateTransaction?.phase === 'review' ? updateTransaction.entries : [])
    .filter(entry => entry.status === 'conflict' && entry.resolver)
    .map(entry => entry.prepared?.installedApp?.id)
    .filter(id => id != null)
    .join(',')
  useEffect(() => {
    if (!resolvingAppKey) return undefined
    const ids = resolvingAppKey.split(',').map(Number)
    let active = true
    const settle = async () => {
      if (!active) return
      const rows = installedRef.current.filter(app => ids.includes(app.id))
      const checks = await refreshUpdateChecks(rows, { force: true })
      if (!active || !checks) return
      updateBatchRef.current?.reconcile(checks)
      if (ids.some(id => checks[id]?.available === false)) refreshInstalled().catch(() => {})
    }
    const onManagedAppEvent = (event) => {
      if (event.source !== window.parent || event?.data?.type !== 'moebius:managed-app-event') return
      const changed = Number(event.data.event?.appId)
      if (!Number.isFinite(changed) || ids.includes(changed)) settle()
    }
    const onReturn = () => {
      if (document.visibilityState === 'visible') settle()
    }
    window.addEventListener('message', onManagedAppEvent)
    document.addEventListener('visibilitychange', onReturn)
    window.addEventListener('focus', onReturn)
    settle()
    return () => {
      active = false
      window.removeEventListener('message', onManagedAppEvent)
      document.removeEventListener('visibilitychange', onReturn)
      window.removeEventListener('focus', onReturn)
    }
  }, [resolvingAppKey, refreshInstalled, refreshUpdateChecks])

  // One owner-visible chat reviews the selected updates: ready releases are
  // reviewed before anything applies, failed ones are investigated.
  const handleAgentUpdateReview = async (entries) => {
    const pending = (entries || []).filter(entry => entry.status === 'ready' || entry.status === 'failed')
    if (!pending.length || agentReviewingUpdate) return
    setAgentReviewingUpdate(true)
    try {
      const title = pending.length === 1
        ? `${pending[0].status === 'failed' ? 'Investigate' : 'Review'} ${pending[0].item.manifest?.name || pending[0].item.name || pending[0].item.id} update`
        : `Review ${pending.length} app updates`
      const chat = await createAppChat(title, token, { ownerVisible: true })
      const content = pending.map(entry => {
        const context = {
          item: entry.item,
          installedApp: findInstalled(installed, entry.item) || entry.prepared?.installedApp,
          preview: entry.prepared?.preview || null,
        }
        return entry.status === 'failed'
          ? buildUpdateFailureMessage({ ...context, error: entry.error })
          : buildUpdateReviewMessage(context)
      }).join('\n\n---\n\n')
      await seedChatMessage(chat.id, content, token)
      openChat(chat.id)
    } catch (error) {
      setToast({ kind: 'error', message: error.message || 'Could not open an agent review.' })
    } finally {
      setAgentReviewingUpdate(false)
    }
  }

  // Publishing stays in the Store while an owner-visible agent works. The
  // conversation remains available as optional detail rather than navigation.
  // Each app's listing has one agent chat: later requests, for the same part
  // or another, continue it instead of starting a parallel agent.
  const handleListingAgent = useCallback(async (app, problem, focus = '') => {
    if (!app?.id) return null
    const name = app.name || app.slug
    const scope = listingAgentScope(app.id)
    try {
      const existing = await latestScopedAppChat(scope, token)
      const chatId = existing?.id
        || (await createAppChat(`Get ${name} ready to publish`, token, { ownerVisible: true, scope, scopeLabel: name })).id
      await seedChatMessage(chatId, buildListingAgentMessage({ app, problem, focus, followUp: !!existing }), token)
      setToast({
        kind: 'success',
        message: existing?.running
          ? `Added to the agent already working on ${name}.`
          : `An agent is preparing ${name}. You can keep working here.`,
        action: { label: 'View work', onClick: () => openChat(chatId) },
      })
      return { chatId }
    } catch (error) {
      setToast({ kind: 'error', message: error.message || 'Could not open an agent chat.' })
      return null
    }
  }, [token])

  const handleListingAgentStatus = useCallback((app) => (
    app?.id ? latestScopedAppChat(listingAgentScope(app.id), token) : Promise.resolve(null)
  ), [token])

  // The creator-run agent check: an owner-visible agent reads the exact
  // accepted revision and writes its verdict into this Store's storage, which
  // the Publish tab follows live.
  const handlePublishCheck = useCallback(async (app, acceptedCommit) => {
    if (!app?.id || !acceptedCommit) return false
    try {
      const chat = await createAppChat(`Check ${app.name || app.slug} before publishing`, token, { ownerVisible: true })
      await seedChatMessage(chat.id, buildPublishCheckMessage({ app, acceptedCommit, storeAppId: appId }), token)
      setToast({
        kind: 'success',
        message: `Your agent is checking ${app.name || app.slug}. The result appears here.`,
        action: { label: 'View work', onClick: () => openChat(chat.id) },
      })
      return true
    } catch (error) {
      setToast({ kind: 'error', message: error.message || 'Could not start the agent check.' })
      return false
    }
  }, [appId, token])

  const handlePublishFix = useCallback(async (app, issues) => {
    if (!app?.id) return false
    try {
      const chat = await createAppChat(`Fix ${app.name || app.slug} before publishing`, token, { ownerVisible: true })
      await seedChatMessage(chat.id, buildPublishFixMessage({ app, issues }), token)
      setToast({
        kind: 'success',
        message: `An agent is fixing ${app.name || app.slug}. Check again when it's done.`,
        action: { label: 'View work', onClick: () => openChat(chat.id) },
      })
      return true
    } catch (error) {
      setToast({ kind: 'error', message: error.message || 'Could not open an agent chat.' })
      return false
    }
  }, [token])

  const loadPublisherReviews = useCallback((communityAppId) => (
    loadCommunityReviews(token, communityAppId)
  ), [token])

  const handleAskAgentAboutError = useCallback(async (item, error) => {
    if (!item || !error || agentErrorItemId) return
    const installedApp = findInstalled(installed, item)
    setAgentErrorItemId(item.id)
    try {
      const title = `Investigate ${item.manifest?.name || item.id} update`
      const chat = await createAppChat(title, token, { ownerVisible: true })
      const content = buildUpdateFailureMessage({
        item,
        installedApp,
        preview: null,
        error,
      })
      await seedChatMessage(chat.id, content, token)
      openChat(chat.id)
    } catch (askError) {
      setToast({
        kind: 'error',
        message: askError.message || 'Could not open an agent chat.',
      })
    } finally {
      setAgentErrorItemId(null)
    }
  }, [agentErrorItemId, installed, token])

  const closeDetail = useCallback(() => closeDetailEntry(navDetailRef, showDetail), [showDetail])

  const handleCommunityWithdraw = useCallback(async () => {
    const community = detail?.community
    if (!community?.id || communityActionBusy || !communityIdentity?.linked) {
      return false
    }
    setCommunityActionBusy(true)
    setCommunityActionError({ key: community.id, message: '' })
    try {
      await withdrawCommunityApp(token, community.id)
      closeDetail()
      await refreshCommunity()
      setToast({
        kind: 'success',
        message: `${detail?.name || 'Your app'} was withdrawn from the community.`,
      })
      return true
    } catch (error) {
      setCommunityActionError({
        key: community.id,
        message: error?.message || 'This app could not be withdrawn.',
      })
      return false
    } finally {
      setCommunityActionBusy(false)
    }
  }, [communityActionBusy, communityIdentity, detail, token, closeDetail, refreshCommunity])

  useLayoutEffect(() => {
    if (!detail && gridScrollRef.current) {
      gridScrollRef.current.scrollTop = savedGridScrollRef.current
    }
  }, [detail, activeCollection])

  // Roving tab navigation: ArrowLeft/ArrowRight move selection between the
  // tabs with wrap, and move DOM focus to the newly-selected tab (the
  // tablist's roving tabIndex keeps only the active tab in the Tab order).
  const onTabsKeyDown = (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    const order = ['browse', 'library', 'publish']
    const i = order.indexOf(tab)
    const next = e.key === 'ArrowRight'
      ? order[(i + 1) % order.length]
      : order[(i - 1 + order.length) % order.length]
    selectTab(next)
    document.getElementById(`st-tab-${next}`)?.focus()
  }

  const displayCatalog = useMemo(() => {
    const remainingInstalledIds = new Set(otherInstalledCatalogSources.map((item) => item.id))
    return sortCatalogForDisplay([
      ...listedCatalog,
      ...otherInstalledCatalog.filter((item) => remainingInstalledIds.has(item.id)),
    ])
  }, [listedCatalog, otherInstalledCatalog, otherInstalledCatalogSources])
  const detailCommunityFeedback = communityFeedbackOf(detail)
  const detailCommunityFeedbackKey = detailCommunityFeedback
    ? `${detailCommunityFeedback.id}:${detailCommunityFeedback.revision_id}`
    : ''
  const systemSetupReady = useMemo(
    () => systemSetupComplete || hasConnectedProvider(providerStatus),
    [systemSetupComplete, providerStatus],
  )
  const lifecycleById = useMemo(() => {
    const byId = new Map()
    for (const item of displayCatalog) {
      byId.set(item.id, appLifecycleFor(item, {
        installed,
        updateChecks,
        installedUnavailable: !!installedLoadError,
        setupCompletions,
        systemSetupReady,
      }))
    }
    return byId
  }, [displayCatalog, installed, updateChecks, installedLoadError, setupCompletions, systemSetupReady])

  const filterCounts = useMemo(() => {
    let updates = 0
    let setup = 0
    let installedCount = 0
    for (const item of displayCatalog) {
      const lifecycle = lifecycleById.get(item.id)
      if (!lifecycle) continue
      if (lifecycle.key === 'update' || lifecycle.key === 'conflict') updates += 1
      if (lifecycle.installedApp) installedCount += 1
      if (lifecycle.setupNeedsAttention) setup += 1
    }
    return {
      update: updates,
      installed: installedCount,
      setup,
    }
  }, [displayCatalog, lifecycleById])

  // Publishing needs a linked Möbius · You identity. Rather than a dead-end
  // "Link identity" label, send the owner to where that sign-in actually
  // happens: the installed Möbius · You app, or its Store listing to install
  // it first when it is missing.
  const logInToMobiusYou = useCallback(() => {
    if (identityApp) {
      openInstalledApp(identityApp.id)
      return
    }
    const listing = displayCatalog.find((item) => item?.manifest?.id === 'identity')
    selectTab('browse')
    if (listing?.manifest) {
      openDetail(listing)
    } else {
      // A detail page covers the grid, so leave it for the search to show.
      closeDetail()
      setQuery('Möbius · You')
    }
  }, [identityApp, displayCatalog, selectTab, openDetail, closeDetail])

  // Apps a server batch is applying (or may be, for an unconfirmed
  // submission) show as updating and stay out of another "Update all".
  const runningBatches = useMemo(
    () => updateBatches.filter(batch => batch.phase === 'applying' || batch.phase === 'unknown'),
    [updateBatches],
  )
  const updatingItemIds = useMemo(() => {
    const appIds = new Set(runningBatches.flatMap(batch => batch.entries
      .filter(entry => entry.status === 'queued' || entry.status === 'applying')
      .map(entry => Number(entry.app_id))))
    return displayCatalog.filter(item => appIds.has(lifecycleById.get(item.id)?.installedApp?.id)).map(item => item.id)
  }, [runningBatches, displayCatalog, lifecycleById])
  const transactionProgress = updateBatchBusy(updateTransaction)
    ? batchProgressOf(updateTransaction.entries)
    : null

  const updateItems = useMemo(
    () => displayCatalog.filter((item) => lifecycleById.get(item.id)?.key === 'update' && !updatingItemIds.includes(item.id)),
    [displayCatalog, lifecycleById, updatingItemIds],
  )

  const conflictItems = useMemo(
    () => displayCatalog.filter((item) => lifecycleById.get(item.id)?.key === 'conflict'),
    [displayCatalog, lifecycleById],
  )

  // Shared "Resolve all" action: start the preserving resolver for every
  // conflicting app at once. The backend spawn is idempotent per app+upstream,
  // so this never duplicates a resolver already started from a card.
  const handleResolveAllConflicts = async () => {
    if (busy || resolvingAll || !conflictItems.length) return
    setResolvingAll(true)
    setCategory('update')
    let started = 0
    let failed = 0
    let firstChatId = null
    try {
      for (const item of conflictItems) {
        const appId = lifecycleById.get(item.id)?.installedApp?.id
        if (!appId) { failed += 1; continue }
        try {
          const resolver = await createConflictResolverChat(appId, 'preserve_local', token)
          if (resolver?.chat_id) {
            started += 1
            if (!firstChatId) firstChatId = resolver.chat_id
          }
        } catch (e) {
          failed += 1
          setCardErrors(prev => ({ ...prev, [item.id]: e.message || String(e) }))
        }
      }
    } finally {
      setResolvingAll(false)
    }
    await refreshInstalled()
    const parts = []
    if (started) parts.push(`${started} ${started === 1 ? 'app is' : 'apps are'} being reconciled`)
    if (failed) parts.push(`${failed} could not start`)
    setToast({
      kind: failed ? 'error' : 'success',
      message: `${parts.join('; ') || 'No conflicts to resolve'}.`,
      action: firstChatId ? { label: 'Open agent', onClick: () => openChat(firstChatId) } : null,
    })
  }

  const handleUpdateAll = async () => {
    if (!updateItems.length || busy || updateBatchRef.current || installedLoadError) return
    await openUpdateBatch()?.check(updateItems)
  }


  const visibleCatalog = useMemo(() => {
    const specialFilters = new Set(['update', 'setup', 'installed'])
    const catalogCategory = specialFilters.has(category) ? 'all' : category
    const matches = filterCatalog(displayCatalog, { query, category: catalogCategory })
    if (category === 'update') {
      return matches.filter((item) => {
        const lifecycle = lifecycleById.get(item.id)
        return lifecycle?.key === 'update' || lifecycle?.key === 'conflict'
      })
    }
    if (category === 'setup') {
      return matches.filter((item) => lifecycleById.get(item.id)?.setupNeedsAttention)
    }
    if (category === 'installed') {
      return matches.filter((item) => !!lifecycleById.get(item.id)?.installedApp)
    }
    return matches
  }, [displayCatalog, query, category, lifecycleById])

  const libraryCatalog = useMemo(
    () => visibleCatalog.filter((item) => !!lifecycleById.get(item.id)?.installedApp),
    [visibleCatalog, lifecycleById],
  )

  const attentionCount = useMemo(
    () => displayCatalog.filter((item) => lifecycleById.get(item.id)?.key === 'conflict').length,
    [displayCatalog, lifecycleById],
  )

  useEffect(() => {
    const nav = window.mobius?.nav
    if (!intentDestination && typeof nav?.setLocation === 'function') {
      const location = storeLocation({
        tab, category, query, activeCollection, detailId: detail?.id,
      })
      if (location) nav.setLocation(location)
    }
  }, [intentDestination, tab, category, query, activeCollection, detail?.id])

  const destinationResolution = useMemo(() =>
    resolveCatalogItemIntent(displayCatalog, intentDestination?.itemId, installed),
  [displayCatalog, intentDestination?.itemId, installed])

  useEffect(() => {
    // An intent is a one-shot command. Metadata refreshes may make a waiting
    // target ready, but must not restart an ownership request already sent.
    if (!intentDestination || cancelDestinationRef.current) return
    const destination = intentDestination
    const resolution = destinationResolution
    const lookup = !resolution.item && destination.itemId?.startsWith('community:')
    if (destination.kind === 'app') {
      if (loadingCatalog || (!resolution.item && !catalogHydrated)) return
      if (destination.restored && !lookup && (
        resolution.item ? !resolution.item.manifest && (!destination.collectionId || !catalogHydrated)
          : ((!destination.collectionId && (installedLoadError || catalogLoadError))
          || otherInstalledCatalogSources.some(item => item.id === destination.itemId))
      )) return
    }
    const controller = new AbortController()
    const { signal } = controller
    cancelDestinationRef.current = () => controller.abort()
    const finish = next => {
      if (signal.aborted) return
      cancelDestinationRef.current = null
      setIntentDestination(next)
    }
    async function openDestination() {
      if (destination.kind === 'updates') {
        closeDetail()
        closeCollection()
        selectTab('library')
        setCategory('update')
        setQuery('')
      } else if (destination.kind === 'collection') {
        await openCollection(destination.collectionId, signal)
        finish(destination.itemId
          ? { kind: 'app', itemId: destination.itemId, restored: true, collectionId: destination.collectionId }
          : null)
        return
      } else {
        let item = resolution.item
        if (lookup) {
          try {
            const row = await loadCommunityApp(token, destination.itemId.slice('community:'.length), { signal })
            item = communityCatalogItems([row]).find(candidate => candidate.id === destination.itemId)
            if (!item?.manifest && !destination.collectionId) return
          } catch (error) {
            if (signal.aborted || (error.status !== 404 && !destination.collectionId)) return
          }
        }
        if (signal.aborted) return
        if (!destination.restored && resolution.toast) setToast(resolution.toast)
        if (!destination.restored && resolution.action !== 'unavailable') {
          selectTab('browse')
          setCategory('all')
          if (resolution.action === 'needs-connection') setQuery(resolution.query)
        }
        if (item?.manifest) {
          await openDetail(item, signal)
          // A retargeted entry may still be awaiting its original host push.
          await navDetailRef.current?.handle.outcome
          if (destination.restored && !destination.collectionId && !navDetailRef.current?.owned) return
        }
      }
      finish(null)
    }
    void openDestination()
  }, [intentDestination, destinationResolution, loadingCatalog, catalogHydrated,
    installedLoadError, catalogLoadError, otherInstalledCatalogSources, token,
    closeDetail, closeCollection, selectTab, openCollection, openDetail])

  // Detail view replaces the main layout when set.
  if (detail) {
    return (
      <div className="st-root" {...ownerInteraction}>
        <style>{CSS}</style>
        <DetailView
          storeAppId={appId}
          item={detail}
          focusSection={detailFocus}
          capabilityReview={capabilityReviews[detail.id]}
          uninstalledApp={findInstalled(uninstalledApps, detail)}
          onRetryCapabilityReview={() => reviewCapabilities(detail)}
          installed={installed}
          onBack={closeDetail}
          onInstall={(item, opts) => opts?.isUpdate
            ? handleCatalogUpdate(item, opts)
            : handleInstall(item)}
          onUninstall={handleUninstall}
          onOpenInstalled={handleOpenInstalled}
          onSetup={handleSetup}
          onRetryInstalled={handleRetryInstalled}
          busy={busy || checkingUpdateItemId === detail.id || updatingItemIds.includes(detail.id)}
          busyActionKind={busyItemId === detail.id
            ? busyActionKind
            : checkingUpdateItemId === detail.id ? 'checking_update'
              : updatingItemIds.includes(detail.id) ? 'update' : null}
          updateChecks={updateChecks}
          onReviewUpdate={handleReviewUpdate}
          onCommunityFeedback={handleCommunityFeedback}
          onCommunityWithdraw={handleCommunityWithdraw}
          canCommunityWithdraw={!!(
            githubIdentity?.login
            && detail?.community
            && detail?.publisher?.login
            && String(githubIdentity.login).toLowerCase()
              === String(detail.publisher.login).toLowerCase()
          )}
          communityBusy={communityActionBusy}
          communityError={communityActionError.key === detailCommunityFeedbackKey
            ? communityActionError.message
            : ''}
          communityIdentityLinked={!!communityIdentity?.linked}
          onLogInToMobiusYou={logInToMobiusYou}
          token={token}
          installedUnavailable={!!installedLoadError}
          setupCompletions={setupCompletions}
          systemSetupReady={systemSetupReady}
        />
        {pendingUninstall && (
          <UninstallConfirmModal
            app={pendingUninstall}
            busy={busy}
            onConfirm={confirmUninstall}
            onCancel={() => !busy && setPendingUninstall(null)}
          />
        )}
        {updateTransaction && (
          <UpdateReviewModal
            review={updateTransaction}
            agentReviewing={agentReviewingUpdate}
            onClose={closeUpdateTransaction}
            onConfirm={() => updateBatchRef.current?.confirm()}
            onRetry={itemId => updateBatchRef.current?.retry(itemId)}
            onResolveAll={() => updateBatchRef.current?.resolveAll()}
            onResolveOne={id => updateBatchRef.current?.resolveOne(id)}
            onOpenChat={openChat}
            onAskAgent={handleAgentUpdateReview}
            onOpenBatch={handleOpenRunningBatch}
          />
        )}
        <Toast toast={toast} onDismiss={() => setToast(null)} />
      </div>
    )
  }

  return (
    <div className="st-root" {...ownerInteraction}>
      <style>{CSS}</style>
      <h1 className="st-sr-only">App Store</h1>
      <div className="st-header">
        <div className="st-title-row">
          <div className="st-store-brand">
            <img
              src={`/api/apps/${appId}/icon?size=64`}
              alt=""
              width={40}
              height={40}
              className="st-brand-icon" ref={(el) => el && window.mobius.immersive && window.mobius.immersive.holdToToggle(el)}
              onError={(e) => {
                e.currentTarget.style.display = 'none'
                const f = e.currentTarget.nextElementSibling
                if (f) f.style.display = 'flex'
              }}
            />
            <span className="st-brand-fallback" style={{ display: 'none' }} aria-hidden="true">·</span>
            <span className="st-brand-name">App Store</span>
          </div>
          <div className="st-seg is-accent st-tabs" role="tablist" aria-label="Browse mode"
               onKeyDown={onTabsKeyDown}>
            <button role="tab" id="st-tab-browse"
                    aria-selected={tab === 'browse'}
                    aria-controls="st-tabpanel"
                    tabIndex={tab === 'browse' ? 0 : -1}
                    className={`st-seg-btn${tab === 'browse' ? ' is-active' : ''}`}
                    onClick={() => selectTab('browse')}>
              Browse
            </button>
            <button role="tab" id="st-tab-library"
                    aria-selected={tab === 'library'}
                    aria-controls="st-tabpanel"
                    tabIndex={tab === 'library' ? 0 : -1}
                    className={`st-seg-btn${tab === 'library' ? ' is-active' : ''}`}
                    onClick={() => { selectTab('library'); setCategory('all') }}>
              Library
              {filterCounts.update > 0 && (
                <span
                  className="st-tab-count"
                  aria-label={`${filterCounts.update} updates available`}
                >
                  {filterCounts.update}
                </span>
              )}
            </button>
            <button role="tab" id="st-tab-publish"
                    aria-selected={tab === 'publish'}
                    aria-controls="st-tabpanel"
                    tabIndex={tab === 'publish' ? 0 : -1}
                    className={`st-seg-btn${tab === 'publish' ? ' is-active' : ''}`}
                    onClick={() => selectTab('publish')}>
              Publish
            </button>
          </div>
          <div className={`st-header-search${searchVisible ? ' is-open' : ''}`}>
            <button
              type="button"
              className="st-header-search-toggle"
              aria-label={searchVisible ? 'Close app search' : 'Search apps'}
              aria-expanded={searchVisible}
              onClick={() => {
                if (searchVisible) setQuery('')
                setSearchOpen(!searchVisible)
              }}
            >
              {searchVisible
                ? <X width="1em" height="1em" aria-hidden="true" />
                : <Search width="1em" height="1em" aria-hidden="true" />}
            </button>
            {searchVisible ? (
              <div className="st-header-search-popover">
                <label className="st-search-label" htmlFor="st-catalog-search">Search apps</label>
                <Search width="1em" height="1em" aria-hidden="true" />
                <input
                  ref={searchInputRef}
                  id="st-catalog-search"
                  className="st-search-input"
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search apps"
                  autoComplete="off"
                  spellCheck={false}
                />
                <span className="st-result-count" aria-live="polite">
                  {visibleCatalog.length === displayCatalog.length
                    ? `${displayCatalog.length} apps`
                    : `${visibleCatalog.length} of ${displayCatalog.length}`}
                </span>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className={`st-scroll is-${tab}`} ref={gridScrollRef}
           id="st-tabpanel" role="tabpanel"
           aria-labelledby={`st-tab-${tab}`}>
        {(tab === 'browse' || tab === 'library') && (
          <>
            <SelfUpdateBanner appId={appId} token={token} />
            {loadingCatalog
              ? <CatalogSkeleton count={CATALOG.length} />
              : <>
                  <CatalogFilters
                    category={category}
                    filterCounts={filterCounts}
                    onCategoryChange={setCategory}
                    updateAllCount={updateItems.length}
                    updateAllState={checkingAllUpdates
                      ? 'checking'
                      : transactionProgress ? 'updating' : 'idle'}
                    updateAllProgress={transactionProgress && { current: transactionProgress.finished, total: transactionProgress.total }}
                    updateAllDisabled={busy || resolvingAll || !!checkingUpdateItemId || !!installedLoadError || !!updateTransaction}
                    onUpdateAll={handleUpdateAll}
                    conflictCount={conflictItems.length}
                    onResolveAll={handleResolveAllConflicts}
                    resolveAllDisabled={busy || resolvingAll || checkingAllUpdates || !!installedLoadError}
                    resolveAllState={resolvingAll ? 'resolving' : 'idle'}
                    mode={tab}
                  />
                  {tab === 'library' && batchLoadError ? (
                    <div className="st-notice is-warning st-notice-row" role="alert">
                      <span>Update progress could not be read: {batchLoadError.message} Updates already running continue on the server.</span>
                      <button type="button" className="st-btn st-btn-secondary st-notice-action" onClick={() => reloadUpdateBatchesRef.current?.()}>
                        Try again
                      </button>
                    </div>
                  ) : null}
                  {tab === 'library' && updateBatches.length > 0 ? (
                    <section className="st-update-batch-list" aria-label="Update progress and results">
                      {updateBatches.map(batch => {
                        const progress = batchProgressOf(batch.entries)
                        const toResolve = batch.entries.filter(entry => entry.status === 'conflict' && !entry.resolver_chat_id).length
                        return (
                          <button key={batch.id} type="button" className="st-update-all-trigger"
                            onClick={() => openStoredUpdateBatch(batch.id)} disabled={!!updateTransaction}>
                            {batch.phase === 'unknown' ? 'Check update status'
                              : batch.phase === 'applying' ? `View update progress · ${progress.finished}/${progress.total} finished`
                                : toResolve ? `Review update results · ${toResolve} to resolve` : 'View update results'}
                          </button>
                        )
                      })}
                    </section>
                  ) : null}
                  {tab === 'library' && (
                    <LibraryHealth
                      installedCount={filterCounts.installed}
                      updateCount={updateItems.length}
                      attentionCount={attentionCount}
                      updateChecks={updateChecks}
                    />
                  )}
                  {installedLoadError && (
                    <div className="st-notice is-warning st-notice-row" role="status">
                      <span>{installedLoadError} Install and update actions are paused until this refreshes.</span>
                      <button
                        type="button"
                        className="st-btn st-btn-secondary st-notice-action"
                        onClick={handleRetryInstalled}
                        disabled={busy}
                      >
                        Retry
                      </button>
                    </div>
                  )}
                  {tab === 'browse' && communityError ? (
                    <div className="st-sr-only" role="status">
                      Shared listings are temporarily unavailable. The Store will retry automatically.
                    </div>
                  ) : null}
                  <CatalogList
                    appId={appId}
                    items={tab === 'library' ? libraryCatalog : visibleCatalog}
                    installed={installed}
                    updateChecks={updateChecks}
                    onPick={item => { if (item.manifest) openDetail(item) }}
                    pickOpensApp={tab === 'library'}
                    onRateApp={tab === 'library' ? (item => { if (item.manifest) openDetail(item, undefined, { focus: 'reviews' }) }) : undefined}
                    onRetry={retryCatalogItem}
                    onUpdate={handleCatalogUpdate}
                    onOpenInstalled={handleOpenInstalled}
                    onRetryInstalled={handleRetryInstalled}
                    busy={busy || checkingAllUpdates}
                    installedUnavailable={!!installedLoadError}
                    busyItemId={busyItemId}
                    updatingItemIds={updatingItemIds}
                    busyActionKind={busyActionKind}
                    checkingUpdateItemId={checkingUpdateItemId}
                    errors={cardErrors}
                    errorRetries={cardErrorRetries}
                    onAskAgentError={handleAskAgentAboutError}
                    agentErrorItemId={agentErrorItemId}
                    onReviewUpdate={handleReviewUpdate}
                    token={token}
                    emptyTitle={tab === 'library' ? 'No installed apps match' : 'No matches'}
                    emptyText={tab === 'library' ? 'Try another search, or browse the Store for something new.' : 'Try a different search or filter.'}
                    setupCompletions={setupCompletions}
                    systemSetupReady={systemSetupReady}
                    loadingMore={tab === 'browse' && communityLoading && communityOffset > 0}
                    searchLoading={tab === 'browse' && communityLoading && communityOffset === 0}
                    hasMore={tab === 'browse' && communityHasMore}
                    onLoadMore={() => refreshCommunity({ append: true })}
                    editorial={tab === 'browse' && !query && category === 'all'}
                    spotlightFeed={spotlightFeed}
                    activeCollection={tab === 'browse' ? activeCollection : null}
                    onOpenCollection={openCollection}
                    onCloseCollection={closeCollection}
                    shelfScrollRef={shelfScrollRef}
                    lifecycleById={lifecycleById}
                    layout={tab === 'library' ? 'list' : 'grid'}
                  />
                </>}
          </>
        )}
        {tab === 'publish' && (
          <PublisherTab
            installed={installed}
            identity={communityIdentity}
            identityError={communityIdentityError}
            viewer={{ github: githubIdentity, error: githubIdentityError }}
            onRefreshViewer={refreshGithubIdentity}
            onPublishLocal={handlePublishLocal}
            onPreviewLocal={(localAppId) => loadLocalPublicationPreview(token, localAppId)}
            onSaveListing={(localAppId, listing) => saveLocalListing(token, localAppId, listing)}
            onPrepareImage={prepareListingImage}
            onListingAgent={handleListingAgent}
            onListingAgentStatus={handleListingAgentStatus}
            onOpenChat={openChat}
            onRunCheck={handlePublishCheck}
            onFixCheck={handlePublishFix}
            onLoadReviews={loadPublisherReviews}
            onViewInStore={(communityId) => {
              cancelPendingDestination()
              setIntentDestination({ kind: 'app', itemId: `community:${communityId}` })
            }}
            onRegisterRepository={handleRegisterCommunity}
            publishingId={publishingId}
            publication={publication}
            publicationError={publicationError}
            publicationStates={publicationStates}
            publicationListings={publicationListings}
            publisherHandle={publisherHandle}
            publicationStatesError={publicationStatesError}
            onRefreshPublicationStates={refreshPublicationStates}
            onNavigate={() => {
              if (gridScrollRef.current) gridScrollRef.current.scrollTop = 0
            }}
            catalog={displayCatalog}
            spotlightFeed={spotlightFeed}
            token={token}
            onUploadSpotlightArtwork={handleUploadSpotlightArtwork}
            onPublishSpotlight={handlePublishSpotlight}
            onLogInToMobiusYou={logInToMobiusYou}
            contributeAvailable={!!contributeApp}
            onOpenContributions={(localAppId) => openInstalledApp(
              contributeApp.id,
              localAppId ? {} : { intent: 'reviews:queue' },
            )}
          />
        )}
      </div>

      {pendingUninstall && (
        <UninstallConfirmModal
          app={pendingUninstall}
          busy={busy}
          onConfirm={confirmUninstall}
          onCancel={() => !busy && setPendingUninstall(null)}
        />
      )}
      {updateTransaction && (
        <UpdateReviewModal
          review={updateTransaction}
          agentReviewing={agentReviewingUpdate}
          onClose={closeUpdateTransaction}
          onConfirm={() => updateBatchRef.current?.confirm()}
          onRetry={itemId => updateBatchRef.current?.retry(itemId)}
          onResolveAll={() => updateBatchRef.current?.resolveAll()}
          onResolveOne={id => updateBatchRef.current?.resolveOne(id)}
          onOpenChat={openChat}
          onAskAgent={handleAgentUpdateReview}
          onOpenBatch={handleOpenRunningBatch}
        />
      )}

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  )
}
