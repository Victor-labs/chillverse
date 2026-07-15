// supabase/functions/send-ban-notice/index.ts
//
// Emails a user after a moderator bans or suspends them. Called by the
// client (ModerationPanel) right after mod_ban_user succeeds.
//
// Deliberately re-derives everything from the database instead of trusting
// the request body: the caller only ever sends target_user_id. Reason,
// duration, and even "is this person actually banned" are all read fresh
// from user_moderation here, so this endpoint can't be used to send an
// arbitrary email to an arbitrary user with arbitrary text — it can only
// ever describe a ban that genuinely exists.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts'
import { preflightResponse } from './_shared/cors.ts'
import { jsonResponse, errorResponse } from './_shared/response.ts'
import { authenticate } from './_shared/auth.ts'
import { enforceRateLimit } from './_shared/rateLimit.ts'

interface RequestBody {
  target_user_id?: string
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
}

function suspensionEmail(username: string, reason: string, until: string) {
  return {
    subject: 'Your Chillverse account has been suspended',
    text:
      `Hi ${username},\n\n` +
      `Your Chillverse account has been temporarily suspended for violating our community guidelines.\n\n` +
      `Reason: ${reason}\n` +
      `Suspension ends: ${until}\n\n` +
      `You won't be able to log in until then. Once it ends, your account will work normally again — no further action needed on your part.\n\n` +
      `If you think this was a mistake, reply to this email and a member of our team will review it.\n\n` +
      `— The Chillverse Team`,
  }
}

function banEmail(username: string, reason: string) {
  return {
    subject: 'Your Chillverse account has been banned',
    text:
      `Hi ${username},\n\n` +
      `Your Chillverse account has been permanently banned for violating our community guidelines.\n\n` +
      `Reason: ${reason}\n\n` +
      `This action is final and your account will not be reinstated. You may not create a new account to continue using Chillverse.\n\n` +
      `If you believe this was made in error, you may reply to this email once to request a review. We are not able to respond to repeated appeals of the same decision.\n\n` +
      `— The Chillverse Team`,
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return preflightResponse(req)
  }

  if (req.method !== 'POST') {
    return errorResponse(req, 'Method not allowed', 405)
  }

  try {
    // ── Auth: verify the caller has a valid Supabase session ──
    const authResult = await authenticate(req)
    if (!authResult.ok) return authResult.response
    const { user: caller } = authResult.auth

    let body: RequestBody
    try {
      body = await req.json()
    } catch {
      return errorResponse(req, 'Invalid JSON body', 400)
    }

    const targetUserId = body.target_user_id
    if (!targetUserId || typeof targetUserId !== 'string') {
      return errorResponse(req, 'target_user_id is required', 400)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const adminClient = createClient(supabaseUrl, serviceRoleKey)

    const rateLimited = await enforceRateLimit(req, adminClient, {
      key: `send-ban-notice:${caller.id}`,
      limit: 30,
      windowSeconds: 60,
    })
    if (rateLimited) return rateLimited

    // ── Caller must be current staff — re-checked here server-side, never
    // trusted from the client (mirrors mod_ban_user's own is_staff check). ──
    const { data: callerMod } = await adminClient
      .from('user_moderation')
      .select('role')
      .eq('user_id', caller.id)
      .maybeSingle()

    if (!callerMod || (callerMod.role !== 'moderator' && callerMod.role !== 'admin')) {
      return errorResponse(req, 'Staff only', 403)
    }

    // ── Pull the real, current ban record. Never trust reason/duration from
    // the request — if this row says the user isn't banned, no email goes out. ──
    const { data: modRow } = await adminClient
      .from('user_moderation')
      .select('is_banned, banned_until, ban_reason')
      .eq('user_id', targetUserId)
      .maybeSingle()

    if (!modRow || !modRow.is_banned) {
      return errorResponse(req, 'That user is not currently banned', 400)
    }

    const { data: profile } = await adminClient
      .from('profiles')
      .select('username')
      .eq('id', targetUserId)
      .maybeSingle()

    const { data: authUserData, error: authUserError } = await adminClient.auth.admin.getUserById(targetUserId)
    if (authUserError || !authUserData?.user?.email) {
      console.error('[send-ban-notice] could not resolve target email:', authUserError?.message)
      return errorResponse(req, 'Could not find an email address for that user', 404)
    }

    const username = profile?.username ?? 'there'
    const reason = modRow.ban_reason ?? 'Violation of community guidelines'
    const { subject, text } = modRow.banned_until
      ? suspensionEmail(username, reason, formatDate(modRow.banned_until))
      : banEmail(username, reason)

    const smtpHost = Deno.env.get('SMTP_HOST')
    const smtpPort = Number(Deno.env.get('SMTP_PORT') ?? '465')
    const smtpUser = Deno.env.get('SMTP_USER')
    const smtpPass = Deno.env.get('SMTP_PASS')

    if (!smtpHost || !smtpUser || !smtpPass) {
      console.error('[send-ban-notice] SMTP secrets not configured')
      return errorResponse(req, 'Email is not configured on the server', 500)
    }

    const client = new SMTPClient({
      connection: {
        hostname: smtpHost,
        port: smtpPort,
        tls: true,
        auth: { username: smtpUser, password: smtpPass },
      },
    })

    try {
      await client.send({
        from: `Chillverse Trust & Safety <${smtpUser}>`,
        to: authUserData.user.email,
        subject,
        content: text,
      })
    } finally {
      await client.close()
    }

    return jsonResponse(req, { ok: true })
  } catch (err) {
    console.error('[send-ban-notice] unexpected error:', err)
    return errorResponse(req, 'Unexpected server error', 500)
  }
})
