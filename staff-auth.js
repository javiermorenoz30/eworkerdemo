(() => {
  const sessionKey = 'eworker360-staff-session-v1'
  const store = window.EWorkerDemoStore
  const saveSession = (member) => localStorage.setItem(sessionKey, JSON.stringify({ id: member.id }))
  const getCurrentMember = () => {
    try {
      const session = JSON.parse(localStorage.getItem(sessionKey) || 'null')
      if (!session?.id) return null
      const member = store.getState().staff.find((entry) => entry.id === session.id && entry.status === 'Activo')
      return member || null
    } catch {
      return null
    }
  }
  const login = (email, accessCode) => {
    const member = store.authenticateStaff(email, accessCode)
    if (!member) return null
    const activeMember = store.recordStaffActivity(member.id)
    saveSession(activeMember)
    return activeMember
  }
  const logout = () => localStorage.removeItem(sessionKey)
  const requireRecruiter = () => {
    const member = getCurrentMember()
    if (!member) {
      window.location.replace('staff-login.html')
      return null
    }
    store.recordStaffActivity(member.id)
    return store.getState().staff.find((entry) => entry.id === member.id)
  }

  const loginForm = document.querySelector('#staff-login-form')
  if (loginForm) {
    loginForm.addEventListener('submit', (event) => {
      event.preventDefault()
      const values = Object.fromEntries(new FormData(loginForm))
      const member = login(values.email, values.accessCode)
      if (!member) {
        document.querySelector('#login-note').textContent = 'No encontramos un acceso activo con esos datos.'
        return
      }
      window.location.assign('recruiter.html')
    })
  }

  window.EWorkerStaffAuth = { login, logout, getCurrentMember, requireRecruiter }
})()

