import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

const requiredNames = [
  'position','employmentMode','englishLevel','referralSource','fullName','address','birthDate','cedula','whatsapp','email',
  'transportation','traveledAbroad','travelDestinations','hasVisa','familyAtCompany','financialAssets','financialObligations','justiceIssues',
  'academicSummary','currentlyStudying','educationLevel','courses','technologyLevel','workSummary',
  'job1Company','job1LastDate','job1ExitReason','job2Company','job2LastDate','job2ExitReason','job3Company','job3LastDate','job3ExitReason',
  'currentlyEmployed','lastSalary','yearsSales','yearsCustomerService','consent',
]

test('employment form uses stable field names and production module submission', async () => {
  const html = await read('application.html')
  for (const name of requiredNames) assert.match(html, new RegExp(`name=["']${name}["']`), `missing field name ${name}`)
  assert.doesNotMatch(html, /admin-data\.js|EWorkerDemoStore/)
  assert.match(html, /type="module" src="application\.js/)
  assert.doesNotMatch(html, /no envía ni almacena información/i)
})

test('public application persistence inserts without selecting the sensitive row back', async () => {
  const api = (await read('data-api.js')).replace(/\r\n/g, '\n')
  const match = api.match(/export async function submitApplication\(record\) \{([\s\S]*?)\n\}\n\nexport async function/)
  assert.ok(match, 'submitApplication function was not found')
  const submitApplicationBody = match[1]
  assert.match(submitApplicationBody, /from\(['"]applications['"]\)/)
  assert.match(submitApplicationBody, /\.insert\(/)
  assert.doesNotMatch(submitApplicationBody, /\.select\(/)
})

test('application page persists first and treats notification as secondary', async () => {
  const js = await read('application.js')
  assert.match(js, /submitApplication/)
  assert.match(js, /notifySubmission\(['"]application['"]/)
  assert.match(js, /crypto\.randomUUID/)
})
