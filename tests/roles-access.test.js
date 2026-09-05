import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'

const root = new URL('../', import.meta.url)
const read = (path) => readFile(new URL(path, root), 'utf8')

async function allMigrationSql() {
  const migrationsUrl = new URL('supabase/migrations/', root)
  const files = (await readdir(migrationsUrl)).filter((name) => name.endsWith('.sql')).sort()
  return (await Promise.all(files.map((name) => readFile(new URL(name, migrationsUrl), 'utf8')))).join('\n')
}

test('Boss routes to admin and Operador routes to the operational portal', async () => {
  const { routeForProfile } = await import('../domain.js')
  assert.equal(routeForProfile({ role: 'boss', active: true }), 'admin.html')
  assert.equal(routeForProfile({ role: 'operator', active: true }), 'recruiter.html')
})

test('admin UI removes the centralized-data notice and lets managers choose staff roles', async () => {
  const html = await read('admin.html')
  assert.doesNotMatch(html, /Datos centralizados/i)
  assert.match(html, /name="role"/)
  for (const role of ['admin', 'boss', 'recruiter', 'operator']) {
    assert.match(html, new RegExp(`value="${role}"`))
  }
})

test('browser authorization treats Boss as admin and Operador as active staff', async () => {
  const auth = await read('auth.js')
  assert.match(auth, /\['admin',\s*'boss'\]/)
  assert.match(auth, /\['admin',\s*'boss',\s*'recruiter',\s*'operator'\]/)
})

test('staff invitation accepts an explicit role and returns detailed function errors', async () => {
  const api = await read('data-api.js')
  const edge = await read('supabase/functions/manage-staff/index.ts')
  assert.match(api, /inviteStaff\([^)]*role/)
  assert.match(api, /context[\s\S]*json\(/)
  assert.match(edge, /\['admin',\s*'boss',\s*'recruiter',\s*'operator'\]/)
  assert.match(edge, /role[\s\S]*payload/)
  assert.match(edge, /origin[\s\S]*reset-password\.html/i)
  assert.doesNotMatch(edge, /const inviteRedirect = 'https:\/\/javiermorenoz30\.github\.io/)
})

test('Operador is read-only and does not receive business-lead editing controls', async () => {
  const js = await read('recruiter.js')
  assert.match(js, /member\.role === 'operator'/)
  assert.match(js, /operator[\s\S]*listApplications/)
  assert.match(js, /operator[\s\S]*listContactMessages/)
  assert.match(js, /readOnly|canEdit/)
  assert.match(js, /business_leads|listBusinessLeads/)
})

test('Supabase migrations separate manager, editor and reader permissions', async () => {
  const sql = await allMigrationSql()
  assert.match(sql, /role in \('admin',\s*'boss',\s*'recruiter',\s*'operator'\)/i)
  assert.match(sql, /role in \('admin',\s*'boss'\)/i)
  assert.match(sql, /role in \('admin',\s*'boss',\s*'recruiter'\)/i)
  assert.match(sql, /applications[\s\S]*for select[\s\S]*is_reader_staff/i)
  assert.match(sql, /applications[\s\S]*for update[\s\S]*is_editor_staff/i)
  assert.match(sql, /contact_messages[\s\S]*for select[\s\S]*is_reader_staff/i)
  assert.match(sql, /contact_messages[\s\S]*for update[\s\S]*is_editor_staff/i)
  assert.match(sql, /business_leads[\s\S]*for select[\s\S]*is_editor_staff/i)
  assert.match(sql, /profiles[\s\S]*for update[\s\S]*is_manager/i)
})
