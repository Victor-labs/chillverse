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

function makeId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

/**
 * Core hook managing Halo AI message history, Gemini API calls, loading
 * state, and graceful fallback routing. Consumed by HaloPanel.
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

        const systemPrompt = buildHaloSystemPrompt(playerCtx)

        const priorContents: GeminiContent[] = messages.map(msg => ({
          role: msg.role === 'halo' ? 'model' : 'user',
          parts: [{ text: msg.content }],
        }))

        const body = {
          contents: [
            { role: 'user', parts: [{ text: systemPrompt }] },
            { role: 'model', parts: [{ text: 'Got it.' }] },
            ...priorContents,
            { role: 'user', parts: [{ text }] },
          ] satisfies GeminiContent[],
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
          throw new Error(`Gemini API error: ${response.status}`)
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
      } catch {
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
