import { supabase } from './supabase-client.js'

export async function submitApplication(record) {
  const { error } = await supabase
    .from('applications')
    .insert(record)

  if (error) throw error
  return record.id
}

export async function submitContactMessage(record) {
  const { error } = await supabase
    .from('contact_messages')
    .insert(record)

  if (error) throw error
  return record.id
}

export async function submitBusinessLead(record) {
  const { error } = await supabase
    .from('business_leads')
    .insert(record)

  if (error) throw error
  return record.id
}

export async function notifySubmission(type, id) {
  const { data, error } = await supabase.functions.invoke('notify-submission', {
    body: { type, id },
  })
  if (error) throw error
  return data
}
