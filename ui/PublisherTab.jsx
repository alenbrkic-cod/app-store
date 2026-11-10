/* PublisherTab turns an accepted local app revision into one reviewable public listing. */
import { ChevronLeft, FileUpload, Search } from '@openai/apps-sdk-ui/components/Icon'
import React, { useEffect, useRef, useState } from 'react'
import {
  LISTING_AGENT_POLL_MS,
  LISTING_FIELD_LABELS,
  listingAgentRunAfterStatus,
  listingDraftFromPreview,
  listingFieldsDiffer,
  listingPayload,
  mergeListingUpdate,
  observedListingAgentRun,
  startedListingAgentRun,
  parsePublishCheck,
  PUBLISH_CHECK_POLL_MS,
  PUBLISH_CHECK_TIMEOUT_MS,
  publishCheckKey,
  publishCheckRequestStatus,
  publishCheckState,
  publishedAppView,
  savedListingSurvived,
} from '../domain.js'
import { ListingChecklist, ListingEditor } from './ListingEditor.jsx'
import { PublishCheck } from './PublishCheck.jsx'
import { PublishedAppPage, YourAppsList } from './PublishedApps.jsx'
import { SpotlightEditor } from './SpotlightEditor.jsx'

// Preview preparation crosses an async boundary while the owner can navigate
// back and choose another app. Keep result acceptance explicit so a late
// response can never pair one app's accepted source with another app's
// publication action.
export function createPublicationPreviewGate() {
  let current = 0
  return {
    begin() {
      current += 1
      return current
    },
    invalidate() {
      current += 1
    },
    isCurrent(requestId) {
      return requestId === current
    },
  }
}

function publishableApps(installed) {
  return (installed || []).filter((app) => (
    app?.source_dir
    && app?.slug !== 'app-store'
    && (!app?.manifest_url || app?.hosted_publication)
  ))
}

// Apps this owner has already published (or is publishing) from this Möbius.
function publishedEntries(installed, publicationStates, publicationListings) {
  return (installed || [])
    .filter((app) => app?.id && (publicationStates[app.id] || app.hosted_publication))
    .map((app) => {
      const state = publicationStates[app.id] || null
      return { app, state: publishedAppView(state, publicationListings[state?.community_app_id]) }
    })
    .sort((left, right) => String(left.app.name || '').localeCompare(String(right.app.name || '')))
}

// Why publishing without a passing verdict takes one more confirmation.
const UNCHECKED_REASON = {
  none: 'Your agent hasn’t checked this version.',
  running: 'Your agent hasn’t finished checking this version.',
  error: 'The agent check for this version didn’t finish.',
  stale: 'The last agent check was for an older version.',
  unavailable: 'Agent checks aren’t available on this Möbius.',
}

function publicationLabel(state, hosted) {
  if (hosted?.has_unpublished_changes) return 'Draft changes'
  if (!state) return hosted ? 'Hosted' : 'Not listed'
  if (state.status === 'live') return 'Live'
  if (state.status === 'rejected' || state.status === 'failed') return 'Needs attention'
  if (state.status === 'checking') return 'Checking'
  return 'In review'
}

function assetUrl(preview, path) {
  return preview?.asset_root && path ? `${preview.asset_root}${path}` : ''
}

// Fields where the agent's new value met the owner's own unsaved edit.
function AgentConflicts({ conflicts, onResolve }) {
  const fields = Object.keys(conflicts)
  if (!fields.length) return null
  return (
    <div className="st-agent-conflicts" role="status">
      {fields.map((field) => {
        const value = conflicts[field]
        return (
          <div key={field} className="st-agent-conflict">
            <div>
              <strong>The agent wrote a new {LISTING_FIELD_LABELS[field]}</strong>
              <span>You changed it here too, so yours is still in the form.</span>
              {typeof value === 'string' && value.trim() ? <q>{value.trim().slice(0, 280)}</q> : null}
            </div>
            <div className="st-agent-conflict-actions">
              <button type="button" className="st-btn st-btn-secondary" onClick={() => onResolve(field, true)}>
                Use the agent’s
              </button>
              <button type="button" className="st-link-btn" onClick={() => onResolve(field, false)}>Keep mine</button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function PublisherTab({
  installed,
  identity,
  identityError,
  viewer,
  onRefreshViewer,
  onPreviewLocal,
  onListingAgent,
  onListingAgentStatus,
  onOpenChat,
  onSaveListing,
  onPrepareImage,
  onPublishLocal,
  onRegisterRepository,
  publishingId,
  publication,
  publicationError,
  contributeAvailable,
  onOpenContributions,
  publicationStates = {},
  publicationListings = {},
  publisherHandle = '',
  publicationStatesError,
  onRefreshPublicationStates,
  onLogInToMobiusYou,
  onNavigate,
  catalog = [],
  spotlightFeed = null,
  token,
  onUploadSpotlightArtwork,
  onPublishSpotlight,
  onLoadReviews,
  onViewInStore,
  onRunCheck,
  onFixCheck,
}) {
  const apps = publishableApps(installed).sort((left, right) => (
    Date.parse(right.updated_at || '') - Date.parse(left.updated_at || '')
    || String(left.name || '').localeCompare(String(right.name || ''))
  ))
  const identityReady = !!identity && !identityError
  const signedIn = identityReady && !!identity?.linked
  const githubReady = viewer?.github?.connected === true
  const githubLogin = String(viewer?.github?.login || '')
  const [candidate, setCandidate] = useState(null)
  const [preview, setPreview] = useState(null)
  const [previewError, setPreviewError] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [askingAgent, setAskingAgent] = useState(false)
  // The one agent chat working on the open app's listing; see
  // startedListingAgentRun. Its applied parts flow into the form below.
  const [agentRun, setAgentRun] = useState(null)
  // Fields the agent changed that the owner had also edited: field -> the
  // agent's value, offered as Use it / Keep mine.
  const [agentConflicts, setAgentConflicts] = useState({})
  const [draft, setDraft] = useState(null)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [editing, setEditing] = useState(false)
  const [localRepositoryName, setLocalRepositoryName] = useState('')
  const [repository, setRepository] = useState('')
  const [commitSha, setCommitSha] = useState('')
  const [appQuery, setAppQuery] = useState('')
  // home: your published apps · choose: pick an app to publish · app: one published app
  const [view, setView] = useState('home')
  const [openAppId, setOpenAppId] = useState(null)
  // The stored check result; undefined until storage is read for this app.
  const [checkRaw, setCheckRaw] = useState(undefined)
  // { appId, commit, prior, startedAt, failed } for the check the owner most
  // recently asked for; see publishCheckRequestStatus. It belongs to one app,
  // so reopening that app mid-check resumes waiting.
  const [checkRequest, setCheckRequest] = useState(null)
  const [checkBusy, setCheckBusy] = useState(false)
  const [confirmingAnyway, setConfirmingAnyway] = useState(false)
  const publishTriggerRef = useRef(null)
  const confirmHeadingRef = useRef(null)
  const confirmShownRef = useRef(false)
  const previewGateRef = useRef(null)
  // Latest form state for the agent refresh, which runs from a timer.
  const liveRef = useRef({})
  const saveEpochRef = useRef(0)
  // Remounts the editor (clearing its image errors) on a full reload only,
  // never under the owner's cursor when an agent's part arrives.
  const [editorEpoch, setEditorEpoch] = useState(0)
  if (!previewGateRef.current) previewGateRef.current = createPublicationPreviewGate()
  liveRef.current = { candidate, preview, draft, saving }
  const agentActive = !!(agentRun?.active && candidate && agentRun.appId === candidate.id)
  const repositoryValid = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository.trim())
  const commitValid = /^[0-9a-fA-F]{40,64}$/.test(commitSha.trim())
  const localRepositoryValid = /^[A-Za-z0-9_.-]{1,100}$/.test(localRepositoryName.trim())
  const published = publishedEntries(installed, publicationStates, publicationListings)
  useEffect(() => { onRefreshPublicationStates() }, [onRefreshPublicationStates])
  const openEntry = published.find((entry) => entry.app.id === openAppId) || null
  const acceptedCommit = String(preview?.accepted_commit || '')
  // Checks live in this Store's app storage; without it there is nothing to
  // check with, and publishing stays available.
  const checkStorage = typeof window !== 'undefined' ? window.mobius?.storage || null : null
  const check = candidate ? parsePublishCheck(checkRaw, candidate.id) : null
  const checkState = publishCheckState(
    check, acceptedCommit,
    publishCheckRequestStatus(checkRequest?.appId === candidate?.id ? checkRequest : null, checkRaw, check, acceptedCommit),
    { storage: !!checkStorage },
  )
  // The check is the owner's own AI opinion, not a Store gate: without a
  // passing verdict, publishing asks for one explicit extra confirmation.
  const checkPassed = checkState === 'ready'
  const publishDisabled = !confirmed || !localRepositoryValid || !!publishingId || !signedIn || !githubReady
  useEffect(() => { setConfirmingAnyway(false) }, [checkState, candidate?.id])
  // The confirmation replaces the Publish button: move focus into it, and back
  // to the button whenever it closes (Keep reviewing, or a verdict arriving)
  // while focus was inside it and so fell back to the page.
  const confirmShown = confirmingAnyway && !checkPassed
  useEffect(() => {
    if (confirmShown) confirmHeadingRef.current?.focus()
    else if (confirmShownRef.current) {
      const active = document.activeElement
      if (!active || active === document.body) publishTriggerRef.current?.focus()
    }
    confirmShownRef.current = confirmShown
  }, [confirmShown])

  // The agent writes its verdict into the Store's own storage; follow that key
  // live for the app being published.
  useEffect(() => {
    setCheckRaw(undefined)
    const store = checkStorage
    if (!candidate?.id || !store) return undefined
    const key = publishCheckKey(candidate.id)
    let cancelled = false
    store.get(key).then((value) => { if (!cancelled) setCheckRaw(value ?? null) })
      .catch(() => { if (!cancelled) setCheckRaw(null) })
    const unsubscribe = typeof store.subscribe === 'function'
      ? store.subscribe(key, (value) => { if (!cancelled) setCheckRaw(value) })
      : null
    return () => { cancelled = true; if (typeof unsubscribe === 'function') unsubscribe() }
  }, [candidate?.id, checkStorage])

  // App storage only notifies on this frame's own writes and on re-reads, so
  // while the agent works, re-read its result (visible only). A request that
  // outlives the timeout fails into a retryable error.
  useEffect(() => {
    if (checkState !== 'running' || !candidate?.id || !checkStorage) return undefined
    const key = publishCheckKey(candidate.id)
    const request = checkRequest
    let cancelled = false
    const poll = setInterval(() => {
      if (window.mobius?.visible === false) return
      checkStorage.get(key).then((value) => { if (!cancelled) setCheckRaw(value ?? null) }).catch(() => {})
    }, PUBLISH_CHECK_POLL_MS)
    const expire = setTimeout(() => stopWaiting(request),
      Math.max(0, request.startedAt + PUBLISH_CHECK_TIMEOUT_MS - Date.now()))
    return () => { cancelled = true; clearInterval(poll); clearTimeout(expire) }
  }, [checkState, candidate?.id, checkRequest, checkStorage])

  function stopWaiting(request) {
    setCheckRequest((current) => (current && current === request ? { ...current, failed: true } : current))
  }

  async function runCheck() {
    // The prior result must be known, or an older verdict could later look new.
    if (!candidate || !acceptedCommit || checkBusy || checkRaw === undefined) return
    setCheckBusy(true)
    try {
      const prior = JSON.stringify(checkRaw)
      const ok = await onRunCheck?.(candidate, acceptedCommit)
      if (ok) setCheckRequest({ appId: candidate.id, commit: acceptedCommit, prior, startedAt: Date.now(), failed: false })
    } finally {
      setCheckBusy(false)
    }
  }

  async function publish() {
    const ok = await onPublishLocal?.(candidate.id, localRepositoryName.trim(), acceptedCommit)
    if (ok) closePreview({ force: true })
  }

  async function fixCheck(issues) {
    if (!candidate || checkBusy) return
    setCheckBusy(true)
    try {
      await onFixCheck?.(candidate, issues)
    } finally {
      setCheckBusy(false)
    }
  }

  const visibleApps = apps.filter((app) => {
    const needle = appQuery.trim().toLowerCase()
    return !needle || `${app.name || ''} ${app.slug || ''}`.toLowerCase().includes(needle)
  })

  function showPreview(app, result) {
    const nextDraft = listingDraftFromPreview(result, app)
    setPreview(result || null)
    setDraft(nextDraft)
    setDirty(false)
    setEditing(false)
    setAgentConflicts({})
    setEditorEpoch((epoch) => epoch + 1)
    setConfirmed(false)
    if (result?.repository_name) setLocalRepositoryName(result.repository_name)
  }

  async function prepare(app) {
    const requestId = previewGateRef.current.begin()
    onNavigate?.()
    setCandidate(app)
    setAgentRun(null)
    setAgentConflicts({})
    onListingAgentStatus?.(app).then((status) => {
      if (liveRef.current.candidate?.id !== app.id) return
      setAgentRun((run) => (run?.appId === app.id ? run : observedListingAgentRun(app.id, status)))
    }).catch(() => {})
    setConfirmed(false)
    setPreview(null)
    setPreviewError('')
    setSaveError('')
    setLocalRepositoryName(String(app.slug || app.name || 'mobius-app')
      .toLowerCase().replace(/[^a-z0-9_.-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 100))
    try {
      const result = await onPreviewLocal?.(app.id)
      if (!previewGateRef.current.isCurrent(requestId)) return
      showPreview(app, result)
    } catch (error) {
      if (!previewGateRef.current.isCurrent(requestId)) return
      setPreviewError(error instanceof Error ? error.message : 'This listing could not be prepared.')
    }
  }

  async function saveListing() {
    if (!candidate || !draft || saving) return
    const app = candidate
    const requestId = previewGateRef.current.begin()
    saveEpochRef.current += 1
    setSaving(true)
    setSaveError('')
    setConfirmed(false)
    try {
      // Saving writes the listing onto whichever revision is accepted now, and
      // the save route has no expected-revision guard. Re-read first so a
      // draft from an older revision never silently replaces a newer one; the
      // owner keeps their edits and saves again knowingly.
      const latest = await onPreviewLocal?.(app.id)
      const saved = listingPayload(draft)
      const movedBefore = String(latest?.accepted_commit || '') !== String(preview?.accepted_commit || '')
      if (!movedBefore) await onSaveListing?.(app.id, saved)
      const result = movedBefore ? latest : await onPreviewLocal?.(app.id)
      // A save is itself a new accepted revision, so its commit cannot show
      // whether another one landed in between. The listing that must survive
      // can: if any saved field did not, keep the draft and say so instead of
      // reporting success.
      const moved = movedBefore || !savedListingSurvived(saved, result?.draft)
      if (!previewGateRef.current.isCurrent(requestId)) return
      if (moved) {
        setPreview(result || null)
        setSaveError('This app changed since you opened its listing. Your edits are kept: check them, then save again to use them on the new version.')
        return
      }
      showPreview(app, result)
    } catch (error) {
      if (!previewGateRef.current.isCurrent(requestId)) return
      setSaveError(error instanceof Error ? error.message : 'The listing could not be saved.')
    } finally {
      setSaving(false)
    }
  }

  function closePreview({ force = false } = {}) {
    if (publishingId && !force) return
    previewGateRef.current.invalidate()
    onNavigate?.()
    setCandidate(null)
    setPreview(null)
    setPreviewError('')
    setConfirmed(false)
    setLocalRepositoryName('')
    setDraft(null)
    setSaveError('')
    setAgentRun(null)
    setAgentConflicts({})
  }

  async function askAgent(problem, focus = '') {
    if (!candidate || askingAgent) return
    const app = candidate
    setAskingAgent(true)
    try {
      const result = await onListingAgent?.(app, problem, focus)
      if (result?.chatId) {
        setAgentRun((run) => startedListingAgentRun(run, { appId: app.id, chatId: result.chatId, focus }))
      }
    } finally {
      setAskingAgent(false)
    }
  }

  function viewAgent() {
    if (agentRun?.chatId) onOpenChat?.(agentRun.chatId)
  }

  // A newer accepted listing (the agent applied a part) merges into the open
  // form: untouched fields take it, the owner's edits stay. Skipped while a
  // save is in flight, whose own reload is authoritative.
  async function refreshListingFromSource(app) {
    const epoch = saveEpochRef.current
    if (liveRef.current.saving) return
    let result
    try {
      result = await onPreviewLocal?.(app.id)
    } catch {
      return
    }
    const live = liveRef.current
    if (!result || live.candidate?.id !== app.id || live.saving || epoch !== saveEpochRef.current) return
    if (!live.preview) {
      setPreviewError('')
      showPreview(app, result)
      return
    }
    if (String(result.accepted_commit || '') === String(live.preview.accepted_commit || '')) return
    if (!live.draft) {
      showPreview(app, result)
      return
    }
    const theirs = listingDraftFromPreview(result, app)
    const merged = mergeListingUpdate(listingDraftFromPreview(live.preview, app), live.draft, theirs)
    liveRef.current = { ...live, preview: result, draft: merged.draft }
    setPreview(result)
    setDraft(merged.draft)
    setDirty(merged.dirty)
    setAgentConflicts((current) => {
      const next = { ...current, ...merged.conflicts }
      for (const field of Object.keys(next)) {
        if (!listingFieldsDiffer(merged.draft, theirs, field)) delete next[field]
      }
      return next
    })
    // A listing that just became ready opens on Publish, unless that would
    // hide edits the owner has not saved.
    if (merged.dirty) setEditing(true)
  }

  function resolveAgentConflict(field, useAgent) {
    const value = agentConflicts[field]
    setAgentConflicts(({ [field]: _resolved, ...rest }) => rest)
    if (!useAgent || !draft) return
    const next = { ...draft, [field]: value, ...(field === 'icon' ? { iconChanged: false } : {}) }
    const saved = listingDraftFromPreview(preview, candidate)
    setDraft(next)
    setDirty(Object.keys(LISTING_FIELD_LABELS).some((name) => listingFieldsDiffer(next, saved, name)))
  }

  // While the listing agent works, follow its chat and the accepted listing.
  useEffect(() => {
    if (!agentActive || !candidate) return undefined
    const app = candidate
    let cancelled = false
    let busy = false
    const tick = async () => {
      if (busy || window.mobius?.visible === false) return
      busy = true
      try {
        let status
        try {
          status = await onListingAgentStatus?.(app)
        } catch {
          status = undefined
        }
        if (cancelled) return
        await refreshListingFromSource(app)
        if (cancelled || status === undefined) return
        setAgentRun((run) => (run?.appId === app.id ? listingAgentRunAfterStatus(run, status) : run))
      } finally {
        busy = false
      }
    }
    const timer = setInterval(tick, LISTING_AGENT_POLL_MS)
    return () => { cancelled = true; clearInterval(timer) }
  }, [agentActive, candidate?.id])

  function askAgentForListing(focus) {
    const missing = (preview?.checklist || [])
      .filter((item) => !item.done && item.message)
      .map((item) => `${item.label}: ${item.message}`)
      .join(' ')
    askAgent(focus ? '' : missing, focus)
  }

  const listing = preview?.listing
  const renderApp = (app) => {
    const state = publicationStates[app.id]
    const label = publicationLabel(state, app.hosted_publication)
    return (
      <article className="st-publish-row" key={app.id}>
        <div className="st-publish-icon" aria-hidden="true">
          <span>{String(app.name || app.slug || '?').trim().slice(0, 1).toUpperCase()}</span>
          {app.icon_url ? (
            <img src={app.icon_url} alt="" width="48" height="48"
                 onError={(event) => { event.currentTarget.hidden = true }} />
          ) : null}
        </div>
        <div className="st-publish-row-copy"><h3>{app.name}</h3><span>{label}</span></div>
        <button type="button" className="st-btn st-btn-secondary"
                disabled={!!publishingId || !signedIn || !githubReady}
                onClick={() => prepare(app)}>
          {state?.status === 'live' ? 'Review update' : 'Prepare listing'}
        </button>
      </article>
    )
  }

  return (
    <div className={`st-publisher${candidate ? ' is-reviewing' : ''}`}>
      {!candidate && view !== 'app' ? (
        <section className="st-publish-heading">
          <div>
            {view === 'choose' ? (
              <button type="button" className="st-back-btn" onClick={() => setView('home')}>
                <ChevronLeft width="16" height="16" aria-hidden="true" />Your apps
              </button>
            ) : null}
            <h2>{view === 'choose' ? 'Publish an app' : 'Your apps'}</h2>
            {view === 'choose' ? <p>Pick one of the apps you built on this Möbius.</p> : null}
          </div>
          <div className="st-publish-heading-actions">
            {!signedIn ? (
              <button type="button" className="st-publish-connection st-publish-connection-action"
                      onClick={() => onLogInToMobiusYou?.()}>
                Log in to Möbius · You
              </button>
            ) : null}
            {signedIn && githubReady ? <span className="st-publish-account">Publishing as {publisherHandle || githubLogin}</span> : null}
            {contributeAvailable ? (
              <button type="button" className="st-btn st-btn-ghost" onClick={() => onOpenContributions?.()}>
                Open contributions
              </button>
            ) : null}
            {view === 'home' ? (
              <button type="button" className="st-btn st-btn-primary" onClick={() => setView('choose')}>
                Publish an app
              </button>
            ) : null}
          </div>
        </section>
      ) : null}

      {publication ? (
        <div className="st-publish-result" role="status">
          <strong>{publication.name || 'Your app'} is {publication.status === 'live' ? 'live' : 'submitted'}</strong>
          <span>{publication.status === 'live' ? 'The exact release is now available in Browse.' : 'Checks are running.'}</span>
          {publication.revision_moved ? (
            <span className="st-publish-result-warning">The app changed after you reviewed it, so a newer version than the one you reviewed was published. Check the public listing.</span>
          ) : null}
          {(publication.repository_url || publication.github?.url) ? (
            <a href={publication.repository_url || publication.github.url} target="_blank" rel="noopener noreferrer">Open source</a>
          ) : null}
        </div>
      ) : null}
      {publicationError ? <div className="st-notice is-warning" role="alert">{publicationError}</div> : null}
      {publicationStatesError ? (
        <div className="st-community-unavailable" role="status">
          <span>Live publishing status could not be refreshed.</span>
          <button type="button" className="st-btn st-btn-secondary" onClick={onRefreshPublicationStates}>Try again</button>
        </div>
      ) : null}
      {!signedIn ? (
        <div className="st-notice is-warning" role="status">
          <div className="st-notice-row">
            <span>{identityError
              ? 'Your Möbius · You identity is unavailable. Log in to publish.'
              : 'Log in to Möbius · You to publish an app.'}</span>
            <button type="button" className="st-btn st-btn-primary st-notice-action"
                    onClick={() => onLogInToMobiusYou?.()}>
              Log in to Möbius · You
            </button>
          </div>
        </div>
      ) : null}
      {signedIn && viewer?.error ? <div className="st-notice is-warning" role="alert">{viewer.error}</div> : null}
      {signedIn && viewer && !githubReady ? (
        <div className="st-publish-setup" role="status">
          <div><strong>Connect GitHub in Contribute</strong><span>The Store will inherit that connection without receiving your credential.</span></div>
          <button type="button" className="st-btn st-btn-secondary" onClick={onRefreshViewer}>Check again</button>
          {contributeAvailable ? <button type="button" className="st-btn st-btn-primary" onClick={() => onOpenContributions?.()}>Open Contribute</button> : null}
        </div>
      ) : null}

      {!candidate && view === 'home' && spotlightFeed?.viewer?.can_edit ? (
        <SpotlightEditor
          catalog={catalog}
          feed={spotlightFeed}
          token={token}
          onUploadArtwork={onUploadSpotlightArtwork}
          onPublish={onPublishSpotlight}
        />
      ) : null}

      {candidate ? (
        <section className="st-listing-review" aria-label={`${candidate.name || 'App'} publishing review`}>
          <div className="st-listing-review-top">
            <button type="button" className="st-back-btn" onClick={closePreview} disabled={!!publishingId}>Back</button>
            <span>{preview ? (preview.ready ? 'Ready to publish' : 'Not ready yet') : 'Accepted source only'}</span>
          </div>
          {!preview && !previewError ? (
            <div className="st-listing-loading" role="status">Preparing {candidate.name}…</div>
          ) : previewError ? (
            <div className="st-listing-incomplete" role="alert">
              <FileUpload width="28" height="28" aria-hidden="true" />
              <div>
                <strong>This app isn’t ready to publish yet</strong>
                <span>{previewError}</span>
                {onListingAgent ? (
                  agentActive ? (
                    <button type="button" className="st-btn st-btn-primary st-listing-agent" onClick={viewAgent}>
                      Agent working… View
                    </button>
                  ) : (
                    <button type="button" className="st-btn st-btn-primary st-listing-agent"
                            disabled={askingAgent} onClick={() => askAgent(previewError)}>
                      {askingAgent ? 'Opening agent…' : 'Get it ready with an agent'}
                    </button>
                  )
                ) : null}
              </div>
            </div>
          ) : !preview.ready || editing ? (
            <div className="st-listing-work">
              <ListingChecklist checklist={preview.checklist || []} agentBusy={askingAgent}
                                agent={agentActive ? agentRun : null}
                                onAgent={askAgentForListing} onViewAgent={viewAgent} />
              <AgentConflicts conflicts={agentConflicts} onResolve={resolveAgentConflict} />
              {draft ? (
                <ListingEditor
                  key={`${candidate.id}:${editorEpoch}`}
                  draft={draft}
                  setDraft={(change) => { setDirty(true); setDraft(change) }}
                  app={candidate}
                  detailsNeedAgent={(preview.checklist || []).some((item) => (
                    item.id === 'details' && !item.done && item.automatic === false
                  ))}
                  saving={saving}
                  saveError={saveError}
                  dirty={dirty}
                  onPrepareImage={onPrepareImage}
                  onSave={saveListing}
                />
              ) : null}
              {preview.ready ? (
                <button type="button" className="st-btn st-btn-secondary st-listing-agent"
                        disabled={saving} onClick={() => setEditing(false)}>
                  Back to publishing
                </button>
              ) : null}
            </div>
          ) : (
            <div className="st-listing-ready-layout">
              <div className="st-listing-hero">
                {listing?.hero?.path ? <img src={assetUrl(preview, listing.hero.path)} alt="" /> : null}
                <div className="st-listing-hero-shade" />
                <div className="st-listing-hero-copy">
                  <img src={preview.icon_url} alt="" width="64" height="64" />
                  <h3 id="st-listing-review-title">{preview.name}</h3>
                  <p>{listing?.tagline}</p>
                </div>
              </div>
              <aside className="st-listing-release-panel" aria-label="Release decision">
                <div className="st-listing-release-copy">
                  <h3>Publish this version</h3>
                  <p>The accepted source and this listing become public together. Later edits stay private until you publish again.</p>
                </div>
                <label className="st-publish-field">
                  <span>Public repository</span>
                  <div className="st-publisher-repository-name">
                    <span aria-hidden="true">{githubLogin}/</span>
                    <input value={localRepositoryName} autoCapitalize="none" autoCorrect="off"
                           onChange={(event) => setLocalRepositoryName(event.target.value)} disabled={!!publishingId} />
                  </div>
                </label>
                <PublishCheck state={checkState} check={check} busy={checkBusy}
                              onRun={runCheck} onFix={fixCheck} onStop={() => stopWaiting(checkRequest)} />
                <label className="st-publish-consent">
                  <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
                  <span>I’ve reviewed this listing and want this exact source revision to become public.</span>
                </label>
                {confirmShown ? (
                  <div className="st-publish-anyway" role="group" aria-labelledby="st-publish-anyway-title"
                       aria-describedby="st-publish-anyway-reason">
                    <strong id="st-publish-anyway-title" ref={confirmHeadingRef} tabIndex={-1}>
                      {checkState === 'must_fix' ? 'Publish without fixing it?' : 'Publish without a check?'}
                    </strong>
                    <span id="st-publish-anyway-reason">
                      {checkState === 'must_fix'
                        ? `Your agent flagged ${check?.must_fix_count || 0} ${check?.must_fix_count === 1 ? 'thing' : 'things'} to fix.`
                        : UNCHECKED_REASON[checkState]}
                      {' '}The check is optional advice from your agent, so the decision is yours.
                    </span>
                    <div className="st-check-actions">
                      <button type="button" className="st-btn st-btn-ghost" disabled={!!publishingId}
                              onClick={() => setConfirmingAnyway(false)}>
                        Keep reviewing
                      </button>
                      <button type="button" className="st-btn st-btn-primary" disabled={publishDisabled} onClick={publish}>
                        {publishingId === candidate.id ? 'Publishing…' : checkState === 'must_fix' ? 'Publish anyway' : 'Publish'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button type="button" className="st-btn st-btn-primary" disabled={publishDisabled} ref={publishTriggerRef}
                          onClick={checkPassed ? publish : () => setConfirmingAnyway(true)}>
                    {publishingId === candidate.id ? 'Publishing…'
                      : checkState === 'must_fix' ? 'Publish anyway…'
                        : checkPassed ? 'Publish app' : 'Publish…'}
                  </button>
                )}
                <div className="st-listing-revise">
                  <button type="button" className="st-btn st-btn-secondary"
                          disabled={!!publishingId} onClick={() => { setConfirmed(false); setEditing(true) }}>
                    Edit listing
                  </button>
                  {onListingAgent ? (
                    <button type="button" className="st-btn st-btn-ghost"
                            disabled={askingAgent || !!publishingId} onClick={agentActive ? viewAgent : () => askAgent('')}>
                      {agentActive ? 'Agent working… View' : askingAgent ? 'Starting agent…' : 'Revise with an agent'}
                    </button>
                  ) : null}
                </div>
              </aside>
              <div className="st-listing-body">
                <p>{listing?.description}</p>
                <div className="st-listing-gallery" aria-label="App screenshots">
                  {(listing?.screenshots || []).map((shot) => (
                    <figure key={shot.src}>
                      <img src={assetUrl(preview, shot.src)} alt={shot.alt} />
                      {shot.label ? <figcaption>{shot.label}</figcaption> : null}
                    </figure>
                  ))}
                </div>
              </div>
            </div>
          )}
        </section>
      ) : view === 'app' && openEntry ? (
        <PublishedAppPage
          app={openEntry.app}
          state={openEntry.state}
          onBack={() => { setView('home'); setOpenAppId(null) }}
          onPublishUpdate={() => prepare(openEntry.app)}
          publishDisabled={!!publishingId || !signedIn || !githubReady}
          onLoadReviews={onLoadReviews}
          onViewInStore={onViewInStore}
        />
      ) : view !== 'choose' ? (
        published.length ? (
          <YourAppsList entries={published}
                        onOpen={(app) => { setOpenAppId(app.id); setView('app'); onNavigate?.() }} />
        ) : (
          <div className="st-empty">
            <div className="st-empty-title">You haven’t published an app yet</div>
            <p className="st-empty-text">Pick one of your apps and share it with everyone on Möbius.</p>
            <button type="button" className="st-btn st-btn-primary" onClick={() => setView('choose')}>Publish an app</button>
          </div>
        )
      ) : (
        <>
          <div className="st-publish-list-head">
            <div><p>{apps.length} {apps.length === 1 ? 'app' : 'apps'} on this Möbius can be published.</p></div>
            <label className="st-publish-search">
              <span className="st-sr-only">Search your apps</span>
              <Search width="17" height="17" aria-hidden="true" />
              <input value={appQuery} onChange={(event) => setAppQuery(event.target.value)} placeholder="Search apps" />
            </label>
          </div>
          <div className="st-publish-list" aria-label="Apps ready to publish">
            {visibleApps.length ? visibleApps.map(renderApp) : apps.length ? (
              <div className="st-empty"><div className="st-empty-title">No matching apps</div><p className="st-empty-text">Try another name.</p></div>
            ) : (
              <div className="st-empty"><div className="st-empty-title">No local apps yet</div><p className="st-empty-text">Build an app, then return here to publish it.</p></div>
            )}
          </div>
        </>
      )}

      {!candidate && view === 'choose' ? (
        <details className="st-publish-advanced">
          <summary><span>Already on GitHub?</span><small>List one exact commit</small></summary>
          <section className="st-publish-review" aria-labelledby="st-register-release-title">
            <div><h3 id="st-register-release-title">List a GitHub release</h3><p>Choose a public repository with <code>mobius.json</code> at its root and an exact commit. Möbius adds a proof without moving your main branch.</p></div>
            <div className="st-publish-repository-grid">
              <label className="st-publish-field"><span>Repository</span><input value={repository} placeholder="owner/repository" autoCapitalize="none" autoCorrect="off" onChange={(event) => setRepository(event.target.value)} disabled={!!publishingId} /></label>
              <label className="st-publish-field"><span>Exact commit</span><input value={commitSha} placeholder="40-character Git commit" autoCapitalize="none" autoCorrect="off" onChange={(event) => setCommitSha(event.target.value)} disabled={!!publishingId} /></label>
            </div>
            <div className="st-publish-review-actions">
              <button type="button" className="st-btn st-btn-primary" disabled={!signedIn || !githubReady || !repositoryValid || !commitValid || !!publishingId}
                      onClick={async () => {
                        const ok = await onRegisterRepository({ repository: repository.trim(), commitSha: commitSha.trim().toLowerCase(), publicIdentity: 'github' })
                        if (ok) { setRepository(''); setCommitSha('') }
                      }}>
                {publishingId === 'github-release' ? 'Creating proof…' : 'Create proof & list'}
              </button>
            </div>
          </section>
        </details>
      ) : null}
    </div>
  )
}
