(() => {
  const storageKey = 'eworker360-demo-v1'
  const defaults = {
    settings: {
      heroTitle: 'Conectamos talento dominicano con oportunidades globales.',
      heroLead: 'Operaciones de customer experience, televentas y soporte diseñadas para crecer con precisión, humanidad y velocidad.',
      contactEmail: 'info@eworker360dominicana.com',
      contactPhone: '+1 809 824 2463',
      whatsapp: 'https://wa.me/18098242463',
      notificationEmail: 'info@eworker360dominicana.com',
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
      ...application,
    }
    state.applications.unshift(entry)
    persist(state)
    return entry
  }
  const updateApplication = (id, patch) => {
    const state = load()
    const index = state.applications.findIndex((entry) => entry.id === id)
    if (index < 0) return null
    state.applications[index] = { ...state.applications[index], ...patch }
    persist(state)
    return clone(state.applications[index])
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

  window.EWorkerDemoStore = { getState, saveSettings, addApplication, updateApplication, exportApplicationsCsv, reset }
})()

