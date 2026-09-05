import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('recruiter page is Supabase-only and exposes shared operational views', async () => {
  const html = await read('recruiter.html')
  assert.doesNotMatch(html, /admin-data\.js|staff-auth\.js|SOLO SOLICITUDES/i)
  assert.match(html, /data-recruiter-view="applications"/)
  assert.match(html, /data-recruiter-view="messages"/)
  assert.match(html, /data-recruiter-view="leads"/)
  assert.match(html, /id="recruiter-candidate-detail"/)
  assert.match(html, /type="module" src="recruiter\.js/)
})

test('recruiter workflow uses shared Supabase data and staff guard', async () => {
  const js = await read('recruiter.js')
  for (const name of ['requireStaff','listApplications','listContactMessages','listBusinessLeads','updateApplication','updateContactMessageStatus','updateBusinessLeadStatus']) {
    assert.match(js, new RegExp(`\\b${name}\\b`), `missing ${name}`)
  }
  assert.doesNotMatch(js, /EWorkerDemoStore|EWorkerStaffAuth|localStorage|recordStaffActivity/)
})

test('recruiter renders complete application answers with internal notes', async () => {
  const js = await read('recruiter.js')
  assert.match(js, /application\.answers/)
  assert.match(js, /internal_note/)
  assert.match(js, /cedula|Número de cédula/)
  assert.match(js, /financialAssets|Bancos \/ financieras/)
  assert.match(js, /justiceIssues|Problemas con la justicia/)
})
