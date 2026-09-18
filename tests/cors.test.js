import test from 'node:test'
import assert from 'node:assert/strict'
import { isAllowedOrigin, corsHeaders } from '../supabase/functions/_shared/cors.ts'

test('production and exact Cloudflare origins can call Edge Functions', () => {
  for (const origin of [
    'https://eworker360dominicana.com',
    'https://www.eworker360dominicana.com',
    'https://eworkerdemo.zencontroller.workers.dev',
  ]) {
    const request = new Request('https://example.test', { headers: { origin } })
    assert.equal(isAllowedOrigin(request), true)
    assert.equal(corsHeaders(request)['Access-Control-Allow-Origin'], origin)
  }
})

test('CORS allow-list covers current Supabase browser client headers', () => {
  const request = new Request('https://example.test', {
    headers: { origin: 'https://eworker360dominicana.com' },
  })
  const headers = corsHeaders(request)['Access-Control-Allow-Headers']

  for (const header of [
    'authorization',
    'x-client-info',
    'apikey',
    'content-type',
    'x-retry-count',
    'traceparent',
    'tracestate',
    'baggage',
  ]) {
    assert.match(headers, new RegExp(`(^|,\\s*)${header}(,|$)`))
  }
})

test('other Workers sites and lookalike origins remain blocked', () => {
  for (const origin of ['https://other.zencontroller.workers.dev', 'https://eworkerdemo.zencontroller.workers.dev.attacker.test', 'http://eworkerdemo.zencontroller.workers.dev']) {
    assert.equal(isAllowedOrigin(new Request('https://example.test', { headers: { origin } })), false)
  }
})
