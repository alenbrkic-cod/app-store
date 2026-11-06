import assert from 'node:assert/strict'
import test from 'node:test'
import { createRequire } from 'node:module'
import { mkdir, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { JSDOM } from 'jsdom'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'

const here = dirname(fileURLToPath(import.meta.url))
const buildDir = join(here, '.build-listing-editor-runtime')

test('listing editor explains disabled Save for over-limit UTF-8 caption and alt text', async () => {
  const require = createRequire(join(process.env.MOBIUS_FRONTEND_NODE_MODULES, 'package.json'))
  const { rolldown } = await import(pathToFileURL(require.resolve('rolldown')).href)
  await mkdir(buildDir, { recursive: true })
  const build = await rolldown({
    input: join(here, '..', 'ui', 'ListingEditor.jsx'), platform: 'node', tsconfig: false,
    external: ['react', 'react/jsx-runtime'],
    resolve: { alias: { '@openai/apps-sdk-ui/components/Icon': join(here, 'runtime-icon-stub.mjs') } },
    transform: { jsx: 'react-jsx' },
  })
  const output = join(buildDir, 'editor.mjs')
  await build.write({ file: output, format: 'es' })
  await build.close()
  const { ListingEditor } = await import(pathToFileURL(output).href)
  const dom = new JSDOM('<div id="root"></div>')
  const keys = ['window', 'document', 'HTMLElement', 'IS_REACT_ACT_ENVIRONMENT']
  const old = Object.fromEntries(keys.map(key => [key, globalThis[key]]))
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, IS_REACT_ACT_ENVIRONMENT: true })
  const root = createRoot(dom.window.document.getElementById('root'))
  const draft = { tagline: 'A tagline', description: 'A description', icon: null, hero: null }
  let saves = 0
  async function render(alt, label) {
    await act(async () => root.render(React.createElement(ListingEditor, {
      draft: { ...draft, screenshots: [{ key: 'shot', url: '/shot.png', alt, label }] },
      dirty: true, app: { name: 'Example' }, setDraft() {}, onSave() { saves++ },
    })))
  }
  try {
    for (const [field, max, other] of [['caption', 120, 'What it shows'], ['what it shows', 300, 'Caption']]) {
      const value = 'é'.repeat(max / 2 + 1)
      await render(field === 'caption' ? other : value, field === 'caption' ? value : other)
      const input = dom.window.document.querySelector(`input[aria-label="Screenshot 1: ${field}"]`)
      const counter = dom.window.document.getElementById(input.getAttribute('aria-describedby'))
      assert.ok(counter, `${field} has a visible, accessible byte-limit reason`)
      assert.equal(counter.textContent, `${max + 2}/${max} bytes`)
      assert.ok(counter.classList.contains('is-over'))
      assert.equal(input.getAttribute('aria-invalid'), 'true')
      assert.equal(input.maxLength, -1, 'byte constraints must not silently truncate accepted characters')
      assert.equal(dom.window.document.querySelector('button[type="submit"]').disabled, true)
      await render(field === 'caption' ? other : `  ${value.slice(1)} `, field === 'caption' ? `  ${value.slice(1)} ` : other)
      assert.equal(dom.window.document.querySelector('button[type="submit"]').disabled, false, 'trimmed values at the byte boundary can be saved')
      await act(async () => dom.window.document.querySelector('button[type="submit"]').click())
    }
    assert.equal(saves, 2)
  } finally {
    await act(async () => root.unmount())
    dom.window.close()
    Object.assign(globalThis, old)
    await rm(buildDir, { recursive: true, force: true })
  }
})

test('the license picker offers each free license and records the choice', async () => {
  const require = createRequire(join(process.env.MOBIUS_FRONTEND_NODE_MODULES, 'package.json'))
  const { rolldown } = await import(pathToFileURL(require.resolve('rolldown')).href)
  const dir = `${buildDir}-license`
  await mkdir(dir, { recursive: true })
  const build = await rolldown({
    input: join(here, '..', 'ui', 'ListingEditor.jsx'), platform: 'node', tsconfig: false,
    external: ['react', 'react/jsx-runtime'],
    resolve: { alias: { '@openai/apps-sdk-ui/components/Icon': join(here, 'runtime-icon-stub.mjs') } },
    transform: { jsx: 'react-jsx' },
  })
  const output = join(dir, 'editor.mjs')
  await build.write({ file: output, format: 'es' })
  await build.close()
  const { ListingEditor } = await import(pathToFileURL(output).href)
  const dom = new JSDOM('<div id="root"></div>')
  const keys = ['window', 'document', 'HTMLElement', 'IS_REACT_ACT_ENVIRONMENT']
  const old = Object.fromEntries(keys.map(key => [key, globalThis[key]]))
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, IS_REACT_ACT_ENVIRONMENT: true })
  const root = createRoot(dom.window.document.getElementById('root'))
  let draft = { tagline: 'T', description: 'D', icon: null, hero: null, screenshots: [], license: '' }
  const render = () => act(async () => root.render(React.createElement(ListingEditor, {
    draft, dirty: true, app: { name: 'Example' }, onSave() {},
    setDraft(change) { draft = typeof change === 'function' ? change(draft) : change },
  })))
  try {
    await render()
    const doc = dom.window.document
    const radios = [...doc.querySelectorAll('.st-edit-license input[type="radio"]')]
    assert.deepEqual(radios.map((radio) => radio.value), ['MIT', 'Apache-2.0', 'GPL-3.0-or-later'])
    assert.ok(radios.every((radio) => !radio.checked))
    assert.match(doc.querySelector('.st-edit-license').textContent, /Pick a license to publish/)
    await act(async () => radios[1].click())
    assert.equal(draft.license, 'Apache-2.0')
    await render()
    assert.equal(doc.querySelector('.st-edit-license input[value="Apache-2.0"]').checked, true)
    assert.doesNotMatch(doc.querySelector('.st-edit-license').textContent, /Pick a license to publish/)
    // A Möbius that does not require a license yet gets no picker.
    draft = { ...draft, license: null }
    await render()
    assert.equal(doc.querySelector('.st-edit-license'), null)
  } finally {
    await act(async () => root.unmount())
    dom.window.close()
    Object.assign(globalThis, old)
    await rm(dir, { recursive: true, force: true })
  }
})
