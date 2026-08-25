(() => {
  const store = window.EWorkerDemoStore
  const auth = window.EWorkerStaffAuth
  const member = auth.requireRecruiter()
  if (!member) return
  const byId = (id) => document.getElementById(id)
  const statuses = ['Nueva', 'En revisión', 'Entrevista', 'Contratada', 'Descartada']
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character])
  const initials = (name) => String(name || 'SN').split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
  const dateLabel = (date) => {
    const hours = Math.round((Date.now() - new Date(date).getTime()) / 3600000)
    if (hours < 1) return 'Ahora mismo'
    if (hours < 24) return `Hace ${hours} h`
    return new Date(date).toLocaleDateString('es-DO', { day: 'numeric', month: 'short' })
  }
  const options = (selected) => statuses.map((status) => `<option ${status === selected ? 'selected' : ''}>${status}</option>`).join('')

  function render() {
    const query = byId('recruiter-search').value.trim().toLowerCase()
    const filter = byId('recruiter-filter').value
    const applications = store.getState().applications.filter((application) => {
      const text = `${application.fullName} ${application.email} ${application.role}`.toLowerCase()
      return (!query || text.includes(query)) && (filter === 'all' || application.status === filter)
    })
    byId('recruiter-name').textContent = member.name
    byId('recruiter-avatar').textContent = initials(member.name)
    byId('recruiter-count').textContent = `${applications.length} ${applications.length === 1 ? 'solicitud' : 'solicitudes'}`
    byId('recruiter-applications').innerHTML = applications.length ? applications.map((application) => `<article class="recruiter-row"><span class="candidate-avatar">${escapeHtml(initials(application.fullName))}</span><div class="candidate-info"><b>${escapeHtml(application.fullName || 'Sin nombre')}</b><small>${escapeHtml(application.email || 'Sin correo')} · ${escapeHtml(application.role || 'Solicitud general')} · ${escapeHtml(dateLabel(application.createdAt))}</small></div><select data-status="${escapeHtml(application.id)}" aria-label="Estado de ${escapeHtml(application.fullName)}">${options(application.status)}</select></article>`).join('') : '<p class="empty">No hay solicitudes que coincidan con los filtros.</p>'
  }

  byId('recruiter-search').addEventListener('input', render)
  byId('recruiter-filter').addEventListener('change', render)
  byId('recruiter-applications').addEventListener('change', (event) => {
    const target = event.target
    if (!target.matches('[data-status]')) return
    store.updateApplication(target.dataset.status, { status: target.value })
    render()
  })
  byId('logout').addEventListener('click', () => { auth.logout(); window.location.assign('staff-login.html') })
  window.setInterval(() => store.recordStaffActivity(member.id), 60000)
  render()
})()

