import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const migrationPath = new URL('../supabase/migrations/20260904_initial_production_schema.sql', import.meta.url)

test('production migration creates required tables and enables RLS', async () => {
  const sql = await readFile(migrationPath, 'utf8')
  for (const table of ['profiles', 'applications', 'contact_messages', 'business_leads', 'site_settings']) {
    assert.match(sql, new RegExp(`create table(?: if not exists)? public\\.${table}`, 'i'))
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`, 'i'))
  }
})

test('production migration defines role helpers and narrow public policies', async () => {
  const sql = await readFile(migrationPath, 'utf8')
  assert.match(sql, /create or replace function public\.is_active_staff\(\)/i)
  assert.match(sql, /create or replace function public\.is_admin\(\)/i)
  assert.match(sql, /create or replace function public\.is_recruiter_or_admin\(\)/i)
  assert.match(sql, /create policy applications_public_insert/i)
  assert.match(sql, /status = 'Nueva'/)
  assert.match(sql, /internal_note = ''/)
  assert.match(sql, /create policy profiles_admin_update/i)
  assert.match(sql, /create policy settings_admin_update/i)
})

test('production migration does not grant anonymous select on sensitive tables', async () => {
  const sql = await readFile(migrationPath, 'utf8')
  assert.doesNotMatch(sql, /grant\s+select[^;]+to\s+anon/i)
})
