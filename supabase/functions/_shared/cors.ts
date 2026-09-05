const allowedOrigins = new Set([
  'https://javiermorenoz30.github.io',
  'https://eworker360dominicana.com',
  'https://www.eworker360dominicana.com',
  'http://localhost:3000',
  'http://127.0.0.1:5500',
])

export function isAllowedOrigin(req: Request) {
  const origin = req.headers.get('origin')
  return !origin || allowedOrigins.has(origin)
}

export function corsHeaders(req: Request) {
  const origin = req.headers.get('origin')
  return {
    'Access-Control-Allow-Origin': origin && allowedOrigins.has(origin) ? origin : 'https://javiermorenoz30.github.io',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  }
}

export function jsonResponse(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), 'Content-Type': 'application/json; charset=utf-8' },
  })
}
