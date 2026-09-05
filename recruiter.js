import { requireStaff, signOut } from './auth.js'
import {
  listApplications,
  listBusinessLeads,
  listContactMessages,
  updateApplication,
  updateBusinessLeadStatus,
  updateContactMessageStatus,
} from './data-api.js'
import { LIVE_RECORD_EVENT } from './staff-notifications.js'

const byId = (id) => document.getElementById(id)
const applicationStatuses = ['Nueva', 'En revisión', 'Entrevista', 'Contratada', 'Descartada']
const messageStatuses = ['Nuevo', 'En revisión', 'Respondido', 'Cerrado']
const leadStatuses = ['Nuevo', 'Contactado', 'Propuesta enviada', 'Negociación', 'Ganado', 'Descartado']
const state = { applications: [], messages: [], leads: [] }
let selectedId = null
let member = null

const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character])
const initials = (name) => String(name || 'SN').split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
const options = (statuses, selected) => statuses.map((status) => `<option value="${escapeHtml(status)}" ${status === selected ? 'selected' : ''}>${escapeHtml(status)}</option>`).join('')

function dateLabel(date) {
  const value = new Date(date)
  if (Number.isNaN(value.getTime())) return 'Sin fecha'
  const hours = Math.round((Date.now() - value.getTime()) / 3600000)
  if (hours < 1) return 'Ahora mismo'
  if (hours < 24) return `Hace ${hours} h`
  return value.toLocaleDateString('es-DO', { day: 'numeric', month: 'short', year: value.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined })
}

function showError(message) {
  const box = byId('recruiter-error')
  box.textContent = message
  box.classList.add('show')
}

function clearError() {
  const box = byId('recruiter-error')
  box.textContent = ''
  box.classList.remove('show')
}

function setView(view) {
  document.querySelectorAll('[data-recruiter-view]').forEach((button) => button.classList.toggle('active', button.dataset.recruiterView === view))
  document.querySelectorAll('.recruiter-view').forEach((section) => section.classList.toggle('active', section.id === `recruiter-view-${view}`))
}

function answerLabel(key) {
  const labels = {
    position: 'Posición', employmentMode: 'Modalidad de empleo', englishLevel: 'Nivel de inglés', referralSource: 'Cómo se enteró', fullName: 'Nombre completo', address: 'Dirección', birthDate: 'Fecha de nacimiento', cedula: 'Número de cédula', whatsapp: 'WhatsApp', email: 'Correo electrónico', transportation: 'Transporte al trabajo', traveledAbroad: 'Ha viajado fuera del país', travelDestinations: 'Destinos de viaje', hasVisa: 'Visa EE. UU. o Europa', familyAtCompany: 'Familiar en eWorker', financialAssets: 'Bancos / financieras', financialObligations: 'Obligaciones financieras', justiceIssues: 'Problemas con la justicia', academicSummary: 'Resumen académico', currentlyStudying: 'Estudia actualmente', educationLevel: 'Nivel académico', courses: 'Cursos completados', technologyLevel: 'Manejo de tecnología', workSummary: 'Resumen laboral', job1Company: 'Empleo 1 · Compañía', job1LastDate: 'Empleo 1 · Última fecha', job1ExitReason: 'Empleo 1 · Razón de salida', job2Company: 'Empleo 2 · Compañía', job2LastDate: 'Empleo 2 · Última fecha', job2ExitReason: 'Empleo 2 · Razón de salida', job3Company: 'Empleo 3 · Compañía', job3LastDate: 'Empleo 3 · Última fecha', job3ExitReason: 'Empleo 3 · Razón de salida', currentlyEmployed: 'Labora actualmente', lastSalary: 'Último salario', yearsSales: 'Años en ventas', yearsCustomerService: 'Años en servicio al cliente', consent: 'Consentimiento',
  }
  return labels[key] || key.replace(/([A-Z])/g, ' $1').replace(/^./, (letter) => letter.toUpperCase())
}

function answerValue(value) {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function filteredApplications() {
  const query = byId('recruiter-search').value.trim().toLowerCase()
  const filter = byId('recruiter-filter').value
  return state.applications.filter((application) => {
    const text = `${application.full_name} ${application.email} ${application.phone} ${application.role_applied}`.toLowerCase()
    return (!query || text.includes(query)) && (filter === 'all' || application.status === filter)
  })
}

function renderCandidateDetail(application) {
  const panel = byId('recruiter-candidate-detail')
  if (!application) {
    panel.innerHTML = '<div class="detail-empty"><b>Selecciona una solicitud</b><span>El formulario completo aparecerá aquí.</span></div>'
    return
  }

  const answers = Object.entries(application.answers || {}).map(([key, value]) => `<div class="answer-row"><b>${escapeHtml(answerLabel(key))}</b><span>${escapeHtml(answerValue(value))}</span></div>`).join('')
  panel.innerHTML = `<div class="detail-heading"><div><h2>${escapeHtml(application.full_name || 'Sin nombre')}</h2><small>${escapeHtml(application.role_applied || 'Solicitud general')} · ${escapeHtml(dateLabel(application.created_at))}</small></div><span class="candidate-avatar">${escapeHtml(initials(application.full_name))}</span></div><div class="detail-contact"><a href="mailto:${escapeHtml(application.email)}">${escapeHtml(application.email || 'Sin correo')}</a><br><a href="tel:${escapeHtml(application.phone)}">${escapeHtml(application.phone || 'Sin teléfono')}</a></div><div class="answer-grid">${answers || '<div class="answer-row"><span>Sin respuestas adicionales.</span></div>'}</div><div class="detail-field"><label>ETAPA DEL PROCESO</label><select data-detail-status="${escapeHtml(application.id)}">${options(applicationStatuses, application.status)}</select></div><div class="detail-field"><label>NOTA INTERNA</label><textarea id="recruiter-note" placeholder="Añade seguimiento para el equipo">${escapeHtml(application.internal_note || '')}</textarea></div><button class="primary detail-save" data-save-recruiter-note="${escapeHtml(application.id)}">Guardar seguimiento</button>`
}

function renderApplications() {
  const applications = filteredApplications()
  byId('recruiter-count').textContent = `${applications.length} ${applications.length === 1 ? 'solicitud' : 'solicitudes'}`

  if (!applications.length) {
    byId('recruiter-applications').innerHTML = '<p class="empty">No hay solicitudes que coincidan con los filtros.</p>'
    selectedId = null
    renderCandidateDetail(null)
    return
  }

  if (!applications.some((application) => application.id === selectedId)) selectedId = applications[0].id
  byId('recruiter-applications').innerHTML = applications.map((application) => `<article class="recruiter-row ${application.id === selectedId ? 'active' : ''}" data-candidate="${escapeHtml(application.id)}"><span class="candidate-avatar">${escapeHtml(initials(application.full_name))}</span><div class="candidate-info"><b>${escapeHtml(application.full_name || 'Sin nombre')}</b><small>${escapeHtml(application.email || 'Sin correo')} · ${escapeHtml(application.role_applied || 'Solicitud general')} · ${escapeHtml(dateLabel(application.created_at))}</small></div><select data-status="${escapeHtml(application.id)}" aria-label="Estado de ${escapeHtml(application.full_name)}">${options(applicationStatuses, application.status)}</select></article>`).join('')
  renderCandidateDetail(applications.find((application) => application.id === selectedId))
}

function renderMessages() {
  byId('recruiter-messages').innerHTML = state.messages.length ? state.messages.map((message) => `<article class="ops-card"><div class="ops-head"><div><h3>${escapeHtml(message.name)}</h3><small>${escapeHtml(message.email)} · ${escapeHtml(dateLabel(message.created_at))}</small></div><select data-message-status="${escapeHtml(message.id)}">${options(messageStatuses, message.status)}</select></div><p><b>${escapeHtml(message.subject || 'Sin asunto')}</b></p><p>${escapeHtml(message.message)}</p></article>`).join('') : '<p class="empty">No hay mensajes recibidos.</p>'
}

function renderLeads() {
  byId('recruiter-leads').innerHTML = state.leads.length ? state.leads.map((lead) => `<article class="ops-card"><div class="ops-head"><div><h3>${escapeHtml(lead.contact_name)}</h3><small>${escapeHtml(lead.email)} · ${escapeHtml(dateLabel(lead.created_at))}</small></div><select data-lead-status="${escapeHtml(lead.id)}">${options(leadStatuses, lead.status)}</select></div><p><b>${escapeHtml(lead.subject || 'Sin asunto')}</b></p><p>${escapeHtml(lead.message)}</p></article>`).join('') : '<p class="empty">No hay propuestas recibidas.</p>'
}

async function loadData() {
  byId('recruiter-applications').innerHTML = '<p class="empty">Cargando solicitudes…</p>'
  try {
    const [applications, messages, leads] = await Promise.all([
      listApplications(), listContactMessages(), listBusinessLeads(),
    ])
    state.applications = applications
    state.messages = messages
    state.leads = leads
    renderApplications()
    renderMessages()
    renderLeads()
  } catch (error) {
    showError(`No pudimos cargar los datos desde Supabase. ${error?.message || 'Inténtalo nuevamente.'}`)
  }
}

async function refreshLiveRecord(event) {
  const kind = event?.detail?.kind
  try {
    switch (kind) {
      case 'applications':
        state.applications = await listApplications()
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

function bindEvents() {
  document.querySelectorAll('[data-recruiter-view]').forEach((button) => button.addEventListener('click', () => setView(button.dataset.recruiterView)))
  byId('recruiter-search').addEventListener('input', renderApplications)
  byId('recruiter-filter').addEventListener('change', renderApplications)

  byId('recruiter-applications').addEventListener('click', (event) => {
    if (event.target.closest('select')) return
    const row = event.target.closest('[data-candidate]')
    if (!row) return
    selectedId = row.dataset.candidate
    renderApplications()
  })

  byId('recruiter-applications').addEventListener('change', async (event) => {
    const target = event.target
    if (!target.matches('[data-status]')) return
    const application = state.applications.find((item) => item.id === target.dataset.status)
    if (!application) return
    const previous = application.status
    target.disabled = true
    try {
      await updateApplication(application.id, { status: target.value })
      application.status = target.value
      clearError()
      renderApplications()
    } catch (error) {
      target.value = previous
      showError(`No se pudo actualizar la solicitud. ${error?.message || ''}`)
    } finally { target.disabled = false }
  })

  byId('recruiter-candidate-detail').addEventListener('change', async (event) => {
    const target = event.target
    if (!target.matches('[data-detail-status]')) return
    const application = state.applications.find((item) => item.id === target.dataset.detailStatus)
    if (!application) return
    const previous = application.status
    target.disabled = true
    try {
      await updateApplication(application.id, { status: target.value })
      application.status = target.value
      clearError()
      renderApplications()
    } catch (error) {
      target.value = previous
      showError(`No se pudo actualizar la etapa. ${error?.message || ''}`)
    } finally { target.disabled = false }
  })

  byId('recruiter-candidate-detail').addEventListener('click', async (event) => {
    const button = event.target.closest('[data-save-recruiter-note]')
    if (!button) return
    const application = state.applications.find((item) => item.id === button.dataset.saveRecruiterNote)
    if (!application) return
    const note = byId('recruiter-note').value.trim()
    button.disabled = true
    try {
      await updateApplication(application.id, { internal_note: note })
      application.internal_note = note
      button.textContent = 'Guardado'
      clearError()
      window.setTimeout(() => { button.textContent = 'Guardar seguimiento' }, 1200)
    } catch (error) {
      showError(`No se pudo guardar la nota. ${error?.message || ''}`)
    } finally { button.disabled = false }
  })

  byId('recruiter-messages').addEventListener('change', async (event) => {
    const target = event.target
    if (!target.matches('[data-message-status]')) return
    const message = state.messages.find((item) => item.id === target.dataset.messageStatus)
    if (!message) return
    const previous = message.status
    target.disabled = true
    try {
      await updateContactMessageStatus(message.id, target.value)
      message.status = target.value
      clearError()
    } catch (error) {
      target.value = previous
      showError(`No se pudo actualizar el mensaje. ${error?.message || ''}`)
    } finally { target.disabled = false }
  })

  byId('recruiter-leads').addEventListener('change', async (event) => {
    const target = event.target
    if (!target.matches('[data-lead-status]')) return
    const lead = state.leads.find((item) => item.id === target.dataset.leadStatus)
    if (!lead) return
    const previous = lead.status
    target.disabled = true
    try {
      await updateBusinessLeadStatus(lead.id, target.value)
      lead.status = target.value
      clearError()
    } catch (error) {
      target.value = previous
      showError(`No se pudo actualizar la propuesta. ${error?.message || ''}`)
    } finally { target.disabled = false }
  })

  byId('logout').addEventListener('click', async () => {
    const button = byId('logout')
    button.disabled = true
    try { await signOut() } finally { window.location.replace('staff-login.html') }
  })
}

async function main() {
  member = await requireStaff()
  if (!member) return
  byId('recruiter-name').textContent = member.full_name || 'equipo'
  byId('recruiter-avatar').textContent = initials(member.full_name || member.email)
  byId('recruiter-role').textContent = member.role === 'admin' ? 'Administrador' : 'Reclutador'
  byId('recruiter-email').textContent = member.email || 'Acceso operativo'
  bindEvents()
  window.addEventListener(LIVE_RECORD_EVENT, refreshLiveRecord)
  await loadData()
}

main().catch((error) => showError(error?.message || 'No se pudo iniciar el portal de reclutamiento.'))
