import test from 'node:test'
import assert from 'node:assert/strict'
import { isAllowedOrigin, corsHeaders } from '../supabase/functions/_shared/cors.ts'

test('the exact Cloudflare site can call Edge Functions', () => {
  const origin = 'https://eworkerdemo.zencontroller.workers.dev'
  const request = new Request('https://example.test', { headers: { origin } })
  assert.equal(isAllowedOrigin(request), true)
  assert.equal(corsHeaders(request)['Access-Control-Allow-Origin'], origin)
})

test('other Workers sites and lookalike origins remain blocked', () => {
  for (const origin of ['https://other.zencontroller.workers.dev', 'https://eworkerdemo.zencontroller.workers.dev.attacker.test', 'http://eworkerdemo.zencontroller.workers.dev']) {
    assert.equal(isAllowedOrigin(new Request('https://example.test', { headers: { origin } })), false)
  }
})
