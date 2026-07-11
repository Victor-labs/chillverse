// src/hooks/useHaloAI.ts
import { useState, useCallback } from 'react'
import { supabase } from '../../shared/lib/supabase'
import { useProfile } from '../profile/useProfile'
import { getUserRankTier } from '../profile/ranks'

export interface HaloMessage {
  id: string
  role: 'user' | 'halo'
  text: string
  timestamp: Date
}

export interface UseHaloAIReturn {
  messages: HaloMessage[]
  loading: boolean
  error: string | null
  messagesLeft: number // -1 = unlimited
  dailyLimit: number   // 5 | 25 | -1
  sendMessage: (text: string) => Promise<void>
  clearError: () => void
  addLocalMessage: (msg: HaloMessage) => void
}

function getDailyLimit(versionLevel: number): number {
  if (versionLevel >= 5) return -1 // unlimited (Void)
  if (versionLevel >= 3) return 25 // Pro (v3.0 or v4.0)
  return 5 // Free
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

export function useHaloAI(): UseHaloAIReturn {
  const { profile, refetch } = useProfile()
  const [messages, setMessages] = useState<HaloMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const dailyLimit = getDailyLimit(profile?.version_level ?? 0)

  const effectiveCount = (() => {
    if (!profile) return 0
    const isNewDay = profile.halo_last_message_date !== todayStr()
    return isNewDay ? 0 : profile.halo_messages_today ?? 0
  })()

  const messagesLeft = dailyLimit === -1 ? -1 : Math.max(0, dailyLimit - effectiveCount)

  const clearError = useCallback(() => setError(null), [])

  const addLocalMessage = useCallback((msg: HaloMessage) => {
    setMessages(prev => [...prev, msg])
  }, [])

  const sendMessage = useCallback(
    async (text: string) => {
      if (!profile) return
      if (messagesLeft === 0) return

      const userMessage: HaloMessage = {
        id: `${Date.now()}-user`,
        role: 'user',
        text,
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, userMessage])
      setLoading(true)
      setError(null)

      try {
        const { data: { session } } = await supabase.auth.getSession()

        if (!session?.access_token) {
          throw new Error('DEBUG: No active session/access_token. User may not be logged in or session expired.')
        }

        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
        const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

        if (!supabaseUrl) {
          throw new Error('DEBUG: VITE_SUPABASE_URL is undefined/empty. Check Vercel env vars.')
        }
        if (!anonKey) {
          throw new Error('DEBUG: VITE_SUPABASE_ANON_KEY is undefined/empty. Check Vercel env vars.')
        }

        const rankTier = getUserRankTier(profile.xp)
        const playerContext = {
          username: profile.username,
          displayName: profile.display_name,
          xp: profile.xp,
          level: profile.level,
          streak: profile.streak,
          version_level: profile.version_level ?? 0,
          rank: rankTier.name,
        }

        const targetUrl = `${supabaseUrl}/functions/v1/halo-ai`

        let res: Response
        try {
          res = await fetch(targetUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session.access_token}`,
              apikey: anonKey,
            },
            body: JSON.stringify({ message: text, playerContext }),
          })
        } catch (networkErr) {
          const msg = networkErr instanceof Error ? networkErr.message : String(networkErr)
          throw new Error(`DEBUG: Network/fetch failed before reaching Supabase. URL tried: ${targetUrl}. Raw error: ${msg}`)
        }

        if (!res.ok) {
          let bodyText = ''
          let debugMsg = ''
          try {
            bodyText = await res.text()
            try {
              const parsed = JSON.parse(bodyText)
              const rawDebug = parsed?.debug
              debugMsg = typeof rawDebug === 'string' ? rawDebug : rawDebug ? JSON.stringify(rawDebug) : ''
            } catch {
              // body wasn't JSON, fall through to raw text
            }
          } catch {
            bodyText = '(could not read response body)'
          }
          throw new Error(
            debugMsg
              ? `DEBUG: status ${res.status}. ${debugMsg}`
              : `DEBUG: Function responded with status ${res.status} ${res.statusText}. Body: ${bodyText}`
          )
        }

        let data: { reply: string }
        try {
          data = await res.json()
        } catch (parseErr) {
          throw new Error('DEBUG: Response was 200 OK but body was not valid JSON.')
        }

        if (!data?.reply) {
          throw new Error(`DEBUG: Response 200 OK but no "reply" field present. Raw: ${JSON.stringify(data)}`)
        }

        const haloMessage: HaloMessage = {
          id: `${Date.now()}-halo`,
          role: 'halo',
          text: data.reply,
          timestamp: new Date(),
        }
        setMessages(prev => [...prev, haloMessage])

        // Counter is now incremented atomically server-side (in the edge
        // function, after a successful Gemini reply) — refetch to pick up
        // the new count rather than computing/writing it here.
        refetch()
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error('[HaloAI]', msg) // full detail (incl. any DEBUG: internals) stays in devtools/logs
        setError('Halo is having trouble responding right now. Try again in a moment.')
      } finally {
        setLoading(false)
      }
    },
    [profile, messagesLeft, refetch]
  )

  return {
    messages,
    loading,
    error,
    messagesLeft,
    dailyLimit,
    sendMessage,
    clearError,
    addLocalMessage,
  }
                }
