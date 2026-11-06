/* ListingEditor shows everything a Store listing still needs and lets the owner
   fill each part in by hand or hand that part to an agent. Saving writes the
   listing into the app's own source, so the publish review reads it back. */
import {
  CheckCircleFilled, Circle, ImageSquare, Plus, Sparkles, Trash,
} from '@openai/apps-sdk-ui/components/Icon'
import React, { useEffect, useId, useRef, useState } from 'react'
import { LISTING_LIMITS, STORE_LICENSES } from '../constants.js'
import { utf8Length } from '../domain.js'

const {
  taglineBytes: TAGLINE_MAX,
  descriptionBytes: DESCRIPTION_MAX,
  altBytes: ALT_MAX,
  captionBytes: CAPTION_MAX,
  screenshots: MAX_SCREENSHOTS,
} = LISTING_LIMITS

function Counter({ value, max, id }) {
  const used = utf8Length(value.trim())
  return <span id={id} className={`st-edit-count${used > max ? ' is-over' : ''}`}>{used}/{max} bytes</span>
}

// A real file input inside its label, visually hidden: keyboard, screen
// readers, and test drivers all reach the actual control.
function ImagePicker({ label, onPick, disabled, children, className = '' }) {
  return (
    <label className={`${className} st-file-picker${disabled ? ' is-disabled' : ''}`}>
      <input type="file" className="st-visually-hidden" aria-label={label} disabled={disabled}
             accept="image/png,image/jpeg,image/webp"
             onChange={(event) => {
               const file = event.target.files?.[0]
               event.target.value = ''
               if (file) onPick(file)
             }} />
      {children}
    </label>
  )
}

export function ListingChecklist({ checklist, agentBusy, onAgent }) {
  const required = checklist.filter((item) => !item.optional)
  const done = required.filter((item) => item.done).length
  return (
    <section className="st-checklist" aria-label="What this listing needs">
      <div className="st-checklist-head">
        <div>
          <strong>{done === required.length ? 'Everything needed is here' : `${required.length - done} of ${required.length} still needed`}</strong>
          <span>Fill these in below, or hand any part to an agent.</span>
        </div>
        <button type="button" className="st-btn st-btn-secondary" disabled={agentBusy}
                onClick={() => onAgent('')}>
          <Sparkles width="16" height="16" aria-hidden="true" />
          {agentBusy ? 'Opening agent…' : 'Do it all with an agent'}
        </button>
      </div>
      <ul>
        {checklist.map((item) => {
          const automatic = item.automatic === true
          return (
            <li key={item.id} className={item.done ? 'is-done' : ''}>
              {item.done
                ? <CheckCircleFilled className="st-check-icon is-done" width="20" height="20" aria-hidden="true" />
                : <Circle className="st-check-icon" width="20" height="20" aria-hidden="true" />}
              <div>
                <span className="st-check-label">
                  {item.label}{item.optional ? <small> · optional</small> : null}
                </span>
                {!item.done && item.message ? <span className="st-check-note">{item.message}</span> : null}
              </div>
              {!item.done && !automatic ? (
                <button type="button" className="st-check-agent" disabled={agentBusy}
                        onClick={() => onAgent(item.id)}>
                  Ask an agent
                </button>
              ) : <span />}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

export function ListingEditor({
  draft, setDraft, app, detailsNeedAgent, saving, saveError, dirty,
  onPrepareImage, onSave,
}) {
  const [imageError, setImageError] = useState('')
  const [preparing, setPreparing] = useState('')
  const pickSession = useRef(0)
  useEffect(() => () => { pickSession.current += 1 }, [])
  const ids = useId()
  const busy = saving || !!preparing

  async function pick(slot, file, apply) {
    const session = pickSession.current
    setImageError('')
    setPreparing(slot)
    try {
      const image = await onPrepareImage(file)
      if (session === pickSession.current) apply(image)
    } catch (error) {
      if (session === pickSession.current) setImageError(error instanceof Error ? error.message : 'That image could not be used.')
    } finally {
      if (session === pickSession.current) setPreparing('')
    }
  }

  const update = (patch) => setDraft((current) => ({ ...current, ...patch }))
  const updateShot = (key, patch) => setDraft((current) => ({
    ...current,
    screenshots: current.screenshots.map((shot) => (shot.key === key ? { ...shot, ...patch } : shot)),
  }))
  const shots = draft.screenshots
  const overLimit = utf8Length(draft.tagline.trim()) > TAGLINE_MAX
    || utf8Length(draft.description.trim()) > DESCRIPTION_MAX
    || shots.some((shot) => utf8Length(shot.alt.trim()) > ALT_MAX || utf8Length(shot.label.trim()) > CAPTION_MAX)

  return (
    <form className="st-listing-editor" onSubmit={(event) => { event.preventDefault(); onSave() }}>
      <div className="st-edit-identity">
        <div className="st-edit-icon">
          {draft.icon?.url ? <img src={draft.icon.url} alt="" /> : <ImageSquare width="24" height="24" aria-hidden="true" />}
        </div>
        <div>
          <strong>{app?.name}</strong>
          <ImagePicker label="Change app icon" className="st-link-btn" disabled={busy}
                       onPick={(file) => pick('icon', file, (image) => update({ icon: image, iconChanged: true }))}>
            {preparing === 'icon' ? 'Preparing…' : draft.icon?.url ? 'Change icon' : 'Add an icon'}
          </ImagePicker>
        </div>
      </div>

      <label className="st-edit-field" htmlFor={`${ids}-tagline`}>
        <span className="st-edit-label">Tagline <Counter value={draft.tagline} max={TAGLINE_MAX} /></span>
        <input id={`${ids}-tagline`} value={draft.tagline} maxLength={TAGLINE_MAX * 2}
               placeholder="One line on what it does for you"
               onChange={(event) => update({ tagline: event.target.value })} />
      </label>

      <label className="st-edit-field" htmlFor={`${ids}-description`}>
        <span className="st-edit-label">Description <Counter value={draft.description} max={DESCRIPTION_MAX} /></span>
        <textarea id={`${ids}-description`} rows={5} value={draft.description}
                  placeholder="What it does, who it is for, and what stays private."
                  onChange={(event) => update({ description: event.target.value })} />
      </label>

      {typeof draft.license === 'string' ? (
        <LicensePicker value={draft.license} onChange={(license) => update({ license })} />
      ) : null}

      <fieldset className="st-edit-field">
        <legend className="st-edit-label">Screenshots <span className="st-edit-count">{shots.length}/{MAX_SCREENSHOTS}</span></legend>
        <p className="st-edit-hint">Everything here becomes public. Show demo or empty data, not your own.</p>
        <div className="st-edit-shots">
          {shots.map((shot, index) => (
            <div className="st-edit-shot" key={shot.key}>
              <div className="st-edit-shot-image">
                {shot.url ? <img src={shot.url} alt="" /> : <span>File missing. Remove it or add it again.</span>}
                <button type="button" className="st-edit-remove" disabled={busy}
                        aria-label={`Remove screenshot ${index + 1}`}
                        onClick={() => update({ screenshots: shots.filter((item) => item.key !== shot.key) })}>
                  <Trash width="16" height="16" aria-hidden="true" />
                </button>
              </div>
              <label className="st-edit-field" htmlFor={`${ids}-${index}-alt`}>
                <span className="st-edit-label">What it shows <Counter id={`${ids}-${index}-alt-count`} value={shot.alt} max={ALT_MAX} /></span>
                <input id={`${ids}-${index}-alt`} aria-label={`Screenshot ${index + 1}: what it shows`} value={shot.alt}
                       aria-describedby={`${ids}-${index}-alt-count`} aria-invalid={utf8Length(shot.alt.trim()) > ALT_MAX}
                       placeholder="What this shows (required)"
                       onChange={(event) => updateShot(shot.key, { alt: event.target.value })} />
              </label>
              <label className="st-edit-field" htmlFor={`${ids}-${index}-caption`}>
                <span className="st-edit-label">Caption <Counter id={`${ids}-${index}-caption-count`} value={shot.label} max={CAPTION_MAX} /></span>
                <input id={`${ids}-${index}-caption`} aria-label={`Screenshot ${index + 1}: caption`} value={shot.label}
                       aria-describedby={`${ids}-${index}-caption-count`} aria-invalid={utf8Length(shot.label.trim()) > CAPTION_MAX}
                       placeholder="Caption (optional)"
                       onChange={(event) => updateShot(shot.key, { label: event.target.value })} />
              </label>
            </div>
          ))}
          {shots.length < MAX_SCREENSHOTS ? (
            <ImagePicker label="Add a screenshot" className="st-edit-add" disabled={busy}
                         onPick={(file) => pick('shot', file, (image) => update({
                           screenshots: [...shots, { key: `new-${Date.now()}`, ...image, alt: '', label: '' }],
                         }))}>
              <Plus width="20" height="20" aria-hidden="true" />
              <span>{preparing === 'shot' ? 'Preparing…' : 'Add screenshot'}</span>
            </ImagePicker>
          ) : null}
        </div>
      </fieldset>

      <fieldset className="st-edit-field">
        <legend className="st-edit-label">Banner image <small>optional</small></legend>
        {draft.hero?.url ? (
          <div className="st-edit-hero">
            <img src={draft.hero.url} alt="" />
            <button type="button" className="st-edit-remove" disabled={busy}
                    aria-label="Remove banner image" onClick={() => update({ hero: null })}>
              <Trash width="16" height="16" aria-hidden="true" />
            </button>
          </div>
        ) : (
          <ImagePicker label="Add a banner image" className="st-edit-add is-wide" disabled={busy}
                       onPick={(file) => pick('hero', file, (image) => update({ hero: image }))}>
            <ImageSquare width="20" height="20" aria-hidden="true" />
            <span>{preparing === 'hero' ? 'Preparing…' : 'Add a wide banner'}</span>
          </ImagePicker>
        )}
      </fieldset>

      {imageError ? <p className="st-edit-error" role="alert">{imageError}</p> : null}
      {saveError ? <p className="st-edit-error" role="alert">{saveError}</p> : null}
      <div className="st-edit-actions">
        <span>{detailsNeedAgent
          ? 'An agent needs to set up this app’s details before the listing can be saved.'
          : dirty ? 'Saving updates the app’s source; nothing is published.' : 'All changes saved.'}</span>
        <button type="submit" className="st-btn st-btn-primary"
                disabled={!dirty || busy || overLimit || detailsNeedAgent}>
          {saving ? 'Saving…' : 'Save listing'}
        </button>
      </div>
    </form>
  )
}

// How others may use the app once its source is public. Publishing requires
// one; saving writes the choice and the license's full text into the source.
function LicensePicker({ value, onChange }) {
  const ids = useId()
  return (
    <fieldset className="st-edit-field st-edit-license">
      <legend className="st-edit-label">License</legend>
      <p className="st-edit-hint">Publishing makes your app’s source public. Choose how others may use it.</p>
      <div className="st-license-options" role="radiogroup" aria-label="License">
        {STORE_LICENSES.map((license) => {
          const checked = value === license.id
          return (
            <label key={license.id} className={`st-license-option${checked ? ' is-active' : ''}`}>
              <input type="radio" name={`${ids}-license`} value={license.id} checked={checked}
                     onChange={() => onChange(license.id)} />
              <span className="st-license-copy">
                <span className="st-license-title">
                  {license.title}
                  {license.recommended ? <span className="st-license-badge">Recommended</span> : null}
                </span>
                <span className="st-license-summary">{license.summary}</span>
              </span>
            </label>
          )
        })}
      </div>
      {!value ? <p className="st-edit-hint is-needed">Pick a license to publish this app.</p> : null}
    </fieldset>
  )
}
