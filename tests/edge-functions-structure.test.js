import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('function configuration keeps staff management authenticated and notification public', async () => {
  const config = await read('supabase/config.toml')
  assert.match(config, /\[functions\.manage-staff\][\s\S]*verify_jwt\s*=\s*true/)
  assert.match(config, /\[functions\.notify-submission\][\s\S]*verify_jwt\s*=\s*false/)
})

test('manage-staff verifies caller admin before using server-side invite API', async () => {
  const code = await read('supabase/functions/manage-staff/index.ts')
  assert.match(code, /Authorization/)
  assert.match(code, /auth\.getUser/)
  assert.match(code, /role[\s\S]*admin/)
  assert.match(code, /active/)
  assert.match(code, /inviteUserByEmail/)
  assert.match(code, /reset-password\.html/)
  assert.match(code, /profiles/)
  assert.doesNotMatch(code, /sb_secret_[A-Za-z0-9_-]+/)
})

test('notification function fetches server-side and sends through Gmail SMTP', async () => {
  const code = await read('supabase/functions/notify-submission/index.ts')
  assert.match(code, /application/)
  assert.match(code, /contact_message/)
  assert.match(code, /business_lead/)
  assert.match(code, /npm:nodemailer/)
  assert.match(code, /smtp\.gmail\.com/)
  assert.match(code, /port:\s*465/)
  assert.match(code, /secure:\s*true/)
  assert.match(code, /GMAIL_SMTP_USER/)
  assert.match(code, /GMAIL_APP_PASSWORD/)
  assert.match(code, /site_settings/)
  assert.doesNotMatch(code, /RESEND_API_KEY|RESEND_FROM_EMAIL|api\.resend\.com/)
  assert.doesNotMatch(code, /sb_secret_[A-Za-z0-9_-]+/)
})

test('shared server env helper supports new Supabase secret keys without hardcoding secrets', async () => {
  const code = await read('supabase/functions/_shared/supabase-env.ts')
  assert.match(code, /SUPABASE_SECRET_KEYS/)
  assert.match(code, /SUPABASE_SERVICE_ROLE_KEY/)
  assert.doesNotMatch(code, /sb_secret_[A-Za-z0-9_-]+/)
})
