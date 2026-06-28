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

// Dedicated type for the system_instruction field (no role required)
interface GeminiSystemInstruction {
  parts: GeminiPart[]
}

interface GeminiRequestBody {
  system_instruction: GeminiSystemInstruction
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
 * FIX: The knowledge base system prompt is now sent via the dedicated
 * `system_instruction` field instead of being smuggled as a fake user/model
 * turn. This ensures Gemini treats it as authoritative grounding context
 * rather than just another message in the conversation history.
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

        // ✅ FIXED: system prompt goes in `system_instruction`, NOT as a fake
        // user turn. This gives Gemini the knowledge base as authoritative
        // grounding that persists across the entire conversation without
        // competing with or getting buried by message history.
        const body: GeminiRequestBody = {
          system_instruction: {
            parts: [{ text: systemPrompt }],
          },
          contents: [
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
