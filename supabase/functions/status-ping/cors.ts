// supabase/functions/_shared/cors.ts
//
// Centralized CORS policy for every edge function in this project.

const ALLOWED_ORIGINS: readonly string[] = [
  'https://chillverse.com.ng',
  'https://www.chillverse.com.ng',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
]

export function buildCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? ''
  const allowOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

export function preflightResponse(req: Request): Response {
  return new Response('ok', { status: 200, headers: buildCorsHeaders(req) })
}
