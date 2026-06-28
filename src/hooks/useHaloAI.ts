// src/hooks/useHaloAI.ts
import { useCallback, useState } from 'react'
import type { HaloMessage, HaloPlayerContext } from '../types/halo'
import { buildHaloSystemPrompt } from '../lib/haloSystemPrompt'
import { haloFallback } from '../lib/haloFallback'

interface UseHaloAIState {
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

interface GeminiRequestBody {
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
 * Core hook managing Halo AI message history, Gemini API calls, loading
 * state, and graceful fallback routing. Consumed by HaloAIPage.
 *
 * FIX #1: system_instruction is NOT used — it requires billing-enabled projects
 * on the Gemini API. Instead, the knowledge base is injected as a synthetic
 * first user/model turn, which works identically on the free tier.
 *
 * FIX #2: catch block now logs errors to console so failures are visible
 * in DevTools instead of being silently swallowed.
 */
export function useHaloAI(playerCtx: HaloPlayerContext): UseHaloAIState {
  const [messages, setMessages] = useState<HaloMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)

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

        // Build the full knowledge base + player context system prompt
        const systemPrompt = buildHaloSystemPrompt(playerCtx)

        // Map prior chat history into Gemini's content format
        const priorContents: GeminiContent[] = messages.map(msg => ({
          role: msg.role === 'halo' ? 'model' : 'user',
          parts: [{ text: msg.content }],
        }))

        // FIX #1: Inject knowledge base as a synthetic first turn pair instead
        // of system_instruction. The free-tier Gemini API blocks system_instruction,
        // causing a silent 400 error that routes every message to haloFallback().
        // This approach is functionally identical and works across all API tiers.
        const body: GeminiRequestBody = {
          contents: [
            {
              role: 'user',
              parts: [{ text: `SYSTEM INSTRUCTIONS & KNOWLEDGE BASE:\n${systemPrompt}\n\nAcknowledge you understand your role and are ready.` }],
            },
            {
              role: 'model',
              parts: [{ text: `Understood. I'm Halo, the Chillverse AI companion. I have full knowledge of the platform and ${playerCtx.displayName}'s live stats. Ready to help.` }],
            },
            ...priorContents,
            { role: 'user', parts: [{ text }] },
          ],
          generationConfig: {
            temperature: 0.85,
            maxOutputTokens: 300,
            topP: 0.9,
          },
        }

        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })

        if (!response.ok) {
          const errBody = await response.text()
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
      } catch (err) {
        // FIX #2: Log the actual error so you can diagnose failures in DevTools
        // instead of getting a silent fallback with no indication of what broke.
        console.error('[HaloAI] Gemini call failed:', err)

        // Graceful fallback — always responds even without a valid API key
        const fallbackText = haloFallback(text, playerCtx)
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
    [messages, playerCtx]
  )

  const clearMessages = useCallback(() => setMessages([]), [])

  return { messages, isLoading, sendMessage, clearMessages }
}
