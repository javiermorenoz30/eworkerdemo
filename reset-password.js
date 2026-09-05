import { supabase } from './supabase-client.js'

const form = document.querySelector('#reset-password-form')
const note = document.querySelector('#reset-password-note')
const submit = form?.querySelector('button[type="submit"]')

async function ensureSession() {
  let { data: sessionData, error: sessionError } = await supabase.auth.getSession()
  if (sessionError) throw sessionError
  if (sessionData?.session) return sessionData.session

  const code = new URLSearchParams(window.location.search).get('code')
  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) throw error
    return data.session
  }

  return null
}

async function initialize() {
  if (!form) return

  try {
    const session = await ensureSession()
    if (!session) {
      note.textContent = 'Este enlace no es válido o ya expiró. Solicita uno nuevo desde la pantalla de acceso.'
      submit.disabled = true
      return
    }
  } catch (error) {
    note.textContent = error?.message || 'No pudimos validar este enlace.'
    submit.disabled = true
    return
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault()
    note.classList.remove('success')

    const values = Object.fromEntries(new FormData(form))
    const password = String(values.password || '')
    const confirmation = String(values.passwordConfirm || '')

    if (password.length < 8) {
      note.textContent = 'La contraseña debe tener al menos 8 caracteres.'
      return
    }
    if (password !== confirmation) {
      note.textContent = 'Las contraseñas no coinciden.'
      return
    }

    submit.disabled = true
    note.textContent = 'Guardando contraseña…'

    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      await supabase.auth.signOut()
      window.location.replace('staff-login.html?password=updated')
    } catch (error) {
      note.textContent = error?.message || 'No pudimos actualizar la contraseña.'
      submit.disabled = false
    }
  })
}

initialize()
