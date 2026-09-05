import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('admin page is production-only and exposes shared operations', async () => {
  const html = await read('admin.html')
  assert.doesNotMatch(html, /Modo demo|Restaurar demo|Cargar datos de muestra|admin-data\.js|Código temporal demo/i)
  assert.match(html, /data-view="messages"/)
  assert.match(html, /data-view="leads"/)
  assert.match(html, /id="logout"/)
  assert.match(html, /type="module" src="admin\.js/)
})

test('admin dashboard is guarded and loads all shared Supabase data', async () => {
  const js = await read('admin.js')
  assert.match(js, /requireAdmin/)
  assert.match(js, /listApplications/)
  assert.match(js, /listContactMessages/)
  assert.match(js, /listBusinessLeads/)
  assert.match(js, /getSiteSettings/)
  assert.match(js, /listProfiles/)
  assert.match(js, /csvForApplications/)
  assert.doesNotMatch(js, /EWorkerDemoStore|localStorage|seedDemoApplications/)
})

test('data API has authenticated admin read and operational update functions', async () => {
  const api = await read('data-api.js')
  for (const name of ['listApplications','updateApplication','listContactMessages','updateContactMessageStatus','listBusinessLeads','updateBusinessLeadStatus','getSiteSettings','updateSiteSettings','listProfiles','updateProfile','inviteRecruiter']) {
    assert.match(api, new RegExp(`export async function ${name}\\b`), `missing ${name}`)
  }
})
