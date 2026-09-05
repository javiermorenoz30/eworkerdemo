import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('public landing keeps static fallback and boots published content before app behaviors', async () => {
  const html = await read('index.html')
  const bootstrap = await read('landing-bootstrap.js')
  const app = await read('app.js')

  assert.match(html, /<main>/)
  assert.match(html, /class="hero"/)
  assert.match(html, /id="contact-form"/)
  assert.match(html, /<script type="module" src="app\.js\?v=supabase-1"><\/script>/)
  assert.match(bootstrap, /getPublishedLanding/)
  assert.match(bootstrap, /renderLanding/)
  assert.match(bootstrap, /document\.querySelector\(['"]main['"]\)/)
  assert.match(bootstrap, /catch/)
  assert.match(app, /import \{ bootPublishedLanding \} from ['"]\.\/landing-bootstrap\.js['"]/)
  assert.match(app, /await bootPublishedLanding\(\)/)
})

test('renderer supports every editable landing template without executable content passthrough', async () => {
  const renderer = await read('landing-renderer.js')
  for (const type of ['hero','metrics','cards','text_image','routes','jobs','gallery','testimonials','cta','contact','faq']) {
    assert.match(renderer, new RegExp(`['"]${type}['"]`), `missing renderer for ${type}`)
  }
  assert.match(renderer, /document\.createElement/)
  assert.match(renderer, /textContent/)
  assert.match(renderer, /dataset\.es/)
  assert.match(renderer, /dataset\.en/)
  assert.doesNotMatch(renderer, /\beval\s*\(|new Function|root\.innerHTML\s*=\s*section\.content/)
})

test('renderer preserves current public CSS and JavaScript hooks', async () => {
  const renderer = await read('landing-renderer.js')
  for (const contract of [
    'hero', 'metrics', 'split-section', 'services', 'service-grid', 'business-section', 'culture',
    'objectives', 'vacantes', 'job-list', 'job-search', 'employment', 'contact', 'contact-form', 'faq', 'news',
  ]) {
    assert.match(renderer, new RegExp(contract), `missing public contract ${contract}`)
  }
})

test('app behaviors tolerate sections that Boss/Admin hide or delete', async () => {
  const app = await read('app.js')
  assert.match(app, /jobSearch\?\.addEventListener/)
  assert.match(app, /if \(contactForm\)|contactForm\?\.addEventListener/)
  assert.match(app, /if \(employmentForm\)/)
})
