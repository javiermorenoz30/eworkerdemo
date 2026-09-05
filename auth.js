import { supabase } from './supabase-client.js'
import { isManagerProfile, routeForProfile } from './domain.js'

const profileColumns = 'id,email,full_name,role,active'

export async function getCurrentProfile() {
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData?.user) return null

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select(profileColumns)
    .eq('id', userData.user.id)
    .maybeSingle()

  if (profileError) throw profileError
  return profile || null
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error

  const profile = await getCurrentProfile()
  const route = routeForProfile(profile)
  if (!profile?.active || !route) {
    await supabase.auth.signOut()
    throw new Error('Tu cuenta no tiene un acceso activo al portal de eWorker360.')
  }

  return { user: data.user, profile }
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

function redirectToLogin() {
  const target = new URL('staff-login.html', window.location.href)
  window.location.replace(target.href)
}

export async function requireAdmin() {
  const profile = await getCurrentProfile()
  if (!isManagerProfile(profile)) {
    await supabase.auth.signOut().catch(() => {})
    redirectToLogin()
    return null
  }
  return profile
}

export async function requireStaff() {
  const profile = await getCurrentProfile()
  if (!profile?.active || !['admin', 'boss', 'recruiter'].includes(profile.role)) {
    await supabase.auth.signOut().catch(() => {})
    redirectToLogin()
    return null
  }
  return profile
}

export async function sendPasswordRecovery(email) {
  const redirectTo = new URL('reset-password.html', window.location.href).href
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })
  if (error) throw error
}

async function initializeLoginPage() {
  const form = document.querySelector('#staff-login-form')
  if (!form) return

  const note = document.querySelector('#login-note')
  const forgot = document.querySelector('#forgot-password')
  const submit = form.querySelector('button[type="submit"]')

  const params = new URLSearchParams(window.location.search)
  if (params.get('password') === 'updated') {
    note.textContent = 'Contraseña actualizada. Ya puedes iniciar sesión.'
    note.classList.add('success')
  }

  try {
    const existing = await getCurrentProfile()
    const route = routeForProfile(existing)
    if (route) {
      window.location.replace(route)
      return
    }
  } catch {
    // Keep the login form available if a stale session cannot load a profile.
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault()
    note.classList.remove('success')
    note.textContent = 'Verificando acceso…'
    submit.disabled = true

    try {
      const values = Object.fromEntries(new FormData(form))
      const { profile } = await signIn(String(values.email || '').trim(), String(values.password || ''))
      window.location.assign(routeForProfile(profile))
    } catch (error) {
      note.textContent = error?.message || 'No pudimos iniciar sesión con esos datos.'
    } finally {
      submit.disabled = false
    }
  })

  forgot?.addEventListener('click', async () => {
    note.classList.remove('success')
    const email = String(form.elements.email?.value || '').trim()
    if (!email) {
      note.textContent = 'Escribe tu correo primero para enviarte el enlace de recuperación.'
      form.elements.email?.focus()
      return
    }

    forgot.disabled = true
    note.textContent = 'Enviando enlace de recuperación…'
    try {
      await sendPasswordRecovery(email)
      note.textContent = 'Revisa tu correo. Te enviamos un enlace para crear una nueva contraseña.'
      note.classList.add('success')
    } catch (error) {
      note.textContent = error?.message || 'No pudimos enviar el correo de recuperación.'
    } finally {
      forgot.disabled = false
    }
  })
}

initializeLoginPage()
