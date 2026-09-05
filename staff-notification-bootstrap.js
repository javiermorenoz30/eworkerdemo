import { getCurrentProfile } from './auth.js'
import {
  areStaffNotificationsEnabled,
  disableStaffNotifications,
  initStaffNotifications,
  requestStaffNotificationPermission,
} from './staff-notifications.js'

const STAFF_ROLES = ['admin', 'boss', 'recruiter']
const OPEN_VIEW_KEY = 'eworker360.staffNotifications.openView'
let controller = null

function validProfile(profile) {
  return Boolean(profile?.active && STAFF_ROLES.includes(profile.role))
}

function portalTarget(kind) {
  return document.querySelector(`[data-view="${kind}"]`) || document.querySelector(`[data-recruiter-view="${kind}"]`)
}

function openView(kind) {
  sessionStorage.setItem(OPEN_VIEW_KEY, kind)
  window.location.reload()
}

function restoreRequestedView() {
  const kind = sessionStorage.getItem(OPEN_VIEW_KEY)
  if (!kind) return
  sessionStorage.removeItem(OPEN_VIEW_KEY)
  window.setTimeout(() => portalTarget(kind)?.click(), 80)
}

function ensureButton() {
  let button = document.getElementById('staff-notification-toggle')
  if (button) return button

  button = document.createElement('button')
  button.type = 'button'
  button.id = 'staff-notification-toggle'
  button.className = 'ghost staff-notification-toggle'

  const adminHost = document.querySelector('.top-actions')
  const recruiterHost = document.querySelector('.staff-profile')
  ;(adminHost || recruiterHost || document.body).prepend(button)
  return button
}

function installStyles() {
  if (document.getElementById('staff-notification-style')) return
  const style = document.createElement('style')
  style.id = 'staff-notification-style'
  style.textContent = `
    .staff-notification-toggle{white-space:nowrap}
    .staff-toast-host{position:fixed;right:18px;top:18px;z-index:9999;display:grid;gap:10px;max-width:min(360px,calc(100vw - 36px))}
    .staff-toast{border:1px solid #cfd8ec;border-radius:12px;background:#fff;color:#17264d;padding:14px 16px;box-shadow:0 18px 50px rgba(16,35,79,.16);font:700 13px Arial;text-align:left;cursor:pointer}
    .staff-toast:hover{border-color:#7589bf}
  `
  document.head.append(style)
}

function updateButton(button) {
  button.textContent = areStaffNotificationsEnabled() ? 'Desactivar notificaciones' : 'Activar notificaciones'
}

function start(profile) {
  controller?.destroy?.()
  controller = initStaffNotifications({ profile, onOpen: openView })
}

async function main() {
  const profile = await getCurrentProfile().catch(() => null)
  if (!validProfile(profile)) return

  installStyles()
  restoreRequestedView()
  const button = ensureButton()
  updateButton(button)

  if (areStaffNotificationsEnabled()) start(profile)

  button.addEventListener('click', async () => {
    button.disabled = true
    try {
      if (areStaffNotificationsEnabled()) {
        controller?.destroy?.()
        controller = null
        disableStaffNotifications()
      } else {
        await requestStaffNotificationPermission()
        start(profile)
      }
      updateButton(button)
    } finally {
      button.disabled = false
    }
  })

  window.addEventListener('beforeunload', () => controller?.destroy?.(), { once: true })
}

main()
