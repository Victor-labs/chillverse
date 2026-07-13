// supabase/functions/delete-account/index.ts
//
// Permanently deletes the authenticated caller's account: cleans up rows in
// tables that have no cascading foreign key, then deletes the underlying
// Supabase Auth user (which cascades everything else via FK constraints).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { preflightResponse } from '../_shared/cors.ts'
import { jsonResponse, errorResponse } from '../_shared/response.ts'
import { authenticate } from '../_shared/auth.ts'
import { enforceRateLimit } from '../_shared/rateLimit.ts'

// Tables with a user_id column and NO foreign key / cascade — confirmed via
// information_schema query. These must be cleaned up manually or they are
// orphaned forever after the auth user is deleted.
const HARD_DELETE_TABLES = [
  'notifications',
  'player_achievements',
  'player_game_ranks',
  'user_inventory',
  'user_wallets',
  'user_weekly_missions',
] as const

// diamond_transactions and purchase_history are intentionally left alone.
// Their user_id stays as-is for accounting/dispute records — once the
// profile is gone, that id no longer resolves to anything, so the rows
// are effectively anonymous without needing a placeholder account.

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return preflightResponse(req)
  }

  if (req.method !== 'POST') {
    return errorResponse(req, 'Method not allowed', 405)
  }

  try {
    // ── Auth: verify the Supabase JWT from the Authorization header ──
    const authResult = await authenticate(req)
    if (!authResult.ok) return authResult.response
    const { user } = authResult.auth

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const adminClient = createClient(supabaseUrl, serviceRoleKey)

    // Irreversible operation — a tight limit is deliberate here, mainly to
    // blunt any scripted retry storm rather than to serve legitimate reuse.
    const rateLimited = await enforceRateLimit(req, adminClient, {
      key: `delete-account:${user.id}`,
      limit: 3,
      windowSeconds: 60,
    })
    if (rateLimited) return rateLimited

    const userId = user.id

    for (const table of HARD_DELETE_TABLES) {
      const { error } = await adminClient.from(table).delete().eq('user_id', userId)
      if (error) {
        console.error(`[delete-account] failed to delete from ${table}:`, error.message)
        return errorResponse(req, `Failed to clean up ${table}`, 500)
      }
    }

    const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId)
    if (deleteError) {
      console.error('[delete-account] failed to delete auth user:', deleteError.message)
      return errorResponse(req, 'Failed to delete account', 500)
    }

    return jsonResponse(req, { ok: true })
  } catch (err) {
    console.error('[delete-account] unexpected error:', err)
    return errorResponse(req, 'Unexpected server error', 500)
  }
})
