import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('contact page loads app.js as an ES module', async () => {
  const html = await read('index.html')
  assert.match(html, /<script type="module" src="app\.js\?v=supabase-1"><\/script>/)
})

test('data API exposes separate contact and business insert operations', async () => {
  const api = await read('data-api.js')
  assert.match(api, /submitContactMessage/)
  assert.match(api, /from\(['"]contact_messages['"]\)/)
  assert.match(api, /submitBusinessLead/)
  assert.match(api, /from\(['"]business_leads['"]\)/)
})

test('public contact handler persists based on audience before resetting', async () => {
  const app = await read('app.js')
  assert.match(app, /submitBusinessLead/)
  assert.match(app, /submitContactMessage/)
  assert.match(app, /notifySubmission\(['"]business_lead['"]/)
  assert.match(app, /notifySubmission\(['"]contact_message['"]/)
  assert.doesNotMatch(app, /mensaje está listo para ser enviado/)
})
