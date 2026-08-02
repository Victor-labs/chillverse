// src/lib/auth.ts
import { supabase } from '../../shared/lib/supabase'
import type { SignupProfileInput } from '../../shared/types'

export interface SignupMetadata {
  username: string
  displayName: string
  country: string
  interests: string[]
  dob: string
  connectedPlatform: string | null
  referralCode: string | null
  deviceId: string
}

/**
 * Sign up a new user with email + password.
 *
 * All the onboarding data collected in Signup.tsx (username, display name,
 * country, interests, dob, connected platform, referral code, device id)
 * is sent here as auth signUp() metadata rather than saved via a separate
 * client-side upsert after the fact. That separate upsert only ran if a
 * session already existed the instant signup returned — which isn't true
 * when the project requires email confirmation, so the data was silently
 * lost. Metadata lands on auth.users.raw_user_meta_data immediately and is
 * read by the handle_new_user() DB trigger to populate the profile (and
 * apply/credit any referral) the moment the account row is created —
 * reliable regardless of confirmation flow, tab, or device.
 */
export async function signUpWithEmail(email: string, password: string, meta: SignupMetadata) {
  return supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${window.location.origin}/dashboard`,
      data: {
        username: meta.username,
        display_name: meta.displayName,
        country: meta.country,
        interests: meta.interests,
        dob: meta.dob || null,
        connected_platform: meta.connectedPlatform,
        referral_code: meta.referralCode,
        device_id: meta.deviceId,
      },
    },
  })
}

/** Log in an existing user with email + password. */
export async function signInWithEmail(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password })
}

/** Start Google OAuth flow. Redirects back to the app's origin. */
export async function signInWithGoogle() {
  return supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}/dashboard` },
  })
}

/** Start Discord OAuth flow. */
export async function signInWithDiscord() {
  return supabase.auth.signInWithOAuth({
    provider: 'discord',
    options: { redirectTo: `${window.location.origin}/dashboard` },
  })
}

/** Sign the current user out. */
export async function signOut() {
  // Fire-and-forget: bumps the public "Active Users" counter shown on the
  // /editorial-room page (see migration 0098). Never awaited and never
  // allowed to block/throw the real sign-out — it's just a stats tick.
  supabase.rpc('increment_auth_activity_counter').then(
    () => {},
    () => {}
  )
  return supabase.auth.signOut()
}

/** Send a password reset email. */
export async function sendPasswordReset(email: string) {
  return supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/login`,
  })
}

/** Fresh session lookup, used right before any RLS-gated write so the
 *  call never relies on a session captured earlier in the flow. */
export async function getCurrentSession() {
  return supabase.auth.getSession()
}

/**
 * Save the rest of onboarding onto the profile row.
 */
export async function upsertProfile(userId: string, input: SignupProfileInput) {
  return supabase.from('profiles').upsert(
    {
      id: userId,
      username: input.username,
      display_name: input.displayName || input.username,
      country: input.country || null,
      interests: input.interests,
      dob: input.dob,
      connected_platform: input.connectedPlatform,
    },
    { onConflict: 'id' }
  )
}

/** Quick check used during signup to give a fast "username taken" hint. */
export async function isUsernameTaken(username: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', username)
    .maybeSingle()

  if (error) return false
  return !!data
}

/** Resend confirmation email for an unconfirmed signup. */
export async function resendConfirmationEmail(email: string) {
  return supabase.auth.resend({ type: 'signup', email })
}

/**
 * Update the user's streak by delegating entirely to a Postgres function.
 *
 * WHY: All date arithmetic happens in the DB (UTC), which means:
 *   - Timezone-safe: no client clock involved.
 *   - Atomic: the DB row is locked with FOR UPDATE so two browser tabs
 *     or a token refresh cannot double-increment the same day.
 *   - Idempotent: calling it many times in one day is always safe
 *     (the DB function returns immediately if already updated today).
 *
 * REQUIRED — run once in Supabase SQL editor:
 *
 *   CREATE OR REPLACE FUNCTION update_streak(p_user_id uuid)
 *   RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
 *   DECLARE
 *     v_streak     int;
 *     v_last_date  date;
 *     v_today      date := (now() AT TIME ZONE 'UTC')::date;
 *     v_new_streak int;
 *   BEGIN
 *     SELECT streak, last_streak_date
 *     INTO   v_streak, v_last_date
 *     FROM   profiles WHERE id = p_user_id FOR UPDATE;
 *
 *     IF v_last_date = v_today THEN RETURN; END IF;
 *
 *     IF v_last_date = v_today - INTERVAL '1 day' THEN
 *       v_new_streak := COALESCE(v_streak, 0) + 1;
 *     ELSE
 *       v_new_streak := 1;
 *     END IF;
 *
 *     UPDATE profiles
 *     SET streak = v_new_streak, last_streak_date = v_today
 *     WHERE id = p_user_id;
 *   END;
 *   $$;
 */
export async function updateStreak(userId: string): Promise<void> {
  const { error } = await supabase.rpc('update_streak', { p_user_id: userId })
  if (error) { console.error('[updateStreak] RPC error:', error.message); return }

  // update_streak returns void by design (see comment above), so re-read the
  // fresh value to check it against the streak-milestone ladder. Cheap and
  // safe to skip on failure — this is a highlight, not core streak logic.
  const { data: profile } = await supabase.from('profiles').select('streak').eq('id', userId).maybeSingle<{ streak: number | null }>()
  if (typeof profile?.streak === 'number') {
    const { checkStreakMilestoneHighlight, STREAK_MILESTONES } = await import('../highlights/highlightTriggers')
    checkStreakMilestoneHighlight(userId, profile.streak).catch(console.error)

    // Halo's voice on top of the same milestone moment (Halo Moments plan
    // §4.4) — purely a flavor toast via the existing notification-toast
    // pipeline, no reward/streak logic touched. Only fires on the exact
    // milestone days (STREAK_MILESTONES), same gate as the highlight above,
    // so it doesn't re-fire every day.
    if (STREAK_MILESTONES.includes(profile.streak)) {
      const { notifyStreakMilestoneHalo } = await import('../halo-moments/haloMoments')
      notifyStreakMilestoneHalo(userId).catch(console.error)
    }
  }
}
