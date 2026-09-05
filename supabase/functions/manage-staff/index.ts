import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders, isAllowedOrigin, jsonResponse } from '../_shared/cors.ts'
import { getSupabaseSecretKey, getSupabaseUrl } from '../_shared/supabase-env.ts'

const inviteRedirect = 'https://eworkerdemo.zencontroller.workers.dev/reset-password.html'
const managerRoles = ['admin', 'boss']
const allowedRoles = ['admin', 'boss', 'recruiter']

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

    if (profileError || !managerRoles.includes(callerProfile?.role) || callerProfile?.active !== true) {
      return jsonResponse(req, { error: 'Manager access required' }, 403)
    }

    const payload = await req.json().catch(() => null)
    const action = String(payload?.action || '')
    const name = String(payload?.name || '').trim()
    const email = String(payload?.email || '').trim().toLowerCase()
    const role = String(payload?.role || 'recruiter')

    if (action !== 'invite') return jsonResponse(req, { error: 'Unsupported action' }, 400)
    if (!allowedRoles.includes(role)) return jsonResponse(req, { error: 'Invalid staff role' }, 400)
    if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return jsonResponse(req, { error: 'Valid name and email are required' }, 400)
    }

    const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
      data: { full_name: name, role },
      redirectTo: inviteRedirect,
    })

    if (inviteError || !inviteData?.user) {
      return jsonResponse(req, { error: inviteError?.message || 'Could not create invitation' }, 400)
    }

    const { error: upsertError } = await adminClient.from('profiles').upsert({
      id: inviteData.user.id,
      email,
      full_name: name,
      role,
      active: true,
    }, { onConflict: 'id' })

    if (upsertError) return jsonResponse(req, { error: 'Invitation created but profile could not be saved' }, 500)

    return jsonResponse(req, { ok: true, user_id: inviteData.user.id, role })
  } catch (error) {
    return jsonResponse(req, { error: error instanceof Error ? error.message : 'Unexpected server error' }, 500)
  }
})
