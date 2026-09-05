import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('landing migration creates draft/published content with transactional RPCs', async () => {
  const sql = await read('supabase/migrations/2026090502_landing_content.sql')
  assert.match(sql, /create table(?: if not exists)? public\.landing_versions/i)
  assert.match(sql, /create table(?: if not exists)? public\.landing_sections/i)
  assert.match(sql, /status[^\n]+check[^\n]+draft[^\n]+published/i)
  assert.match(sql, /create or replace function public\.save_landing_draft\(sections_payload jsonb\)/i)
  assert.match(sql, /create or replace function public\.publish_landing\(\)/i)
  assert.match(sql, /landing_media_is_referenced/i)
  assert.match(sql, /landing-media/)
})

test('anonymous users can only read published visible sections', async () => {
  const sql = await read('supabase/migrations/2026090502_landing_content.sql')
  assert.match(sql, /landing_versions_public_select/i)
  assert.match(sql, /status = 'published'/i)
  assert.match(sql, /landing_sections_public_select/i)
  assert.match(sql, /visible = true/i)
  assert.match(sql, /public\.is_admin\(\)/i)
  assert.match(sql, /to anon, authenticated/i)
})

test('landing publishing validates managers and preserves one draft and one published version', async () => {
  const sql = await read('supabase/migrations/2026090502_landing_content.sql')
  assert.match(sql, /status text not null unique/i)
  assert.match(sql, /if not public\.is_admin\(\)/i)
  assert.match(sql, /for update/i)
  assert.match(sql, /published_at/i)
  assert.match(sql, /jsonb_array_elements\(sections_payload\)/i)
})

test('landing Storage writes are scoped to managers and the landing-media bucket', async () => {
  const sql = await read('supabase/migrations/2026090502_landing_content.sql')
  assert.match(sql, /insert into storage\.buckets/i)
  assert.match(sql, /bucket_id = 'landing-media'/i)
  assert.match(sql, /storage\.objects[\s\S]*public\.is_admin\(\)/i)
  assert.doesNotMatch(sql, /to anon[\s\S]{0,1000}for insert[\s\S]{0,500}storage\.objects/i)
})
