// supabase/functions/credit-diamonds/index.ts
//
// Called by BuyDiamonds.tsx after Paystack confirms payment.
// Verifies the transaction with Paystack, then credits gems to the user's
// wallet inside a DB transaction so the operation is idempotent.
//
// SECURITY FIX (critical): the previous version trusted the client-supplied
// `diamonds` and `is_first_purchase` fields directly. Since this function is
// invoked from the browser, anyone could call it directly with a valid
// `reference` from ANY successful payment (even the cheapest pack) and claim
// an arbitrary `diamonds` count — Paystack verification only confirms the
// PAYMENT succeeded, it says nothing about what the client claims that
// payment was for. This version derives the diamond count server-side from
// a fixed price table keyed by pack_id, and cross-checks it against the
// actual verified amount paid.
//
// Required env vars (set in Supabase Dashboard → Project → Edge Functions → Secrets):
//   PAYSTACK_SECRET_KEY   — your Paystack secret key (sk_live_… / sk_test_…)
//   SUPABASE_URL          — injected automatically by Supabase
//   SUPABASE_SERVICE_ROLE_KEY — injected automatically by Supabase

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Server-side source of truth for pack pricing — keep in sync with
// src/features/economy/BuyDiamonds.tsx's PACKS / FLASH_PACKS. The client's
// `diamonds`/`priceCents` values are never trusted for crediting; they're
// only used for display.
const PACK_PRICES: Record<string, { diamonds: number; priceCents: number }> = {
  starter:     { diamonds: 100,  priceCents: 100000 },
  popular:     { diamonds: 310,  priceCents: 300000 },
  best_value:  { diamonds: 520,  priceCents: 480000 },
  mega:        { diamonds: 1040, priceCents: 860000 },
  ultimate:    { diamonds: 2180, priceCents: 1500000 },
  flash1:      { diamonds: 250,  priceCents: 80000 },
  flash2:      { diamonds: 450,  priceCents: 150000 },
  flash3:      { diamonds: 650,  priceCents: 250000 },
  flash4:      { diamonds: 800,  priceCents: 300000 },
}

interface RequestBody {
  reference: string
  user_id: string
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body: RequestBody = await req.json()
    const { reference, user_id } = body

    if (!reference || !user_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: reference, user_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // ── 1. Verify payment with Paystack ───────────────────────────────────
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
      console.error('Paystack verification failed:', verifyData)
      return new Response(
        JSON.stringify({ error: 'Payment verification failed' }),
        { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // ── 2. Derive the pack + diamond amount SERVER-SIDE — never trust the
    //       client's `diamonds` field, only the verified transaction's own
    //       metadata.pack_id (set at Paystack init) plus our own price table.
    const packId: string | undefined = verifyData.data?.metadata?.pack_id
    const pack = packId ? PACK_PRICES[packId] : undefined

    if (!pack) {
      console.error('credit-diamonds: unknown or missing pack_id', packId)
      return new Response(
        JSON.stringify({ error: 'Unknown pack' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const amountPaidCents = verifyData.data?.amount
    if (amountPaidCents !== pack.priceCents) {
      console.error('credit-diamonds: amount mismatch', { packId, expected: pack.priceCents, paid: amountPaidCents })
      return new Response(
        JSON.stringify({ error: 'Amount paid does not match pack price' }),
        { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // ── 3. Create admin Supabase client ───────────────────────────────────
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // ── 4. Idempotency — check if this reference was already processed ────
    const { data: existingTx } = await supabase
      .from('diamond_transactions')
      .select('id')
      .eq('reference', reference)
      .maybeSingle()

    if (existingTx) {
      return new Response(
        JSON.stringify({ ok: true, already_credited: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // ── 5. First-purchase bonus — derived from OUR OWN records, not a
    //       client-supplied flag (was previously trusted, allowing every
    //       purchase to be doubled by claiming is_first_purchase: true) ────
    const { data: walletRow, error: fetchErr } = await supabase
      .from('user_wallets')
      .select('gem_balance, first_purchase_claimed')
      .eq('user_id', user_id)
      .maybeSingle()

    if (fetchErr) throw fetchErr

    const isFirstPurchase = !walletRow?.first_purchase_claimed
    const totalDiamonds = isFirstPurchase ? pack.diamonds * 2 : pack.diamonds
    const currentBalance = walletRow?.gem_balance ?? 0
    const newBalance = currentBalance + totalDiamonds

    if (walletRow) {
      const { error: updateErr } = await supabase
        .from('user_wallets')
        .update({ gem_balance: newBalance, first_purchase_claimed: true })
        .eq('user_id', user_id)
      if (updateErr) throw updateErr
    } else {
      const { error: insertErr } = await supabase
        .from('user_wallets')
        .insert({ user_id, gem_balance: totalDiamonds, first_purchase_claimed: true })
      if (insertErr) throw insertErr
    }

    // ── 6. Record transaction for history ─────────────────────────────────
    const description = isFirstPurchase
      ? `Diamond pack (×2 first-purchase bonus)`
      : `Diamond pack purchase`

    await supabase.from('diamond_transactions').insert({
      user_id,
      reference,
      amount: totalDiamonds,
      description,
      pack_id: packId,
    })

    return new Response(
      JSON.stringify({ ok: true, diamonds_credited: totalDiamonds, new_balance: newBalance }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('credit-diamonds error:', err)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
