import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'
import { parseHTML } from 'linkedom'
import * as content from '../landing-content.js'

const source = (await readFile(new URL('../landing-editor.js', import.meta.url), 'utf8'))
  .replace(/import \{[\s\S]*?\} from '[^']+'\s*/g, '')
  .replace('export async function', 'async function')
const tick = () => new Promise((resolve) => setImmediate(resolve))
const draft = () => ({ sections: [content.createSection('hero', 'hero-1'), content.createSection('faq', 'faq-1')] })

function mount({ load = async () => draft(), save = async () => {} } = {}) {
  const { document, window } = parseHTML('<html><head></head><body><div id="content"></div></body></html>')
  const context = vm.createContext({
    ...content, document, window, structuredClone, crypto,
    getDraftLanding: load, saveDraft: save, publishDraft: async () => {},
    publicLandingImageUrl: (path) => path,
    removeLandingImage: async () => ({ removed: true }),
    uploadLandingImage: async () => { throw new Error('Unexpected upload') },
  })
  vm.runInContext(source, context)
  const ready = context.initLandingEditor()
  const find = (selector) => {
    const node = document.querySelector(selector)
    assert.ok(node, `Missing ${selector}`)
    return node
  }
  const click = (selector) => {
    const node = find(selector)
    assert.equal(Boolean(node.disabled), false, `${selector} must be enabled`)
    node.dispatchEvent(new window.Event('click', { bubbles: true }))
  }
  return { ready, find, click, document, window }
}

test('successful nonempty draft load unlocks save, preview, publish and add controls', async () => {
  const ui = mount()
  assert.equal(ui.find('#landing-save').disabled, true)
  await ui.ready
  assert.equal(ui.find('.landing-section-card').draggable, true)
  for (const id of ['landing-save', 'landing-preview', 'landing-publish', 'landing-add', 'landing-template-select']) {
    assert.equal(Boolean(ui.find(`#${id}`).disabled), false, `${id} stayed locked after load`)
  }
  ui.click('[data-section-action="edit"]')
  assert.equal(ui.find('.landing-section-editor').hidden, false)
  assert.equal(ui.find('[data-section-action="move-up"]').disabled, true)
  assert.equal(Boolean(ui.find('[data-section-action="move-down"]').disabled), false)
})

test('edit Spanish and English content, save, then continue editing', async () => {
  const saved = []
  let finishSave
  const ui = mount({ save: (sections) => { saved.push(structuredClone(sections)); return new Promise((resolve) => { finishSave = resolve }) } })
  await ui.ready
  ui.click('[data-section-action="edit"]')
  for (const [locale, value] of [['es', 'Nuevo título'], ['en', 'New title']]) {
    ui.click(`[data-section-locale="${locale}"]`)
    const input = [...ui.document.querySelectorAll('[data-field-path]')].find((node) => node.dataset.fieldPath === JSON.stringify(['title', locale]))
    assert.ok(input)
    input.setCustomValidity = () => {}
    input.value = value
    input.dispatchEvent(new ui.window.Event('input', { bubbles: true }))
  }
  ui.click('#landing-save')
  assert.equal(ui.find('#landing-save').disabled, true)
  assert.equal(ui.find('[data-section-action="edit"]').disabled, true)
  assert.equal(ui.find('.landing-section-card').draggable, false)
  assert.deepEqual(saved[0][0].content.title, { es: 'Nuevo título', en: 'New title' })
  finishSave()
  await tick()
  ui.click('[data-section-action="edit"]')
  assert.equal(ui.find('.landing-section-editor').hidden, true)
  assert.equal(Boolean(ui.find('#landing-save').disabled), false)
  assert.equal(ui.find('.landing-section-card').draggable, true)
})

test('empty draft can add its first section and save it', async () => {
  let saved
  const ui = mount({ load: async () => ({ sections: [] }), save: async (sections) => { saved = sections } })
  await ui.ready
  ui.find('#landing-template-select').querySelector('option').selected = true
  ui.click('#landing-add')
  assert.equal(ui.find('.landing-section-editor').hidden, false)
  ui.click('#landing-save')
  await tick()
  assert.equal(saved.length, 1)
  assert.equal(saved[0].type, 'hero')
  assert.equal(Boolean(ui.find('#landing-add').disabled), false)
})

test('failed save unlocks controls and preserves content for retry', async () => {
  let attempts = 0
  const ui = mount({ save: async () => {
    attempts += 1
    if (attempts === 1) throw new Error('Save unavailable')
  } })
  await ui.ready
  ui.click('#landing-save')
  await tick()
  assert.match(ui.find('#landing-editor-note').textContent, /Save unavailable/)
  assert.equal(ui.find('.landing-section-card').draggable, true)
  assert.equal(ui.find('[data-section-action="move-up"]').disabled, true)
  ui.click('[data-section-action="edit"]')
  assert.equal(ui.find('.landing-section-editor').hidden, false)
  ui.click('#landing-save')
  await tick()
  assert.equal(attempts, 2)
  assert.equal(Boolean(ui.find('#landing-save').disabled), false)
})

test('failed initial load keeps destructive actions unavailable', async () => {
  let saves = 0
  const ui = mount({ load: async () => { throw new Error('Draft access denied') }, save: async () => { saves += 1 } })
  await ui.ready
  for (const id of ['landing-save', 'landing-preview', 'landing-publish', 'landing-add']) {
    assert.equal(ui.find(`#${id}`).disabled, true)
  }
  ui.find('#landing-save').dispatchEvent(new ui.window.Event('click'))
  await tick()
  assert.equal(saves, 0)
  assert.match(ui.find('#landing-editor-note').textContent, /Draft access denied/)
})
