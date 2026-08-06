// supabase/functions/_shared/response.ts
//
// Standard response helpers. Every JSON response an edge function sends
// should go through jsonResponse/errorResponse so CORS headers and a
// baseline set of security headers are never accidentally left off.

import { buildCorsHeaders } from './cors.ts'

const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  // These endpoints return per-user data / mutate state — never let an
  // intermediary cache a response meant for one caller and replay it to
  // another.
  'Cache-Control': 'no-store',
}

export function jsonResponse(
  req: Request,
  body: unknown,
  status = 200,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...buildCorsHeaders(req),
      ...SECURITY_HEADERS,
      'Content-Type': 'application/json',
      ...extraHeaders,
    },
  })
}

export function errorResponse(
  req: Request,
  message: string,
  status = 400,
  extraHeaders: Record<string, string> = {},
): Response {
  return jsonResponse(req, { error: message }, status, extraHeaders)
}
