(() => {
  const storageKey = 'eworker360-demo-v1'
  const defaults = {
    settings: {
      brandName: 'eWorker360 Dominicana',
      heroTitle: 'Conectamos talento dominicano con oportunidades globales.',
      heroLead: 'Operaciones de customer experience, televentas y soporte diseñadas para crecer con precisión, humanidad y velocidad.',
      contactEmail: 'info@eworker360dominicana.com',
      contactPhone: '+1 809 824 2463',
      whatsapp: 'https://wa.me/18098242463',
      notificationEmail: 'info@eworker360dominicana.com',
      emailSubject: 'Nueva solicitud desde eWorker360',
      autoReply: 'on',
    },
    applications: [],
  }

  const clone = (value) => JSON.parse(JSON.stringify(value))
  const load = () => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || 'null')
      return saved ? { ...clone(defaults), ...saved, settings: { ...defaults.settings, ...saved.settings } } : clone(defaults)
    } catch {
      return clone(defaults)
    }
  }
  const persist = (state) => localStorage.setItem(storageKey, JSON.stringify(state))
  const csvValue = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`
  const getState = () => clone(load())

  const saveSettings = (settings) => {
    const state = load()
    state.settings = { ...state.settings, ...settings }
    persist(state)
    return getState()
  }

  const addApplication = (application) => {
    const state = load()
    const entry = {
      id: `app-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      status: 'Nueva',
      createdAt: new Date().toISOString(),
      note: '',
      area: application.role || 'Solicitud general',
      ...application,
    }
    state.applications.unshift(entry)
    persist(state)
    return clone(entry)
  }

  const updateApplication = (id, patch) => {
    const state = load()
    const index = state.applications.findIndex((entry) => entry.id === id)
    if (index < 0) return null
    state.applications[index] = { ...state.applications[index], ...patch }
    persist(state)
    return clone(state.applications[index])
  }

  const seedDemoApplications = () => {
    const state = load()
    if (state.applications.length) return clone(state.applications)
    const now = Date.now()
    const sample = [
      ['app-demo-1', 'María González', 'maria.gonzalez@email.com', '+1 809 555 0148', 'Ventas', 'Nueva', 'Perfil bilingüe con experiencia en ventas consultivas.', 2],
      ['app-demo-2', 'Daniel Reyes', 'daniel.reyes@email.com', '+1 809 555 0172', 'Servicio al Cliente', 'En revisión', 'Excelente comunicación escrita. Revisar disponibilidad.', 10],
      ['app-demo-3', 'Carla Medina', 'carla.medina@email.com', '+1 809 555 0196', 'Soporte', 'Entrevista', 'Entrevista técnica confirmada para esta semana.', 28],
      ['app-demo-4', 'José Ramírez', 'jose.ramirez@email.com', '+1 809 555 0121', 'Ventas', 'Contratada', 'Documentación completada. Inicio programado.', 56],
      ['app-demo-5', 'Elena Castillo', 'elena.castillo@email.com', '+1 809 555 0164', 'Servicio al Cliente', 'Descartada', 'Se mantendrá en base de talento para futuras vacantes.', 80],
    ]
    state.applications = sample.map(([id, fullName, email, phone, role, status, note, hours]) => ({
      id,
      fullName,
      email,
      phone,
      role,
      area: role,
      status,
      note,
      createdAt: new Date(now - hours * 60 * 60 * 1000).toISOString(),
    }))
    persist(state)
    return clone(state.applications)
  }

  const exportApplicationsCsv = () => {
    const rows = getState().applications
    const headers = ['id', 'createdAt', 'status', 'fullName', 'email', 'phone', 'role', 'note']
    return [headers.join(','), ...rows.map((row) => headers.map((header) => csvValue(row[header])).join(','))].join('\n')
  }
  const reset = () => {
    localStorage.removeItem(storageKey)
    return getState()
  }

  window.EWorkerDemoStore = { getState, saveSettings, addApplication, updateApplication, seedDemoApplications, exportApplicationsCsv, reset }
})()

