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
try {
  let ready = false
  for (let attempt = 0; attempt < 60; attempt++) {
    if (server.exitCode !== null) throw new Error(`Wrangler exited: ${logs}`)
    try {
      ready = (await fetch(origin, { signal: AbortSignal.timeout(1000) })).ok
    } catch {}
    if (ready) break
    await new Promise(resolve => setTimeout(resolve, 500))
  }
  assert.ok(ready, `Wrangler did not start: ${logs}`)
  const allowlist = (await readFile('.assetsignore', 'utf8')).split(/\r?\n/)
    .filter(line => line.startsWith('!/') && !line.endsWith('/'))
    .map(line => line.slice(2))
  let bytes = 0
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
  console.log(`Verified ${allowlist.length} public assets (${bytes} bytes); internal paths return 404.`)
} finally {
  server.kill('SIGTERM')
}
