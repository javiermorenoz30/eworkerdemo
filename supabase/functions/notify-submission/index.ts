import { createClient } from 'npm:@supabase/supabase-js@2'
import nodemailer from 'npm:nodemailer@^9'
import { corsHeaders, isAllowedOrigin, jsonResponse } from '../_shared/cors.ts'
import { getSupabaseSecretKey, getSupabaseUrl } from '../_shared/supabase-env.ts'

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const adminPortal = Deno.env.get('ADMIN_PORTAL_URL') || 'https://javiermorenoz30.github.io/eworkerdemo/admin.html'

const typeConfig = {
  application: {
    table: 'applications',
    columns: 'id,created_at,full_name,email,phone,role_applied',
    label: 'Nueva solicitud de empleo',
  },
  contact_message: {
    table: 'contact_messages',
    columns: 'id,created_at,name,email,subject,message',
    label: 'Nuevo mensaje de talento',
  },
  business_lead: {
    table: 'business_leads',
    columns: 'id,created_at,company_name,contact_name,email,subject,message',
    label: 'Nueva propuesta de empresa',
  },
} as const

type SubmissionType = keyof typeof typeConfig

function escapeHtml(value: unknown) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!)
}

function emailBody(type: SubmissionType, record: Record<string, unknown>) {
  if (type === 'application') {
    return `<h2>Nueva solicitud de empleo</h2><p><b>Nombre:</b> ${escapeHtml(record.full_name)}</p><p><b>Correo:</b> ${escapeHtml(record.email)}</p><p><b>Teléfono:</b> ${escapeHtml(record.phone)}</p><p><b>Posición:</b> ${escapeHtml(record.role_applied)}</p><p>Los datos completos y sensibles están disponibles únicamente dentro del portal autorizado.</p><p><a href="${escapeHtml(adminPortal)}">Abrir Control Center</a></p>`
  }

  if (type === 'contact_message') {
    return `<h2>Nuevo mensaje de talento</h2><p><b>Nombre:</b> ${escapeHtml(record.name)}</p><p><b>Correo:</b> ${escapeHtml(record.email)}</p><p><b>Asunto:</b> ${escapeHtml(record.subject)}</p><p>${escapeHtml(record.message)}</p><p><a href="${escapeHtml(adminPortal)}">Abrir Control Center</a></p>`
  }

  return `<h2>Nueva propuesta de empresa</h2><p><b>Contacto:</b> ${escapeHtml(record.contact_name)}</p><p><b>Correo:</b> ${escapeHtml(record.email)}</p><p><b>Asunto:</b> ${escapeHtml(record.subject)}</p><p>${escapeHtml(record.message)}</p><p><a href="${escapeHtml(adminPortal)}">Abrir Control Center</a></p>`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) })
  if (req.method !== 'POST') return jsonResponse(req, { error: 'Method not allowed' }, 405)
  if (!isAllowedOrigin(req)) return jsonResponse(req, { error: 'Origin not allowed' }, 403)

  const payload = await req.json().catch(() => null)
  const type = String(payload?.type || '') as SubmissionType
  const id = String(payload?.id || '')
  if (!(type in typeConfig) || !uuidPattern.test(id)) return jsonResponse(req, { error: 'Invalid submission reference' }, 400)

  const smtpUser = String(Deno.env.get('GMAIL_SMTP_USER') || '').trim()
  const smtpPassword = String(Deno.env.get('GMAIL_APP_PASSWORD') || '').replace(/\s+/g, '')
  if (!smtpUser || !smtpPassword) return jsonResponse(req, { error: 'Email provider is not configured' }, 503)

  try {
    const adminClient = createClient(getSupabaseUrl(), getSupabaseSecretKey(), {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    })
    const config = typeConfig[type]

    const { data: record, error: recordError } = await adminClient
      .from(config.table)
      .select(config.columns)
      .eq('id', id)
      .single()

    if (recordError || !record) return jsonResponse(req, { error: 'Submission not found' }, 404)

    const { data: settings, error: settingsError } = await adminClient
      .from('site_settings')
      .select('notification_email,email_subject')
      .eq('id', 1)
      .single()

    if (settingsError || !settings?.notification_email) return jsonResponse(req, { error: 'Notification settings are missing' }, 503)

    const subjectPrefix = String(settings.email_subject || 'Nueva solicitud desde eWorker360').trim()
    const transport = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: smtpUser,
        pass: smtpPassword,
      },
    })

    try {
      await new Promise<void>((resolve, reject) => {
        transport.sendMail({
          from: `eWorker360 <${smtpUser}>`,
          to: settings.notification_email,
          subject: `${subjectPrefix} · ${config.label}`,
          html: emailBody(type, record as Record<string, unknown>),
        }, (error) => {
          if (error) reject(error)
          else resolve()
        })
      })
    } catch (error) {
      console.error('Gmail SMTP delivery failed', error instanceof Error ? error.message : String(error))
      return jsonResponse(req, { error: 'Notification delivery failed' }, 502)
    }

    return jsonResponse(req, { ok: true })
  } catch (error) {
    return jsonResponse(req, { error: error instanceof Error ? error.message : 'Unexpected server error' }, 500)
  }
})
