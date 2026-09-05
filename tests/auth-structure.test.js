import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('Supabase browser config contains only public credentials', async () => {
  const config = await read('supabase-config.js')
  assert.match(config, /https:\/\/zyghqdnjfiulkfyhtztc\.supabase\.co/)
  assert.match(config, /sb_publishable_/)
  assert.doesNotMatch(config, /service_role|sb_secret_/i)
})

test('auth module uses Supabase password auth and profile authorization', async () => {
  const auth = await read('auth.js')
  assert.match(auth, /signInWithPassword/)
  assert.match(auth, /from\(['"]profiles['"]\)/)
  assert.match(auth, /resetPasswordForEmail/)
  assert.match(auth, /signOut/)
})

test('staff login no longer references local access-code auth', async () => {
  const html = await read('staff-login.html')
  assert.match(html, /name="password"/)
  assert.doesNotMatch(html, /accessCode/)
  assert.doesNotMatch(html, /admin-data\.js/)
  assert.doesNotMatch(html, /staff-auth\.js/)
})

test('password setup page updates the authenticated Supabase user', async () => {
  const html = await read('reset-password.html')
  const js = await read('reset-password.js')
  assert.match(html, /reset-password-form/)
  assert.match(js, /updateUser/)
  assert.match(js, /password/)
})
