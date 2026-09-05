import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('manager invite flow exposes and propagates the selected role', async () => {
  const [html, admin, api, fn] = await Promise.all([
    read('admin.html'),
    read('admin.js'),
    read('data-api.js'),
    read('supabase/functions/manage-staff/index.ts'),
  ])

  assert.match(html, /name="role"/)
  for (const role of ['admin', 'boss', 'recruiter']) assert.match(html, new RegExp(`value="${role}"`))
  assert.match(html, /value="recruiter"[^>]*selected|selected[^>]*value="recruiter"/)
  assert.match(admin, /inviteStaff\([^)]*values\.role/)
  assert.match(api, /export async function inviteStaff\(name, email, role\)/)
  assert.match(api, /body:\s*\{\s*action:\s*['"]invite['"],\s*name,\s*email,\s*role\s*\}/s)
  assert.match(fn, /allowedRoles\s*=\s*\['admin',\s*'boss',\s*'recruiter'\]/)
  assert.match(fn, /Invalid staff role/)
  assert.match(fn, /role,\s*active:\s*true/)
})

test('manager-only record deletion is server-side and excludes applications', async () => {
  const [api, fn] = await Promise.all([
    read('data-api.js'),
    read('supabase/functions/manage-records/index.ts'),
  ])

  assert.match(api, /export async function deleteOperationalRecord\(type, id\)/)
  assert.match(api, /functions\.invoke\(['"]manage-records['"]/)
  assert.match(fn, /managerRoles\s*=\s*\['admin',\s*'boss'\]/)
  assert.match(fn, /contact_message:\s*['"]contact_messages['"]/)
  assert.match(fn, /business_lead:\s*['"]business_leads['"]/)
  assert.doesNotMatch(fn, /application:\s*['"]applications['"]/)
  assert.match(fn, /\.delete\(\)[\s\S]*\.eq\(['"]id['"],\s*id\)/)
})

test('admin delete controls require permanent-deletion confirmation', async () => {
  const admin = await read('admin.js')
  assert.match(admin, /data-delete-message/)
  assert.match(admin, /data-delete-lead/)
  assert.match(admin, /window\.confirm\([^)]*permanent/i)
  assert.match(admin, /await deleteOperationalRecord\(['"]contact_message['"]/)
  assert.match(admin, /await deleteOperationalRecord\(['"]business_lead['"]/)
})

test('staff realtime notifications are authenticated-only, opt-in and generic', async () => {
  const [module, admin, recruiter, publicApp] = await Promise.all([
    read('staff-notifications.js'),
    read('admin.js'),
    read('recruiter.js'),
    read('app.js'),
  ])

  for (const table of ['applications', 'contact_messages', 'business_leads']) {
    assert.match(module, new RegExp(`event:\\s*['"]INSERT['"][\\s\\S]*table:\\s*['"]${table}['"]`))
  }
  assert.doesNotMatch(module, /payload\.new\.(name|email|phone|message|full_name)/)
  assert.match(module, /Notification\.requestPermission\(\)/)
  assert.match(module, /eworker360\.staffNotifications\.enabled/)
  assert.match(module, /supabase\.removeChannel/)
  assert.match(admin, /staff-notifications\.js/)
  assert.match(recruiter, /staff-notifications\.js/)
  assert.doesNotMatch(publicApp, /staff-notifications\.js/)
})
