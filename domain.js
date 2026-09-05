export function routeForProfile(profile) {
  if (!profile?.active) return null
  if (profile.role === 'admin') return 'admin.html'
  if (profile.role === 'recruiter') return 'recruiter.html'
  return null
}

export function applicationMetrics(applications = []) {
  const total = applications.length
  const newCount = applications.filter((application) => application.status === 'Nueva').length
  const progress = applications.filter((application) => ['En revisión', 'Entrevista'].includes(application.status)).length
  const hired = applications.filter((application) => application.status === 'Contratada').length
  return { total, newCount, progress, hired }
}

export function buildApplicationRecord(values, id = crypto.randomUUID()) {
  return {
    id,
    full_name: String(values.fullName || '').trim(),
    email: String(values.email || '').trim(),
    phone: String(values.whatsapp || '').trim(),
    role_applied: String(values.position || 'Solicitud general').trim() || 'Solicitud general',
    answers: { ...values },
  }
}

function csvValue(value) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`
}

export function csvForApplications(applications = []) {
  const headers = ['id', 'created_at', 'status', 'full_name', 'email', 'phone', 'role_applied', 'internal_note']
  const rows = applications.map((application) => headers.map((header) => csvValue(application[header])).join(','))
  return [headers.join(','), ...rows].join('\n')
}
