import test from 'node:test'
import assert from 'node:assert/strict'
import { access, readFile } from 'node:fs/promises'
import { constants } from 'node:fs'

const rootUrl = new URL('../', import.meta.url)
const read = (path) => readFile(new URL(path, rootUrl), 'utf8')

async function exists(path) {
  try {
    await access(new URL(path, rootUrl), constants.F_OK)
    return true
  } catch {
    return false
  }
}

test('legacy local demo persistence and auth files are removed', async () => {
  assert.equal(await exists('admin-data.js'), false)
  assert.equal(await exists('staff-auth.js'), false)
})

test('production entrypoints do not store candidate or staff data in localStorage', async () => {
  const paths = ['application.js','app.js','auth.js','admin.js','recruiter.js','data-api.js']
  for (const path of paths) {
    const content = await read(path)
    assert.doesNotMatch(content, /localStorage|EWorkerDemoStore|EWorkerStaffAuth/, `${path} still references local demo persistence`)
  }
})

test('repository browser/server code contains no hardcoded Supabase secret key', async () => {
  const paths = [
    'supabase-config.js','supabase-client.js','auth.js','data-api.js',
    'supabase/functions/manage-staff/index.ts','supabase/functions/notify-submission/index.ts',
    'supabase/functions/_shared/supabase-env.ts',
  ]
  for (const path of paths) {
    const content = await read(path)
    assert.doesNotMatch(content, /sb_secret_[A-Za-z0-9_-]+/, `${path} contains a hardcoded Supabase secret`)
  }
})
