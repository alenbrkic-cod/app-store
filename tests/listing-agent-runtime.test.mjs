import assert from 'node:assert/strict'
import test, { mock } from 'node:test'
import { createRequire } from 'node:module'
import { mkdir, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { JSDOM } from 'jsdom'
import React, { act } from 'react'

const here = dirname(fileURLToPath(import.meta.url))
const buildDir = join(here, '.build-listing-agent')

async function loadPublisherTab() {
  const require = createRequire(join(process.env.MOBIUS_FRONTEND_NODE_MODULES, 'package.json'))
  const { rolldown } = await import(pathToFileURL(require.resolve('rolldown')).href)
  await mkdir(buildDir, { recursive: true })
  const build = await rolldown({ input: join(here, '..', 'ui', 'PublisherTab.jsx'), platform: 'node', tsconfig: false,
    external: ['react', 'react/jsx-runtime'],
    resolve: { alias: { '@openai/apps-sdk-ui/components/Icon': join(here, 'runtime-icon-stub.mjs') } },
    transform: { jsx: 'react-jsx' } })
  const output = join(buildDir, 'publisher.mjs')
  await build.write({ file: output, format: 'es' }); await build.close()
  return (await import(pathToFileURL(output).href)).PublisherTab
}

const checklist = (done) => ['description', 'screenshots', 'license'].map((id) => ({
  id, label: id[0].toUpperCase() + id.slice(1), done: done.includes(id), message: done.includes(id) ? '' : `Add ${id}`,
}))

test('one agent works the listing: rows lock, its parts fill the form, the owner’s edits stay', async () => {
  const PublisherTab = await loadPublisherTab()
  const dom = new JSDOM('<div id="root"></div>')
  const keys = ['window', 'document', 'HTMLElement', 'IS_REACT_ACT_ENVIRONMENT']
  const old = Object.fromEntries(keys.map(key => [key, globalThis[key]]))
  Object.assign(globalThis, { window: dom.window, document: dom.window.document,
    HTMLElement: dom.window.HTMLElement, IS_REACT_ACT_ENVIRONMENT: true })
  // Loaded after the document exists, so React listens for real typing.
  const { createRoot } = await import('react-dom/client')
  mock.timers.enable({ apis: ['setInterval'] })
  const root = createRoot(dom.window.document.getElementById('root'))
  const doc = dom.window.document
  const app = { id: 7, name: 'Scorekeeper', slug: 'scorekeeper', source_dir: '/data/apps/scorekeeper' }
  const requests = []
  const opened = []
  let status = null
  let preview = { ready: false, accepted_commit: 'a'.repeat(40),
    draft: { tagline: 'Keep score.', description: '', screenshots: [] }, checklist: checklist([]) }
  const buttons = (label) => [...doc.querySelectorAll('button')].filter(b => b.textContent.trim() === label)
  async function click(label) {
    const [button] = buttons(label)
    assert.ok(button, label)
    await act(async () => button.click())
  }
  async function poll() {
    await act(async () => {
      mock.timers.tick(5000)
      for (let i = 0; i < 20; i += 1) await Promise.resolve()
    })
  }
  const tagline = () => doc.querySelector('.st-edit-field > input')
  try {
    await act(async () => root.render(React.createElement(PublisherTab, {
      installed: [app], identity: { linked: true }, viewer: { github: { connected: true, login: 'owner' } },
      onRefreshPublicationStates() {},
      onListingAgent: async (...args) => { requests.push(args); status = { id: 'c1', running: true }; return { chatId: 'c1' } },
      onListingAgentStatus: async () => status,
      onOpenChat: (id) => opened.push(id),
      onPreviewLocal: async () => preview,
    })))
    await click('Publish an app')
    await click('Prepare listing')
    assert.equal(buttons('Ask an agent').length, 3)

    await click('Ask an agent')
    assert.equal(requests[0][2], 'description')
    assert.equal(buttons('Ask an agent').length, 2, 'the part being worked on cannot be asked for twice')
    assert.equal(buttons('Agent working…').length, 1)
    await click('Agent working…')
    assert.deepEqual(opened, ['c1'], 'its row opens the agent’s chat')
    assert.equal(buttons('Do the rest too').length, 1)

    // The owner keeps editing while the agent works.
    await act(async () => {
      const input = tagline()
      Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set.call(input, 'My tagline')
      input.dispatchEvent(new dom.window.Event('input', { bubbles: true }))
    })
    assert.equal(tagline().value, 'My tagline')
    assert.match(doc.body.textContent, /Saving updates the app’s source/, 'the edit is unsaved')

    // The agent applies the description (and its own tagline idea).
    preview = { ...preview, accepted_commit: 'b'.repeat(40),
      draft: { tagline: 'Agent tagline', description: 'A tiny score keeper.', screenshots: [] },
      checklist: checklist(['description']) }
    const editorBefore = doc.querySelector('.st-listing-editor')
    await poll()
    assert.equal(doc.querySelector('.st-listing-editor textarea').value, 'A tiny score keeper.', 'filled in without copy and paste')
    assert.equal(tagline().value, 'My tagline', 'the owner’s edit is never overwritten')
    assert.equal(doc.querySelector('.st-listing-editor'), editorBefore, 'the form is not remounted under the owner')
    assert.match(doc.querySelector('.st-agent-conflicts').textContent, /The agent wrote a new tagline/)
    assert.match(doc.querySelector('.st-agent-conflicts').textContent, /Agent tagline/)
    assert.equal(buttons('Agent working…').length, 0, 'a finished part shows done, not working')

    await click('Use the agent’s')
    assert.equal(tagline().value, 'Agent tagline')
    assert.equal(doc.querySelector('.st-agent-conflicts'), null)

    // Another part goes to the same agent.
    await click('Ask an agent')
    assert.equal(requests.length, 2)
    assert.equal(requests[1][2], 'screenshots')
    assert.equal(buttons('Agent working…').length, 1)

    // It finishes: two quiet polls end the working state.
    status = { id: 'c1', running: false, awaitingOwner: false }
    await poll()
    assert.equal(buttons('View agent work').length, 1)
    await poll()
    assert.equal(buttons('View agent work').length, 0)
    assert.equal(buttons('Do it all with an agent').length, 1)
    assert.equal(buttons('Ask an agent').length, 2)
  } finally {
    mock.timers.reset()
    await act(async () => root.unmount()); dom.window.close(); Object.assign(globalThis, old)
    await rm(buildDir, { recursive: true, force: true })
  }
})
