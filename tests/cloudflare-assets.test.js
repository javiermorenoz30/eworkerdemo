import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir, stat } from 'node:fs/promises'
import ignore from 'ignore'

const root = new URL('../', import.meta.url)
const read = (path) => readFile(new URL(path, root), 'utf8')

test('Cloudflare excludes development files and unknown files by default', async () => {
  const filter = ignore().add(await read('.assetsignore'))
  for (const path of ['node_modules/workerd/bin/workerd', '.git/config', '.github/workflows/tests.yml', 'tests/domain.test.js', 'docs/private.txt', 'supabase/config.toml', 'package.json', 'package-lock.json', 'wrangler.jsonc', '.env', '.dev.vars', 'backup.sql', 'new-script.js', 'assets/private.json']) {
    assert.equal(filter.ignores(path), true, `${path} must not be published`)
  }
  for (const path of ['index.html', 'application.html', 'admin.html', 'staff-login.html', 'reset-password.html', 'supabase-config.js', 'supabase-client.js', 'data-api.js', 'assets/logoewrker.png']) {
    assert.equal(filter.ignores(path), false, `${path} must be published`)
  }
})

test('all existing frontend files are published below the asset size limit', async () => {
  const filter = ignore().add(await read('.assetsignore'))
  const paths = (await readdir(root)).filter(path => /\.(html|css|js|xml|txt)$/.test(path))
  paths.push(...(await readdir(new URL('assets/', root))).filter(path => !path.startsWith('.')).map(path => `assets/${path}`))
  for (const path of paths) {
    assert.equal(filter.ignores(path), false, `${path} is missing from publication`)
    assert.ok((await stat(new URL(path, root))).size <= 25 * 1024 * 1024, `${path} exceeds 25 MiB`)
  }
})
