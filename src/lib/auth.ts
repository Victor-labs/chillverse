// src/lib/auth.ts
import { supabase } from './supabase'
import type { SignupProfileInput } from '../types'

/** Sign up a new user with email + password. */
export async function signUpWithEmail(email: string, password: string) {
  return supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${window.location.origin}/dashboard`,
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

/** Update streak directly in the profiles table — no edge function needed.
 *  Rules:
 *  - Same day as last_streak_date → do nothing (already counted today)
 *  - Yesterday → increment streak by 1
 *  - Older than yesterday → reset streak to 1 (missed a day)
 */
export async function updateStreak(userId: string) {
  // Fetch current streak state
  const { data, error } = await supabase
    .from('profiles')
    .select('streak, last_streak_date')
    .eq('id', userId)
    .single()

  if (error || !data) return

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const last = data.last_streak_date ? new Date(data.last_streak_date) : null
  if (last) last.setHours(0, 0, 0, 0)

  const todayStr = today.toISOString().split('T')[0]

  // Already updated today — skip
  if (last && last.getTime() === today.getTime()) return

  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  let newStreak: number
  if (last && last.getTime() === yesterday.getTime()) {
    // Played yesterday → keep the fire going
    newStreak = (data.streak ?? 0) + 1
  } else {
    // Missed a day or first time → reset to 1
    newStreak = 1
  }

  await supabase
    .from('profiles')
    .update({ streak: newStreak, last_streak_date: todayStr })
    .eq('id', userId)
}
