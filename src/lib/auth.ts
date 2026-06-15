import { supabase } from './supabase'
import type { SignupProfileInput } from '../types'

/** Sign up a new user with email + password. */
export async function signUpWithEmail(email: string, password: string) {
  return supabase.auth.signUp({ email, password })
}

/** Log in an existing user with email + password. */
export async function signInWithEmail(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password })
}

/** Start Google OAuth flow. Redirects back to the app's origin. */
export async function signInWithGoogle() {
  return supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin },
  })
}

/** Start Discord OAuth flow. */
export async function signInWithDiscord() {
  return supabase.auth.signInWithOAuth({
    provider: 'discord',
    options: { redirectTo: window.location.origin },
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

/**
 * Create a profile row for a freshly-registered user.
 * Called after signUp succeeds (and the user has a session/id).
 */
export async function createProfile(userId: string, input: SignupProfileInput) {
  return supabase.from('profiles').insert({
    id: userId,
    username: input.username,
    display_name: input.displayName || input.username,
    avatar: input.avatar,
    country: input.country || null,
    interests: input.interests,
    dob: input.dob,
    connected_platform: input.connectedPlatform,
  })
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
