// src/hooks/useHaloAI.ts
import { useCallback, useEffect, useRef, useState } from 'react'
import type { HaloMessage, HaloPlayerContext } from '../types/halo'
import { buildHaloSystemPrompt, getTopicSections } from '../lib/haloSystemPrompt'
import { haloFallback } from '../lib/haloFallback'

export interface UseHaloAIState {
  messages: HaloMessage[]
  isLoading: boolean
  sendMessage: (text: string) => Promise<void>
  clearMessages: () => void
}

interface GeminiPart {
  text: string
}

interface GeminiContent {
  role: 'user' | 'model'
  parts: GeminiPart[]
}

interface GeminiCandidate {
  content?: {
    parts?: GeminiPart[]
  }
}

interface GeminiResponse {
  candidates?: GeminiCandidate[]
}

/**
 * GeminiRequestBody now includes systemInstruction — the correct way to pass
 * a system prompt to Gemini 2.x. This is a top-level field, NOT a contents entry.
 * Using it this way means Gemini processes it as actual instructions rather than
 * as a fake user message, which was causing unpredictable behavior previously.
 */
interface GeminiRequestBody {
  systemInstruction: {
    parts: GeminiPart[]
  }
  contents: GeminiContent[]
  generationConfig: {
    temperature: number
    maxOutputTokens: number
    topP: number
  }
}

function makeId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

/**
 * Core hook managing Halo AI message history, Gemini API calls, loading state,
 * and graceful fallback routing.
 *
 * FIXES APPLIED IN THIS VERSION:
 *
 * FIX 1 — Model: gemini-1.5-flash → gemini-2.0-flash
 *   The 1.5 endpoint returns 404 on many free-tier projects due to Google's model
 *   deprecation cycle. 2.0-flash is the stable current free-tier model.
 *
 * FIX 2 — systemInstruction (real system prompt, not fake conversation turn)
 *   Previous approach injected a fake user/model exchange as the first contents entry.
 *   Gemini 2.x supports systemInstruction as a top-level field — this is processed
 *   as actual instructions, not conversation history. Removed the fake "Ready. I'm Halo"
 *   model prefill entirely (it confused the model's response generation).
 *
 * FIX 3 — messagesRef for stale closure fix
 *   useCallback with [messages] in deps caused the closure to capture a stale snapshot
 *   of messages state on every call — meaning priorContents was always missing the most
 *   recent turn. A ref that stays in sync with state fixes this without re-creating
 *   sendMessage on every message, which caused its own re-render cascade.
 *
 * FIX 4 — Full error object logged (not just message string)
 *   console.error('[HaloAI] FULL ERROR', err) instead of String(err) — surfaces
 *   HTTP status codes, stack traces, and Gemini's actual error body in DevTools.
 */
export function useHaloAI(playerCtx: HaloPlayerContext): UseHaloAIState {
  const [messages, setMessages] = useState<HaloMessage[]>([])
  const [isLoading, setIsLoading]  = useState(false)

  // FIX 3: Keep a ref in sync so sendMessage always reads current history
  // without needing messages in its dependency array (which caused stale closures).
  const messagesRef = useRef<HaloMessage[]>(messages)
  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  const sendMessage = useCallback(
    async (text: string) => {
      const userMessage: HaloMessage = {
        id: makeId(),
        role: 'user',
        content: text,
        timestamp: new Date(),
      }

      setMessages(prev => [...prev, userMessage])
      setIsLoading(true)

      try {
        const apiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined
        if (!apiKey) {
          throw new Error('Missing VITE_GEMINI_API_KEY')
        }

        // FIX 2: Build the real systemInstruction from slim persona + player context
        // and targeted topic knowledge — two separate concerns composed cleanly here.
        const slimPersona    = buildHaloSystemPrompt(playerCtx)
        const topicKnowledge = getTopicSections(text)

        const systemText =
          `${slimPersona}\n\n` +
          `RELEVANT KNOWLEDGE FOR THIS QUESTION:\n${topicKnowledge}\n\n` +
          `Keep replies to 1-4 sentences unless asked to elaborate. ` +
          `Use gaming slang naturally. Never break character.`

        // FIX 3: Use the ref — always current, never stale
        const priorContents: GeminiContent[] = messagesRef.current.map(msg => ({
          role: msg.role === 'halo' ? 'model' : 'user',
          parts: [{ text: msg.content }],
        }))

        // FIX 2: systemInstruction is top-level, NOT a contents entry.
        // FIX 2: No fake user/model exchange prefill — contents is clean history + current turn.
        const body: GeminiRequestBody = {
          systemInstruction: {
            parts: [{ text: systemText }],
          },
          contents: [
            ...priorContents,
            { role: 'user', parts: [{ text }] },
          ],
          generationConfig: {
            temperature: 0.75,
            maxOutputTokens: 300,
            topP: 0.9,
          },
        }

        // FIX 1: gemini-1.5-flash → gemini-2.0-flash (stable free-tier endpoint)
        const endpoint =
          `https://generativelanguage.googleapis.com/v1beta/models/` +
          `gemini-2.0-flash:generateContent?key=${apiKey}`

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })

        if (!response.ok) {
          const errBody = await response.text()
          console.error('[HaloAI] Gemini HTTP error body:', errBody)
          throw new Error(`Gemini API error ${response.status}: ${errBody}`)
        }

        const data = (await response.json()) as GeminiResponse
        const replyText = data.candidates?.[0]?.content?.parts?.[0]?.text

        if (!replyText) {
          throw new Error('Empty Gemini response')
        }

        const haloMessage: HaloMessage = {
          id: makeId(),
          role: 'halo',
          content: replyText,
          timestamp: new Date(),
        }
        setMessages(prev => [...prev, haloMessage])

      } catch (err: unknown) {
        // FIX 4: Log the full object so DevTools shows status codes + stack traces
        console.error('[HaloAI] FULL ERROR', err)

        const errMsg = err instanceof Error ? err.message : String(err)
        let fallbackText: string

        if (errMsg.includes('VITE_GEMINI_API_KEY')) {
          console.error(
            '[HaloAI] ⚠️  VITE_GEMINI_API_KEY is not configured.\n' +
            '  LOCAL: add VITE_GEMINI_API_KEY=<your_key> to .env.local and restart dev server.\n' +
            '  VERCEL: Settings → Environment Variables → add for Production → Redeploy.'
          )
          fallbackText =
            '[Dev: VITE_GEMINI_API_KEY missing — set it in Vercel env vars and redeploy.] ' +
            haloFallback(text, playerCtx)

        } else if (errMsg.includes('404')) {
          console.error(
            '[HaloAI] ⚠️  404 — model endpoint not found. ' +
            'The gemini-2.0-flash model may require a different API version prefix. ' +
            'Check https://ai.google.dev/gemini-api/docs/models for current model names.'
          )
          fallbackText = haloFallback(text, playerCtx)

        } else if (errMsg.includes('429') || errMsg.includes('quota')) {
          console.error('[HaloAI] ⚠️  Gemini quota hit. Check quota at https://ai.google.dev/gemini-api/docs/quota')
          fallbackText =
            haloFallback(text, playerCtx) +
            ' (Dev: Gemini rate limit hit — check your quota in Google AI Studio.)'

        } else if (errMsg.includes('Empty Gemini response')) {
          console.error('[HaloAI] ⚠️  Empty response — likely a safety filter block. Try rephrasing the prompt.')
          fallbackText = haloFallback(text, playerCtx)

        } else {
          fallbackText = haloFallback(text, playerCtx)
        }

        const haloMessage: HaloMessage = {
          id: makeId(),
          role: 'halo',
          content: fallbackText,
          timestamp: new Date(),
        }
        setMessages(prev => [...prev, haloMessage])

      } finally {
        setIsLoading(false)
      }
    },
    // FIX 3: playerCtx only — messages read from ref, not closure
    [playerCtx]
  )

  const clearMessages = useCallback(() => {
    setMessages([])
    messagesRef.current = []
  }, [])

  return { messages, isLoading, sendMessage, clearMessages }
}
