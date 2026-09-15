import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('contact page loads the current classic entry script that uses dynamic modules', async () => {
  const html = await read('index.html')
  const app = await read('app.js')
  assert.match(
    html,
    /<script\s+src=["']app\.js\?v=application-inbox-1["']\s+defer\s*><\/script>/,
  )
  assert.match(
    app,
    /await import\(\s*["']\.\/data-api\.js["']\s*\)/,
  )
})

test('data API exposes separate contact and business insert operations', async () => {
  const api = await read('data-api.js')
  assert.match(api, /submitContactMessage/)
  assert.match(api, /from\(['"]contact_messages['"]\)/)
  assert.match(api, /submitBusinessLead/)
  assert.match(api, /from\(['"]business_leads['"]\)/)
})

test('public contact handler persists based on audience before resetting and notifies afterward', async () => {
  const app = await read('app.js')
  assert.match(app, /submitBusinessLead/)
  assert.match(
    app,
    /notificationType\s*=\s*['"]business_lead['"]/,
  )
  assert.match(app, /submitContactMessage/)
  assert.match(
    app,
    /notificationType\s*=\s*['"]contact_message['"]/,
  )
  assert.match(
    app,
    /await notifySubmission\(\s*notificationType,\s*id\s*\)/,
  )
  assert.match(app, /form\.reset\(\)/)
  assert.doesNotMatch(app, /mensaje está listo para ser enviado/)
})
