import test from 'node:test'
import assert from 'node:assert/strict'
import { applicationMetrics, buildApplicationRecord, routeForProfile, csvForApplications, isManagerProfile } from '../domain.js'

test('routeForProfile sends active admins and recruiters to their dashboard', () => {
  assert.equal(routeForProfile({ role: 'admin', active: true }), 'admin.html')
  assert.equal(routeForProfile({ role: 'recruiter', active: true }), 'recruiter.html')
  assert.equal(routeForProfile({ role: 'recruiter', active: false }), null)
  assert.equal(routeForProfile({ role: 'unknown', active: true }), null)
  assert.equal(routeForProfile(null), null)
})

test('Boss has the same dashboard route and manager status as Admin', () => {
  assert.equal(routeForProfile({ role: 'boss', active: true }), 'admin.html')
  assert.equal(isManagerProfile({ role: 'admin', active: true }), true)
  assert.equal(isManagerProfile({ role: 'boss', active: true }), true)
  assert.equal(isManagerProfile({ role: 'boss', active: false }), false)
  assert.equal(isManagerProfile({ role: 'recruiter', active: true }), false)
})

test('applicationMetrics counts pipeline states', () => {
  assert.deepEqual(applicationMetrics([
    { status: 'Nueva' },
    { status: 'En revisión' },
    { status: 'Entrevista' },
    { status: 'Contratada' },
  ]), { total: 4, newCount: 1, progress: 2, hired: 1 })
})

test('buildApplicationRecord keeps complete sensitive and work-history answers with normalized summary fields', () => {
  const values = {
    position: 'Ventas',
    fullName: 'Persona Demo',
    email: 'demo@example.com',
    whatsapp: '+10000000000',
    birthDate: '1990-01-01',
    cedula: 'TEST-ID',
    financialAssets: 'TEST-AMOUNT',
    justiceIssues: 'No',
    job1Company: 'Empresa 1',
    job1LastDate: '2025-01',
    job1ExitReason: 'Cambio profesional',
    job2Company: 'Empresa 2',
    job2LastDate: '2024-01',
    job2ExitReason: 'Fin de contrato',
    job3Company: 'Empresa 3',
    job3LastDate: '2023-01',
    job3ExitReason: 'Mudanza',
  }
  const record = buildApplicationRecord(values, '11111111-1111-4111-8111-111111111111')

  assert.equal(record.id, '11111111-1111-4111-8111-111111111111')
  assert.equal(record.full_name, 'Persona Demo')
  assert.equal(record.email, 'demo@example.com')
  assert.equal(record.phone, '+10000000000')
  assert.equal(record.role_applied, 'Ventas')
  assert.equal(record.answers.birthDate, '1990-01-01')
  assert.equal(record.answers.cedula, 'TEST-ID')
  assert.equal(record.answers.financialAssets, 'TEST-AMOUNT')
  assert.equal(record.answers.justiceIssues, 'No')
  assert.equal(record.answers.job1Company, 'Empresa 1')
  assert.equal(record.answers.job1LastDate, '2025-01')
  assert.equal(record.answers.job1ExitReason, 'Cambio profesional')
  assert.equal(record.answers.job2Company, 'Empresa 2')
  assert.equal(record.answers.job2LastDate, '2024-01')
  assert.equal(record.answers.job2ExitReason, 'Fin de contrato')
  assert.equal(record.answers.job3Company, 'Empresa 3')
  assert.equal(record.answers.job3LastDate, '2023-01')
  assert.equal(record.answers.job3ExitReason, 'Mudanza')
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
