// Exercise Wrangler's real asset routing, including its .assetsignore parser.
import { spawn } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'

const server = spawn(process.execPath, ['node_modules/wrangler/bin/wrangler.js', 'dev', '--ip', '127.0.0.1', '--port', '8787'], {
  env: { ...process.env, WRANGLER_SEND_METRICS: 'false' },
  stdio: ['ignore', 'pipe', 'pipe'],
})
let logs = ''
server.stdout.on('data', data => { logs += data })
server.stderr.on('data', data => { logs += data })
const origin = 'http://127.0.0.1:8787'

const cleanRoutes = new Map([
  ['/es/', 'es/index.html'],
  ['/en/', 'en/index.html'],
  ['/es/empleos/', 'es/empleos/index.html'],
  ['/es/empleos/call-center/', 'es/empleos/call-center/index.html'],
  ['/es/empleos/servicio-al-cliente/', 'es/empleos/servicio-al-cliente/index.html'],
  ['/es/empleos/la-vega/', 'es/empleos/la-vega/index.html'],
  ['/es/empleos/republica-dominicana/', 'es/empleos/republica-dominicana/index.html'],
  ['/en/bpo/', 'en/bpo/index.html'],
  ['/en/nearshore-outsourcing/', 'en/nearshore-outsourcing/index.html'],
  ['/en/customer-service-outsourcing/', 'en/customer-service-outsourcing/index.html'],
  ['/en/bpo-united-states/', 'en/bpo-united-states/index.html'],
  ['/en/bpo-florida/', 'en/bpo-florida/index.html'],
  ['/en/bpo-new-york/', 'en/bpo-new-york/index.html'],
  ['/en/bpo-new-jersey/', 'en/bpo-new-jersey/index.html'],
  ['/en/bpo-massachusetts/', 'en/bpo-massachusetts/index.html'],
  ['/en/bpo-pennsylvania/', 'en/bpo-pennsylvania/index.html'],
])

try {
  let ready = false
  for (let attempt = 0; attempt < 60; attempt++) {
    if (server.exitCode !== null) throw new Error(`Wrangler exited: ${logs}`)
    try {
      ready = (await fetch(`${origin}/es/`, { signal: AbortSignal.timeout(1000) })).ok
    } catch {}
    if (ready) break
    await new Promise(resolve => setTimeout(resolve, 500))
  }
  assert.ok(ready, `Wrangler did not start: ${logs}`)

  const root = await fetch(`${origin}/`, { redirect: 'manual' })
  assert.equal(root.status, 301, 'root must redirect permanently to Spanish')
  assert.equal(root.headers.get('location'), '/es/')

  const allowlist = (await readFile('.assetsignore', 'utf8')).split(/\r?\n/)
    .filter(line => line.startsWith('!/') && !line.endsWith('/'))
    .map(line => line.slice(2))
  let bytes = 0

  for (const page of ['admin', 'recruiter', 'staff-login', 'reset-password', 'application', 'faq', 'privacy', 'terms']) {
    for (const suffix of ['', '/']) {
      const response = await fetch(`${origin}/${page}${suffix}?route_check=1`)
      assert.equal(response.status, 200, `${page}${suffix} must resolve`)
      assert.equal(new URL(response.url).pathname, `/${page}.html`)
      assert.equal(new URL(response.url).searchParams.get('route_check'), '1')
      assert.deepEqual(Buffer.from(await response.arrayBuffer()), await readFile(`${page}.html`))
    }
  }

  for (const [route, sourcePath] of cleanRoutes) {
    for (const urlPath of [route, route.endsWith('/') ? route.slice(0, -1) : route]) {
      const response = await fetch(`${origin}${urlPath}?route_check=1`)
      assert.equal(response.status, 200, `${urlPath} must resolve`)
      assert.equal(new URL(response.url).searchParams.get('route_check'), '1')
      assert.deepEqual(Buffer.from(await response.arrayBuffer()), await readFile(sourcePath), `${urlPath} must serve ${sourcePath}`)
    }
  }

  for (const path of allowlist.filter(path => path !== '_redirects')) {
    const response = await fetch(`${origin}/${path}`)
    assert.equal(response.status, 200, path)
    const source = await readFile(path)
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), source, `${path} changed during serving`)
    bytes += source.length
  }

  for (const path of ['node_modules/workerd/bin/workerd', '.git/config', '.github/workflows/tests.yml', 'tests/domain.test.js', 'docs/superpowers/specs/2026-09-04-supabase-production-backend-design.md', 'supabase/config.toml', 'README.md', 'package.json', 'package-lock.json', 'wrangler.jsonc', '.assetsignore', '.env', 'missing-page.html']) {
    const response = await fetch(`${origin}/${path}`)
    assert.equal(response.status, 404, `${path} must not be served`)
  }
  console.log(`Verified ${allowlist.length} public assets (${bytes} bytes); ${cleanRoutes.size} SEO routes resolve; internal paths return 404.`)
} finally {
  server.kill('SIGTERM')
}
