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

/** Call the update-streak edge function for the signed-in user. */
export async function updateStreak(userId: string) {
  await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/update-streak`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ user_id: userId }),
  })
}
