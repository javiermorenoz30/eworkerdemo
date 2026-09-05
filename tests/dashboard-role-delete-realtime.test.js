import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('manager invite flow exposes and propagates the selected role', async () => {
  const [enhancement, auth, api, fn] = await Promise.all([
    read('admin-manager-actions.js'),
    read('auth.js'),
    read('data-api.js'),
    read('supabase/functions/manage-staff/index.ts'),
  ])

  for (const role of ['admin', 'boss', 'recruiter']) assert.match(enhancement, new RegExp(`value="${role}"`))
  assert.match(enhancement, /value="recruiter" selected/)
  assert.match(enhancement, /inviteStaff\([\s\S]*values\.role/)
  assert.match(auth, /import\(['"]\.\/admin-manager-actions\.js['"]\)/)
  assert.match(api, /export async function inviteStaff\(name, email, role\)/)
  assert.match(api, /body:\s*\{\s*action:\s*['"]invite['"],\s*name,\s*email,\s*role\s*\}/s)
  assert.match(fn, /allowedRoles\s*=\s*\['admin',\s*'boss',\s*'recruiter'\]/)
  assert.match(fn, /Invalid staff role/)
  assert.match(fn, /role,\s*active:\s*true/)
  assert.match(fn, /https:\/\/eworkerdemo\.zencontroller\.workers\.dev\/reset-password\.html/)
})

test('manager-only record deletion is server-side and excludes applications', async () => {
  const [api, fn, migration] = await Promise.all([
    read('data-api.js'),
    read('supabase/functions/manage-records/index.ts'),
    read('supabase/migrations/2026090503_manager_record_delete.sql'),
  ])

  assert.match(api, /export async function deleteOperationalRecord\(type, id\)/)
  assert.match(api, /functions\.invoke\(['"]manage-records['"]/)
  assert.match(fn, /managerRoles\s*=\s*\['admin',\s*'boss'\]/)
  assert.match(fn, /contact_message:\s*['"]contact_messages['"]/)
  assert.match(fn, /business_lead:\s*['"]business_leads['"]/)
  assert.doesNotMatch(fn, /application:\s*['"]applications['"]/)
  assert.match(fn, /\.delete\(\)[\s\S]*\.eq\(['"]id['"],\s*id\)/)
  assert.match(migration, /revoke delete on public\.contact_messages from anon, authenticated/i)
  assert.match(migration, /revoke delete on public\.business_leads from anon, authenticated/i)
})

test('admin delete controls require permanent-deletion confirmation', async () => {
  const enhancement = await read('admin-manager-actions.js')
  assert.match(enhancement, /button\.dataset\.managerDeleteType/)
  assert.match(enhancement, /contact_message/)
  assert.match(enhancement, /business_lead/)
  assert.match(enhancement, /window\.confirm\([^)]*permanent/i)
  assert.match(enhancement, /await deleteOperationalRecord\(type, id\)/)
  assert.doesNotMatch(enhancement, /applications[^\n]*delete/i)
})

test('staff realtime notifications are authenticated-only, opt-in and generic', async () => {
  const [module, bootstrap, auth, publicApp] = await Promise.all([
    read('staff-notifications.js'),
    read('staff-notification-bootstrap.js'),
    read('auth.js'),
    read('app.js'),
  ])

  for (const table of ['applications', 'contact_messages', 'business_leads']) {
    assert.match(module, new RegExp(`${table}:\\s*\\{`))
  }
  assert.match(module, /event:\s*['"]INSERT['"]/)
  assert.doesNotMatch(module, /payload\.new\.(name|email|phone|message|full_name)/)
  assert.match(module, /Notification\.requestPermission\(\)/)
  assert.match(module, /eworker360\.staffNotifications\.enabled/)
  assert.match(module, /supabase\.removeChannel/)
  assert.match(module, /aria-live|ariaLive/)
  assert.match(module, /showSystemNotification\(config, onOpen\)/)
  assert.match(module, /notice\.onclick[\s\S]*onOpen\?\.\(config\.kind\)/)
  assert.match(bootstrap, /getCurrentProfile/)
  assert.match(bootstrap, /\['admin', 'boss', 'recruiter'\]/)
  assert.match(auth, /import\(['"]\.\/staff-notification-bootstrap\.js['"]\)/)
  assert.doesNotMatch(publicApp, /staff-notifications|staff-notification-bootstrap/)
})
