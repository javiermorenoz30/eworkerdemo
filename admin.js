(() => {
  const store = window.EWorkerDemoStore
  const byId = (id) => document.getElementById(id)
  const titles = { overview: 'Buenos días.', applications: 'Solicitudes recibidas', content: 'Editar contenido', settings: 'Ajustes de la demo' }

  function render() {
    const state = store.getState()
    const apps = state.applications
    byId('total').textContent = apps.length
    byId('new').textContent = apps.filter((app) => app.status === 'Nueva').length
    byId('progress').textContent = apps.filter((app) => ['En revisión', 'Entrevista'].includes(app.status)).length
    const empty = '<p class="empty">Aún no hay solicitudes. Completa el formulario público para verla aquí.</p>'
    byId('recent').innerHTML = apps.length ? apps.slice(0, 5).map((app) => `<div class="application"><div><b>${app.fullName || 'Sin nombre'}</b><small>${app.role || 'Solicitud'} · ${app.status}</small></div></div>`).join('') : empty
    byId('applications-list').innerHTML = apps.length ? apps.map((app) => `<div class="application"><div><b>${app.fullName || 'Sin nombre'}</b><small>${app.email || ''} · ${app.phone || ''}<br>${app.role || 'Solicitud'}</small></div><select data-status="${app.id}">${['Nueva', 'En revisión', 'Entrevista', 'Descartada', 'Contratada'].map((status) => `<option ${app.status === status ? 'selected' : ''}>${status}</option>`).join('')}</select></div>`).join('') : empty
    document.querySelectorAll('[data-status]').forEach((select) => select.onchange = () => { store.updateApplication(select.dataset.status, { status: select.value }); render() })
    Object.entries(state.settings).forEach(([key, value]) => { const input = document.querySelector(`[name="${key}"]`); if (input) input.value = value })
  }

  document.querySelectorAll('[data-view]').forEach((button) => button.addEventListener('click', () => {
    document.querySelectorAll('[data-view]').forEach((item) => item.classList.toggle('active', item === button))
    document.querySelectorAll('.view').forEach((view) => view.classList.toggle('active', view.id === button.dataset.view))
    byId('view-title').textContent = titles[button.dataset.view]
  }))
  document.querySelectorAll('.form').forEach((form) => form.addEventListener('submit', (event) => { event.preventDefault(); store.saveSettings(Object.fromEntries(new FormData(form))); form.querySelector('p[id$="note"]').textContent = 'Cambios guardados en este navegador.'; render() }))
  byId('download').addEventListener('click', () => { const url = URL.createObjectURL(new Blob([store.exportApplicationsCsv()], { type: 'text/csv' })); const link = document.createElement('a'); link.href = url; link.download = 'solicitudes-eworker360.csv'; link.click(); URL.revokeObjectURL(url) })
  byId('reset').addEventListener('click', () => { if (confirm('¿Restaurar la demo?')) { store.reset(); render() } })
  byId('search').addEventListener('input', (event) => document.querySelectorAll('#applications-list .application').forEach((item) => item.hidden = !item.textContent.toLowerCase().includes(event.target.value.toLowerCase())))
  render()
})()

