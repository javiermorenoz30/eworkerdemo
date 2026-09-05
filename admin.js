import { requireAdmin, signOut } from './auth.js'
import {
  getSiteSettings,
  inviteRecruiter,
  listApplications,
  listBusinessLeads,
  listContactMessages,
  listProfiles,
  updateApplication,
  updateBusinessLeadStatus,
  updateContactMessageStatus,
  updateProfile,
  updateSiteSettings,
} from './data-api.js'
import { applicationMetrics, csvForApplications } from './domain.js'
import { LIVE_RECORD_EVENT } from './staff-notifications.js'

const byId = (id) => document.getElementById(id)
const applicationStatuses = ['Nueva', 'En revisión', 'Entrevista', 'Contratada', 'Descartada']
const messageStatuses = ['Nuevo', 'En revisión', 'Respondido', 'Cerrado']
const leadStatuses = ['Nuevo', 'Contactado', 'Propuesta enviada', 'Negociación', 'Ganado', 'Descartado']
const staffRoles = [
  ['admin', 'Administrador'],
  ['boss', 'Boss'],
  ['recruiter', 'Reclutador'],
]
const titles = {
  overview: ['Centro de control.', 'Resumen de solicitudes, mensajes y actividad.'],
  applications: ['Bandeja de solicitudes.', 'Revisa cada candidatura y actualiza el proceso.'],
  messages: ['Mensajes de talento.', 'Consultas recibidas desde el formulario público.'],
  leads: ['Propuestas de empresas.', 'Oportunidades comerciales recibidas desde la web.'],
  settings: ['Ajustes de notificación.', 'Configura el destino de los avisos del equipo.'],
  team: ['Equipo y accesos.', 'Administra usuarios autorizados e invitaciones.'],
}

const state = {
  applications: [],
  messages: [],
  leads: [],
  profiles: [],
  settings: null,
}
let selectedId = null
let adminProfile = null

const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
})[character])
const initials = (name) => String(name || 'SN').split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
const statusClass = (status) => `status-${String(status).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-')}`
const statusBadge = (status) => `<span class="status-badge ${statusClass(status)}">${escapeHtml(status)}</span>`
const selectOptions = (items, selected) => items.map((item) => `<option value="${escapeHtml(item)}" ${item === selected ? 'selected' : ''}>${escapeHtml(item)}</option>`).join('')
const staffRoleLabel = (role) => staffRoles.find(([value]) => value === role)?.[1] || role
const staffRoleOptions = (selected) => staffRoles.map(([value, label]) => `<option value="${escapeHtml(value)}" ${value === selected ? 'selected' : ''}>${escapeHtml(label)}</option>`).join('')

function dateLabel(date) {
  const value = new Date(date)
  if (Number.isNaN(value.getTime())) return 'Sin fecha'
  const hours = Math.round((Date.now() - value.getTime()) / 3600000)
  if (hours < 1) return 'Ahora mismo'
  if (hours < 24) return `Hace ${hours} h`
  return value.toLocaleDateString('es-DO', {
    day: 'numeric',
    month: 'short',
    year: value.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
  })
}

function showError(message) {
  const box = byId('dashboard-error')
  if (!box) return
  box.textContent = message
  box.classList.add('show')
  box.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
}

function clearError() {
  const box = byId('dashboard-error')
  if (!box) return
  box.textContent = ''
  box.classList.remove('show')
}

function setView(view) {
  document.querySelectorAll('[data-view]').forEach((item) => item.classList.toggle('active', item.dataset.view === view))
  document.querySelectorAll('.view').forEach((item) => item.classList.toggle('active', item.id === view))
  byId('view-title').textContent = titles[view]?.[0] || 'Centro de control.'
  byId('view-meta').textContent = titles[view]?.[1] || ''
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function filteredApplications() {
  const query = byId('search').value.trim().toLowerCase()
  const filter = byId('status-filter').value
  const sort = byId('sort').value
  const items = state.applications.filter((app) => {
    const searchable = `${app.full_name} ${app.email} ${app.phone} ${app.role_applied} ${app.status}`.toLowerCase()
    return (!query || searchable.includes(query)) && (filter === 'all' || app.status === filter)
  })
  return items.sort((a, b) => {
    if (sort === 'name') return String(a.full_name).localeCompare(String(b.full_name), 'es')
    if (sort === 'status') return String(a.status).localeCompare(String(b.status), 'es')
    return new Date(b.created_at) - new Date(a.created_at)
  })
}

function renderPipeline() {
  const active = ['Nueva', 'En revisión', 'Entrevista', 'Contratada']
  const total = state.applications.length || 1
  byId('pipeline').innerHTML = active.map((status) => {
    const count = state.applications.filter((app) => app.status === status).length
    const width = Math.max(count ? 10 : 0, Math.round((count / total) * 100))
    return `<div class="pipeline-row"><b>${escapeHtml(status)}</b><span class="bar"><i style="width:${width}%"></i></span><strong>${count}</strong></div>`
  }).join('')
  byId('pipeline-total').textContent = `${state.applications.length} total`
}

function renderRecent() {
  const recent = byId('recent')
  if (!state.applications.length) {
    recent.innerHTML = '<p class="empty">Aún no hay solicitudes registradas.</p>'
    return
  }
  recent.innerHTML = state.applications.slice(0, 5).map((app) => `
    <div class="recent-item">
      <span class="avatar">${escapeHtml(initials(app.full_name))}</span>
      <div><b>${escapeHtml(app.full_name || 'Sin nombre')}</b><small>${escapeHtml(app.role_applied || 'Solicitud general')} · ${escapeHtml(dateLabel(app.created_at))}</small></div>
      ${statusBadge(app.status)}
    </div>
  `).join('')
}

function answerLabel(key) {
  const labels = {
    position: 'Posición',
    employmentMode: 'Modalidad de empleo',
    englishLevel: 'Nivel de inglés',
    referralSource: 'Cómo se enteró',
    fullName: 'Nombre completo',
    address: 'Dirección',
    birthDate: 'Fecha de nacimiento',
    cedula: 'Número de cédula',
    whatsapp: 'WhatsApp',
    email: 'Correo electrónico',
    transportation: 'Transporte al trabajo',
    traveledAbroad: 'Ha viajado fuera del país',
    travelDestinations: 'Destinos de viaje',
    hasVisa: 'Visa EE. UU. o Europa',
    familyAtCompany: 'Familiar en eWorker',
    financialAssets: 'Bancos / financieras',
    financialObligations: 'Obligaciones financieras',
    justiceIssues: 'Problemas con la justicia',
    academicSummary: 'Resumen académico',
    currentlyStudying: 'Estudia actualmente',
    educationLevel: 'Nivel académico',
    courses: 'Cursos completados',
    technologyLevel: 'Manejo de tecnología',
    workSummary: 'Resumen laboral',
    job1Company: 'Empleo 1 · Compañía',
    job1LastDate: 'Empleo 1 · Última fecha',
    job1ExitReason: 'Empleo 1 · Razón de salida',
    job2Company: 'Empleo 2 · Compañía',
    job2LastDate: 'Empleo 2 · Última fecha',
    job2ExitReason: 'Empleo 2 · Razón de salida',
    job3Company: 'Empleo 3 · Compañía',
    job3LastDate: 'Empleo 3 · Última fecha',
    job3ExitReason: 'Empleo 3 · Razón de salida',
    currentlyEmployed: 'Labora actualmente',
    lastSalary: 'Último salario',
    yearsSales: 'Años en ventas',
    yearsCustomerService: 'Años en servicio al cliente',
    consent: 'Consentimiento',
  }
  return labels[key] || key.replace(/([A-Z])/g, ' $1').replace(/^./, (letter) => letter.toUpperCase())
}

function answerValue(value) {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function renderCandidateDetail(application) {
  const panel = byId('candidate-detail')
  if (!application) {
    panel.innerHTML = '<div class="detail-empty"><b>Selecciona una solicitud</b><span>El formulario completo aparecerá aquí.</span></div>'
    return
  }
  const answers = Object.entries(application.answers || {})
    .map(([key, value]) => `<div class="answer-row"><b>${escapeHtml(answerLabel(key))}</b><span>${escapeHtml(answerValue(value))}</span></div>`)
    .join('')
  panel.innerHTML = `
    <div class="detail-top"><span class="detail-avatar">${escapeHtml(initials(application.full_name))}</span>${statusBadge(application.status)}</div>
    <h2>${escapeHtml(application.full_name || 'Sin nombre')}</h2>
    <p class="eyebrow">${escapeHtml(application.role_applied || 'SOLICITUD GENERAL')}</p>
    <div class="detail-contact">
      <a href="mailto:${escapeHtml(application.email)}">${escapeHtml(application.email || 'Sin correo')}</a><br>
      <a href="tel:${escapeHtml(application.phone)}">${escapeHtml(application.phone || 'Sin teléfono')}</a><br>
      Recibida ${escapeHtml(dateLabel(application.created_at))}
    </div>
    <div class="answer-grid">${answers || '<div class="answer-row"><span>Sin respuestas adicionales.</span></div>'}</div>
    <div class="detail-field"><label for="candidate-status">ETAPA DEL PROCESO</label><select id="candidate-status" data-edit-status="${escapeHtml(application.id)}">${selectOptions(applicationStatuses, application.status)}</select></div>
    <div class="detail-field"><label for="candidate-note">NOTA INTERNA</label><textarea id="candidate-note" data-edit-note="${escapeHtml(application.id)}" placeholder="Añade una nota para el equipo">${escapeHtml(application.internal_note || '')}</textarea></div>
    <button class="primary detail-save" data-save-note="${escapeHtml(application.id)}">Guardar seguimiento</button>
  `
}

function renderApplications() {
  const applications = filteredApplications()
  byId('results-count').textContent = `${applications.length} ${applications.length === 1 ? 'solicitud' : 'solicitudes'}`
  if (!applications.length) {
    byId('applications-list').innerHTML = '<p class="empty">No hay solicitudes que coincidan con estos filtros.</p>'
    selectedId = null
    renderCandidateDetail(null)
    return
  }
  if (!applications.some((app) => app.id === selectedId)) selectedId = applications[0].id
  byId('applications-list').innerHTML = applications.map((app) => `
    <button class="application-row ${app.id === selectedId ? 'active' : ''}" data-candidate="${escapeHtml(app.id)}">
      <span class="avatar">${escapeHtml(initials(app.full_name))}</span>
      <span class="application-info"><b>${escapeHtml(app.full_name || 'Sin nombre')}</b><small>${escapeHtml(app.role_applied || 'Solicitud general')} · ${escapeHtml(dateLabel(app.created_at))}</small></span>
      ${statusBadge(app.status)}
    </button>
  `).join('')
  renderCandidateDetail(applications.find((app) => app.id === selectedId))
}

function renderMessages() {
  byId('messages-count').textContent = state.messages.length
  byId('messages-list').innerHTML = state.messages.length
    ? state.messages.map((message) => `
      <article class="data-record">
        <div class="data-record-head">
          <div><h3>${escapeHtml(message.name)}</h3><small>${escapeHtml(message.email)} · ${escapeHtml(dateLabel(message.created_at))}</small></div>
          <select data-message-status="${escapeHtml(message.id)}" aria-label="Estado del mensaje">${selectOptions(messageStatuses, message.status)}</select>
        </div>
        <p><b>${escapeHtml(message.subject || 'Sin asunto')}</b></p>
        <p>${escapeHtml(message.message)}</p>
      </article>
    `).join('')
    : '<p class="empty">No hay mensajes recibidos.</p>'
}

function renderLeads() {
  byId('leads-count').textContent = state.leads.length
  byId('leads-list').innerHTML = state.leads.length
    ? state.leads.map((lead) => `
      <article class="data-record">
        <div class="data-record-head">
          <div><h3>${escapeHtml(lead.contact_name)}</h3><small>${escapeHtml(lead.email)} · ${escapeHtml(dateLabel(lead.created_at))}</small></div>
          <select data-lead-status="${escapeHtml(lead.id)}" aria-label="Estado de la propuesta">${selectOptions(leadStatuses, lead.status)}</select>
        </div>
        <p><b>${escapeHtml(lead.subject || 'Sin asunto')}</b></p>
        <p>${escapeHtml(lead.message)}</p>
      </article>
    `).join('')
    : '<p class="empty">No hay propuestas recibidas.</p>'
}

function renderTeam() {
  const activeCount = state.profiles.filter((profile) => profile.active).length
  byId('team-count').textContent = state.profiles.length
  byId('staff-online-count').textContent = `${activeCount} activos`
  byId('staff-list').innerHTML = state.profiles.length
    ? state.profiles.map((profile) => {
      const ownProfile = profile.id === adminProfile?.id
      const roleControl = `<select class="staff-action" data-staff-role="${escapeHtml(profile.id)}" aria-label="Rol de ${escapeHtml(profile.full_name || profile.email)}" ${ownProfile ? 'disabled title="No puedes cambiar tu propio rol desde esta sesión"' : ''}>${staffRoleOptions(profile.role)}</select>`
      return `
        <div class="staff-row">
          <span class="avatar">${escapeHtml(initials(profile.full_name || profile.email))}</span>
          <div class="staff-info">
            <b>${escapeHtml(profile.full_name || 'Sin nombre')}</b>
            <small>${escapeHtml(profile.email)} · ${escapeHtml(staffRoleLabel(profile.role))}</small>
            ${roleControl}
            <span class="presence ${profile.active ? 'online' : ''}">${profile.active ? 'Acceso activo' : 'Acceso pausado'}</span>
          </div>
          <button class="staff-action" data-staff-toggle="${escapeHtml(profile.id)}" ${ownProfile ? 'disabled title="No puedes pausar tu propia cuenta desde esta sesión"' : ''}>${profile.active ? 'Pausar' : 'Activar'}</button>
        </div>
      `
    }).join('')
    : '<p class="empty">No hay perfiles autorizados.</p>'
}

function renderOverview() {
  const metrics = applicationMetrics(state.applications)
  byId('total').textContent = metrics.total
  byId('new').textContent = metrics.newCount
  byId('progress').textContent = metrics.progress
  byId('hired').textContent = metrics.hired
  byId('nav-count').textContent = metrics.total
  byId('total-sub').textContent = metrics.total ? `${metrics.total} registros compartidos` : 'Sin solicitudes todavía'
  byId('focus-title').textContent = metrics.newCount
    ? `${metrics.newCount} solicitud${metrics.newCount === 1 ? '' : 'es'} nueva${metrics.newCount === 1 ? '' : 's'} por revisar.`
    : metrics.total ? 'La bandeja está al día.' : 'La operación está lista.'
  byId('focus-copy').textContent = metrics.newCount
    ? 'Prioriza los perfiles nuevos para mantener una respuesta rápida.'
    : metrics.total ? 'Revisa el pipeline y programa el siguiente seguimiento.' : 'Las nuevas solicitudes aparecerán aquí después de enviarse desde la web.'
  renderPipeline()
  renderRecent()
}

function populateSettings() {
  if (!state.settings) return
  const settings = byId('settings-form')
  if (settings) {
    settings.elements.notificationEmail.value = state.settings.notification_email || ''
    settings.elements.emailSubject.value = state.settings.email_subject || ''
    settings.elements.autoReply.checked = Boolean(state.settings.auto_reply)
  }
}

function renderAll() {
  renderOverview()
  renderApplications()
  renderMessages()
  renderLeads()
  renderTeam()
}

async function loadDashboard() {
  clearError()
  byId('applications-list').innerHTML = '<p class="empty">Cargando solicitudes…</p>'
  byId('messages-list').innerHTML = '<p class="empty">Cargando mensajes…</p>'
  byId('leads-list').innerHTML = '<p class="empty">Cargando propuestas…</p>'
  byId('staff-list').innerHTML = '<p class="empty">Cargando equipo…</p>'
  try {
    const [applications, messages, leads, settings, profiles] = await Promise.all([
      listApplications(),
      listContactMessages(),
      listBusinessLeads(),
      getSiteSettings(),
      listProfiles(),
    ])
    state.applications = applications
    state.messages = messages
    state.leads = leads
    state.settings = settings
    state.profiles = profiles
    renderAll()
    populateSettings()
  } catch (error) {
    showError(`No pudimos cargar el panel. ${error?.message || 'Inténtalo nuevamente.'}`)
  }
}

async function refreshLiveRecord(event) {
  const kind = event?.detail?.kind
  try {
    switch (kind) {
      case 'applications':
        state.applications = await listApplications()
        renderOverview()
        renderApplications()
        break
      case 'messages':
        state.messages = await listContactMessages()
        renderMessages()
        break
      case 'leads':
        state.leads = await listBusinessLeads()
        renderLeads()
        break
      default:
        return
    }
    clearError()
  } catch (error) {
    showError(`No pudimos actualizar el panel en vivo. ${error?.message || 'Inténtalo nuevamente.'}`)
  }
}

function bindNavigation() {
  document.querySelectorAll('[data-view]').forEach((button) => button.addEventListener('click', () => setView(button.dataset.view)))
  document.querySelectorAll('[data-go]').forEach((button) => button.addEventListener('click', () => setView(button.dataset.go)))
  ;['search', 'status-filter', 'sort'].forEach((id) => byId(id).addEventListener(id === 'search' ? 'input' : 'change', renderApplications))
}

function bindApplicationActions() {
  byId('applications-list').addEventListener('click', (event) => {
    const target = event.target.closest('[data-candidate]')
    if (!target) return
    selectedId = target.dataset.candidate
    renderApplications()
  })

  byId('candidate-detail').addEventListener('change', async (event) => {
    const target = event.target
    if (!target.matches('[data-edit-status]')) return
    const application = state.applications.find((item) => item.id === target.dataset.editStatus)
    if (!application) return
    const previous = application.status
    target.disabled = true
    try {
      await updateApplication(application.id, { status: target.value })
      application.status = target.value
      clearError()
      renderAll()
    } catch (error) {
      target.value = previous
      showError(`No se pudo cambiar el estado. ${error?.message || ''}`)
    } finally {
      target.disabled = false
    }
  })

  byId('candidate-detail').addEventListener('click', async (event) => {
    const target = event.target.closest('[data-save-note]')
    if (!target) return
    const application = state.applications.find((item) => item.id === target.dataset.saveNote)
    if (!application) return
    const note = byId('candidate-note').value.trim()
    target.disabled = true
    try {
      await updateApplication(application.id, { internal_note: note })
      application.internal_note = note
      clearError()
      target.textContent = 'Guardado'
      window.setTimeout(() => { target.textContent = 'Guardar seguimiento' }, 1200)
    } catch (error) {
      showError(`No se pudo guardar la nota. ${error?.message || ''}`)
    } finally {
      target.disabled = false
    }
  })
}

function bindOperationalLists() {
  byId('messages-list').addEventListener('change', async (event) => {
    const target = event.target
    if (!target.matches('[data-message-status]')) return
    const row = state.messages.find((item) => item.id === target.dataset.messageStatus)
    if (!row) return
    const previous = row.status
    target.disabled = true
    try {
      await updateContactMessageStatus(row.id, target.value)
      row.status = target.value
      clearError()
    } catch (error) {
      target.value = previous
      showError(`No se pudo actualizar el mensaje. ${error?.message || ''}`)
    } finally {
      target.disabled = false
    }
  })

  byId('leads-list').addEventListener('change', async (event) => {
    const target = event.target
    if (!target.matches('[data-lead-status]')) return
    const row = state.leads.find((item) => item.id === target.dataset.leadStatus)
    if (!row) return
    const previous = row.status
    target.disabled = true
    try {
      await updateBusinessLeadStatus(row.id, target.value)
      row.status = target.value
      clearError()
    } catch (error) {
      target.value = previous
      showError(`No se pudo actualizar la propuesta. ${error?.message || ''}`)
    } finally {
      target.disabled = false
    }
  })
}

function bindSettings() {
  byId('settings-form').addEventListener('submit', async (event) => {
    event.preventDefault()
    const form = event.currentTarget
    const button = form.querySelector('button[type="submit"], button:not([type])')
    const note = byId('settings-note')
    button.disabled = true
    note.textContent = 'Guardando…'
    const values = Object.fromEntries(new FormData(form))
    const patch = {
      notification_email: values.notificationEmail,
      email_subject: values.emailSubject,
      auto_reply: form.elements.autoReply.checked,
    }
    try {
      await updateSiteSettings(patch)
      Object.assign(state.settings, patch)
      note.textContent = 'Ajustes guardados.'
      clearError()
    } catch (error) {
      note.textContent = 'No se pudieron guardar los ajustes.'
      showError(error?.message || 'Error guardando ajustes.')
    } finally {
      button.disabled = false
    }
  })
}

function bindTeam() {
  byId('staff-form').addEventListener('submit', async (event) => {
    event.preventDefault()
    const form = event.currentTarget
    const button = form.querySelector('button[type="submit"], button:not([type])')
    const note = byId('staff-note')
    const values = Object.fromEntries(new FormData(form))
    button.disabled = true
    note.textContent = 'Enviando invitación…'
    try {
      await inviteRecruiter(String(values.name || '').trim(), String(values.email || '').trim())
      note.textContent = 'Invitación enviada. El usuario aparecerá cuando se cree su perfil.'
      form.reset()
      state.profiles = await listProfiles()
      renderTeam()
      clearError()
    } catch (error) {
      note.textContent = 'No se pudo enviar la invitación.'
      showError(`No se pudo completar la invitación. ${error?.message || ''}`)
    } finally {
      button.disabled = false
    }
  })

  byId('staff-list').addEventListener('change', async (event) => {
    const target = event.target
    if (!target.matches('[data-staff-role]') || target.disabled) return
    const profile = state.profiles.find((item) => item.id === target.dataset.staffRole)
    if (!profile) return
    const previous = profile.role
    target.disabled = true
    try {
      await updateProfile(profile.id, { role: target.value })
      profile.role = target.value
      renderTeam()
      clearError()
    } catch (error) {
      target.value = previous
      target.disabled = false
      showError(`No se pudo cambiar el rol. ${error?.message || ''}`)
    }
  })

  byId('staff-list').addEventListener('click', async (event) => {
    const target = event.target.closest('[data-staff-toggle]')
    if (!target || target.disabled) return
    const profile = state.profiles.find((item) => item.id === target.dataset.staffToggle)
    if (!profile) return
    target.disabled = true
    try {
      await updateProfile(profile.id, { active: !profile.active })
      profile.active = !profile.active
      renderTeam()
      clearError()
    } catch (error) {
      showError(`No se pudo cambiar el acceso. ${error?.message || ''}`)
      target.disabled = false
    }
  })
}

function bindExportAndLogout() {
  byId('download').addEventListener('click', () => {
    const url = URL.createObjectURL(new Blob([csvForApplications(state.applications)], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'solicitudes-eworker360.csv'
    link.click()
    URL.revokeObjectURL(url)
  })

  byId('logout').addEventListener('click', async () => {
    const button = byId('logout')
    button.disabled = true
    try {
      await signOut()
    } finally {
      window.location.replace('staff-login.html')
    }
  })
}

async function main() {
  adminProfile = await requireAdmin()
  if (!adminProfile) return
  byId('admin-name').textContent = adminProfile.full_name || 'Administrador'
  byId('admin-email').textContent = adminProfile.email || ''

  bindNavigation()
  bindApplicationActions()
  bindOperationalLists()
  bindSettings()
  bindTeam()
  bindExportAndLogout()
  window.addEventListener(LIVE_RECORD_EVENT, refreshLiveRecord)
  await loadDashboard()
}

main().catch((error) => showError(error?.message || 'No se pudo iniciar el panel administrativo.'))
