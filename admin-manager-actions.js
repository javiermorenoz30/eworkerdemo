import { getCurrentProfile } from './auth.js'
import { deleteOperationalRecord, inviteStaff } from './data-api.js'

const MANAGER_ROLES = ['admin', 'boss']

function isManager(profile) {
  return Boolean(profile?.active && MANAGER_ROLES.includes(profile.role))
}

function ensureInviteRoleSelector() {
  const form = document.getElementById('staff-form')
  if (!form || form.elements.role) return

  const note = form.querySelector('.access-note')
  const label = document.createElement('label')
  label.textContent = 'Rol del acceso'

  const select = document.createElement('select')
  select.name = 'role'
  select.required = true
  select.innerHTML = `
    <option value="recruiter" selected>Reclutador</option>
    <option value="boss">Boss</option>
    <option value="admin">Administrador</option>
  `
  label.append(select)
  form.insertBefore(label, note)
}

function recordActionButton(type, id) {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'staff-action manager-delete-action'
  button.textContent = 'Eliminar'
  button.dataset.managerDeleteType = type
  button.dataset.managerDeleteId = id
  return button
}

function ensureDeleteControls() {
  document.querySelectorAll('#messages-list .data-record').forEach((record) => {
    if (record.querySelector('[data-manager-delete-type="contact_message"]')) return
    const select = record.querySelector('[data-message-status]')
    if (!select?.dataset.messageStatus) return
    const head = record.querySelector('.data-record-head')
    if (!head) return
    const actions = document.createElement('div')
    actions.className = 'manager-record-actions'
    actions.append(select, recordActionButton('contact_message', select.dataset.messageStatus))
    head.append(actions)
  })

  document.querySelectorAll('#leads-list .data-record').forEach((record) => {
    if (record.querySelector('[data-manager-delete-type="business_lead"]')) return
    const select = record.querySelector('[data-lead-status]')
    if (!select?.dataset.leadStatus) return
    const head = record.querySelector('.data-record-head')
    if (!head) return
    const actions = document.createElement('div')
    actions.className = 'manager-record-actions'
    actions.append(select, recordActionButton('business_lead', select.dataset.leadStatus))
    head.append(actions)
  })
}

function installStyles() {
  if (document.getElementById('manager-actions-style')) return
  const style = document.createElement('style')
  style.id = 'manager-actions-style'
  style.textContent = `
    .manager-record-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
    .manager-delete-action{border-color:#e5a7b3;color:#a12e45;background:#fff7f8}
    .manager-delete-action:hover{border-color:#c95e73;background:#fff0f3}
    .manager-delete-action:disabled{opacity:.55;cursor:wait}
    #staff-form select[name="role"]{width:100%;border:1px solid #d9dfed;border-radius:8px;background:#fbfcff;padding:11px;color:#17264d}
  `
  document.head.append(style)
}

function bindInviteCapture() {
  const form = document.getElementById('staff-form')
  if (!form || form.dataset.roleInviteBound === 'true') return
  form.dataset.roleInviteBound = 'true'

  form.addEventListener('submit', async (event) => {
    event.preventDefault()
    event.stopImmediatePropagation()

    const button = form.querySelector('button[type="submit"], button:not([type])')
    const note = document.getElementById('staff-note')
    const values = Object.fromEntries(new FormData(form))
    button.disabled = true
    note.textContent = 'Enviando invitación…'

    try {
      await inviteStaff(
        String(values.name || '').trim(),
        String(values.email || '').trim(),
        String(values.role || 'recruiter'),
      )
      note.textContent = 'Invitación enviada con el rol seleccionado.'
      form.reset()
      window.setTimeout(() => window.location.reload(), 700)
    } catch (error) {
      note.textContent = 'No se pudo enviar la invitación.'
      const box = document.getElementById('dashboard-error')
      if (box) {
        box.textContent = `No se pudo completar la invitación. ${error?.message || ''}`
        box.classList.add('show')
      }
    } finally {
      button.disabled = false
    }
  }, true)
}

function bindDeletion() {
  document.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-manager-delete-type]')
    if (!button) return

    const type = button.dataset.managerDeleteType
    const id = button.dataset.managerDeleteId
    const label = type === 'contact_message' ? 'mensaje' : 'propuesta'
    const confirmed = window.confirm(`Esta acción eliminará el ${label} permanentemente. ¿Deseas continuar?`)
    if (!confirmed) return

    button.disabled = true
    try {
      await deleteOperationalRecord(type, id)
      button.closest('.data-record')?.remove()
      const counter = document.getElementById(type === 'contact_message' ? 'messages-count' : 'leads-count')
      if (counter) counter.textContent = String(Math.max(0, Number(counter.textContent || 0) - 1))
    } catch (error) {
      const box = document.getElementById('dashboard-error')
      if (box) {
        box.textContent = `No se pudo eliminar el ${label}. ${error?.message || ''}`
        box.classList.add('show')
      }
      button.disabled = false
    }
  })
}

async function main() {
  const profile = await getCurrentProfile().catch(() => null)
  if (!isManager(profile)) return

  installStyles()
  ensureInviteRoleSelector()
  bindInviteCapture()
  bindDeletion()

  const observer = new MutationObserver(() => ensureDeleteControls())
  observer.observe(document.body, { childList: true, subtree: true })
  ensureDeleteControls()
}

main()
