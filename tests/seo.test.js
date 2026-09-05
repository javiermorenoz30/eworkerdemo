import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')
const domain = 'https://eworker360dominicana.com'

const pages = [
  ['es/index.html', 'es-DO', '/es/'],
  ['es/empleos/index.html', 'es-DO', '/es/empleos/'],
  ['es/empleos/call-center/index.html', 'es-DO', '/es/empleos/call-center/'],
  ['es/empleos/servicio-al-cliente/index.html', 'es-DO', '/es/empleos/servicio-al-cliente/'],
  ['es/empleos/la-vega/index.html', 'es-DO', '/es/empleos/la-vega/'],
  ['es/empleos/republica-dominicana/index.html', 'es-DO', '/es/empleos/republica-dominicana/'],
  ['en/index.html', 'en-US', '/en/'],
  ['en/bpo/index.html', 'en-US', '/en/bpo/'],
  ['en/nearshore-outsourcing/index.html', 'en-US', '/en/nearshore-outsourcing/'],
  ['en/customer-service-outsourcing/index.html', 'en-US', '/en/customer-service-outsourcing/'],
  ['en/bpo-united-states/index.html', 'en-US', '/en/bpo-united-states/'],
  ['en/bpo-florida/index.html', 'en-US', '/en/bpo-florida/'],
  ['en/bpo-new-york/index.html', 'en-US', '/en/bpo-new-york/'],
  ['en/bpo-new-jersey/index.html', 'en-US', '/en/bpo-new-jersey/'],
  ['en/bpo-massachusetts/index.html', 'en-US', '/en/bpo-massachusetts/'],
  ['en/bpo-pennsylvania/index.html', 'en-US', '/en/bpo-pennsylvania/'],
]

const employmentPages = pages.filter(([path]) => path.startsWith('es/empleos/')).map(([path]) => path)
const buyerPages = pages.filter(([path]) => path.startsWith('en/') && path !== 'en/index.html').map(([path]) => path)
const statePages = pages.filter(([path]) => /en\/bpo-(florida|new-york|new-jersey|massachusetts|pennsylvania)\/index\.html/.test(path)).map(([path]) => path)

function tagValue(html, tagRegex) {
  return html.match(tagRegex)?.[1]?.trim() || ''
}

const normalize = (html) => html
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

function parseJsonLd(html, path) {
  const blocks = [...html.matchAll(/<script\s+type=["']application\/ld\+json["']>([\s\S]*?)<\/script>/gi)]
  for (const [, source] of blocks) assert.doesNotThrow(() => JSON.parse(source), `${path} contains malformed JSON-LD`)
}

test('Phase 1 SEO pages have unique crawlable metadata and production canonicals', async () => {
  const titles = new Set()
  const descriptions = new Set()
  for (const [path, lang, route] of pages) {
    const html = await read(path)
    assert.match(html, new RegExp(`<html[^>]+lang=["']${lang}["']`))
    assert.match(html, new RegExp(`<link[^>]+rel=["']canonical["'][^>]+href=["']${domain}${route.replaceAll('/', '\\/')}["']`))
    const title = tagValue(html, /<title>([^<]+)<\/title>/i)
    const description = tagValue(html, /<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i)
    assert.ok(title, `${path} needs a title`)
    assert.ok(description, `${path} needs a description`)
    assert.ok(!titles.has(title), `duplicate title: ${title}`)
    assert.ok(!descriptions.has(description), `duplicate description: ${description}`)
    titles.add(title)
    descriptions.add(description)
    assert.match(html, /<h1[\s>]/i)
    parseJsonLd(html, path)
  }
})

test('employment pages target Dominican candidates and link to the existing application flow', async () => {
  const headings = new Set()
  for (const path of employmentPages) {
    const html = await read(path)
    assert.match(html, /href=["']\/application(?:\.html)?["']/i)
    assert.doesNotMatch(html, /employment in (Florida|New York|New Jersey|Massachusetts|Pennsylvania)/i)
    const h1 = tagValue(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i).replace(/<[^>]+>/g, '').trim()
    assert.ok(h1 && !headings.has(h1), `${path} needs a unique H1`)
    headings.add(h1)
  }
})

test('commercial pages focus on BPO buyers and Dominican nearshore context', async () => {
  for (const path of buyerPages) {
    const html = await read(path)
    assert.match(html, /(BPO|nearshore|outsourcing|customer service)/i)
    assert.match(html, /(Dominican Republic|Dominicana)/i)
    assert.doesNotMatch(html, /apply for a job|job vacancy/i)
  }
})

test('priority state pages are materially distinct and link to the national BPO hub', async () => {
  const stateByPath = new Map([
    ['en/bpo-florida/index.html', 'Florida'],
    ['en/bpo-new-york/index.html', 'New York'],
    ['en/bpo-new-jersey/index.html', 'New Jersey'],
    ['en/bpo-massachusetts/index.html', 'Massachusetts'],
    ['en/bpo-pennsylvania/index.html', 'Pennsylvania'],
  ])
  const bodies = []
  for (const path of statePages) {
    const html = await read(path)
    assert.match(html, new RegExp(stateByPath.get(path)))
    assert.match(html, /href=["']\/en\/bpo-united-states\/["']/)
    bodies.push([path, normalize(html)])
  }
  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) {
      assert.notEqual(bodies[i][1], bodies[j][1], `${bodies[i][0]} and ${bodies[j][0]} must not be duplicates`)
    }
  }
})

test('utility and authenticated pages are not intended for indexing', async () => {
  for (const path of ['application.html', 'admin.html', 'recruiter.html', 'staff-login.html', 'reset-password.html']) {
    assert.match(await read(path), /<meta\s+name=["']robots["']\s+content=["']noindex,follow["']/i)
  }
})

test('sitemap contains every canonical Phase 1 public page and excludes utility pages', async () => {
  const sitemap = await read('sitemap.xml')
  for (const [, , route] of pages) assert.match(sitemap, new RegExp(`${domain}${route.replaceAll('/', '\\/')}`))
  for (const route of ['/admin', '/recruiter', '/staff-login', '/reset-password', '/application']) assert.doesNotMatch(sitemap, new RegExp(route))
})

test('language homes expose reciprocal hreflang alternates', async () => {
  const [es, en] = await Promise.all([read('es/index.html'), read('en/index.html')])
  assert.match(es, /hreflang=["']es-DO["'][^>]+href=["']https:\/\/eworker360dominicana\.com\/es\/["']/i)
  assert.match(es, /hreflang=["']en-US["'][^>]+href=["']https:\/\/eworker360dominicana\.com\/en\/["']/i)
  assert.match(en, /hreflang=["']es-DO["'][^>]+href=["']https:\/\/eworker360dominicana\.com\/es\/["']/i)
  assert.match(en, /hreflang=["']en-US["'][^>]+href=["']https:\/\/eworker360dominicana\.com\/en\/["']/i)
})
