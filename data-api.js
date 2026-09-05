import { supabase } from './supabase-client.js'

async function rows(query) {
  const { data, error } = await query
  if (error) throw error
  return data || []
}

export async function submitApplication(record) {
  const { error } = await supabase.from('applications').insert(record)
  if (error) throw error
  return record.id
}

export async function submitContactMessage(record) {
  const { error } = await supabase.from('contact_messages').insert(record)
  if (error) throw error
  return record.id
}

export async function submitBusinessLead(record) {
  const { error } = await supabase.from('business_leads').insert(record)
  if (error) throw error
  return record.id
}

export async function listApplications() {
  return rows(supabase.from('applications').select('*').order('created_at', { ascending: false }))
}

export async function updateApplication(id, patch) {
  const allowed = {}
  if (Object.hasOwn(patch, 'status')) allowed.status = patch.status
  if (Object.hasOwn(patch, 'internal_note')) allowed.internal_note = patch.internal_note
  const { error } = await supabase.from('applications').update(allowed).eq('id', id)
  if (error) throw error
}

export async function listContactMessages() {
  return rows(supabase.from('contact_messages').select('*').order('created_at', { ascending: false }))
}

export async function updateContactMessageStatus(id, status) {
  const { error } = await supabase.from('contact_messages').update({ status }).eq('id', id)
  if (error) throw error
}

export async function listBusinessLeads() {
  return rows(supabase.from('business_leads').select('*').order('created_at', { ascending: false }))
}

export async function updateBusinessLeadStatus(id, status) {
  const { error } = await supabase.from('business_leads').update({ status }).eq('id', id)
  if (error) throw error
}

export async function getSiteSettings() {
  const { data, error } = await supabase.from('site_settings').select('*').eq('id', 1).single()
  if (error) throw error
  return data
}

export async function updateSiteSettings(patch) {
  const allowedKeys = ['brand_name','hero_title','hero_lead','contact_email','contact_phone','whatsapp','notification_email','email_subject','auto_reply']
  const allowed = Object.fromEntries(Object.entries(patch).filter(([key]) => allowedKeys.includes(key)))
  const { error } = await supabase.from('site_settings').update(allowed).eq('id', 1)
  if (error) throw error
}

export async function listProfiles() {
  return rows(supabase.from('profiles').select('id,email,full_name,role,active,created_at,updated_at').order('created_at', { ascending: true }))
}

export async function updateProfile(id, patch) {
  const allowedKeys = ['email','full_name','role','active']
  const allowed = Object.fromEntries(Object.entries(patch).filter(([key]) => allowedKeys.includes(key)))
  const { error } = await supabase.from('profiles').update(allowed).eq('id', id)
  if (error) throw error
}

export async function inviteStaff(name, email, role) {
  const { data, error } = await supabase.functions.invoke('manage-staff', {
    body: { action: 'invite', name, email, role },
  })
  if (error) throw error
  return data
}

export async function deleteOperationalRecord(type, id) {
  const { data, error } = await supabase.functions.invoke('manage-records', {
    body: { action: 'delete', type, id },
  })
  if (error) throw error
  return data
}

export async function notifySubmission(type, id) {
  const { data, error } = await supabase.functions.invoke('notify-submission', {
    body: { type, id },
  })
  if (error) throw error
  return data
}
