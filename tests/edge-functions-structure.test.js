import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('function configuration keeps staff management authenticated and notification public', async () => {
  const config = await read('supabase/config.toml')
  assert.match(config, /\[functions\.manage-staff\][\s\S]*verify_jwt\s*=\s*true/)
  assert.match(config, /\[functions\.notify-submission\][\s\S]*verify_jwt\s*=\s*false/)
})

test('manage-staff verifies manager caller before using server-side invite API', async () => {
  const code = await read('supabase/functions/manage-staff/index.ts')
  assert.match(code, /Authorization/)
  assert.match(code, /auth\.getUser/)
  assert.match(code, /\['admin',\s*'boss'\]/)
  assert.match(code, /includes\(callerProfile\?\.role\)/)
  assert.match(code, /active/)
  assert.match(code, /inviteUserByEmail/)
  assert.match(code, /reset-password\.html/)
  assert.match(code, /profiles/)
  assert.match(code, /role:\s*'recruiter'/)
  assert.doesNotMatch(code, /sb_secret_[A-Za-z0-9_-]+/)
})

test('notification function accepts only type and id, fetches server-side, and uses idempotency', async () => {
  const code = await read('supabase/functions/notify-submission/index.ts')
  assert.match(code, /application/)
  assert.match(code, /contact_message/)
  assert.match(code, /business_lead/)
  assert.match(code, /Idempotency-Key/)
  assert.match(code, /RESEND_API_KEY/)
  assert.match(code, /site_settings/)
  assert.doesNotMatch(code, /sb_secret_[A-Za-z0-9_-]+/)
})

test('shared server env helper supports new Supabase secret keys without hardcoding secrets', async () => {
  const code = await read('supabase/functions/_shared/supabase-env.ts')
  assert.match(code, /SUPABASE_SECRET_KEYS/)
  assert.match(code, /SUPABASE_SERVICE_ROLE_KEY/)
  assert.doesNotMatch(code, /sb_secret_[A-Za-z0-9_-]+/)
})
