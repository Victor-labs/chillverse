// src/hooks/useHaloAI.ts
import { useCallback, useState } from 'react'
import type { HaloMessage, HaloPlayerContext } from '../types/halo'
import { buildHaloSystemPrompt, getTopicSections } from '../lib/haloSystemPrompt'
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
 * ARCHITECTURE: Uses a two-part prompt strategy to stay well under free-tier
 * token quotas:
 *   1. buildHaloSystemPrompt → slim persona + player context (~500 tokens)
 *   2. getTopicSections → targeted knowledge for THIS specific question (~200-800 tokens)
 *
 * Total per-request tokens: ~1,400–1,800 vs the previous ~6,000+ token dump.
 *
 * ERROR CLASSIFICATION: Each error type is classified and logged with a distinct
 * message so the dev can immediately identify the failure mode in DevTools Console
 * without needing to inspect the Network tab.
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

        // SLIM persona + player context (~500 tokens)
        const slimSystemPrompt = buildHaloSystemPrompt(playerCtx)

        // Targeted knowledge sections for THIS question (~200-800 tokens)
        const topicSections = getTopicSections(text)

        // Map prior chat history into Gemini's content format
        const priorContents: GeminiContent[] = messages.map(msg => ({
          role: msg.role === 'halo' ? 'model' : 'user',
          parts: [{ text: msg.content }],
        }))

        const body: GeminiRequestBody = {
          contents: [
            {
              role: 'user',
              parts: [{
                text:
                  `PERSONA + PLAYER CONTEXT:\n${slimSystemPrompt}\n\n` +
                  `RELEVANT KNOWLEDGE FOR THIS QUESTION:\n${topicSections}\n\n` +
                  `Rules: stay in character as Halo. Use the player context above. ` +
                  `Keep replies to 1-4 sentences unless asked to elaborate. Acknowledge ready.`,
              }],
            },
            {
              role: 'model',
              parts: [{
                text: `Ready. I'm Halo — I have ${playerCtx.displayName}'s live stats and the relevant Chillverse knowledge for this question.`,
              }],
            },
            ...priorContents,
            { role: 'user', parts: [{ text }] },
          ],
          generationConfig: {
            temperature: 0.75,
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
        const errMsg = err instanceof Error ? err.message : String(err)
        console.error('[HaloAI] Error:', errMsg)

        let fallbackText: string

        if (errMsg.includes('VITE_GEMINI_API_KEY')) {
          // Key missing in environment — most common production issue
          console.error(
            '[HaloAI] ⚠️ VITE_GEMINI_API_KEY is not set. ' +
            'Add it to your Vercel Environment Variables (Settings → Environment Variables) ' +
            'then redeploy. Locally: add it to .env.local and restart the dev server.'
          )
          fallbackText =
            `[Dev notice: VITE_GEMINI_API_KEY is not set in this environment. ` +
            `Add it to your Vercel environment variables and redeploy.] ` +
            haloFallback(text, playerCtx)
        } else if (errMsg.includes('429') || errMsg.includes('quota')) {
          // Rate limited — reduce prompt size or upgrade billing
          console.error('[HaloAI] ⚠️ Gemini quota hit — prompt may be too large or requests too frequent.')
          fallbackText =
            haloFallback(text, playerCtx) +
            ' (Tip for dev: Gemini quota hit — check your API quota in Google AI Studio.)'
        } else if (errMsg.includes('Empty Gemini response')) {
          // Safety filter or malformed response — try rephrasing
          console.error('[HaloAI] ⚠️ Gemini returned an empty response (safety filter or malformed JSON).')
          fallbackText = haloFallback(text, playerCtx)
        } else {
          console.error('[HaloAI] ⚠️ Unexpected error — check Network tab for details.')
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
    [messages, playerCtx]
  )

  const clearMessages = useCallback(() => setMessages([]), [])

  return { messages, isLoading, sendMessage, clearMessages }
}
