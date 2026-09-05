export function getSupabaseUrl() {
  const value = Deno.env.get('SUPABASE_URL')
  if (!value) throw new Error('SUPABASE_URL is not configured')
  return value
}

export function getSupabaseSecretKey() {
  const modernJson = Deno.env.get('SUPABASE_SECRET_KEYS')
  if (modernJson) {
    try {
      const parsed = JSON.parse(modernJson)
      const value = parsed.default || Object.values(parsed)[0]
      if (typeof value === 'string' && value) return value
    } catch {
      throw new Error('SUPABASE_SECRET_KEYS is not valid JSON')
    }
  }

  const singleModern = Deno.env.get('SUPABASE_SECRET_KEY')
  if (singleModern) return singleModern

  const legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (legacy) return legacy

  throw new Error('No Supabase server secret key is configured')
}
