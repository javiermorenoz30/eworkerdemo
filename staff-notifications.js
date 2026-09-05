import { supabase } from './supabase-client.js'

const PREFERENCE_KEY = 'eworker360.staffNotifications.enabled'
const STAFF_ROLES = ['admin', 'boss', 'recruiter']
const EVENT_CONFIG = {
  applications: { kind: 'applications', title: 'Llegó una nueva solicitud' },
  contact_messages: { kind: 'messages', title: 'Llegó un nuevo mensaje de talento' },
  business_leads: { kind: 'leads', title: 'Llegó una nueva propuesta de empresa' },
}

function allowedProfile(profile) {
  return Boolean(profile?.active && STAFF_ROLES.includes(profile.role))
}

function preferenceEnabled() {
  return localStorage.getItem(PREFERENCE_KEY) === 'true'
}

function setPreference(value) {
  localStorage.setItem(PREFERENCE_KEY, value ? 'true' : 'false')
}

function ensureToastHost() {
  let host = document.querySelector('[data-staff-toast-host]')
  if (!host) {
    host = document.createElement('div')
    host.dataset.staffToastHost = ''
    host.className = 'staff-toast-host'
    document.body.append(host)
  }
  return host
}

function showToast(config, onOpen) {
  const host = ensureToastHost()
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'staff-toast'
  button.textContent = config.title
  button.addEventListener('click', () => {
    button.remove()
    onOpen?.(config.kind)
  })
  host.append(button)
  window.setTimeout(() => button.remove(), 7000)
}

function showSystemNotification(config) {
  if (!('Notification' in window)) return
  if (Notification.permission !== 'granted' || !document.hidden) return
  const notice = new Notification(config.title, {
    body: 'Abre eWorker360 para revisar el nuevo registro.',
  })
  notice.onclick = () => {
    window.focus()
    notice.close()
  }
}

export async function requestStaffNotificationPermission() {
  setPreference(true)
  if (!('Notification' in window)) return { enabled: true, system: false }
  const permission = Notification.permission === 'default'
    ? await Notification.requestPermission()
    : Notification.permission
  return { enabled: true, system: permission === 'granted' }
}

export function disableStaffNotifications() {
  setPreference(false)
}

export function areStaffNotificationsEnabled() {
  return preferenceEnabled()
}

export function initStaffNotifications({ profile, onOpen } = {}) {
  if (!allowedProfile(profile) || !preferenceEnabled()) {
    return { enabled: false, destroy() {} }
  }

  const channel = supabase.channel(`staff-alerts-${profile.id || 'session'}`)

  const handleInsert = (table) => () => {
    const config = EVENT_CONFIG[table]
    showToast(config, onOpen)
    showSystemNotification(config)
  }

  for (const table of Object.keys(EVENT_CONFIG)) {
    channel.on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table,
    }, handleInsert(table))
  }

  channel.subscribe()

  return {
    enabled: true,
    destroy() {
      supabase.removeChannel(channel)
    },
  }
}

export { PREFERENCE_KEY }
