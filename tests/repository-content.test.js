import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'
import { parseHTML } from 'linkedom'
import ignore from 'ignore'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('dashboard exposes operational sections without a content editor', async () => {
  const { document } = parseHTML(await read('admin.html'))
  assert.deepEqual([...document.querySelectorAll('[data-view]')].map((node) => node.dataset.view),
    ['overview', 'applications', 'messages', 'leads', 'settings', 'team'])
  assert.equal(document.getElementById('content'), null)
  assert.equal(document.getElementById('content-form'), null)
  assert.ok(document.getElementById('settings-form'))
  assert.ok(document.getElementById('staff-form'))
  assert.equal(document.querySelector('.notice'), null)
  assert.equal(document.querySelector('.readiness'), null)
})

for (const readyState of ['complete', 'loading']) {
  test(`public page starts from repository HTML without fetching CMS (${readyState})`, async () => {
    const { document } = parseHTML(await read('index.html'))
    const original = document.querySelector('main').innerHTML
    document.readyState = readyState
    let scheduled = 0
    const listeners = new Map()
    const window = {
      location: { search: '?preview=draft' },
      requestIdleCallback: () => { scheduled += 1 },
      addEventListener: (name, handler) => listeners.set(name, handler),
    }
    const script = new vm.Script(await read('app.js'), {
      importModuleDynamically: () => { throw new Error('Page startup must not request CMS modules') },
    })
    await script.runInNewContext({ document, window })
    if (readyState === 'loading') {
      assert.equal(scheduled, 0)
      listeners.get('load')()
    }
    assert.equal(scheduled, 1)
    assert.equal(document.querySelector('main').innerHTML, original)
    assert.equal(document.querySelector('.landing-preview-banner'), null)
  })
}

test('CMS modules are excluded from the published asset package', async () => {
  const assets = ignore().add(await read('.assetsignore'))
  for (const file of ['landing-editor.js', 'landing-bootstrap.js', 'landing-api.js', 'landing-content.js', 'landing-renderer.js']) {
    assert.equal(assets.ignores(file), true, `${file} must not be published`)
  }
  for (const file of ['admin.js', 'app.js', 'data-api.js', 'auth.js']) {
    assert.equal(assets.ignores(file), false, `${file} must remain available`)
  }
})
