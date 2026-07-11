// supabase/functions/activate-premium/index.ts
// Called from Pro.tsx right after Paystack's inline checkout succeeds.
// Verifies the transaction server-side with Paystack (never trust the
// client's word that a charge succeeded), then marks the user's profile
// as Premium for the tier/interval they actually paid for.
//
// SECURITY FIX (critical): the previous version matched the claimed
// tier/interval against `verifyJson.data.metadata`, but that metadata is
// exactly what the CLIENT passed into PaystackPop.setup() at checkout
// init — Paystack echoes it back verbatim without validating it against
// the actual plan/amount charged. That meant a user could check out
// against the cheapest plan_code while sending metadata claiming the
// priciest tier/interval, and get premium activated for the wrong price.
// This version instead resolves tier/interval from the transaction's own
// `plan.plan_code` (Paystack's authoritative record of what was actually
// subscribed/charged) against a server-side price table.
//
// NOTE: this only handles the *first* activation. Recurring renewal
// charges come from Paystack as webhook events (charge.success on the
// subscription code) — those should extend pro_expires_at from your
// existing paystack-webhook function, not from here.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type ProTier = 'orbit' | 'void'
type BillingInterval = 'monthly' | 'yearly'

interface ActivateRequestBody {
  reference: string
  user_id: string
}

// Server-side source of truth — keep in sync with src/shared/lib/proPlans.ts
// PLAN_CODES. Get the real codes from your Paystack dashboard (Payments →
// Plans) if these don't match; they must be exact.
const PLAN_CODE_MAP: Record<string, { tier: ProTier; interval: BillingInterval }> = {
  PLN_9jnq69avo1tr60t: { tier: 'orbit', interval: 'monthly' },
  PLN_iqt6skasttaqc79: { tier: 'orbit', interval: 'yearly' },
  PLN_aaz0myfn9x3s819: { tier: 'void',  interval: 'monthly' },
  PLN_9bhvy7t70adfro9: { tier: 'void',  interval: 'yearly' },
}

function addInterval(from: Date, interval: BillingInterval): Date {
  const d = new Date(from)
  if (interval === 'monthly') d.setMonth(d.getMonth() + 1)
  else d.setFullYear(d.getFullYear() + 1)
  return d
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: CORS_HEADERS })
  }

  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    // ── Auth: verify the Supabase JWT from the Authorization header ──
    const authHeader = req.headers.get('Authorization') ?? ''
    const jwt = authHeader.replace('Bearer ', '').trim()
    if (!jwt) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    })

    const { data: userData, error: userError } = await authClient.auth.getUser(jwt)
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    // ── Input validation ──
    const body: ActivateRequestBody = await req.json()
    const { reference, user_id } = body

    if (!reference || typeof reference !== 'string') {
      return new Response(JSON.stringify({ error: 'reference is required' }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }
    if (userData.user.id !== user_id) {
      return new Response(JSON.stringify({ error: 'user_id mismatch' }), {
        status: 403,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    // ── Verify the transaction with Paystack (server-side, secret key) ──
    const paystackSecret = Deno.env.get('PAYSTACK_SECRET_KEY')
    if (!paystackSecret) {
      return new Response(JSON.stringify({ error: 'Payment verification unavailable' }), {
        status: 502,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    const verifyRes = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${paystackSecret}` },
    })
    const verifyJson = await verifyRes.json()

    if (!verifyRes.ok || verifyJson?.data?.status !== 'success') {
      return new Response(JSON.stringify({ error: 'Transaction not successful' }), {
        status: 402,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    // Resolve tier/interval from Paystack's own record of the plan actually
    // charged — never from client-supplied request fields or echoed metadata.
    const planCode: string | undefined = verifyJson.data?.plan?.plan_code
    const resolved = planCode ? PLAN_CODE_MAP[planCode] : undefined

    if (!resolved) {
      console.error('activate-premium: unknown or missing plan_code', planCode)
      return new Response(JSON.stringify({ error: 'Unrecognized subscription plan' }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    const { tier, interval } = resolved

    // ── Activate: write with the service role (bypasses RLS) ──
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const adminClient = createClient(supabaseUrl, serviceRoleKey)

    const expiresAt = addInterval(new Date(), interval)

    const { error: updateError } = await adminClient
      .from('profiles')
      .update({
        is_pro: true,
        pro_tier: tier,
        pro_billing_interval: interval,
        pro_expires_at: expiresAt.toISOString(),
      })
      .eq('id', user_id)

    if (updateError) {
      return new Response(JSON.stringify({ error: 'Failed to activate plan' }), {
        status: 500,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ success: true, tier, interval, expires_at: expiresAt.toISOString() }), {
      status: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('activate-premium error:', err)
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }
})
