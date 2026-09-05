import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders, isAllowedOrigin, jsonResponse } from '../_shared/cors.ts'
import { getSupabaseSecretKey, getSupabaseUrl } from '../_shared/supabase-env.ts'

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const managerRoles = ['admin', 'boss']
const resourceTables = {
  contact_message: 'contact_messages',
  business_lead: 'business_leads',
} as const

type ResourceType = keyof typeof resourceTables

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) })
  if (req.method !== 'POST') return jsonResponse(req, { error: 'Method not allowed' }, 405)
  if (!isAllowedOrigin(req)) return jsonResponse(req, { error: 'Origin not allowed' }, 403)

  const authorization = req.headers.get('Authorization')
  const token = authorization?.replace(/^Bearer\s+/i, '').trim()
  if (!token) return jsonResponse(req, { error: 'Authentication required' }, 401)

  try {
    const adminClient = createClient(getSupabaseUrl(), getSupabaseSecretKey(), {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    })

    const { data: userData, error: userError } = await adminClient.auth.getUser(token)
    if (userError || !userData?.user) return jsonResponse(req, { error: 'Invalid session' }, 401)

    const { data: callerProfile, error: profileError } = await adminClient
      .from('profiles')
      .select('role,active')
      .eq('id', userData.user.id)
      .single()

    if (profileError || callerProfile?.active !== true || !managerRoles.includes(callerProfile.role)) {
      return jsonResponse(req, { error: 'Manager access required' }, 403)
    }

    const payload = await req.json().catch(() => null)
    const action = String(payload?.action || '')
    const type = String(payload?.type || '') as ResourceType
    const id = String(payload?.id || '')

    if (action !== 'delete') return jsonResponse(req, { error: 'Unsupported action' }, 400)
    if (!(type in resourceTables) || !uuidPattern.test(id)) {
      return jsonResponse(req, { error: 'Invalid record reference' }, 400)
    }

    const { data, error } = await adminClient
      .from(resourceTables[type])
      .delete()
      .eq('id', id)
      .select('id')
      .maybeSingle()

    if (error) return jsonResponse(req, { error: 'Could not delete record' }, 500)
    if (!data) return jsonResponse(req, { error: 'Record not found' }, 404)

    return jsonResponse(req, { ok: true, id })
  } catch (error) {
    return jsonResponse(req, { error: error instanceof Error ? error.message : 'Unexpected server error' }, 500)
  }
})
