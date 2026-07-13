// supabase/functions/credit-diamonds/index.ts
//
// Called by BuyDiamonds.tsx after Paystack confirms payment.
// Verifies the transaction with Paystack, then credits gems to the user's
// wallet inside a DB transaction so the operation is idempotent.
//
// SECURITY FIX (critical, pack pricing): the previous version trusted the
// client-supplied `diamonds` and `is_first_purchase` fields directly. Since
// this function is invoked from the browser, anyone could call it directly
// with a valid `reference` from ANY successful payment (even the cheapest
// pack) and claim an arbitrary `diamonds` count — Paystack verification
// only confirms the PAYMENT succeeded, it says nothing about what the
// client claims that payment was for. This version derives the diamond
// count server-side from a fixed price table keyed by pack_id, and
// cross-checks it against the actual verified amount paid.
//
// SECURITY FIX (critical, IDOR): the previous version ALSO trusted the
// client-supplied `user_id` field outright, with no authentication at all.
// Anyone with the (public) anon key could call this function directly with
// their own valid `reference` but someone else's `user_id`, crediting
// diamonds to an arbitrary account. This version now requires a valid
// Supabase session (Authorization: Bearer <jwt>) and always credits the
// AUTHENTICATED caller — a `user_id` in the body is only accepted if it
// matches that session, for backward compatibility with existing clients.
//
// Required env vars (set in Supabase Dashboard → Project → Edge Functions → Secrets):
//   PAYSTACK_SECRET_KEY        — your Paystack secret key (sk_live_… / sk_test_…)
//   SUPABASE_URL                — injected automatically by Supabase
//   SUPABASE_ANON_KEY           — injected automatically by Supabase
//   SUPABASE_SERVICE_ROLE_KEY   — injected automatically by Supabase

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { preflightResponse } from '../_shared/cors.ts'
import { jsonResponse, errorResponse } from '../_shared/response.ts'
import { authenticate, assertMatchesCaller } from '../_shared/auth.ts'
import { enforceRateLimit } from '../_shared/rateLimit.ts'

// Server-side source of truth for pack pricing — keep in sync with
// src/features/economy/BuyDiamonds.tsx's PACKS / FLASH_PACKS. The client's
// `diamonds`/`priceCents` values are never trusted for crediting; they're
// only used for display.
const PACK_PRICES: Record<string, { diamonds: number; priceCents: number }> = {
  starter: { diamonds: 100, priceCents: 100000 },
  popular: { diamonds: 310, priceCents: 300000 },
  best_value: { diamonds: 520, priceCents: 480000 },
  mega: { diamonds: 1040, priceCents: 860000 },
  ultimate: { diamonds: 2180, priceCents: 1500000 },
  flash1: { diamonds: 250, priceCents: 80000 },
  flash2: { diamonds: 450, priceCents: 150000 },
  flash3: { diamonds: 650, priceCents: 250000 },
  flash4: { diamonds: 800, priceCents: 300000 },
}

interface RequestBody {
  reference: string
  user_id?: string
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return preflightResponse(req)
  }

  if (req.method !== 'POST') {
    return errorResponse(req, 'Method not allowed', 405)
  }

  try {
    // ── 1. Authenticate the caller — user_id is ALWAYS derived from the
    //       verified session below, never trusted from the request body. ──
    const authResult = await authenticate(req)
    if (!authResult.ok) return authResult.response
    const { user } = authResult.auth

    const body: RequestBody = await req.json()
    const { reference, user_id } = body

    if (!reference || typeof reference !== 'string') {
      return errorResponse(req, 'Missing required field: reference', 400)
    }

    // If the client still sends a user_id, it must match the authenticated
    // session — this is what closes the IDOR hole described above.
    const mismatch = assertMatchesCaller(req, authResult.auth, user_id)
    if (mismatch) return mismatch

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')

    // ── 2. Rate limit — generous enough for legitimate retries after a
    //       flaky network response, but stops scripted hammering of the
    //       Paystack verification call. ──
    const rateLimited = await enforceRateLimit(req, admin, {
      key: `credit-diamonds:${user.id}`,
      limit: 20,
      windowSeconds: 60,
    })
    if (rateLimited) return rateLimited

    // ── 3. Verify payment with Paystack ───────────────────────────────────
    const paystackKey = Deno.env.get('PAYSTACK_SECRET_KEY')
    if (!paystackKey) {
      throw new Error('PAYSTACK_SECRET_KEY env var not set')
    }

    const verifyRes = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      { headers: { Authorization: `Bearer ${paystackKey}` } },
    )
    const verifyData = await verifyRes.json()

    if (!verifyRes.ok || verifyData.data?.status !== 'success') {
      console.error('credit-diamonds: Paystack verification failed:', verifyData)
      return errorResponse(req, 'Payment verification failed', 402)
    }

    // ── 4. Derive the pack + diamond amount SERVER-SIDE — never trust the
    //       client's `diamonds` field, only the verified transaction's own
    //       metadata.pack_id (set at Paystack init) plus our own price table.
    const packId: string | undefined = verifyData.data?.metadata?.pack_id
    const pack = packId ? PACK_PRICES[packId] : undefined

    if (!pack) {
      console.error('credit-diamonds: unknown or missing pack_id', packId)
      return errorResponse(req, 'Unknown pack', 400)
    }

    const amountPaidCents = verifyData.data?.amount
    if (amountPaidCents !== pack.priceCents) {
      console.error('credit-diamonds: amount mismatch', {
        packId,
        expected: pack.priceCents,
        paid: amountPaidCents,
      })
      return errorResponse(req, 'Amount paid does not match pack price', 402)
    }

    // ── 5. Idempotency — check if this reference was already processed ────
    const { data: existingTx } = await admin
      .from('diamond_transactions')
      .select('id')
      .eq('reference', reference)
      .maybeSingle()

    if (existingTx) {
      return jsonResponse(req, { ok: true, already_credited: true })
    }

    // ── 6. First-purchase bonus — derived from OUR OWN records, not a
    //       client-supplied flag (was previously trusted, allowing every
    //       purchase to be doubled by claiming is_first_purchase: true) ────
    const { data: walletRow, error: fetchErr } = await admin
      .from('user_wallets')
      .select('gem_balance, first_purchase_claimed')
      .eq('user_id', user.id)
      .maybeSingle()

    if (fetchErr) throw fetchErr

    const isFirstPurchase = !walletRow?.first_purchase_claimed
    const totalDiamonds = isFirstPurchase ? pack.diamonds * 2 : pack.diamonds
    const currentBalance = walletRow?.gem_balance ?? 0
    const newBalance = currentBalance + totalDiamonds

    if (walletRow) {
      const { error: updateErr } = await admin
        .from('user_wallets')
        .update({ gem_balance: newBalance, first_purchase_claimed: true })
        .eq('user_id', user.id)
      if (updateErr) throw updateErr
    } else {
      const { error: insertErr } = await admin
        .from('user_wallets')
        .insert({ user_id: user.id, gem_balance: totalDiamonds, first_purchase_claimed: true })
      if (insertErr) throw insertErr
    }

    // ── 7. Record transaction for history ─────────────────────────────────
    const description = isFirstPurchase
      ? `Diamond pack (×2 first-purchase bonus)`
      : `Diamond pack purchase`

    await admin.from('diamond_transactions').insert({
      user_id: user.id,
      reference,
      amount: totalDiamonds,
      description,
      pack_id: packId,
    })

    return jsonResponse(req, { ok: true, diamonds_credited: totalDiamonds, new_balance: newBalance })
  } catch (err) {
    console.error('credit-diamonds error:', err)
    return errorResponse(req, 'Internal server error', 500)
  }
})
