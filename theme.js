// One module-level stylesheet rendered once at the app root as
// <style>{CSS}</style>. Style is via semantic `st-`-prefixed classNames;
// inline style={} is reserved for render-time dynamic values (the skeleton
// block dimensions, the installed-dot's update tint). App-driven variants
// (including every action button's state) ride is-* / variant classNames,
// never JS style helpers — the action buttons share the one canonical
// st-btn component so they're identical across the card and detail views.
// Shared chrome (root, segmented tabs, empty, sheet, buttons, toast) is
// fenced with mobius-ui markers so a
// future extraction into @mobius/ui is mechanical.
export const CSS = `
/* mobius-ui:Root v1 — keep in sync; library candidate. Diverge below the marker only. */
.st-root {
  position: relative;        /* anchor for scrims / sheets / toasts (absolute, not fixed) */
  height: 100%; width: 100%; max-width: 100%; display: flex; flex-direction: column;
  background: var(--bg); color: var(--text);
  font-family: var(--font); overflow: hidden;
  -webkit-font-smoothing: antialiased;
  -webkit-tap-highlight-color: transparent;
}
.st-scroll {
  flex: 1; min-height: 0;
  overflow-y: auto; overflow-x: hidden;
  padding: 16px max(16px, env(safe-area-inset-right)) max(16px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left));
  overscroll-behavior: contain;
  word-break: break-word; overflow-wrap: anywhere;
}
/* /mobius-ui:Root */

/* mobius-ui:Scrollskin v2 — keep in sync; hidden by default, content stays scrollable. */
.st-scroll,
.st-sheet {
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.st-scroll::-webkit-scrollbar,
.st-sheet::-webkit-scrollbar {
  display: none;
  width: 0;
  height: 0;
}
/* /mobius-ui:Scrollskin */

/* mobius-ui:Focus v1 — keep in sync; library candidate. A single
   keyboard-focus ring for every interactive control, so no element can
   ship without a visible focus indicator. .st-btn and .st-card already
   declare matching rings below; this is the floor, not a doubled ring. */
:where(button, a, input, textarea, select, summary, [role="button"], [tabindex]:not([tabindex="-1"])):focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
/* /mobius-ui:Focus */

/* Honor reduced-motion: collapse every animation/transition to ~instant
   so the skeleton pulse, card lift, and active-state scales don't move
   for motion-sensitive users. */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}

/* App-specific header — title + a segmented tab bar, not the canonical
   brand-cluster header. Kept on the store's own values. */
.st-header {
  padding: max(10px, env(safe-area-inset-top)) max(12px, env(safe-area-inset-right)) 10px max(12px, env(safe-area-inset-left));
  flex-shrink: 0;
  border-bottom: 1px solid var(--border);
  background: var(--bg);
}
.st-title-row {
  display: grid;
  grid-template-columns: minmax(120px, 1fr) minmax(320px, 560px) minmax(120px, 1fr);
  align-items: center;
  gap: 20px;
}
.st-store-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.st-brand-icon {
  width: 34px; height: 34px; border-radius: 8px;
  object-fit: cover; flex-shrink: 0; display: block;
}
.st-brand-fallback {
  width: 34px; height: 34px; border-radius: 8px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  background: var(--accent); color: var(--accent-fg);
  font-size: 22px; font-weight: 700; line-height: 1;
}
.st-brand-name {
  overflow: hidden;
  color: var(--text);
  font-size: 15px;
  font-weight: 750;
  letter-spacing: -0.02em;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.st-header-search { position: relative; justify-self: end; }
.st-header-search-toggle {
  width: 44px; height: 44px; display: grid; place-items: center;
  padding: 0; border: 1px solid var(--border); border-radius: 10px;
  color: var(--muted); background: var(--surface); cursor: pointer;
}
.st-header-search-toggle:hover,
.st-header-search.is-open .st-header-search-toggle {
  color: var(--text);
  border-color: color-mix(in srgb, var(--accent) 45%, var(--border));
}
.st-header-search-toggle:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.st-header-search-toggle svg { width: 18px; height: 18px; }
.st-header-search-popover {
  position: absolute; z-index: 20; top: calc(100% + 10px); right: 0;
  width: min(360px, calc(100vw - 32px)); min-height: 52px;
  display: grid; grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center; gap: 9px; padding: 6px 10px;
  border: 1px solid var(--border); border-radius: 12px;
  background: var(--bg); box-shadow: 0 14px 34px rgba(0, 0, 0, .22);
}
.st-header-search-popover > svg { width: 18px; height: 18px; color: var(--muted); }

/* mobius-ui:Segmented v1 — keep in sync; library candidate. Diverge below the marker only. */
.st-seg {
  display: inline-flex; gap: 2px; height: 44px;
  background: var(--surface-2, var(--surface)); border: 0; border-radius: 10px;
  box-shadow: inset 0 0 0 1px var(--border);
}
.st-seg-btn {
  box-sizing: border-box; min-height: 44px; padding: 6px 14px; border: 0; border-radius: 7px;
  background: transparent; color: var(--muted); font-family: var(--font);
  font-size: 13px; font-weight: 650; cursor: pointer; transition: background 0.15s, color 0.15s;
  touch-action: manipulation; user-select: none;
}
@media (hover: hover) {
  .st-seg-btn:hover { text-decoration: underline; text-underline-offset: 4px; }
}
@media (prefers-reduced-motion: no-preference) {
  .st-seg-btn:active { opacity: 0.75; }
}
.st-seg-btn.is-active { background: var(--bg); color: var(--text); box-shadow: 0 1px 3px rgba(0, 0, 0, 0.18); }
.st-seg.is-accent .st-seg-btn.is-active { background: var(--accent-hover, var(--accent)); color: var(--accent-fg); box-shadow: none; }
/* /mobius-ui:Segmented */

/* The store's tab bar: segmented control shares the header row with the
   brand icon, taking the remaining width with each button splitting it
   equally. min-width:0 lets it shrink without overflowing on narrow phones. */
.st-tabs { display: flex; flex: 1; min-width: 0; gap: 4px; border-radius: 10px; }
.st-tabs .st-seg-btn {
  flex: 1;
  min-width: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
}
.st-tab-count {
  min-width: 18px;
  height: 18px;
  display: inline-grid;
  place-items: center;
  padding: 0 5px;
  border-radius: 999px;
  color: var(--text);
  background: color-mix(in srgb, var(--accent) 13%, var(--bg));
  font-size: 10px;
  font-weight: 800;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}
.st-seg.is-accent .st-seg-btn.is-active .st-tab-count {
  color: var(--accent-fg);
  background: rgba(0, 0, 0, .22);
}

@media (max-width: 620px) {
  .st-title-row { grid-template-columns: auto minmax(0, 1fr) auto; gap: 10px; }
  .st-brand-name { display: none; }
  .st-brand-icon,
  .st-brand-fallback { width: 32px; height: 32px; }
}

/* Discovery controls now contain only Library filters. Search lives in the
   header and opens over content, keeping Browse focused on discovery. */
.st-discovery {
  margin: 0 0 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.st-search-label {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
.st-search-input {
  width: 100%;
  min-width: 0;
  min-height: 44px;
  padding: 8px 0;
  border: 0;
  background: transparent;
  color: var(--text);
  font-family: var(--font);
  font-size: 14px;
  outline: none;
  transition: border-color 150ms, box-shadow 150ms, background 150ms;
}
.st-search-input::placeholder { color: color-mix(in srgb, var(--muted) 88%, var(--text)); }
.st-search-input:focus {
  box-shadow: none;
}
.st-result-count {
  flex-shrink: 0;
  min-width: 48px;
  text-align: right;
  color: var(--muted);
  font-size: 12px;
  font-family: var(--mono, monospace);
}
.st-category-strip {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  overflow: visible;
  padding-bottom: 1px;
}
.st-category-strip::-webkit-scrollbar { display: none; width: 0; height: 0; }
.st-chip {
  flex: 0 0 auto;
  min-width: 44px;
  min-height: 44px;
  padding: 7px 12px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--muted);
  font-family: var(--font);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  touch-action: manipulation;
  user-select: none;
  transition: background 150ms, border-color 150ms, color 150ms;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.st-chip.is-active {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 14%, var(--surface));
  color: var(--text);
}
.st-chip-count {
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--text) 12%, transparent);
  color: var(--text);
  font-size: 11px;
  line-height: 1;
  font-family: var(--mono, monospace);
}
.st-update-all-trigger {
  flex: 0 0 auto;
  min-height: 44px;
  margin-left: auto;
  padding: 7px 13px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  border: 1px solid var(--accent);
  border-radius: 999px;
  background: var(--accent-hover, var(--accent));
  color: var(--accent-fg);
  font: 650 13px/1 var(--font);
  cursor: pointer;
  touch-action: manipulation;
  transition: filter 150ms, transform 150ms, opacity 150ms;
}
.st-update-all-trigger:disabled { opacity: 0.52; cursor: default; }
.st-resolve-all-trigger {
  margin-left: auto;
  background: transparent;
  color: var(--text);
}
.st-update-all-trigger + .st-resolve-all-trigger { margin-left: 8px; }
.st-resolve-all-trigger .st-update-all-count {
  background: color-mix(in srgb, var(--accent) 18%, transparent);
  color: var(--text);
}
.st-library-health {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 14px;
  margin: 18px 0 26px;
  padding: 16px;
  border: 1px solid color-mix(in srgb, var(--accent) 28%, var(--border));
  border-radius: 16px;
  background: color-mix(in srgb, var(--accent) 7%, var(--surface));
}
.st-library-health.is-healthy {
  border-color: color-mix(in srgb, var(--green) 30%, var(--border));
  background: color-mix(in srgb, var(--green) 6%, var(--surface));
}
.st-library-health-mark {
  width: 40px;
  height: 40px;
  display: grid;
  place-items: center;
  border-radius: 12px;
  color: var(--bg);
  background: var(--accent);
  font-weight: 800;
}
.st-library-health.is-healthy .st-library-health-mark { background: var(--green); }
.st-library-health-copy h2 { margin: 0 0 3px; font-size: 15px; letter-spacing: -0.01em; }
.st-library-health-copy p { margin: 0; color: var(--muted); font-size: 12px; line-height: 1.45; }
.st-community-unavailable {
  display: flex; align-items: center; justify-content: space-between; gap: 14px;
  margin: 16px 0; padding: 13px 15px; border-radius: 14px;
  color: var(--muted); background: var(--surface); border: 1px solid var(--border);
  font-size: 12px;
}
.st-publisher { display: flex; flex-direction: column; gap: 22px; padding-bottom: 36px; }
.st-publisher-intro {
  display: flex; align-items: flex-start; justify-content: space-between; gap: 28px;
  padding: 28px; border-radius: 18px; background: var(--surface); border: 1px solid var(--border);
}
.st-publisher-intro h2 { margin: 0 0 9px; font-size: clamp(24px, 4vw, 38px); letter-spacing: -0.03em; }
.st-publisher-intro p { max-width: 66ch; margin: 0; color: var(--muted); line-height: 1.6; }
.st-publisher-identities { display: grid; justify-items: end; gap: 8px; flex: 0 0 auto; }
.st-publisher-identity {
  display: inline-flex; align-items: center; gap: 8px; flex: 0 0 auto;
  padding: 9px 12px; border-radius: 999px; color: var(--muted);
  background: var(--bg); border: 1px solid var(--border); font-size: 12px; font-weight: 650;
}
.st-publisher-identity-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--muted); }
.st-publisher-identity.is-linked .st-publisher-identity-dot { background: var(--green); }
.st-publisher-contributions { flex: 0 0 auto; }
.st-publish-result {
  display: grid; gap: 4px; padding: 16px; border-radius: 14px;
  color: var(--text); background: color-mix(in srgb, var(--green) 8%, var(--surface));
  border: 1px solid color-mix(in srgb, var(--green) 32%, var(--border));
}
.st-publish-result span { color: var(--muted); font-size: 12px; }
.st-publish-result a {
  width: fit-content; min-height: 44px; display: inline-flex; align-items: center;
  margin-top: 5px; color: var(--text); font-size: 12px; font-weight: 700;
}
.st-publish-review {
  display: grid; gap: 16px; padding: 20px; border-radius: 16px;
  background: var(--surface); border: 1px solid color-mix(in srgb, var(--accent) 35%, var(--border));
}
.st-publish-review h3 { margin: 0 0 6px; font-size: 17px; }
.st-publish-review p { max-width: 70ch; margin: 0; color: var(--muted); font-size: 12px; line-height: 1.55; }
.st-publish-consent { display: flex; align-items: flex-start; gap: 10px; font-size: 12px; line-height: 1.45; cursor: pointer; }
.st-publish-consent input { width: 18px; height: 18px; margin: 0; accent-color: var(--accent); }
.st-publish-review-actions { display: flex; justify-content: flex-end; gap: 9px; }
.st-publisher-github-setup {
  display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 18px;
  margin: 0; padding: 16px 18px; border-radius: 14px;
}
.st-publisher-github-setup strong,
.st-publisher-github-setup span { display: block; }
.st-publisher-github-setup strong { margin-bottom: 4px; font-size: 13px; }
.st-publisher-github-setup span { color: var(--muted); font-size: 12px; line-height: 1.5; }
.st-publisher-github-setup .st-btn { text-decoration: none; white-space: nowrap; }
.st-publish-advanced {
  margin: 0 0 18px; border: 1px solid var(--border); border-radius: 14px;
  background: color-mix(in srgb, var(--surface) 78%, transparent); overflow: hidden;
}
.st-publish-advanced > summary {
  display: flex; align-items: center; justify-content: space-between; gap: 16px;
  min-height: 54px; padding: 12px 16px; cursor: pointer; list-style: none;
}
.st-publish-advanced > summary::-webkit-details-marker { display: none; }
.st-publish-advanced > summary span { color: var(--text); font-size: 13px; font-weight: 750; }
.st-publish-advanced > summary small { color: var(--muted); font-size: 11px; }
.st-publish-advanced[open] > summary { border-bottom: 1px solid var(--border); }
.st-publish-advanced .st-publish-review { margin: 0; border: 0; border-radius: 0; }
.st-community-provenance {
  display: flex; align-items: center; justify-content: space-between; gap: 18px;
  margin: 18px 0; padding: 14px 16px; border-radius: 14px;
  background: var(--surface); border: 1px solid var(--border);
}
.st-community-provenance strong, .st-community-provenance span { display: block; }
.st-community-provenance strong { margin-bottom: 3px; font-size: 13px; }
.st-community-provenance span { color: var(--muted); font-size: 11px; }
.st-community-provenance a {
  min-height: 44px; display: inline-flex; align-items: center;
  color: var(--text); font-size: 12px; font-weight: 700; white-space: nowrap;
}
.st-community-actions { display: flex; align-items: center; gap: 10px; }
.st-community-actions .st-btn { min-height: 44px; padding: 7px 13px; }
.st-community-withdraw { margin-top: 12px; }
.st-community-withdraw-btn {
  min-height: 40px; padding: 7px 13px; border-radius: 9px; cursor: pointer;
  background: transparent; color: var(--danger, #d05a5a);
  border: 1px solid color-mix(in srgb, var(--danger, #d05a5a) 45%, var(--border));
  font: inherit; font-size: 12px; font-weight: 600;
}
.st-community-withdraw-btn:hover:not(:disabled) { background: color-mix(in srgb, var(--danger, #d05a5a) 12%, transparent); }
.st-community-withdraw-btn:disabled { opacity: 0.55; cursor: default; }
.st-community-withdraw-confirm {
  display: flex; flex-direction: column; gap: 10px; padding: 12px 14px;
  border: 1px solid color-mix(in srgb, var(--danger, #d05a5a) 40%, var(--border));
  border-radius: 11px; background: color-mix(in srgb, var(--danger, #d05a5a) 7%, transparent);
}
.st-community-withdraw-confirm > span { font-size: 12px; color: var(--muted); line-height: 1.45; }
.st-community-withdraw-actions { display: flex; gap: 10px; }
.st-community-withdraw-actions button {
  min-height: 40px; padding: 7px 15px; border-radius: 9px; cursor: pointer;
  font: inherit; font-size: 12px; font-weight: 600;
  border: 1px solid var(--border); background: var(--surface, transparent); color: var(--text);
}
.st-community-withdraw-confirm-btn {
  background: var(--danger, #d05a5a) !important; color: #fff !important;
  border-color: var(--danger, #d05a5a) !important;
}
.st-community-withdraw-actions button:disabled { opacity: 0.55; cursor: default; }
.st-community-withdraw-error { font-size: 12px; color: var(--danger, #d05a5a); }
.st-community-feedback { margin: 28px 0 8px; padding-top: 24px; border-top: 1px solid var(--border); }
.st-community-feedback-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; }
.st-community-feedback h3 { margin: 0 0 5px; font-size: 18px; letter-spacing: -.02em; }
.st-community-feedback-head p { max-width: 64ch; margin: 0; color: var(--muted); font-size: 12px; line-height: 1.5; }
.st-rating-summary { flex-shrink: 0; text-align: right; font-variant-numeric: tabular-nums; }
.st-rating-summary strong { display: block; font-size: 22px; line-height: 1; }
.st-rating-summary span { color: var(--muted); font-size: 10px; }
.st-rating-picker { display: flex; align-items: center; gap: 3px; margin: 16px 0 18px; }
.st-rating-picker button {
  width: 44px; height: 44px; padding: 9px; border: 0; border-radius: 10px;
  color: var(--text); background: transparent; cursor: pointer;
}
@media (hover: hover) { .st-rating-picker button:not(:disabled):hover { background: var(--surface-2, var(--surface)); } }
.st-rating-picker button:disabled { opacity: .45; cursor: default; }
.st-rating-picker button svg { width: 100%; height: 100%; }
.st-rating-picker > span { margin-left: 7px; color: var(--muted); font-size: 11px; }
.st-review-eligibility { margin-top: 14px; color: var(--muted); font-size: 12px; line-height: 1.45; }
.st-review-gate { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px 12px; }
.st-review-form { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 9px; }
.st-review-form label { grid-column: 1 / -1; font-size: 12px; font-weight: 700; }
.st-review-form textarea {
  min-height: 88px; resize: vertical; padding: 12px 13px; border: 1px solid var(--border);
  border-radius: 13px; color: var(--text); background: var(--surface); font: inherit; line-height: 1.45;
}
.st-review-form .st-btn { align-self: end; }
.st-community-feedback-error { margin-top: 9px; color: var(--danger); font-size: 12px; }
.st-review-list { margin-top: 18px; border-top: 1px solid var(--border); }
.st-review-list article { padding: 14px 0; border-bottom: 1px solid var(--border); }
.st-review-list article strong { font-size: 12px; }
.st-review-list article p { margin: 5px 0 0; color: var(--muted); font-size: 12px; line-height: 1.55; }
.st-review-empty { margin: 4px 0 0; color: var(--muted); font-size: 12px; }
.st-publish-field { display: grid; gap: 7px; color: var(--muted); font-size: 12px; font-weight: 700; }
.st-publish-field input {
  width: 100%; min-height: 44px; padding: 10px 12px; border-radius: 12px;
  color: var(--text); background: var(--bg); border: 1px solid var(--border); font: inherit;
}
.st-publisher-repository-name {
  display: flex; align-items: center; min-height: 46px; overflow: hidden;
  border: 1px solid var(--border); border-radius: 12px; background: var(--bg);
}
.st-publisher-repository-name > span {
  flex: none; padding: 0 0 0 12px; color: var(--muted); font-weight: 650;
}
.st-publisher-repository-name input {
  min-width: 0; border: 0; border-radius: 0; background: transparent;
}
.st-publisher-repository-name:focus-within {
  border-color: color-mix(in srgb, var(--accent) 65%, var(--border));
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 18%, transparent);
}
.st-publisher-repository-name input:focus { outline: 0; }
.st-publish-repository-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.45fr); gap: 12px; }
.st-publish-source-note { color: var(--muted); font-size: 12px; margin-right: auto; }
@media (max-width: 680px) {
  .st-publish-repository-grid { grid-template-columns: 1fr; }
}
@media (max-width: 620px) {
  .st-community-unavailable, .st-publisher-intro, .st-community-provenance { align-items: stretch; flex-direction: column; }
  .st-community-feedback-head { align-items: stretch; flex-direction: column; }
  .st-rating-summary { text-align: left; }
  .st-review-form { grid-template-columns: 1fr; }
  .st-review-form .st-btn { width: 100%; }
  .st-review-gate .st-btn { width: 100%; }
  .st-publisher-intro { padding: 20px; }
  .st-publisher-identities { justify-items: start; }
  .st-publisher-identity { align-self: flex-start; }
  .st-publisher-github-setup { grid-template-columns: 1fr; }
}
.st-update-all-count {
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: color-mix(in srgb, var(--accent-fg) 18%, transparent);
  font: 650 11px/1 var(--mono, monospace);
}
@media (hover: hover) {
  .st-update-all-trigger:not(:disabled):hover { filter: brightness(0.94); }
}
@media (prefers-reduced-motion: no-preference) {
  .st-update-all-trigger:not(:disabled):active { transform: scale(0.97); }
}
@media (hover: hover) {
  .st-chip:hover { text-decoration: underline; text-underline-offset: 4px; }
}
.st-notice {
  margin: 0 0 14px;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--surface-2, var(--surface));
  color: var(--muted);
  font-size: 13px;
  line-height: 1.4;
}
.st-notice.is-warning {
  border-color: color-mix(in srgb, var(--accent) 45%, var(--border));
  color: var(--text);
}
.st-notice-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.st-notice-row > span { min-width: 0; }
.st-notice-action {
  flex: 0 0 auto;
}

@media (max-width: 720px) {
  .st-category-strip {
    flex-wrap: nowrap;
    overflow-x: auto;
    margin-right: -16px;
    padding-right: 16px;
    scrollbar-width: none;
    -ms-overflow-style: none;
  }
}

@media (max-width: 520px) {
  .st-category-strip {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    overflow: visible;
    margin-right: 0;
    padding-right: 0;
  }
  .st-chip { width: 100%; justify-content: center; }
  .st-update-all-trigger {
    grid-column: 1 / -1;
    width: 100%;
    margin-left: 0;
    border-radius: 12px;
  }
}

/* Curated collections keep very different kinds of apps discoverable without
   turning each category into a separate catalog. Search and lifecycle filters
   preserve the same shelves and simply hide empty ones. */
.st-catalog-sections {
  display: flex;
  flex-direction: column;
  gap: 22px;
}
.st-catalog-more {
  display: flex;
  justify-content: center;
  padding: 8px 0 20px;
}
.st-catalog-section { min-width: 0; }
.st-catalog-section-head { margin: 0 0 8px; }
.st-catalog-section-title {
  margin: 0;
  color: var(--text);
  font-size: 17px;
  font-weight: 720;
  line-height: 1.3;
  letter-spacing: -0.01em;
}
.st-catalog-section-desc {
  margin: 4px 0 0;
  max-width: 66ch;
  color: var(--muted);
  font-size: 13px;
  line-height: 1.45;
}

/* App-specific catalog grid + tiles. Browse cards keep visual proof in the
   detail description and spend their footprint on identity, value, and the
   current action. State rides is-* modifier classes. */
.st-catalog-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(168px, 1fr));
  gap: 10px;
}
/* The card is a non-interactive container (not role=button). The open
   affordance is a real <button class="st-card-open"> whose ::after overlay
   stretches across the whole card, so hover/focus on it lifts the card and
   a click anywhere outside the action button opens details. The action
   button rides z-index:1 above that overlay. */
.st-card {
  position: relative;
  display: flex; flex-direction: column;
  align-items: center; text-align: center;
  padding: 12px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  transition: border-color 150ms, transform 150ms, box-shadow 150ms, background 150ms;
  min-height: 44px;
  touch-action: manipulation; user-select: none;
}
.st-card.is-update {
  background: color-mix(in srgb, var(--accent) 10%, var(--surface));
  border-color: var(--accent);
}
.st-card.is-conflict {
  background: color-mix(in srgb, var(--danger, #e5484d) 8%, var(--surface));
  border-color: color-mix(in srgb, var(--danger, #e5484d) 70%, var(--border));
}
.st-card.is-unavailable {
  background: color-mix(in srgb, var(--text) 4%, var(--surface));
  border-color: color-mix(in srgb, var(--text) 22%, var(--border));
}
.st-card.is-installed {
  background: color-mix(in srgb, var(--text) 5%, var(--surface));
  border: 1px solid color-mix(in srgb, var(--text) 22%, var(--border));
}
.st-card.is-error {
  border: 1px dashed var(--border);
}
.st-card.is-catalog {
  display: grid;
  grid-template-columns: 52px minmax(0, 1fr);
  grid-template-rows: auto auto auto auto;
  align-items: center;
  column-gap: 10px;
  row-gap: 2px;
  text-align: left;
}
.st-card.is-loading-card { align-items: center; text-align: center; }
.st-card.is-catalog .st-icon-slot {
  grid-column: 1;
  grid-row: 1 / span 2;
  align-self: start;
  margin: 0;
}
.st-card.is-catalog .st-icon-wrap { width: 52px; height: 52px; border-radius: 13px; }
.st-card.is-catalog .st-icon-letter { font-size: 24px; }
.st-card.is-catalog .st-card-open {
  grid-column: 2;
  grid-row: 1;
  align-self: end;
  min-height: 0;
  margin: 0;
  text-align: left;
}
.st-card.is-catalog .st-card-state-row {
  grid-column: 2;
  grid-row: 2;
  min-height: 18px;
  margin: 0;
  justify-content: flex-start;
}
.st-card.is-catalog .st-card-desc {
  grid-column: 1 / -1;
  grid-row: 3;
  display: -webkit-box;
  min-height: 32px;
  margin: 8px 0 0;
  overflow: hidden;
  text-align: left;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}
.st-card.is-catalog .st-card-status-row {
  grid-column: 1 / -1;
  grid-row: 4;
  margin-top: 8px;
  align-items: flex-end;
}
.st-card.is-catalog .st-card-inline-error { grid-column: 1 / -1; }
/* The app name is the card's open affordance. Its ::after overlay covers
   the whole card so the icon / name / description all open details. */
.st-card-open {
  position: static;
  border: 0; background: transparent; padding: 0; margin: 0 0 4px;
  font-family: var(--font); color: var(--text);
  font-size: 14px; font-weight: 600; line-height: 1.25;
  cursor: pointer;
  min-height: 44px;
  align-items: flex-start;
  display: -webkit-box; -webkit-line-clamp: 2;
  -webkit-box-orient: vertical; overflow: hidden;
  touch-action: manipulation; user-select: none;
}
.st-sr-only {
  position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0;
}
.st-card-open::after {
  content: ""; position: absolute; inset: 0; border-radius: inherit;
}
.st-card-open:focus-visible { outline: none; }
.st-card-open:focus-visible::after {
  outline: 2px solid var(--accent); outline-offset: 2px;
}
/* Interaction lift — gated on hover:hover so touch devices don't get stuck hover states. */
@media (hover: hover) {
  .st-card:has(.st-card-open:hover) {
    transform: translateY(-1px);
    box-shadow: 0 4px 8px color-mix(in srgb, var(--accent) 14%, transparent);
    border-color: var(--accent);
  }
}
.st-card:has(.st-card-open:focus-visible) {
  transform: translateY(-1px);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 40%, transparent);
  border-color: var(--accent);
}
@media (prefers-reduced-motion: no-preference) {
  .st-card:has(.st-card-open:active) { transform: scale(0.98); opacity: 0.9; }
}
/* Icons float on the card with no tile or border — clean transparent
   presentation. Almost every catalog repo ships a transparent glossy-3D PNG
   (memory, reflection, news, atlas, notes, latex, …); the lone holdout still
   shipping an opaque baked-in square is cuberun (pending an imagegen regen).
   The slot only keeps overflow:hidden + the radius so that one opaque square
   gets its corners clipped to match. The letter fallback (no icon / load
   error) keeps a surface tile so an iconless app still reads as finished. */
.st-icon-wrap {
  width: 96px; height: 96px; border-radius: 22px;
  background: transparent;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0; overflow: hidden;
}
/* A relative anchor around the IconBox so the "installed" check dot can
   sit at the icon's bottom-right corner without leaking out of
   .st-icon-wrap's overflow: hidden. Spacing-below lives on this slot. */
.st-icon-slot { position: relative; margin-bottom: 12px; display: inline-block; }
.st-icon-img { width: 100%; height: 100%; object-fit: contain; }
/* Known remote icon still resolving. Never use the letter as a loading state:
   it creates a visible false identity immediately before the real icon. */
.st-icon-loading {
  background: color-mix(in srgb, var(--surface-2) 78%, transparent);
  border: 1px solid color-mix(in srgb, var(--border) 72%, transparent);
}
/* Letter fallback (no icon / load error) gets a surface tile + border so the
   initial reads as a recognisable icon slot — real icons float transparent,
   but an iconless app still looks finished. */
.st-icon-wrap--letter {
  background: var(--surface-2);
  border: 1px solid var(--border);
}
.st-icon-letter { font-size: 36px; font-weight: 700; color: var(--text); }
/* A tiny check dot sits at the icon's bottom-right when the app is
   already installed. Quicker to read than the pill text, lets the grid
   double as an "at a glance" inventory. */
.st-installed-dot {
  position: absolute;
  bottom: -2px; right: -2px;
  width: 22px; height: 22px; border-radius: 999px;
  background: var(--surface);
  border: 2px solid var(--surface);
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.18);
}
.st-installed-dot-inner {
  width: 18px; height: 18px; border-radius: 999px;
  background: color-mix(in srgb, var(--accent) 80%, var(--surface));
  color: var(--accent-fg);
  display: flex; align-items: center; justify-content: center;
  font-size: 12px; font-weight: 700; line-height: 1;
}
.st-installed-dot-inner.is-update { background: var(--accent); }
.st-card-name {
  font-size: 14px; font-weight: 600; line-height: 1.25;
  margin-bottom: 4px;
  display: -webkit-box; -webkit-line-clamp: 2;
  -webkit-box-orient: vertical; overflow: hidden;
}
.st-card-state-row {
  width: 100%;
  min-height: 20px;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}
.st-card-state-line {
  max-width: 100%;
  color: var(--muted);
  font-size: 12px;
  font-weight: 650;
  line-height: 1.35;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.st-card-state-line.is-update { color: var(--text); }
.st-card-state-line.is-conflict { color: var(--danger, #e5484d); }
.st-card-state-line.is-unavailable { color: var(--muted); }
.st-card-state-line.is-rejected { color: var(--orange, #e8b45a); }
.st-card-state-detail {
  flex-basis: 100%; max-width: 100%; color: var(--muted);
  font-size: 12px; line-height: 1.4; overflow-wrap: anywhere;
}
.st-card-state-row:has(.st-card-state-detail) { flex-wrap: wrap; row-gap: 2px; }
.st-card-agent {
  flex: 0 0 auto;
  font-family: var(--font, inherit); font-weight: 600;
  font-size: 12px; letter-spacing: 0;
  color: var(--text);
  background: color-mix(in srgb, var(--accent) 16%, transparent);
  border: 1px solid color-mix(in srgb, var(--accent) 34%, transparent);
  border-radius: 999px; padding: 1px 7px;
}
.st-card-source-update {
  display: inline-flex; align-items: center; min-height: 22px; padding: 0 8px;
  border: 1px solid color-mix(in srgb, var(--accent) 42%, var(--border));
  border-radius: 999px; color: var(--text); background: var(--accent-dim);
  font-size: 10px; font-weight: 800; letter-spacing: .01em; white-space: nowrap;
}
.st-repository-update {
  display: flex; align-items: center; justify-content: space-between; gap: 16px;
  margin-top: 12px; padding: 14px 16px; border: 1px solid color-mix(in srgb, var(--accent) 44%, var(--border));
  border-radius: 14px; background: var(--accent-dim);
}
.st-repository-update strong, .st-repository-update span { display: block; }
.st-repository-update strong { color: var(--text); font-size: 13px; margin-bottom: 4px; }
.st-repository-update div > span { color: var(--muted); font-size: 12px; line-height: 1.45; }
.st-repository-update-sha { color: var(--text); font-family: var(--mono); font-size: 11px; font-weight: 800; }
@media (max-width: 680px) { .st-repository-update { align-items: flex-start; flex-direction: column; } }
.st-source-status {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 13px 14px;
  border: 1px solid var(--border);
  border-radius: 13px;
  background: var(--surface-2);
}
.st-source-status > div { display: flex; flex-direction: column; gap: 4px; }
.st-source-status strong { font-size: 12px; }
.st-source-status span { color: var(--muted); font-size: 11px; line-height: 1.45; }
.st-source-status.is-preserved { border-color: color-mix(in srgb, var(--green) 36%, var(--border)); }
.st-source-status.is-preserved strong { color: var(--green); }
.st-card-desc {
  font-size: 12px; color: var(--muted); line-height: 1.35;
  margin-bottom: 12px;
  text-align: center;
  min-height: 49px;
}
/* The single icon action stays visually quiet while preserving a full 44px
   touch target. Its accessible label and native tooltip carry the action name. */
.st-card-status-row {
  position: relative;
  z-index: 1;
  width: auto;
  margin-top: auto;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  justify-content: center;
  gap: 8px;
}
.st-card-action {
  width: 44px;
  height: 44px;
  flex-shrink: 0;
  border: 1px solid transparent;
  border-radius: 999px;
  padding: 0;
  background: var(--accent-hover, var(--accent));
  color: var(--accent-fg);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  touch-action: manipulation; user-select: none;
}
/* Install and Update share the accent primary look so the action button
   reads identically across every card; the card-level border + checkmark
   dot (see .st-card.is-update) carry the "update available" signal without
   an off-brand second button colour. Installed = a muted, lower-emphasis
   fill so the primary actions stay the eye-catchers in the grid. */
.st-card-action.is-update { background: var(--accent-hover, var(--accent)); }
.st-card-action.is-conflict {
  background: var(--danger, #e5484d);
  color: var(--accent-fg);
}
.st-card-action.is-unavailable {
  background: color-mix(in srgb, var(--text) 9%, transparent);
  color: var(--text);
  border-color: color-mix(in srgb, var(--text) 18%, var(--border));
}
.st-card-action.is-installed {
  background: color-mix(in srgb, var(--text) 9%, transparent);
  color: var(--text);
  border-color: color-mix(in srgb, var(--text) 18%, var(--border));
}
.st-card-action:disabled { opacity: 0.65; cursor: default; pointer-events: none; }
.st-card-action:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
@media (prefers-reduced-motion: no-preference) {
  .st-card-action:not(:disabled):active { opacity: 0.8; transform: scale(0.97); }
}
.st-card-inline-error {
  position: relative;
  z-index: 2;
  width: 100%;
  margin-top: 8px;
  padding: 8px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--danger, #e5484d) 10%, transparent);
  color: var(--danger);
  font-size: 12px;
  line-height: 1.35;
  border: 1px solid color-mix(in srgb, var(--danger, #e5484d) 30%, transparent);
  box-sizing: border-box;
}
.st-card-inline-error-text {
  user-select: text;
  cursor: text;
}
.st-card-inline-error-action {
  width: 100%;
  min-height: 38px;
  margin-top: 8px;
  padding: 7px 12px;
  user-select: none;
}
/* Skeleton placeholder — same shape as a card so the grid doesn't reflow
   when the real manifests arrive. Per-block width/height stay inline. */
.st-skeleton-card {
  display: flex; flex-direction: column; align-items: stretch;
  padding: 12px;
  background: var(--surface);
  border: 1px solid var(--border); border-radius: 12px;
  min-height: 44px;
  opacity: 0.7;
}
.st-skeleton-block {
  border-radius: 6px;
  background: color-mix(in srgb, var(--text) 8%, transparent);
  animation: mobius-store-pulse 1.4s ease-in-out infinite;
}
@keyframes mobius-store-pulse {
  0%, 100% { opacity: 0.55; }
  50% { opacity: 0.95; }
}
.st-card-error-body {
  font-size: 12px; color: var(--muted); line-height: 1.4;
  margin-top: 4px; margin-bottom: 12px;
  text-align: center;
}
.st-card-retry {
  padding: 6px 12px; border-radius: 8px;
  border: 1px solid var(--border); background: transparent;
  color: var(--text); font-size: 12px; font-weight: 600;
  cursor: pointer; font-family: var(--font);
  min-height: 44px;
  transition: background 150ms;
  touch-action: manipulation; user-select: none;
}
@media (prefers-reduced-motion: no-preference) {
  .st-card-retry:active { opacity: 0.75; }
}

/* App-specific "From URL" tab. */
.st-url-form {
  background: var(--surface); border: 1px solid var(--border);
  border-radius: 12px; padding: 16px;
}
.st-url-label { font-size: 14px; font-weight: 600; margin-bottom: 8px; display: block; }
.st-url-hint { font-size: 12px; color: var(--muted); margin-bottom: 12px; line-height: 1.5; }
.st-url-input {
  width: 100%; padding: 12px;
  background: var(--bg); color: var(--text);
  border: 1px solid var(--border); border-radius: 8px;
  font-size: 13px; font-family: var(--mono, monospace);
  box-sizing: border-box;
  margin-bottom: 12px;
  min-height: 44px;
  transition: border-color 150ms, box-shadow 150ms;
}
/* Focus ring — was JS focused state, now a real :focus pseudo-class.
   Same accent ring the catalog cards use. The shared :focus-visible block
   keeps a keyboard outline; this border+shadow is the always-on focus cue. */
.st-url-input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 30%, transparent);
}
/* Suppress the UA outline only for pointer focus; keyboard focus keeps the
   shared :focus-visible accent ring on top of the border+shadow cue. */
.st-url-input:focus:not(:focus-visible) { outline: none; }
.st-primary-btn {
  padding: 12px 20px; border-radius: 10px; border: none;
  background: var(--accent-hover, var(--accent)); color: var(--accent-fg);
  font-size: 14px; font-weight: 600; cursor: pointer;
  font-family: var(--font);
  min-height: 44px;
  transition: background 150ms;
  touch-action: manipulation; user-select: none;
  width: 100%;
}
.st-primary-btn:disabled { pointer-events: none; opacity: 0.65; }
@media (hover: hover) {
  .st-primary-btn:not(:disabled):hover { filter: brightness(0.94); }
}
@media (prefers-reduced-motion: no-preference) {
  .st-primary-btn:not(:disabled):active { opacity: 0.82; transform: scale(0.98); }
}
/* Live host indicator below the URL input — switches between "trusted
   source" (calm accent badge) and "unfamiliar host" (muted, not red —
   a personal repo is legitimate; inform, don't alarm). State = is-*. */
.st-host-badge {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 4px 10px; border-radius: 999px;
  font-size: 12px; font-weight: 500;
  font-family: var(--font);
  background: color-mix(in srgb, var(--text) 6%, transparent);
  color: var(--muted);
  border: 1px solid var(--border);
  margin-bottom: 12px;
}
.st-host-badge.is-trusted {
  background: color-mix(in srgb, var(--accent) 12%, transparent);
  color: var(--text);
  border-color: var(--accent);
}
.st-host-badge-dot {
  width: 6px; height: 6px; border-radius: 999px;
  background: color-mix(in srgb, var(--muted) 60%, transparent);
  flex-shrink: 0;
}
.st-host-badge.is-trusted .st-host-badge-dot { background: var(--accent); }
.st-host-badge-host { font-family: var(--mono, monospace); font-size: 12px; }
.st-error-box {
  background: color-mix(in srgb, var(--danger, #e5484d) 12%, transparent);
  color: var(--danger); padding: 12px;
  border-radius: 8px; font-size: 14px;
  margin-top: 12px; line-height: 1.5;
  border: 1px solid color-mix(in srgb, var(--danger, #e5484d) 40%, transparent);
}

/* App-specific detail view. */
.st-detail-header {
  padding: 12px 16px; display: flex; align-items: center;
  gap: 8px; border-bottom: 1px solid var(--border);
  flex-shrink: 0; width: min(100%, 1180px); margin-inline: auto; box-sizing: border-box;
}
.st-back-btn {
  background: none; border: none; color: var(--text);
  font-size: 14px; cursor: pointer; padding: 8px 12px;
  font-family: var(--font); font-weight: 500;
  min-height: 44px;
  display: inline-flex; align-items: center; gap: 4px;
  margin: -8px -8px;  /* compensate so the visible affordance still aligns */
  border-radius: 8px;
  transition: background 150ms;
  touch-action: manipulation; user-select: none;
}
.st-back-btn svg { width: 16px; height: 16px; }
@media (hover: hover) {
  .st-back-btn:hover { background: color-mix(in srgb, var(--accent) 10%, transparent); }
}
@media (prefers-reduced-motion: no-preference) {
  .st-back-btn:active { opacity: 0.75; }
}
.st-hero { display: flex; align-items: center; gap: 16px; margin-bottom: 24px; }
.st-hero-text { flex: 1; min-width: 0; }
/* Detail-view hero icon — clean transparent, same as the grid (see
   .st-icon-wrap); overflow-clip rounds the lone opaque (cuberun) icon. */
.st-hero-icon {
  width: 80px; height: 80px; border-radius: 18px;
  background: transparent;
  display: flex;
  align-items: center; justify-content: center;
  flex-shrink: 0; overflow: hidden;
}
.st-hero-icon.is-letter { background: var(--surface-2); border: 1px solid var(--border); }
.st-hero-icon-letter { font-size: 32px; font-weight: 700; color: var(--text); }
.st-hero-name { font-size: 22px; font-weight: 700; margin: 0 0 4px; letter-spacing: 0; user-select: none; }
.st-hero-meta { font-size: 12px; color: var(--muted); font-family: var(--mono, monospace); user-select: none; }
.st-detail-desc { max-width: 72ch; font-size: 14px; line-height: 1.55; color: var(--text); margin-bottom: 24px; }
.st-detail-preview {
  margin: 22px 0 28px;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: var(--surface);
}
.st-detail-preview img {
  display: block;
  width: 100%;
  max-height: min(58vh, 560px);
  aspect-ratio: 16 / 10;
  object-fit: cover;
  object-position: top center;
}
.st-detail-preview figcaption {
  padding: 10px 13px;
  color: var(--muted);
  border-top: 1px solid var(--border);
  font-size: 11px;
  font-weight: 650;
}
.st-detail-section { margin-bottom: 24px; }
.st-section {
  font-size: 13px; font-weight: 700; color: var(--text);
  letter-spacing: 0; margin: 22px 0 14px;
  user-select: none;
}
.st-scroll > .st-section:first-child { margin-top: 0; }
.st-section-label {
  font-size: 12px; font-weight: 600; color: var(--muted);
  letter-spacing: 0;
  margin-bottom: 8px;
  user-select: none;
}
.st-permission-row {
  display: flex; gap: 12px;
  padding: 12px; background: var(--surface);
  border: 1px solid var(--border); border-radius: 8px;
  margin-bottom: 8px; font-size: 14px; line-height: 1.5;
}
.st-perm-row-main { flex: 1; min-width: 0; }
.st-perm-label { font-weight: 600; color: var(--text); }
.st-perm-detail { color: var(--muted); }
.st-capability-state,
.st-capability-change {
  padding: 12px;
  color: var(--muted);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  font-size: 13px;
  line-height: 1.45;
}
.st-capability-change { margin-bottom: 10px; color: var(--text); }
.st-capability-list { display: grid; gap: 8px; }
.st-perm-hint { color: var(--muted); font-size: 12px; margin-top: 4px; }
.st-capability-diff-row.is-added { border-color: color-mix(in srgb, var(--green) 45%, var(--border)); }
.st-capability-diff-row.is-removed { border-color: color-mix(in srgb, var(--danger) 45%, var(--border)); }
.st-capability-diff-kind {
  display: inline-block; margin-right: 7px; color: var(--muted);
  font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em;
}
.st-capability-diff-values {
  display: flex; flex-wrap: wrap; align-items: baseline; gap: 8px;
  margin-top: 5px; color: var(--text); font-size: 13px; line-height: 1.4;
}
.st-capability-diff-arrow { color: var(--muted); }
.st-capability-diff-before { color: var(--muted); }
.st-capability-full-access {
  margin-top: 8px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface);
}
.st-capability-full-access summary {
  min-height: 44px; padding: 12px; cursor: pointer; color: var(--muted);
  font-size: 13px; font-weight: 650; touch-action: manipulation;
}
.st-capability-full-access[open] summary { border-bottom: 1px solid var(--border); color: var(--text); }
.st-capability-full-access > .st-capability-list { padding: 10px; }

/* Progressive disclosure for the information that matters during review or
   troubleshooting but should not dominate everyday app browsing. Permission
   changes open this section automatically; stable access stays collapsed. */
.st-technical-details {
  margin: 8px 0 4px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface);
  overflow: hidden;
}
.st-technical-details.is-attention {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 6%, var(--surface));
}
.st-technical-summary {
  min-height: 58px;
  padding: 12px 14px;
  cursor: pointer;
  touch-action: manipulation;
  user-select: none;
}
.st-technical-summary-main {
  color: var(--text);
  font-size: 14px;
  font-weight: 650;
}
.st-technical-summary-meta {
  display: block;
  margin-top: 3px;
  color: var(--muted);
  font-family: var(--mono, monospace);
  font-size: 11px;
  line-height: 1.35;
}
.st-technical-details.is-attention .st-technical-summary-meta { color: var(--text); }
.st-technical-body {
  padding: 14px;
  border-top: 1px solid var(--border);
}
.st-technical-section + .st-technical-section { margin-top: 20px; }
/* A short capability tag next to each permission row. State (read / write /
   muted) rides is-* modifiers; 'no'/'none' both render muted. */
.st-perm-tag {
  flex-shrink: 0;
  padding: 2px 8px; border-radius: 999px;
  font-size: 12px; font-weight: 600;
  font-family: var(--font); letter-spacing: 0;
  background: color-mix(in srgb, var(--accent) 22%, transparent);
  color: var(--text);
  border: 1px solid var(--accent);
  align-self: flex-start;
}
/* The platform marks the few rows that can change Möbius itself with one dot. */
.st-perm-critical {
  flex-shrink: 0; align-self: flex-start; margin-top: 6px;
  width: 8px; height: 8px; border-radius: 50%; background: #f87171;
}
.st-perm-tag.is-read { background: color-mix(in srgb, var(--accent) 14%, transparent); }
.st-perm-tag.is-muted {
  background: color-mix(in srgb, var(--muted) 14%, transparent);
  color: var(--muted);
  border-color: var(--border);
}
.st-schedule-row {
  padding: 12px; background: var(--surface);
  border: 1px solid var(--border); border-radius: 8px;
  font-size: 14px; line-height: 1.5;
}
.st-schedule-main { font-weight: 600; color: var(--text); }
.st-schedule-note { color: var(--muted); margin-top: 4px; font-size: 12px; }
.st-setup-card {
  padding: 12px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  font-size: 14px;
  line-height: 1.5;
}
.st-setup-main { font-weight: 650; color: var(--text); }
.st-setup-note { color: var(--muted); margin-top: 4px; }
.st-setup-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-top: 10px;
}
.st-setup-meta {
  display: inline-flex;
  padding: 3px 8px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--accent) 13%, transparent);
  color: var(--text);
  font-size: 12px;
  font-weight: 650;
}
.st-setup-action {
  min-width: 0;
  white-space: nowrap;
  padding-inline: 12px;
}
@media (max-width: 520px) {
  .st-setup-bottom {
    align-items: flex-start;
    flex-direction: column;
  }
}
/* External-libs disclosure — a quiet note on a muted surface, dep list
   mono-formatted (not an alarming panel). */
.st-esm-note {
  padding: 12px; background: var(--surface);
  border: 1px solid var(--border); border-radius: 8px;
  font-size: 14px; line-height: 1.5;
  color: var(--muted);
}
.st-esm-dep-list {
  font-family: var(--mono, monospace);
  font-size: 12px;
  color: var(--text);
  margin-top: 6px;
  word-break: break-all;
}
.st-host-warn {
  display: flex; gap: 12px; align-items: flex-start;
  padding: 12px; margin-bottom: 12px;
  background: var(--accent-dim, rgba(139, 108, 247, 0.15));
  border: 1px solid var(--accent); border-radius: 8px;
  font-size: 14px; line-height: 1.5;
}
.st-host-warn-icon { font-size: 16px; line-height: 1.2; color: var(--text); flex-shrink: 0; }
.st-host-warn-host { font-weight: 600; color: var(--text); font-family: var(--mono, monospace); }
.st-host-warn-body { color: var(--muted); margin-top: 2px; }
.st-link { color: var(--text); text-decoration: none; }
.st-installed-note { font-size: 14px; color: var(--muted); user-select: none; }
.st-detail-footer {
  padding: 16px; border-top: 1px solid var(--border);
  display: flex; flex-direction: column; gap: 10px;
  flex-shrink: 0; background: var(--bg);
}
/* Footer CTAs: full-width canonical buttons. The shared .st-btn min-height
   (44px) keeps the primary's height fixed across every label/busy state, so
   "Open App" -> "Updating…" never shifts the row; the secondary "Uninstall"
   sits below as a real, muted button (not an underlined text link) so both
   actions read as one consistent control family. */
.st-detail-cta { width: 100%; font-size: 15px; }
/* The "you uninstalled this app" note sits with the primary action; on a wide window it fills the space to its left. */
.st-detail-note { flex: 1; min-width: 0; display: grid; gap: 2px; font-size: 13px; line-height: 1.4; }
.st-detail-note strong { color: var(--text); font-weight: 650; }
.st-detail-note span { color: var(--muted); }
/* Full-width solid accent button for the update-notice "Review in chat" /
   "Resolve in chat" action. (The detail-footer CTA and modal confirm both
   use the canonical st-btn now; this stays for the in-flow update notice.) */
.st-big-btn {
  width: 100%; padding: 12px 16px; border-radius: 10px;
  border: none; background: var(--accent-hover, var(--accent)); color: var(--accent-fg);
  font-size: 14px; font-weight: 600; cursor: pointer;
  font-family: var(--font);
  min-height: 44px;
  transition: background 150ms, transform 150ms;
  touch-action: manipulation; user-select: none;
}
.st-big-btn:disabled { cursor: default; pointer-events: none; opacity: 0.65; }
@media (prefers-reduced-motion: no-preference) {
  .st-big-btn:not(:disabled):active { opacity: 0.82; transform: scale(0.98); }
}
.st-danger-btn {
  padding: 12px 16px; border-radius: 10px;
  border: 1px solid var(--border); background: transparent;
  color: var(--danger); font-size: 14px; font-weight: 600;
  cursor: pointer; font-family: var(--font);
  min-height: 44px;
  touch-action: manipulation; user-select: none;
}
@media (hover: hover) {
  .st-danger-btn:hover { background: color-mix(in srgb, var(--danger) 8%, transparent); }
}
@media (prefers-reduced-motion: no-preference) {
  .st-danger-btn:not(:disabled):active { opacity: 0.8; }
}
.st-danger-btn:disabled { pointer-events: none; opacity: 0.65; }
/* Self-update banner — the store checks for its own newer published
   version and offers a one-tap update + reload. App-specific. */
.st-banner {
  display: flex; align-items: center; gap: 12px;
  margin: 0 0 16px; padding: 12px 16px;
  background: color-mix(in srgb, var(--accent) 12%, var(--surface));
  border: 1px solid var(--accent); border-radius: 12px;
  font-size: 14px; line-height: 1.4;
}
.st-banner-msg { flex: 1; }
.st-banner-content { flex: 1; min-width: 0; }
.st-banner.is-reviewing { align-items: flex-start; }
.st-banner.is-reviewing .st-banner-msg { margin-bottom: 10px; }
.st-banner.is-reviewing .st-capability-list { gap: 6px; }
.st-banner.is-reviewing .st-permission-row { background: var(--bg); }
.st-banner-btn {
  flex-shrink: 0; border: none; border-radius: 8px; padding: 8px 16px;
  background: var(--accent-hover, var(--accent)); color: var(--accent-fg); font-weight: 600;
  font-size: 13px; cursor: pointer; font-family: var(--font);
  min-height: 44px;
  touch-action: manipulation; user-select: none;
}
.st-banner.is-conflict .st-banner-btn:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
@media (max-width: 520px) {
  .st-banner.is-conflict { flex-direction: column; align-items: stretch; }
  .st-banner.is-conflict .st-banner-btn { width: 100%; }
}
@media (prefers-reduced-motion: no-preference) {
  .st-banner-btn:not(:disabled):active { opacity: 0.8; transform: scale(0.97); }
}

/* mobius-ui:Empty v1 — keep in sync; library candidate. Diverge below the marker only. */
.st-empty {
  display: flex; flex-direction: column; align-items: center; text-align: center; gap: 8px;
  max-width: 440px; margin: 0 auto; padding: 48px 24px; color: var(--muted);
}
.st-empty-title { font-size: 17px; font-weight: 700; color: var(--text); letter-spacing: 0; }
.st-empty-text { margin: 0; font-size: 14px; line-height: 1.6; }
/* /mobius-ui:Empty */

/* Read-only app-update review. Mirrors the platform updater's hierarchy: a
   compact file summary first, full unified diff on demand, explicit apply. */
.st-update-review-scrim {
  position: absolute; inset: 0; z-index: 150;
  display: flex; align-items: center; justify-content: center;
  padding: 16px;
  background: rgba(0, 0, 0, 0.5);
  overscroll-behavior: contain;
}
.st-update-review {
  width: min(640px, 100%);
  height: min(720px, calc(100% - 16px));
  min-height: 0;
  display: grid; grid-template-rows: auto minmax(0, 1fr) auto; gap: 14px;
  padding: 18px;
  border: 1px solid var(--border); border-radius: 16px;
  background: var(--surface); color: var(--text);
  overflow: hidden;
}
.st-update-review-head {
  display: flex; align-items: flex-start; justify-content: space-between; gap: 12px;
}
.st-update-review-title {
  margin: 0; font-size: 18px; line-height: 1.3; font-weight: 700; letter-spacing: 0;
}
.st-update-review-subtitle {
  margin: 3px 0 0; font-size: 13px; line-height: 1.45; color: var(--muted);
}
.st-update-review-close {
  flex: 0 0 auto; width: 44px; height: 44px; margin: -4px -4px 0 0;
  display: grid; place-items: center;
  border: 0; border-radius: 8px; background: transparent; color: var(--muted);
  font: 400 22px/1 var(--font); cursor: pointer;
}
.st-update-review-close svg { width: 18px; height: 18px; }
.st-update-review-close:disabled { opacity: 0.5; cursor: default; }
@media (hover: hover) {
  .st-update-review-close:not(:disabled):hover { background: var(--surface-2); color: var(--text); }
}
.st-update-review-body {
  min-height: 0; overflow-y: auto; overflow-x: hidden;
  display: flex; flex-direction: column; gap: 18px;
  padding-right: 2px; overscroll-behavior: contain;
  scrollbar-width: none;
}
.st-update-review-body::-webkit-scrollbar { display: none; }
.st-update-review-section { display: flex; flex-direction: column; gap: 14px; padding: 18px; border: 1px solid var(--border); border-radius: 14px; }
.st-update-review-section-head { flex-wrap: wrap; }
.st-update-review-section-head h3 { color: var(--text); font-size: 16px; }
.st-update-version { display: block; color: var(--muted); font-size: 12px; margin-top: 4px; }
.st-update-status { padding: 6px 10px; border-radius: 999px; font-size: 12px; font-weight: 600; background: var(--surface-2); }
.st-update-status.is-success { color: var(--green); }
.st-update-status.is-attention { color: var(--orange, #e8b45a); }
.st-update-status.is-error { color: var(--danger); }
.st-update-change-summary h4 { margin: 0 0 7px; font-size: 14px; }
.st-update-change-summary p { margin: 0; font-size: 13px; line-height: 1.6; }
.st-update-change-summary .st-update-summary-note { color: var(--muted); margin-top: 7px; }
.st-update-technical { border-top: 1px solid var(--border); padding-top: 4px; }
.st-update-technical > summary { min-height: 44px; padding: 12px 0; cursor: pointer; font-size: 13px; }
.st-update-technical > summary span { margin-left: 8px; color: var(--muted); }
.st-update-technical > summary:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.st-update-review-notice p { margin: 0 0 12px; }
.st-update-review-notice.is-success { color: var(--text); border-color: color-mix(in srgb, var(--green) 40%, var(--border)); }
.st-update-review-section > h3 {
  margin: 0; font-size: 12px; line-height: 1.4; font-weight: 650; color: var(--muted);
}
.st-update-review-section-head {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
}
.st-update-review-total {
  display: inline-flex; align-items: baseline; gap: 8px;
  font: 600 12px/1.3 var(--mono, monospace);
}
.st-update-review-total .is-add { color: var(--green); }
.st-update-review-total .is-del { color: var(--danger); }
.st-update-review-notice {
  padding: 12px; border: 1px solid var(--border); border-radius: 10px;
  background: var(--surface-2); color: var(--muted);
  font-size: 13px; line-height: 1.5;
}
.st-update-review-notice.is-error {
  border-color: color-mix(in srgb, var(--danger) 45%, var(--border));
}
.st-update-review-error-text,
.st-selectable-error {
  user-select: text;
  cursor: text;
}
.st-update-review-error-text { margin-bottom: 6px; color: var(--danger); }
.st-update-review-notice .st-btn + .st-btn { margin-left: 8px; }
.st-update-review-warnings { margin: 0; padding-left: 18px; color: var(--muted); font-size: 13px; line-height: 1.5; }
.st-banner-access-review { margin-top: 10px; }
.st-banner-access-note {
  max-width: 65ch;
  margin: 0 0 10px;
  color: var(--muted);
  font-size: 13px;
  line-height: 1.5;
}
.st-update-review-actions {
  display: flex; align-items: center; justify-content: flex-end; gap: 8px;
  padding-top: 14px; border-top: 1px solid var(--border);
}
.st-update-review-actions .st-btn:first-child { margin-right: auto; }

@media (max-width: 520px) {
  .st-update-review-scrim { align-items: stretch; padding: 8px; }
  .st-update-review { height: calc(100% - 16px); padding: 16px; border-radius: 12px; }
  .st-update-review-actions { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .st-update-review-actions .st-btn { width: 100%; margin: 0; }
  .st-update-review-actions .st-btn-primary { grid-column: 1 / -1; order: -2; }
  .st-update-review-actions .st-btn-secondary { order: -1; }
}

@media (max-width: 360px) {
  .st-update-review-actions { grid-template-columns: 1fr; }
  .st-update-review-actions .st-btn-primary { grid-column: auto; }
}

/* mobius-ui:Sheet v1 — keep in sync; library candidate. Diverge below the marker only. */
.st-scrim {
  position: absolute; inset: 0; z-index: 100;   /* absolute → stays inside the app, never over shell chrome */
  display: flex; align-items: flex-end; justify-content: center;
  padding: 16px; background: rgba(0, 0, 0, 0.5);
}
.st-sheet {
  width: 100%; max-width: 480px; max-height: 85vh; overflow-y: auto;
  padding: 24px; background: var(--surface); border: 1px solid var(--border);
  border-radius: 16px 16px 0 0; box-shadow: 0 -4px 8px rgba(0, 0, 0, 0.28);
  overscroll-behavior: contain;
}
.st-sheet-title { margin: 0 0 12px; font-size: 16px; font-weight: 700; letter-spacing: 0; }
.st-sheet-body { margin: 0 0 16px; font-size: 14px; line-height: 1.5; color: var(--muted); }
.st-sheet-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 24px; }
.st-sheet-actions .st-btn { flex: 1; }
/* /mobius-ui:Sheet */

/* mobius-ui:Button v1 — keep in sync; library candidate. Diverge below the marker only. */
.st-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  min-height: 44px; padding: 10px 16px; border-radius: 10px;
  border: 1px solid var(--border); background: var(--surface); color: var(--text);
  font-family: var(--font); font-size: 14px; font-weight: 600; cursor: pointer; white-space: nowrap;
  transition: background 0.14s ease, border-color 0.14s ease, transform 0.1s ease;
  touch-action: manipulation; user-select: none;
}
@media (prefers-reduced-motion: no-preference) {
  .st-btn:not(:disabled):active { transform: scale(0.97); }
}
.st-btn:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.st-btn:disabled { opacity: 0.5; cursor: default; pointer-events: none; }
.st-btn-primary { background: var(--accent-hover, var(--accent)); border-color: var(--accent-hover, var(--accent)); color: var(--accent-fg); }
@media (hover: hover) {
  .st-btn-primary:hover { filter: brightness(0.94); }
  .st-btn-secondary:hover { border-color: color-mix(in srgb, var(--accent) 40%, var(--border)); }
  .st-btn-ghost:hover { background: color-mix(in srgb, var(--accent) 10%, transparent); }
}
.st-btn-secondary { background: var(--surface-2, var(--surface)); }
.st-btn-ghost { background: transparent; border-color: transparent; color: var(--text); }
.st-btn-danger { background: var(--danger); border-color: var(--danger); color: var(--accent-fg); }
.st-btn-icon { width: 44px; padding: 0; border-radius: 8px; font-size: 18px; }
/* /mobius-ui:Button */

/* mobius-ui:Toast v1 — keep in sync; library candidate. */
.st-toast {
  position: absolute; left: 16px; right: 16px; bottom: 16px; z-index: 200;   /* absolute → inside the app */
  display: flex; align-items: center; gap: 12px; padding: 12px 16px;
  background: var(--surface); border: 1px solid var(--accent); border-radius: 12px;
  font-size: 14px; line-height: 1.5; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.32);
  box-sizing: border-box;
}
.st-toast.is-success { border-color: var(--green); }
.st-toast.is-error { border-color: var(--danger); }
.st-toast-msg { flex: 1; user-select: text; cursor: text; }
.st-toast-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}
.st-toast-btn {
  padding: 8px 16px; border-radius: 8px; border: none;
  font-size: 12px; font-weight: 600; cursor: pointer;
  font-family: var(--font); flex-shrink: 0;
  min-height: 44px;
  touch-action: manipulation; user-select: none;
}
.st-toast-btn-primary { background: var(--accent-hover, var(--accent)); color: var(--accent-fg); }
.st-toast-btn-secondary {
  background: var(--surface-2, var(--surface));
  color: var(--text);
  border: 1px solid var(--border);
}
@media (prefers-reduced-motion: no-preference) {
  .st-toast-btn:active { opacity: 0.8; transform: scale(0.97); }
}
@media (max-width: 520px) {
  .st-notice-row {
    align-items: stretch;
    flex-direction: column;
  }
  .st-notice-action {
    width: 100%;
  }
  .st-toast {
    flex-direction: column;
    align-items: stretch;
  }
  .st-toast-actions {
    justify-content: flex-end;
  }
  .st-toast-btn {
    flex: 1 1 0;
  }
}
/* /mobius-ui:Toast */

/* Desktop/web: the phone layout is fluid + left-aligned, which leaves a
   wide empty right gutter on a large window. Cap the content measure and
   center it so the grid, forms, banner, errors, and detail view stay
   comfortably sized and intentional on wide screens. The grid floor also
   bumps so cards don't get over-dense. */
@media (min-width: 720px) {
  .st-title-row {
    max-width: 1180px;
    margin-inline: auto;
  }
  .st-tabs {
    justify-self: center;
    width: 100%;
  }
  .st-scroll > * {
    max-width: 840px;
    margin-inline: auto;
  }
  .st-scroll.is-browse > * { max-width: 1180px; }
  .st-scroll.is-library > * { max-width: 960px; }
  .st-scroll.is-detail > * { max-width: 1180px; }
  .st-catalog-grid {
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  }
  .st-primary-btn {
    width: auto;
    min-width: 128px;
  }
  .st-detail-footer {
    width: 100%;
    max-width: 1180px;
    margin-inline: auto;
    box-sizing: border-box;
    flex-direction: row;
    align-items: center;
    justify-content: flex-end;
  }
  .st-detail-cta {
    width: auto;
    min-width: 148px;
  }
  .st-sheet {
    border-radius: 16px;
  }
  .st-sheet-actions .st-btn {
    flex: 0 0 auto;
    min-width: 112px;
  }
  .st-toast {
    left: 50%;
    right: auto;
    width: max-content;
    min-width: min(420px, calc(100% - 32px));
    max-width: min(720px, calc(100% - 32px));
    transform: translateX(-50%);
  }
}

/* Publishing is one compact choose → review → publish journey. */
.st-publisher { width: min(100%, 1040px); max-width: none !important; margin-inline: auto; }
.st-publish-heading {
  display: flex; align-items: flex-start; justify-content: space-between; gap: 24px;
  margin: 4px 0 22px; padding: 22px 0 18px; border-bottom: 1px solid var(--border);
}
.st-eyebrow { color: var(--muted); font-size: 12px; font-weight: 650; }
.st-publish-heading h2 { margin: 0 0 8px; font-size: clamp(27px, 4vw, 40px); line-height: 1; letter-spacing: -.045em; }
.st-publish-heading p { margin: 0; max-width: 46ch; color: var(--muted); font-size: 14px; line-height: 1.5; }
.st-publish-path { display: flex; flex-wrap: wrap; gap: 8px 22px; margin: 16px 0 0; padding: 0; list-style: none; color: var(--text); font-size: 12px; font-weight: 650; counter-reset: publish-step; }
.st-publish-path li { position: relative; counter-increment: publish-step; }
.st-publish-path li::before { content: counter(publish-step); display: inline-grid; place-items: center; width: 20px; height: 20px; margin-right: 7px; border: 1px solid var(--border); border-radius: 50%; color: var(--muted); font-size: 10px; }
.st-publish-heading-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; align-items: center; gap: 8px; }
.st-publish-account { color: var(--muted); font-size: 12px; }
.st-publish-connection {
  min-height: 32px; display: inline-flex; align-items: center; padding: 6px 10px; border-radius: 999px;
  color: var(--muted); background: var(--surface); border: 1px solid var(--border); font-size: 11px; font-weight: 700;
}
.st-publish-connection.is-ready { color: var(--green); border-color: color-mix(in srgb, var(--green) 32%, var(--border)); }
.st-publish-connection-action { cursor: pointer; color: var(--text); border-color: color-mix(in srgb, var(--accent) 45%, var(--border)); font-family: inherit; }
.st-publish-connection-action:hover { background: color-mix(in srgb, var(--accent) 10%, var(--surface)); }
.st-publish-setup { display: flex; align-items: center; gap: 10px; padding: 14px; border: 1px solid var(--border); border-radius: 14px; background: var(--surface); }
.st-publish-setup > div { flex: 1; min-width: 0; display: grid; gap: 3px; }
.st-publish-setup span { color: var(--muted); font-size: 12px; line-height: 1.4; }
.st-publish-list-head { display: flex; align-items: end; justify-content: space-between; gap: 16px; margin: 28px 0 14px; }
.st-publish-list-head h3 { margin: 0; font-size: 14px; }
.st-publish-list-head p { margin: 0; color: var(--muted); font-size: 12px; }
.st-publish-search { width: min(260px, 42vw); min-height: 42px; display: flex; align-items: center; gap: 9px; padding: 0 12px; border: 1px solid var(--border); border-radius: 11px; color: var(--muted); background: var(--surface); }
.st-publish-search:focus-within { border-color: var(--accent); outline: 2px solid color-mix(in srgb, var(--accent) 18%, transparent); }
.st-publish-search input { width: 100%; min-width: 0; border: 0; outline: 0; color: var(--text); background: transparent; font: inherit; font-size: 13px; }
.st-publish-list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: 22px; }
.st-publish-more { margin-top: 12px; }
.st-publish-more > summary {
  min-height: 44px; display: flex; align-items: center; justify-content: space-between; gap: 12px;
  padding: 0 12px; color: var(--muted); border: 1px solid var(--border); border-radius: 12px;
  background: var(--surface); font-size: 12px; font-weight: 700; cursor: pointer; list-style: none;
}
.st-publish-more > summary::-webkit-details-marker { display: none; }
.st-publish-more > summary small { min-width: 24px; height: 24px; display: grid; place-items: center; border-radius: 999px; background: var(--surface-2, var(--bg)); }
.st-publish-more[open] > summary { margin-bottom: 8px; }
.st-publish-row {
  display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 13px;
  min-height: 78px; padding: 12px 0; border: 0; border-bottom: 1px solid var(--border); border-radius: 0; background: transparent;
}
.st-publish-row-copy { min-width: 0; display: grid; gap: 4px; }
.st-publish-row-copy h3 { margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 14px; }
.st-publish-row-copy p { margin: 0; color: var(--muted); font-size: 12px; line-height: 1.4; }
.st-publish-row-copy span { color: var(--muted); font-size: 11px; }
.st-publish-row-copy .st-publish-row-message { display: block; margin-top: 4px; color: var(--danger); }
.st-publish-icon { position: relative; width: 48px; height: 48px; border-radius: 12px; overflow: hidden; display: grid; place-items: center; color: var(--muted); background: var(--surface-2, var(--bg)); font-weight: 800; }
.st-publish-icon img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.st-listing-review { overflow: hidden; border: 1px solid var(--border); border-radius: 20px; background: var(--surface); }
.st-listing-review-top { min-height: 50px; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 8px 12px; }
.st-listing-review-top > span { color: var(--muted); font-size: 11px; }
.st-listing-loading { min-height: 260px; display: grid; place-items: center; color: var(--muted); }
.st-listing-incomplete { min-height: 220px; padding: 28px; display: flex; align-items: center; justify-content: center; gap: 14px; color: var(--muted); text-align: left; }
.st-listing-incomplete > div { display: grid; gap: 5px; max-width: 440px; }
.st-listing-incomplete strong { color: var(--text); font-size: 16px; }
.st-listing-agent { justify-self: start; margin-top: 8px; }
.st-listing-review > .st-listing-agent { margin: 0 22px 18px; }
.st-listing-incomplete span { font-size: 13px; line-height: 1.45; }
.st-listing-hero { grid-area: hero; position: relative; min-height: clamp(280px, 46vw, 420px); overflow: hidden; background: var(--bg); border-right: 1px solid var(--border); }
.st-listing-hero > img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.st-listing-hero-shade { position: absolute; inset: 0; background: linear-gradient(90deg, rgba(4, 6, 8, .88) 0%, rgba(4, 6, 8, .45) 48%, rgba(4, 6, 8, .05) 82%); }
.st-listing-hero-copy { position: absolute; z-index: 1; left: clamp(18px, 5vw, 48px); bottom: clamp(22px, 5vw, 48px); max-width: min(420px, 72%); color: white; }
.st-listing-hero-copy > img { width: 58px; height: 58px; margin-bottom: 14px; border-radius: 14px; object-fit: cover; box-shadow: 0 12px 30px #0007; }
.st-listing-hero-copy h3 { margin: 5px 0 7px; font-size: clamp(32px, 6vw, 58px); line-height: .94; letter-spacing: -.055em; }
.st-listing-hero-copy p { margin: 0; max-width: 32ch; font-size: clamp(14px, 2vw, 18px); line-height: 1.35; color: rgba(255,255,255,.82); }
.st-listing-body { grid-area: body; min-width: 0; padding: 22px; border-right: 1px solid var(--border); }
.st-listing-body > p { max-width: 64ch; margin: 0 0 18px; color: var(--muted); font-size: 14px; line-height: 1.6; }
.st-listing-gallery { display: grid; grid-auto-flow: column; grid-auto-columns: min(82%, 640px); gap: 12px; overflow-x: auto; scroll-snap-type: x mandatory; scrollbar-width: none; }
.st-listing-gallery::-webkit-scrollbar { display: none; }
.st-listing-gallery figure { margin: 0; scroll-snap-align: start; overflow: hidden; border: 1px solid var(--border); border-radius: 14px; background: var(--bg); }
.st-listing-gallery img { display: block; width: 100%; aspect-ratio: 16 / 10; object-fit: cover; }
.st-listing-gallery figcaption { padding: 9px 11px; color: var(--muted); font-size: 11px; }
.st-listing-ready-layout {
  display: grid; grid-template-columns: minmax(0, 1.65fr) minmax(280px, .75fr);
  grid-template-areas: "hero release" "body release"; align-items: start;
}
.st-listing-release-panel { grid-area: release; position: sticky; top: 0; display: grid; gap: 18px; padding: 24px; }
.st-listing-release-copy h3 { margin: 0 0 7px; font-size: 18px; letter-spacing: -.02em; }
.st-listing-release-copy p { margin: 0; color: var(--muted); font-size: 12px; line-height: 1.55; }
.st-listing-release-panel > .st-btn-primary { width: 100%; }
.st-listing-revise { display: flex; flex-wrap: wrap; gap: 8px; padding-top: 4px; border-top: 1px solid var(--border); }
.st-listing-work { display: grid; gap: 18px; padding: 4px 18px 22px; }
.st-listing-work > .st-listing-agent { margin: 0; }

.st-checklist { border: 1px solid var(--border); border-radius: 16px; background: var(--bg); overflow: hidden; }
.st-checklist-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; padding: 14px 16px; border-bottom: 1px solid var(--border); }
.st-checklist-head > div { display: grid; gap: 3px; }
.st-checklist-head strong { font-size: 15px; }
.st-checklist-head span { color: var(--muted); font-size: 12px; }
.st-checklist-head .st-btn { display: inline-flex; align-items: center; gap: 7px; }
.st-checklist ul { list-style: none; margin: 0; padding: 4px 0; }
.st-checklist li { display: grid; grid-template-columns: 20px minmax(0, 1fr) auto; align-items: start; gap: 12px; padding: 10px 16px; }
.st-check-icon { color: var(--muted); margin-top: 1px; }
.st-check-icon.is-done { color: var(--accent); }
.st-checklist li > div { display: grid; gap: 2px; min-width: 0; }
.st-check-label { font-size: 14px; font-weight: 650; }
.st-check-label small { color: var(--muted); font-weight: 500; }
.st-checklist li.is-done .st-check-label { color: var(--muted); font-weight: 550; }
.st-check-note { color: var(--muted); font-size: 12px; line-height: 1.4; }
.st-check-agent {
  min-height: 36px; padding: 6px 11px; border-radius: 999px; font: inherit; font-size: 12px; font-weight: 650;
  color: var(--accent); background: color-mix(in srgb, var(--accent) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--accent) 28%, transparent); cursor: pointer; white-space: nowrap;
}
.st-check-agent:disabled { opacity: .55; cursor: default; }
.st-checklist-head > .st-checklist-actions { display: flex; flex-wrap: wrap; gap: 8px; }
.st-agent-status { display: inline-flex; align-items: center; gap: 8px; }
.st-check-agent.is-working { display: inline-flex; align-items: center; gap: 7px; color: var(--text); border-style: dashed; }
.st-agent-pulse {
  flex: none; width: 8px; height: 8px; border-radius: 50%; background: var(--accent);
  box-shadow: 0 0 0 0 color-mix(in srgb, var(--accent) 45%, transparent);
}
@media (prefers-reduced-motion: no-preference) {
  .st-agent-pulse { animation: st-agent-pulse 1.6s ease-out infinite; }
}
@keyframes st-agent-pulse {
  0% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--accent) 45%, transparent); }
  100% { box-shadow: 0 0 0 8px transparent; }
}
.st-agent-conflicts { display: grid; gap: 10px; }
.st-agent-conflict {
  display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap;
  padding: 12px 14px; border-radius: 14px; background: var(--surface);
  border: 1px solid color-mix(in srgb, var(--accent) 30%, var(--border));
}
.st-agent-conflict > div:first-child { display: grid; gap: 3px; min-width: 0; flex: 1 1 260px; }
.st-agent-conflict strong { font-size: 14px; }
.st-agent-conflict span { color: var(--muted); font-size: 12px; }
.st-agent-conflict q { font-size: 13px; line-height: 1.45; overflow-wrap: anywhere; }
.st-agent-conflict-actions { display: flex; align-items: center; gap: 12px; }

.st-listing-editor { display: grid; gap: 18px; }
.st-edit-identity { display: flex; align-items: center; gap: 14px; }
.st-edit-identity > div:last-child { display: grid; gap: 2px; }
.st-edit-identity strong { font-size: 17px; }
.st-edit-icon { width: 60px; height: 60px; flex: none; display: grid; place-items: center; overflow: hidden; border-radius: 15px; border: 1px solid var(--border); background: var(--bg); color: var(--muted); }
.st-edit-icon img { width: 100%; height: 100%; object-fit: cover; }
.st-link-btn { justify-self: start; display: inline-flex; align-items: center; min-height: 32px; padding: 0; border: 0; background: none; color: var(--accent); font: inherit; font-size: 13px; font-weight: 650; cursor: pointer; }
.st-link-btn:disabled { opacity: .55; cursor: default; }
.st-edit-field { display: grid; gap: 7px; margin: 0; padding: 0; border: 0; min-width: 0; }
.st-edit-label { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; width: 100%; padding: 0; font-size: 13px; font-weight: 700; }
.st-edit-label small { color: var(--muted); font-weight: 500; margin-right: auto; margin-left: 6px; }
.st-edit-count { color: var(--muted); font-size: 11px; font-weight: 600; font-variant-numeric: tabular-nums; }
.st-edit-count.is-over { color: var(--danger, #d05a5a); }
.st-edit-field input, .st-edit-field textarea, .st-edit-shot input {
  width: 100%; min-height: 44px; padding: 10px 12px; border-radius: 12px; font: inherit; font-size: 14px;
  color: var(--text); background: var(--bg); border: 1px solid var(--border);
}
.st-edit-field textarea { resize: vertical; line-height: 1.5; min-height: 120px; }
.st-edit-field input:focus-visible, .st-edit-field textarea:focus-visible, .st-edit-shot input:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--accent) 60%, transparent); outline-offset: 1px; border-color: var(--accent);
}
.st-edit-hint { margin: -2px 0 2px; color: var(--muted); font-size: 12px; line-height: 1.4; }
.st-edit-shots { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(200px, 240px); gap: 12px; overflow-x: auto; padding-bottom: 4px; scroll-snap-type: x proximity; }
.st-edit-shot { display: grid; gap: 7px; align-content: start; scroll-snap-align: start; }
.st-edit-shot input { min-height: 40px; font-size: 13px; }
.st-edit-shot-image, .st-edit-hero { position: relative; overflow: hidden; border-radius: 12px; border: 1px solid var(--border); background: var(--bg); }
.st-edit-shot-image { aspect-ratio: 10 / 16; display: grid; place-items: center; }
.st-edit-shot-image img, .st-edit-hero img { display: block; width: 100%; height: 100%; object-fit: cover; }
.st-edit-shot-image span { padding: 12px; color: var(--muted); font-size: 12px; text-align: center; }
.st-edit-hero { aspect-ratio: 16 / 7; }
.st-edit-remove {
  position: absolute; top: 8px; right: 8px; width: 36px; height: 36px; display: grid; place-items: center;
  border-radius: 999px; border: 0; color: #fff; background: rgba(0, 0, 0, .55); cursor: pointer;
}
.st-edit-remove:disabled { opacity: .5; cursor: default; }
.st-edit-add {
  min-height: 120px; display: grid; place-items: center; align-content: center; gap: 6px; padding: 12px;
  aspect-ratio: 10 / 16; border-radius: 12px; border: 1.5px dashed var(--border); background: transparent;
  color: var(--muted); font: inherit; font-size: 13px; font-weight: 650; cursor: pointer;
}
.st-edit-add.is-wide { aspect-ratio: 16 / 5; width: 100%; }
.st-edit-add:disabled { opacity: .55; cursor: default; }
.st-visually-hidden { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
.st-file-picker { position: relative; cursor: pointer; }
.st-file-picker.is-disabled { opacity: .55; cursor: default; }
.st-file-picker:focus-within { outline: 2px solid color-mix(in srgb, var(--accent) 60%, transparent); outline-offset: 2px; }
.st-edit-error { margin: 0; color: var(--danger, #d05a5a); font-size: 13px; }
.st-edit-actions {
  position: sticky; bottom: 0; z-index: 1; display: flex; align-items: center; justify-content: space-between; gap: 12px;
  margin: 0 -18px -22px; padding: 12px 18px; border-top: 1px solid var(--border);
  background: color-mix(in srgb, var(--surface) 94%, transparent); backdrop-filter: blur(8px);
}
.st-edit-actions > span { color: var(--muted); font-size: 12px; line-height: 1.4; }
.st-edit-actions .st-btn { flex: none; }
@media (hover: hover) {
  .st-check-agent:hover:not(:disabled) { background: color-mix(in srgb, var(--accent) 16%, transparent); }
  .st-edit-add:hover:not(:disabled) { border-color: var(--accent); color: var(--accent); }
}
@media (max-width: 680px) {
  .st-listing-work { padding: 4px 12px 18px; }
  .st-checklist-head .st-btn { width: 100%; justify-content: center; }
  .st-checklist-actions { width: 100%; }
  .st-edit-actions { margin: 0 -12px -18px; padding: 12px; }
}
.st-publish-advanced { margin-top: 24px; }

@media (max-width: 680px) {
  .st-publish-heading { flex-direction: column; }
  .st-publisher.is-reviewing .st-publish-heading { gap: 14px; margin-bottom: 18px; padding: 12px 0 14px; }
  .st-publisher.is-reviewing .st-publish-heading h2 { font-size: 26px; }
  .st-publisher.is-reviewing .st-publish-path { gap: 8px 14px; margin-top: 12px; }
  .st-publish-heading-actions { justify-content: flex-start; }
  .st-publish-list-head { align-items: stretch; flex-direction: column; }
  .st-publish-search { width: 100%; }
  .st-publish-list { grid-template-columns: 1fr; }
  .st-publish-row { grid-template-columns: auto minmax(0, 1fr); }
  .st-publish-row > .st-btn { grid-column: 1 / -1; width: 100%; }
  .st-listing-ready-layout { grid-template-columns: 1fr; grid-template-areas: "hero" "release" "body"; }
  .st-listing-hero { min-height: 280px; border-right: 0; border-bottom: 1px solid var(--border); }
  .st-listing-body { padding: 18px 16px; border-top: 1px solid var(--border); border-right: 0; }
  .st-listing-release-panel { position: static; gap: 16px; padding: 20px 16px; }
  .st-listing-release-panel > .st-btn-primary { min-height: 48px; }
  .st-listing-revise { display: grid; grid-template-columns: 1fr 1fr; }
  .st-listing-revise .st-btn { min-height: 44px; }
  .st-listing-hero-copy { max-width: 82%; }
  .st-listing-hero-shade { background: linear-gradient(0deg, rgba(4, 6, 8, .9) 0%, rgba(4, 6, 8, .15) 88%); }
}

/* Editorial discovery keeps the Möbius journey chrome and borrows the calm,
   story-led hierarchy of a focused marketplace: one feature at a time,
   followed by dense app rows. Spotlight advances gently but remains fully
   pausable and yields to hover, focus, visibility, and reduced-motion. */
.st-spotlights { min-width: 0; }
.st-spotlights-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 18px;
  margin-bottom: 12px;
}
.st-spotlights-head .st-catalog-section-desc { max-width: 54ch; }
.st-spotlight-pagination {
  display: flex; align-items: center; justify-content: flex-end;
  min-height: 44px;
}
.st-spotlight-pagination button {
  width: 44px; height: 44px; display: grid; place-items: center; padding: 0;
  border: 0; border-radius: 999px; background: transparent; cursor: pointer;
}
.st-spotlight-pagination button span {
  width: 7px; height: 7px; border-radius: 999px;
  background: color-mix(in srgb, var(--text) 24%, transparent);
  transition: transform 150ms ease, background 150ms ease;
}
.st-spotlight-pagination button.is-active span { transform: scaleX(3.4); background: var(--accent); }
.st-spotlight-pagination button:focus-visible { outline: 2px solid var(--accent); outline-offset: -4px; }
.st-spotlight-pagination .st-spotlight-toggle {
  margin-left: 4px; border: 1px solid var(--border); color: var(--muted);
  background: color-mix(in srgb, var(--surface) 82%, transparent);
}
.st-spotlight-pagination .st-spotlight-toggle:hover { color: var(--text); border-color: color-mix(in srgb, var(--text) 24%, var(--border)); }
.st-spotlight-pagination .st-spotlight-toggle[aria-pressed="true"] { color: var(--text); border-color: color-mix(in srgb, var(--accent) 38%, var(--border)); }
.st-spotlight-stage { min-width: 0; }
.st-spotlight-slide {
  position: relative; min-height: clamp(360px, 43vw, 520px); overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--text) 12%, var(--border));
  border-radius: 22px; background: var(--surface);
  box-shadow: 0 24px 70px rgba(0, 0, 0, .24);
}
.st-spotlight-slide-image,
.st-spotlight-slide > .st-store-image-placeholder {
  position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover;
}
.st-spotlight-slide > .st-store-image-placeholder { background: var(--surface-2, var(--surface)); }
.st-spotlight-slide-shade {
  position: absolute; inset: 0;
  background:
    linear-gradient(90deg, rgba(3,5,8,.9) 0%, rgba(3,5,8,.56) 44%, rgba(3,5,8,.06) 80%),
    linear-gradient(0deg, rgba(3,5,8,.72) 0%, rgba(3,5,8,.04) 64%);
}
.st-spotlight-slide-copy {
  position: absolute; z-index: 1;
  left: clamp(22px, 4vw, 48px); right: clamp(22px, 4vw, 48px); bottom: clamp(24px, 4vw, 48px);
  display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: end; gap: 16px;
  color: white;
}
.st-spotlight-slide-copy .st-icon-wrap { width: 60px; height: 60px; border-radius: 15px; box-shadow: 0 12px 30px #0009; }
.st-spotlight-kicker { display: block; margin-bottom: 7px; color: rgba(255,255,255,.68); font-size: 10px; font-weight: 800; letter-spacing: .13em; text-transform: uppercase; }
.st-spotlight-slide-copy h3 { margin: 0 0 7px; font-size: clamp(34px, 5vw, 56px); line-height: .94; letter-spacing: -.05em; }
.st-spotlight-slide-copy p { margin: 0; max-width: 42ch; color: rgba(255,255,255,.8); font-size: clamp(13px, 1.5vw, 16px); line-height: 1.42; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 4; overflow: hidden; }
.st-spotlight-open {
  min-width: 108px; min-height: 44px; padding: 0 16px; border: 1px solid rgba(255,255,255,.3); border-radius: 999px;
  color: white; background: rgba(8,8,10,.5); backdrop-filter: blur(12px);
  font: 750 12px/1 var(--font); cursor: pointer;
}
@media (hover: hover) {
  .st-spotlight-open:hover { background: rgba(255,255,255,.14); }
}
.st-picks { min-width: 0; }
.st-picks-grid,
.st-catalog-sections.is-editorial .st-catalog-grid {
  display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px;
}
.st-catalog-sections.is-editorial { gap: 28px; }
.st-catalog-sections.is-editorial .st-catalog-section-head { margin-bottom: 10px; }
.st-catalog-sections.is-editorial .st-catalog-section-title { font-size: 18px; }

/* Browse rows carry enough value copy to compare apps without spending the
   height of a tile. They are separate from Library's maintenance rows. */
.st-card.is-editorial-row {
  display: grid; grid-template-columns: auto minmax(0, 1fr) auto;
  grid-template-rows: auto auto auto; align-items: center;
  min-height: 108px; padding: 14px; column-gap: 13px; row-gap: 2px; text-align: left;
}
.st-card.is-editorial-row .st-icon-slot { grid-column: 1; grid-row: 1 / span 3; margin: 0; }
.st-card.is-editorial-row .st-icon-wrap { width: 54px; height: 54px; border-radius: 14px; }
.st-card.is-editorial-row .st-card-open { grid-column: 2; grid-row: 1; align-self: end; min-height: 0; margin: 0; text-align: left; font-size: 15px; font-weight: 720; }
.st-card.is-editorial-row .st-card-desc {
  grid-column: 2; grid-row: 2; display: -webkit-box; min-height: 18px; margin: 2px 0 0;
  overflow: hidden; color: var(--muted); text-align: left; line-height: 1.35;
  -webkit-box-orient: vertical; -webkit-line-clamp: 2;
}
.st-card.is-editorial-row .st-card-state-row { grid-column: 2; grid-row: 3; justify-content: flex-start; min-height: 18px; margin: 2px 0 0; }
.st-card.is-editorial-row .st-card-status-row { grid-column: 3; grid-row: 1 / span 3; align-self: center; margin: 0; }
.st-card.is-editorial-row .st-card-inline-error { grid-column: 1 / -1; grid-row: 4; }

/* Library rows scan like a system update centre rather than a second Store grid. */
.st-card.is-list {
  display: grid; grid-template-columns: auto minmax(0, 1fr) auto; grid-template-rows: auto auto;
  align-items: center; column-gap: 14px; row-gap: 3px; min-height: 72px; padding: 11px 12px; text-align: left;
}
.st-catalog-sections.is-list { gap: 22px; }
.st-catalog-sections.is-list .st-catalog-grid { grid-template-columns: 1fr; gap: 8px; }
.st-card.is-list .st-icon-slot { grid-column: 1; grid-row: 1 / span 2; margin: 0; }
.st-card.is-list .st-icon-wrap { width: 52px; height: 52px; border-radius: 13px; }
.st-card.is-list .st-card-open { grid-column: 2; grid-row: 1; align-self: end; margin: 0; text-align: left; }
.st-card.is-list .st-card-state-row { grid-column: 2; grid-row: 2; justify-content: flex-start; min-height: 18px; margin: 0; }
.st-card.is-list .st-card-desc { display: none; }
.st-card.is-list .st-card-status-row { grid-column: 3; grid-row: 1 / span 2; align-self: center; margin: 0; }
.st-card.is-list .st-card-status-row { display: flex; gap: 8px; align-items: center; justify-content: flex-end; flex-wrap: wrap; }
.st-card.is-list .st-card-inline-error { grid-column: 1 / -1; grid-row: 3; }

/* Listing-led detail pages put imagery and product value before prose. */
.st-detail-editorial {
  position: relative; min-height: clamp(310px, 52vw, 480px); margin-bottom: 18px; overflow: hidden;
  border: 1px solid var(--border); border-radius: 22px; background: var(--surface);
}
.st-detail-editorial-image,
.st-detail-editorial > .st-store-image-placeholder { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.st-detail-editorial > .st-store-image-placeholder { background: var(--surface-2, var(--surface)); }
.st-detail-editorial-shade { position: absolute; inset: 0; background: linear-gradient(0deg, rgba(3,5,7,.94) 0%, rgba(3,5,7,.2) 78%); }
.st-detail-editorial-copy {
  position: absolute; z-index: 1; left: clamp(20px, 5vw, 46px); right: clamp(20px, 5vw, 46px); bottom: clamp(22px, 5vw, 46px);
  color: white;
}
.st-detail-editorial-copy .st-icon-wrap { width: 58px; height: 58px; margin-bottom: 13px; border-radius: 14px; box-shadow: 0 10px 28px #0008; }
.st-detail-editorial-copy h2 { margin: 6px 0 7px; font-size: clamp(36px, 7vw, 64px); line-height: .94; letter-spacing: -.055em; }
.st-detail-editorial-copy p { margin: 0; max-width: 38ch; color: rgba(255,255,255,.82); font-size: clamp(15px, 2vw, 19px); line-height: 1.38; }
.st-detail-gallery {
  display: grid; grid-auto-flow: column; grid-auto-columns: min(86%, 670px); gap: 12px;
  margin-block: 0 22px; overflow-x: auto; scroll-snap-type: x mandatory; scrollbar-width: none;
}
.st-detail-gallery.is-single { grid-auto-columns: 100%; }
.st-detail-gallery::-webkit-scrollbar { display: none; }
.st-detail-gallery figure { margin: 0; overflow: hidden; scroll-snap-align: start; border: 1px solid var(--border); border-radius: 16px; background: var(--surface); }
.st-detail-gallery-image,
.st-detail-gallery .st-store-image-placeholder { display: block; width: 100%; aspect-ratio: 5 / 3; object-fit: cover; object-position: top center; }
.st-detail-gallery .st-store-image-placeholder { background: var(--surface-2, var(--surface)); }
.st-detail-gallery figcaption { padding: 9px 12px; color: var(--muted); border-top: 1px solid var(--border); font-size: 11px; font-weight: 650; }
.st-detail-byline { margin-block: -14px 26px; color: var(--muted); font: 11px/1.4 var(--mono, monospace); }
.st-detail-tagline { margin: 5px 0 0; color: var(--muted); font-size: 14px; line-height: 1.4; }

@media (max-width: 720px) {
  .st-spotlights-head { align-items: flex-start; flex-direction: column; gap: 4px; }
  .st-spotlight-pagination { align-self: center; }
  .st-spotlight-slide { min-height: 390px; }
  .st-spotlight-slide-copy { grid-template-columns: auto minmax(0, 1fr); align-items: center; }
  .st-spotlight-slide-copy .st-spotlight-open { grid-column: 1 / -1; width: 100%; }
  .st-picks-grid,
  .st-catalog-sections.is-editorial .st-catalog-grid { grid-template-columns: 1fr; }
}
@media (max-width: 460px) {
  .st-spotlight-slide { min-height: 372px; border-radius: 18px; }
  .st-spotlight-slide-shade {
    background: linear-gradient(0deg, rgba(3,5,8,.94) 0%, rgba(3,5,8,.54) 50%, rgba(3,5,8,.08) 100%);
  }
  .st-spotlight-slide-copy { left: 16px; right: 16px; bottom: 16px; gap: 10px; }
  .st-spotlight-slide-copy .st-icon-wrap { width: 50px; height: 50px; border-radius: 13px; }
  .st-card.is-editorial-row { grid-template-columns: 50px minmax(0, 1fr) auto; min-height: 108px; padding: 12px; column-gap: 11px; }
  .st-card.is-editorial-row .st-icon-slot { grid-row: 1 / span 3; }
  .st-card.is-editorial-row .st-icon-wrap { width: 48px; height: 48px; border-radius: 12px; }
  .st-card.is-editorial-row .st-card-status-row { grid-column: 3; grid-row: 1 / span 3; width: auto; margin: 0; }
  .st-card.is-editorial-row .st-card-inline-error { grid-row: 4; }
}

/* Hosted Spotlight editing stays inside publishing: the same reviewed GitHub
   identity that can publish apps can see this panel only when the Host grants
   its explicit Store-editor role. */
.st-spotlight-editor {
  display: grid; gap: 16px; padding: clamp(16px, 3vw, 24px);
  border: 1px solid color-mix(in srgb, var(--accent) 34%, var(--border));
  border-radius: 20px; background: color-mix(in srgb, var(--accent) 5%, var(--surface));
}
.st-spotlight-editor-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; }
.st-spotlight-editor-head h3 { margin: 4px 0 6px; font-size: 21px; letter-spacing: -.025em; }
.st-spotlight-editor-head p { max-width: 58ch; margin: 0; color: var(--muted); font-size: 13px; line-height: 1.5; }
.st-spotlight-revision {
  flex: 0 0 auto; padding: 7px 10px; border: 1px solid var(--border); border-radius: 999px;
  color: var(--muted); background: var(--bg); font: 650 10px/1 var(--mono, monospace);
}
.st-spotlight-editor-list { display: grid; gap: 8px; }
.st-spotlight-editor-row {
  display: grid; grid-template-columns: 76px minmax(0, 1fr) auto; align-items: center; gap: 12px;
  min-width: 0; padding: 9px; border: 1px solid var(--border); border-radius: 15px; background: var(--bg);
}
.st-spotlight-editor-preview {
  display: grid; place-items: center; width: 76px; height: 54px; overflow: hidden;
  border-radius: 10px; background: var(--surface-2, var(--surface));
}
.st-spotlight-editor-preview > img,
.st-spotlight-editor-preview > .st-store-image-placeholder { width: 100%; height: 100%; object-fit: cover; }
.st-spotlight-editor-preview .st-icon-wrap { width: 42px; height: 42px; border-radius: 11px; }
.st-spotlight-editor-copy { min-width: 0; }
.st-spotlight-editor-copy strong,
.st-spotlight-editor-copy span { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.st-spotlight-editor-copy strong { margin-bottom: 3px; font-size: 13px; }
.st-spotlight-editor-copy span { color: var(--muted); font-size: 11px; }
.st-spotlight-editor-actions { display: flex; align-items: center; gap: 5px; }
.st-spotlight-editor-actions button,
.st-spotlight-upload {
  min-height: 44px; padding: 0 10px; border: 1px solid var(--border); border-radius: 9px;
  color: var(--text); background: var(--surface); font: 650 11px/1 var(--font); cursor: pointer;
}
.st-spotlight-editor-actions button svg { width: 16px; height: 16px; }
.st-spotlight-editor-actions button:disabled { opacity: .42; cursor: default; }
.st-spotlight-editor-actions .is-remove { color: var(--muted); }
.st-spotlight-upload { position: relative; display: inline-grid; place-items: center; overflow: hidden; }
.st-spotlight-upload input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
.st-spotlight-upload:focus-within { outline: 2px solid var(--accent); outline-offset: 2px; }
.st-spotlight-editor-add { display: flex; gap: 8px; }
.st-spotlight-editor-add select {
  min-width: 0; flex: 1; min-height: 40px; padding: 0 12px; border: 1px solid var(--border);
  border-radius: 10px; color: var(--text); background: var(--bg); font: 600 12px/1 var(--font);
}
.st-spotlight-editor-publish { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding-top: 4px; }
@media (hover: hover) {
  .st-spotlight-editor-actions button:not(:disabled):hover,
  .st-spotlight-upload:hover { border-color: color-mix(in srgb, var(--accent) 55%, var(--border)); }
}
@media (max-width: 720px) {
  .st-spotlight-editor-head,
  .st-spotlight-editor-publish { align-items: stretch; flex-direction: column; }
  .st-spotlight-revision { align-self: flex-start; }
  .st-spotlight-editor-row { grid-template-columns: 64px minmax(0, 1fr); }
  .st-spotlight-editor-preview { width: 64px; height: 50px; }
  .st-spotlight-editor-actions { grid-column: 1 / -1; display: grid; grid-template-columns: auto auto 1fr auto; }
  .st-spotlight-editor-add { flex-direction: column; }
  .st-spotlight-editor-add select { font-size: 16px; }
  .st-spotlight-editor-publish .st-btn { width: 100%; }
}
/* mobius-ui:CenteredRail v1 */
@media (min-width: 900px) {
  .st-header { width: min(100%, 1120px); margin-inline: auto; }
}
/* /mobius-ui:CenteredRail */

/* Compact catalogue grammar: shared by each discovery shelf and full view. */
.st-shelf { min-width: 0; }
.st-shelf-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.st-shelf-controls { display: flex; align-items: center; gap: 4px; flex-shrink: 0; }
.st-shelf-arrow, .st-shelf-all { min-height: 44px; min-width: 44px; border: 0; background: transparent; color: var(--text); cursor: pointer; font: 600 13px var(--font); }
.st-shelf-arrow { display: grid; place-items: center; border-radius: 50%; }
.st-shelf-arrow:disabled { opacity: .3; cursor: default; }
.st-shelf-all { padding: 0 10px; color: var(--text); }
@media (hover: hover) {
  .st-shelf-all:hover { text-decoration: underline; text-underline-offset: 4px; }
  .st-shelf-arrow:not(:disabled):hover { outline: 1px solid currentColor; outline-offset: -6px; }
}
.st-shelf-row { display: grid; grid-template-rows: repeat(2, auto); grid-auto-flow: column; grid-auto-columns: calc((100% - 32px) / 3); gap: 12px 16px; overflow-x: auto; padding: 3px 2px 10px; scrollbar-width: thin; scrollbar-color: var(--border) transparent; scroll-snap-type: x proximity; }
.st-shelf-row > .st-card { scroll-snap-align: start; }
.st-collection-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 18px; }
.st-collection-heading { display: flex; align-items: center; gap: 18px; margin-bottom: 24px; }
.st-collection-heading h2 { margin: 0; font-size: 24px; letter-spacing: -.02em; }
.st-collection-heading p { margin: 4px 0 0; color: var(--muted); font-size: 13px; }
.st-collection-heading .st-btn { display: flex; align-items: center; gap: 6px; min-height: 44px; }
.st-card.is-compact, .st-card.is-list {
  display: grid; grid-template-columns: 62px minmax(0,1fr) auto;
  grid-template-rows: auto auto auto auto; gap: 2px 12px;
  align-items: center; min-width: 0; min-height: 92px;
  padding: 10px 0; border: 0; border-radius: 0; background: transparent; box-shadow: none; text-align: left;
}
.st-card.is-compact:hover, .st-card.is-list:hover { transform: none; box-shadow: none; background: transparent; }
.st-card.is-compact .st-icon-slot, .st-card.is-list .st-icon-slot { grid-column: 1; grid-row: 1 / span 4; margin: 0; }
.st-card.is-compact .st-icon-wrap, .st-card.is-list .st-icon-wrap { width: 62px; height: 62px; }
.st-card.is-compact .st-card-open, .st-card.is-list .st-card-open { grid-column: 2; grid-row: 1; align-self: end; text-align: left; font-size: 15px; line-height: 1.35; margin: 0; min-height: 0; }
.st-card.is-compact .st-card-desc, .st-card.is-list .st-card-desc { grid-column: 2; grid-row: 2; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; font-size: 13px; line-height: 1.4; min-height: 0; margin: 0; color: var(--muted); text-align: left; }
.st-card-byline { grid-column: 2; grid-row: 3; color: var(--muted); font-size: 12px; line-height: 1.4; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.st-card.is-compact .st-card-state-row, .st-card.is-list .st-card-state-row { grid-column: 2; grid-row: 4; margin: 0; min-height: 0; justify-content: flex-start; }
.st-card.is-compact .st-card-status-row, .st-card.is-list .st-card-status-row { grid-column: 3; grid-row: 1 / span 4; margin: 0; align-self: center; }
.st-card.is-compact .st-card-action, .st-card.is-list .st-card-action { width: auto; min-width: 60px; min-height: 44px; height: auto; padding: 8px 13px; border: 0; border-radius: 999px; background: var(--surface); color: var(--text); font: 650 12px/1.3 var(--font); }
.st-card.is-compact .st-card-action.is-update, .st-card.is-list .st-card-action.is-update { background: var(--accent); color: var(--accent-text, white); }
.st-card.is-compact .st-card-inline-error, .st-card.is-list .st-card-inline-error { grid-column: 1 / -1; grid-row: auto; }
.st-catalog-sections.is-list .st-catalog-grid { gap: 0; }
.st-catalog-sections.is-list .st-card + .st-card { border-top: 1px solid var(--border); }
@media (max-width: 1100px) {
  .st-shelf-row { grid-auto-columns: calc((100% - 16px) / 2); }
  .st-collection-grid { grid-template-columns: repeat(2, minmax(0,1fr)); }
}
@media (max-width: 620px) {
  .st-shelf-row { grid-auto-columns: minmax(280px, 91%); }
  .st-collection-grid { grid-template-columns: minmax(0,1fr); gap: 12px; }
  .st-shelf-controls { gap: 0; }
  .st-card.is-compact, .st-card.is-list { grid-template-columns: 52px minmax(0,1fr) auto; gap: 2px 10px; }
  .st-card.is-compact .st-icon-wrap, .st-card.is-list .st-icon-wrap { width: 52px; height: 52px; }
  .st-card.is-compact .st-card-action, .st-card.is-list .st-card-action { padding: 8px 10px; min-width: 54px; }
}

/* Library keeps maintenance controls compact, leaving room for the apps. */
.st-scroll.is-library .st-category-strip { display: flex; flex-wrap: wrap; gap: 8px; }
.st-scroll.is-library .st-chip { flex: 0 0 auto; width: auto; min-height: 44px; padding: 8px 14px; }
.st-scroll.is-library .st-update-all-trigger { width: auto; min-height: 44px; margin-left: auto; padding: 8px 16px; }
.st-scroll.is-library .st-library-health { padding: 14px; margin-bottom: 22px; }
.st-scroll.is-library .st-update-batch-list { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 14px; }
.st-scroll.is-library .st-update-batch-list .st-update-all-trigger {
  margin-left: 0; background: var(--surface); color: var(--text); border-color: var(--border);
}
@media (max-width: 520px) {
  .st-scroll.is-library .st-update-batch-list .st-update-all-trigger { width: 100%; }
}

/* Publish tab: your published apps, one app page, and the agent check. */
.st-publish-heading .st-back-btn { margin-bottom: 10px; }
.st-mine-list { display: flex; flex-direction: column; border: 1px solid var(--border); border-radius: 16px; background: var(--surface); overflow: hidden; margin: 0; padding: 0; list-style: none; }
.st-mine-list > li { border-bottom: 1px solid var(--border); }
.st-mine-list > li:last-child { border-bottom: 0; }
.st-mine-row {
  display: grid; grid-template-columns: 48px minmax(0, 1fr) repeat(2, 112px) 16px; gap: 24px; align-items: center;
  width: 100%; min-height: 104px; padding: 22px 24px; border: 0;
  background: none; color: var(--text); font: inherit; text-align: left; cursor: pointer;
}
.st-mine-row:hover { background: color-mix(in srgb, var(--text) 4%, var(--surface)); }
.st-mine-copy { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.st-mine-copy strong { font-size: 15px; }
.st-mine-status { color: var(--muted); font-size: 13px; }
.st-mine-status.is-accent { color: var(--accent); }
.st-mine-status.is-warning { color: var(--orange, #e8b45a); }
.st-mine-num { display: flex; flex-direction: column; align-items: center; gap: 4px; text-align: center; white-space: nowrap; }
.st-mine-num b { font-size: 22px; line-height: 1.2; font-variant-numeric: tabular-nums; }
.st-mine-num small { color: var(--muted); font-size: 12px; line-height: 16px; min-height: 16px; }
.st-mine-num.is-wide { grid-column: span 2; }
.st-mine-num.is-wide small { white-space: normal; }
.st-mine-chevron { color: var(--muted); }
.st-mine-page { display: flex; flex-direction: column; gap: 6px; }
.st-mine-page > .st-back-btn { align-self: flex-start; }
.st-mine-head { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; margin-top: 8px; }
.st-mine-title { display: flex; flex-direction: column; gap: 4px; margin-right: auto; }
.st-mine-title h2 { margin: 0; font-size: clamp(24px, 4vw, 30px); letter-spacing: -.03em; }
.st-mine-release { display: flex; flex-wrap: wrap; gap: 16px 40px; margin: 18px 0 0; padding: 16px 0; border-bottom: 1px solid var(--border); }
.st-mine-release > div { display: flex; flex-direction: column; gap: 5px; min-width: 140px; }
.st-mine-release dt { color: var(--muted); font-size: 12px; }
.st-mine-release dd { margin: 0; font-size: 14px; font-weight: 600; overflow-wrap: anywhere; }
.st-mine-numbers { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin: 22px 0 8px; }
.st-mine-numbers div { display: flex; flex-direction: column; }
.st-mine-numbers b { font-size: 28px; letter-spacing: -.03em; }
.st-mine-numbers span { color: var(--muted); font-size: 13px; }
.st-mine-section { margin: 20px 0 6px; font-size: 16px; }
.st-mine-reviews { border: 1px solid var(--border); border-radius: 16px; background: var(--surface); }
.st-mine-empty { padding: 20px 18px; color: var(--muted); font-size: 14px; }
.st-mine-review { display: flex; flex-direction: column; gap: 8px; padding: 16px 18px; border-bottom: 1px solid var(--border); }
.st-mine-review:last-child { border-bottom: 0; }
.st-mine-review p { margin: 0; line-height: 1.5; }
.st-mine-review-top { display: flex; align-items: center; gap: 8px; }
.st-mine-stars { display: inline-flex; gap: 2px; color: #f2c14e; }
.st-mine-stars svg { width: 13px; height: 13px; }
.st-check { display: flex; flex-direction: column; gap: 10px; padding: 14px; border: 1px solid var(--border); border-radius: 14px; background: var(--bg); }
.st-check-head { display: flex; gap: 10px; align-items: flex-start; }
.st-check-head strong { display: block; font-size: 14px; }
.st-check-head span { display: block; color: var(--muted); font-size: 12px; line-height: 1.45; margin-top: 2px; }
.st-check-mark { flex: 0 0 auto; display: grid; place-items: center; width: 24px; height: 24px; border-radius: 50%; border: 2px solid var(--border); }
.st-check.is-ready .st-check-mark { border: 0; background: color-mix(in srgb, var(--green) 18%, transparent); color: var(--green); }
.st-check.is-must_fix .st-check-mark { border: 0; background: color-mix(in srgb, var(--red, #f0776a) 18%, transparent); color: var(--red, #f0776a); }
.st-check.is-error .st-check-mark { border: 0; background: color-mix(in srgb, var(--orange, #e8b45a) 18%, transparent); color: var(--orange, #e8b45a); }
.st-check.is-running .st-check-mark { border-color: var(--accent); border-top-color: transparent; animation: st-check-spin .9s linear infinite; }
@keyframes st-check-spin { to { transform: rotate(360deg); } }
.st-check-issues { display: flex; flex-direction: column; gap: 8px; margin: 0; padding: 0; list-style: none; }
.st-check-issues li { padding: 8px 10px; border-radius: 10px; background: var(--surface); font-size: 13px; }
.st-check-issues li.is-must { box-shadow: inset 3px 0 0 var(--red, #f0776a); }
.st-check-issues strong { display: block; }
.st-check-issues summary { cursor: pointer; font-weight: 700; list-style-position: inside; }
.st-check-issues details[open] summary { margin-bottom: 4px; }
.st-check-issues span { display: block; color: var(--muted); margin-top: 2px; }
.st-check-actions { display: flex; flex-wrap: wrap; gap: 8px; }
.st-publish-anyway { display: flex; flex-direction: column; gap: 8px; padding: 14px; border: 1px solid color-mix(in srgb, var(--orange, #e8b45a) 45%, var(--border)); border-radius: 14px; }
.st-publish-anyway strong { font-size: 14px; }
.st-publish-anyway strong:focus { outline: none; }
.st-publish-anyway strong:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; border-radius: 4px; }
.st-publish-result .st-publish-result-warning { color: var(--orange, #e8b45a); }
.st-publish-anyway > span { color: var(--muted); font-size: 13px; line-height: 1.45; }
@media (max-width: 640px) {
  .st-mine-row { grid-template-columns: 44px minmax(0, 1fr) 16px; gap: 16px; padding: 18px; min-height: 88px; }
  .st-mine-num { display: none; }
  .st-mine-head .st-btn { width: 100%; }
}
.st-card-secondary { position: relative; z-index: 2; min-height: 44px; padding: 8px 13px; border: 1px solid var(--border); border-radius: 999px; background: transparent; color: var(--text); font: 650 12px/1.3 var(--font); cursor: pointer; }
.st-card-secondary:hover { background: var(--surface); }
.st-card.is-list .st-card-status-row { flex-direction: row; flex-wrap: wrap; justify-content: flex-end; align-items: center; }
@media (max-width: 640px) { .st-card.is-list .st-card-status-row { justify-content: flex-start; } }
`
