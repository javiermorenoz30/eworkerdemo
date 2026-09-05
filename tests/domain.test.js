import test from 'node:test'
import assert from 'node:assert/strict'
import { applicationMetrics, buildApplicationRecord, routeForProfile, csvForApplications } from '../domain.js'

test('routeForProfile sends active admins and recruiters to their dashboard', () => {
  assert.equal(routeForProfile({ role: 'admin', active: true }), 'admin.html')
  assert.equal(routeForProfile({ role: 'recruiter', active: true }), 'recruiter.html')
  assert.equal(routeForProfile({ role: 'recruiter', active: false }), null)
  assert.equal(routeForProfile({ role: 'unknown', active: true }), null)
  assert.equal(routeForProfile(null), null)
})

test('applicationMetrics counts pipeline states', () => {
  assert.deepEqual(applicationMetrics([
    { status: 'Nueva' },
    { status: 'En revisión' },
    { status: 'Entrevista' },
    { status: 'Contratada' },
  ]), { total: 4, newCount: 1, progress: 2, hired: 1 })
})

test('buildApplicationRecord keeps all answers and normalized summary fields', () => {
  const record = buildApplicationRecord({
    position: 'Ventas',
    fullName: 'Persona Demo',
    email: 'demo@example.com',
    whatsapp: '+10000000000',
    cedula: 'TEST-ID',
    financialAssets: 'TEST-AMOUNT',
  }, '11111111-1111-4111-8111-111111111111')

  assert.equal(record.id, '11111111-1111-4111-8111-111111111111')
  assert.equal(record.full_name, 'Persona Demo')
  assert.equal(record.email, 'demo@example.com')
  assert.equal(record.phone, '+10000000000')
  assert.equal(record.role_applied, 'Ventas')
  assert.equal(record.answers.cedula, 'TEST-ID')
  assert.equal(record.answers.financialAssets, 'TEST-AMOUNT')
  assert.equal('status' in record, false)
  assert.equal('internal_note' in record, false)
})

test('csvForApplications escapes commas and quotes', () => {
  const csv = csvForApplications([{
    id: 'a1',
    created_at: '2026-09-04T00:00:00.000Z',
    status: 'Nueva',
    full_name: 'Demo, Persona',
    email: 'demo@example.com',
    phone: '+10000000000',
    role_applied: 'Ventas',
    internal_note: 'Dijo "hola"',
  }])
  assert.match(csv, /"Demo, Persona"/)
  assert.match(csv, /"Dijo ""hola"""/)
})
