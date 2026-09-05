import { buildApplicationRecord } from './domain.js'
import { notifySubmission, submitApplication } from './data-api.js'

const form = document.querySelector('#application-form')
const note = document.querySelector('#application-note')
const submit = form?.querySelector('button[type="submit"]')

form?.addEventListener('submit', async (event) => {
  event.preventDefault()
  if (!form.reportValidity()) return

  submit.disabled = true
  note.classList.remove('error')
  note.textContent = 'Enviando solicitud…'

  const values = Object.fromEntries(new FormData(form).entries())
  const id = crypto.randomUUID()
  const record = buildApplicationRecord(values, id)

  try {
    await submitApplication(record)
    note.textContent = 'Solicitud enviada correctamente. Gracias por compartir tu información con eWorker360.'
    form.reset()

    try {
      await notifySubmission('application', id)
    } catch {
      // The application is already stored. Notification delivery is secondary.
    }
  } catch {
    note.classList.add('error')
    note.textContent = 'No pudimos enviar tu solicitud. Tus datos siguen en el formulario; inténtalo nuevamente.'
  } finally {
    submit.disabled = false
  }
})
