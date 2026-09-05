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
  assert.match(html, /<script src="app\.js\?v=application-inbox-1" defer><\/script>/)
  assert.match(bootstrap, /getPublishedLanding/)
  assert.match(bootstrap, /renderLanding/)
  assert.match(bootstrap, /document\.querySelector\(['"]main['"]\)/)
  assert.match(bootstrap, /catch/)
  assert.match(app, /await import\(['"]\.\/landing-bootstrap\.js['"]\)/)
  assert.match(app, /await bootPublishedLanding\(\)/)
})

test('renderer supports every editable landing template without executable content passthrough', async () => {
  const renderer = await read('landing-renderer.js')
  const rendererNames = {
    hero: 'renderHero', metrics: 'renderMetrics', cards: 'renderCards', text_image: 'renderTextImage', routes: 'renderRoutes',
    jobs: 'renderJobs', gallery: 'renderGallery', testimonials: 'renderTestimonials', cta: 'renderCta', contact: 'renderContact', faq: 'renderFaq',
  }
  for (const [type, fn] of Object.entries(rendererNames)) {
    assert.match(renderer, new RegExp(`${type}:\\s*${fn}`), `missing renderer for ${type}`)
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

test('general Texto + imagen uses its own image layout instead of the business process layout', async () => {
  const renderer = await read('landing-renderer.js')
  assert.match(renderer, /function renderGeneralTextImage\b/)
  assert.match(renderer, /if \(content\.variant === ['"]business['"]\) return renderBusiness/)
  assert.match(renderer, /return renderGeneralTextImage\(content, locale\)/)
})

test('editable links are normalized through a safe href helper', async () => {
  const renderer = await read('landing-renderer.js')
  assert.match(renderer, /function safeHref\b/)
  assert.match(renderer, /javascript:/i)
  assert.match(renderer, /safeHref\(link\?\.href/)
})

test('localized image descriptions survive language switching', async () => {
  const renderer = await read('landing-renderer.js')
  const app = await read('app.js')
  assert.match(renderer, /dataset\.altEs/)
  assert.match(renderer, /dataset\.altEn/)
  assert.match(app, /\[data-alt-es\]/)
})

test('draft preview never falls back to the public static page when draft is empty or fails', async () => {
  const bootstrap = await read('landing-bootstrap.js')
  assert.match(bootstrap, /function showDraftPreviewState[\s\S]*root\.replaceChildren\(panel\)/)
  assert.match(bootstrap, /if \(preview && !sections\.length\)[\s\S]*showDraftPreviewState/)
  assert.match(bootstrap, /if \(preview\)[\s\S]*No pudimos cargar la vista previa del borrador/)
})

test('contact submission keeps the current main persistence flow', async () => {
  const app = await read('app.js')
  assert.match(app, /await import\(['"]\.\/data-api\.js['"]\)/)
  assert.match(app, /submitBusinessLead/)
  assert.match(app, /submitContactMessage/)
  assert.match(app, /notifySubmission\(notificationType, id\)/)
  assert.match(app, /audienceInput\.value = ['"]Empresa['"]/)
})
