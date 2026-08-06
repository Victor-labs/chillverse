// supabase/functions/status-ping/index.ts
//
// Feeds the "Server Response Time" chart on /status. Runs on a pg_cron
// schedule (see migration 0101) every 5 minutes.
//
// SECURITY NOTE: this function is intentionally unauthenticated
// (verify_jwt: false) — pg_net's cron call carries no user session, and
// this project has no mechanism to set a CRON_SECRET without dashboard
// access (unlike cleanup-rooms, which uses that pattern). The blast
// radius of an unauthenticated call here is low: the handler does exactly
// one thing (time a trivial read + optionally insert one row), and it
// self-throttles so repeated/spammed calls can't flood status_metrics or
// skew the chart. If you want it locked down further later: set a
// CRON_SECRET in Supabase Dashboard → Edge Functions → Secrets, add an
// authenticateCron() check here (see cleanup-rooms/index.ts for the exact
// pattern), and pass the same value as the X-Cron-Secret header in the
// pg_cron job in migration 0101.
//
// Required env vars (both injected automatically by Supabase):
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { preflightResponse } from './_shared/cors.ts'
import { jsonResponse, errorResponse } from './_shared/response.ts'

const MIN_GAP_MS = 3 * 60 * 1000 // don't write more than one row per ~3 min, however often this is called

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return preflightResponse(req)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceKey) {
    console.error('status-ping: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set')
    return errorResponse(req, 'Server misconfiguration', 500)
  }

  const supabase = createClient(supabaseUrl, serviceKey)

  try {
    // Throttle: skip if we already logged a ping recently.
    const { data: last } = await supabase
      .from('status_metrics')
      .select('recorded_at')
      .order('recorded_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (last?.recorded_at && Date.now() - new Date(last.recorded_at).getTime() < MIN_GAP_MS) {
      return jsonResponse(req, { skipped: true }, 200)
    }

    // Time a trivial, representative read — the same round trip a real
    // page load makes (function → Postgres → back), nothing that touches
    // sensitive data.
    const started = Date.now()
    const { error: pingError } = await supabase.from('status_components').select('key').limit(1)
    const latencyMs = Date.now() - started
    const ok = !pingError

    await supabase.from('status_metrics').insert({ latency_ms: ok ? latencyMs : null, ok })

    return jsonResponse(req, { ok, latency_ms: latencyMs }, 200)
  } catch (err) {
    console.error('status-ping failed:', err)
    // Still log the failed ping so the chart/uptime story is honest about it.
    await supabase.from('status_metrics').insert({ latency_ms: null, ok: false }).then(
      () => {},
      () => {},
    )
    return errorResponse(req, 'Ping failed', 500)
  }
})
