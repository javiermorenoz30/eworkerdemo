(() => {
  const store = window.EWorkerDemoStore
  const byId = (id) => document.getElementById(id)
  const statuses = ['Nueva', 'En revisión', 'Entrevista', 'Contratada', 'Descartada']
  const titles = {
    overview: ['Centro de control.', 'Una vista clara de tu operación y talento.'],
    applications: ['Bandeja de solicitudes.', 'Revisa cada candidatura y mueve el proceso con un clic.'],
    content: ['Contenido de la landing.', 'Ajusta el mensaje de eWorker360 en modo demo.'],
    settings: ['Ajustes de la demo.', 'Prepara las notificaciones para la siguiente etapa.'],
    team: ['Equipo y accesos.', 'Crea roles limitados y supervisa la actividad del equipo.'],
  }
  let selectedId = null

  const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character])
  const initials = (name) => String(name || 'SN').split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
  const statusClass = (status) => `status-${String(status).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-')}`
  const dateLabel = (date) => {
    const value = new Date(date)
    if (Number.isNaN(value.getTime())) return 'Sin fecha'
    const hours = Math.round((Date.now() - value.getTime()) / 3600000)
    if (hours < 1) return 'Ahora mismo'
    if (hours < 24) return `Hace ${hours} h`
    return value.toLocaleDateString('es-DO', { day: 'numeric', month: 'short' })
  }
  const statusBadge = (status) => `<span class="status-badge ${statusClass(status)}">${escapeHtml(status)}</span>`
  const statusOptions = (selected) => statuses.map((status) => `<option value="${status}" ${status === selected ? 'selected' : ''}>${status}</option>`).join('')

  function setView(view) {
    document.querySelectorAll('[data-view]').forEach((item) => item.classList.toggle('active', item.dataset.view === view))
    document.querySelectorAll('.view').forEach((item) => item.classList.toggle('active', item.id === view))
    byId('view-title').textContent = titles[view][0]
    byId('view-meta').textContent = titles[view][1]
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function filteredApplications(state) {
    const query = byId('search').value.trim().toLowerCase()
    const filter = byId('status-filter').value
    const sort = byId('sort').value
    const items = state.applications.filter((app) => {
      const searchable = `${app.fullName} ${app.email} ${app.phone} ${app.role} ${app.status}`.toLowerCase()
      return (!query || searchable.includes(query)) && (filter === 'all' || app.status === filter)
    })
    return items.sort((a, b) => {
      if (sort === 'name') return String(a.fullName).localeCompare(String(b.fullName), 'es')
      if (sort === 'status') return String(a.status).localeCompare(String(b.status), 'es')
      return new Date(b.createdAt) - new Date(a.createdAt)
    })
  }

  function renderPipeline(applications) {
    const pipeline = byId('pipeline')
    const active = ['Nueva', 'En revisión', 'Entrevista', 'Contratada']
    const total = applications.length || 1
    pipeline.innerHTML = active.map((status) => {
      const count = applications.filter((app) => app.status === status).length
      return `<div class="pipeline-row"><b>${escapeHtml(status)}</b><span class="bar"><i style="width:${Math.max(count ? 10 : 0, Math.round((count / total) * 100))}%"></i></span><strong>${count}</strong></div>`
    }).join('')
    byId('pipeline-total').textContent = `${applications.length} total`
  }

  function renderRecent(applications) {
    const recent = byId('recent')
    if (!applications.length) {
      recent.innerHTML = '<p class="empty">Aún no hay solicitudes. Usa “Cargar datos de muestra” para presentar el panel o completa el formulario público.</p>'
      return
    }
    recent.innerHTML = applications.slice(0, 5).map((app) => `<div class="recent-item"><span class="avatar">${escapeHtml(initials(app.fullName))}</span><div><b>${escapeHtml(app.fullName || 'Sin nombre')}</b><small>${escapeHtml(app.role || 'Solicitud general')} · ${dateLabel(app.createdAt)}</small></div>${statusBadge(app.status)}</div>`).join('')
  }

  function renderApplications(state) {
    const applications = filteredApplications(state)
    const list = byId('applications-list')
    byId('results-count').textContent = `${applications.length} ${applications.length === 1 ? 'solicitud' : 'solicitudes'}`
    if (!applications.length) {
      list.innerHTML = '<p class="empty">No encontramos solicitudes con esos filtros.</p>'
      selectedId = null
      renderCandidateDetail(null)
      return
    }
    if (!applications.some((app) => app.id === selectedId)) selectedId = applications[0].id
    list.innerHTML = applications.map((app) => `<button class="application-row ${app.id === selectedId ? 'active' : ''}" data-candidate="${escapeHtml(app.id)}"><span class="avatar">${escapeHtml(initials(app.fullName))}</span><span class="application-info"><b>${escapeHtml(app.fullName || 'Sin nombre')}</b><small>${escapeHtml(app.role || 'Solicitud general')} · ${dateLabel(app.createdAt)}</small></span>${statusBadge(app.status)}</button>`).join('')
    renderCandidateDetail(applications.find((app) => app.id === selectedId))
  }

  function renderCandidateDetail(application) {
    const panel = byId('candidate-detail')
    if (!application) {
      panel.innerHTML = '<div class="detail-empty"><b>Selecciona una solicitud</b><span>Los datos del candidato aparecerán aquí.</span></div>'
      return
    }
    panel.innerHTML = `<div class="detail-top"><span class="detail-avatar">${escapeHtml(initials(application.fullName))}</span>${statusBadge(application.status)}</div><h2>${escapeHtml(application.fullName || 'Sin nombre')}</h2><p class="eyebrow">${escapeHtml(application.role || 'SOLICITUD GENERAL')}</p><div class="detail-contact"><a href="mailto:${escapeHtml(application.email)}">${escapeHtml(application.email || 'Sin correo')}</a><br><a href="tel:${escapeHtml(application.phone)}">${escapeHtml(application.phone || 'Sin teléfono')}</a><br>Recibida ${escapeHtml(dateLabel(application.createdAt))}</div><div class="detail-field"><label for="candidate-status">ETAPA DEL PROCESO</label><select id="candidate-status" data-edit-status="${escapeHtml(application.id)}">${statusOptions(application.status)}</select></div><div class="detail-field"><label for="candidate-note">NOTA INTERNA</label><textarea id="candidate-note" data-edit-note="${escapeHtml(application.id)}" placeholder="Añade una nota para el equipo">${escapeHtml(application.note)}</textarea></div><button class="primary detail-save" data-save-note="${escapeHtml(application.id)}">Guardar seguimiento</button>`
  }

  function populateForms(settings) {
    Object.entries(settings).forEach(([key, value]) => {
      document.querySelectorAll(`[name="${key}"]`).forEach((input) => {
        if (input.type === 'checkbox') input.checked = value === 'on' || value === true
        else input.value = value ?? ''
      })
    })
  }

  function renderTeam(state) {
    const members = state.staff || []
    const isOnline = (member) => member.status === 'Activo' && member.lastSeenAt && Date.now() - new Date(member.lastSeenAt).getTime() < 180000
    const online = members.filter(isOnline).length
    byId('team-count').textContent = members.length
    byId('staff-online-count').textContent = `${online} en línea`
    const list = byId('staff-list')
    if (!members.length) {
      list.innerHTML = '<p class="empty">Aún no has creado accesos. Agrega al primer responsable de solicitudes desde el formulario.</p>'
      return
    }
    list.innerHTML = members.map((member) => {
      const active = isOnline(member)
      const stateLabel = member.status === 'Activo' ? (active ? 'En línea' : member.lastSeenAt ? `Visto ${dateLabel(member.lastSeenAt)}` : 'Sin inicio de sesión') : 'Acceso pausado'
      return `<div class="staff-row"><span class="avatar">${escapeHtml(initials(member.name))}</span><div class="staff-info"><b>${escapeHtml(member.name)}</b><small>${escapeHtml(member.email)} · Solo solicitudes</small><span class="presence ${active ? 'online' : ''}">${escapeHtml(stateLabel)}</span></div><button class="staff-action" data-staff-toggle="${escapeHtml(member.id)}">${member.status === 'Activo' ? 'Pausar' : 'Activar'}</button></div>`
    }).join('')
  }

  function render() {
    const state = store.getState()
    const apps = state.applications
    const newCount = apps.filter((app) => app.status === 'Nueva').length
    const progress = apps.filter((app) => ['En revisión', 'Entrevista'].includes(app.status)).length
    const hired = apps.filter((app) => app.status === 'Contratada').length
    byId('total').textContent = apps.length
    byId('new').textContent = newCount
    byId('progress').textContent = progress
    byId('hired').textContent = hired
    byId('nav-count').textContent = apps.length
    byId('total-sub').textContent = apps.length ? `${apps.length} registros activos` : 'Sin actividad todavía'
    byId('focus-title').textContent = newCount ? `${newCount} solicitud${newCount === 1 ? '' : 'es'} nueva${newCount === 1 ? '' : 's'} por revisar.` : apps.length ? 'Tu bandeja está al día.' : 'Tu operación está lista.'
    byId('focus-copy').textContent = newCount ? 'Prioriza los perfiles nuevos para mantener una respuesta rápida y consistente.' : apps.length ? 'Revisa el pipeline y programa el siguiente seguimiento desde la bandeja.' : 'Carga los datos de muestra o recibe solicitudes desde el formulario público para empezar.'
    renderPipeline(apps)
    renderRecent(apps)
    renderApplications(state)
    populateForms(state.settings)
    renderTeam(state)
  }

  document.querySelectorAll('[data-view]').forEach((button) => button.addEventListener('click', () => setView(button.dataset.view)))
  document.querySelectorAll('[data-go]').forEach((button) => button.addEventListener('click', () => setView(button.dataset.go)))
  ;['search', 'status-filter', 'sort'].forEach((id) => byId(id).addEventListener(id === 'search' ? 'input' : 'change', () => renderApplications(store.getState())))
  byId('applications-list').addEventListener('click', (event) => {
    const target = event.target.closest('[data-candidate]')
    if (!target) return
    selectedId = target.dataset.candidate
    renderApplications(store.getState())
  })
  byId('candidate-detail').addEventListener('change', (event) => {
    const target = event.target
    if (!target.matches('[data-edit-status]')) return
    store.updateApplication(target.dataset.editStatus, { status: target.value })
    render()
  })
  byId('candidate-detail').addEventListener('click', (event) => {
    const target = event.target.closest('[data-save-note]')
    if (!target) return
    const note = byId('candidate-note').value.trim()
    store.updateApplication(target.dataset.saveNote, { note })
    render()
  })
  document.querySelectorAll('.form:not(#staff-form)').forEach((form) => form.addEventListener('submit', (event) => {
    event.preventDefault()
    const values = Object.fromEntries(new FormData(form))
    if (form.id === 'settings-form') values.autoReply = form.elements.autoReply.checked ? 'on' : ''
    store.saveSettings(values)
    form.querySelector('.form-note').textContent = 'Cambios guardados en este navegador.'
    render()
  }))
  byId('staff-form').addEventListener('submit', (event) => {
    event.preventDefault()
    const member = store.addStaff(Object.fromEntries(new FormData(event.currentTarget)))
    const note = byId('staff-note')
    note.textContent = member ? `Acceso creado para ${member.name}.` : 'No se pudo crear: revisa los datos o usa otro correo.'
    if (member) event.currentTarget.reset()
    render()
  })
  byId('staff-list').addEventListener('click', (event) => {
    const target = event.target.closest('[data-staff-toggle]')
    if (!target) return
    const member = store.getState().staff.find((entry) => entry.id === target.dataset.staffToggle)
    if (!member) return
    store.updateStaff(member.id, { status: member.status === 'Activo' ? 'Pausado' : 'Activo' })
    render()
  })
  byId('seed-demo').addEventListener('click', () => { store.seedDemoApplications(); render() })
  byId('download').addEventListener('click', () => {
    const url = URL.createObjectURL(new Blob([store.exportApplicationsCsv()], { type: 'text/csv' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'solicitudes-eworker360.csv'
    link.click()
    URL.revokeObjectURL(url)
  })
  byId('reset').addEventListener('click', () => { if (confirm('¿Restaurar la demo y borrar los datos locales?')) { store.reset(); selectedId = null; render() } })
  render()
})()

