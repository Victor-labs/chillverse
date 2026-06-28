// src/components/HaloAI/HaloPanel.tsx
import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { X, Send } from 'lucide-react'
import { useHalo } from '../../context/HaloContext'
import { useHaloAI } from '../../hooks/useHaloAI'
import type { HaloPlayerContext } from '../../types/halo'
import HaloMessage from './HaloMessage'
import HaloTypingDots from './HaloTypingDots'

interface HaloPanelProps {
  playerCtx: HaloPlayerContext
}

export default function HaloPanel({ playerCtx }: HaloPanelProps) {
  const { isOpen, closeHalo } = useHalo()
  const { messages, isLoading, sendMessage } = useHaloAI(playerCtx)
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  const handleSend = () => {
    const trimmed = input.trim()
    if (!trimmed) return
    sendMessage(trimmed)
    setInput('')
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <>
      {isOpen && (
        <div
          onClick={closeHalo}
          className="fixed inset-0 bg-black/40 z-30"
        />
      )}

      <div
        className="fixed right-0 top-0 h-full z-40 w-full sm:w-[400px] flex flex-col"
        style={{
          background: 'var(--surface)',
          boxShadow: '-4px 0 32px rgba(0,0,0,0.5)',
          transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 300ms ease-out',
        }}
      >
        {/* HEADER */}
        <div
          style={{
            background: 'var(--surface)',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            flexShrink: 0,
          }}
        >
          <button
            onClick={closeHalo}
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              background: 'var(--surface2)',
              border: '1px solid rgba(255,255,255,0.06)',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
            onMouseEnter={e => {
              e.currentTarget.style.color = 'var(--text)'
              e.currentTarget.style.background = 'var(--surface3)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.color = 'var(--text-muted)'
              e.currentTarget.style.background = 'var(--surface2)'
            }}
            aria-label="Close Halo panel"
          >
            <X size={16} />
          </button>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: 'conic-gradient(#9b6dff, #4f8ef7, #3ecf8e, #9b6dff)',
              animation: 'halo-spin 4s linear infinite',
              flexShrink: 0,
            }}
          />
          <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>Halo AI</span>
          <span
            style={{
              fontSize: 9,
              fontWeight: 700,
              color: 'var(--purple)',
              letterSpacing: 1,
              marginLeft: 'auto',
            }}
          >
            POWERED BY CVWT
          </span>
        </div>

        {/* MESSAGE LIST */}
        <div
          className="flex flex-col overflow-y-auto"
          style={{ background: 'var(--bg)', padding: 16, flex: 1 }}
        >
          {messages.length === 0 ? (
            <div
              style={{
                margin: 'auto',
                textAlign: 'center',
                color: 'var(--text-muted)',
                fontSize: 13,
              }}
            >
              Ask me anything about Chillverse, your rank, or game tips 👾
            </div>
          ) : (
            messages.map(message => <HaloMessage key={message.id} message={message} />)
          )}
          {isLoading && <HaloTypingDots />}
          <div ref={bottomRef} />
        </div>

        {/* INPUT AREA */}
        <div
          style={{
            background: 'var(--surface)',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            padding: '12px 16px',
            display: 'flex',
            gap: 8,
            alignItems: 'flex-end',
            flexShrink: 0,
          }}
        >
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Halo anything…"
            rows={1}
            style={{
              flex: 1,
              background: 'var(--surface2)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 10,
              padding: '10px 12px',
              fontSize: 13,
              color: 'var(--text)',
              resize: 'none',
              maxHeight: 80,
            }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            style={{
              width: 38,
              height: 38,
              borderRadius: '50%',
              background: 'var(--purple)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              border: 'none',
              cursor: input.trim() ? 'pointer' : 'default',
              opacity: input.trim() ? 1 : 0.4,
              filter: 'none',
            }}
            onMouseEnter={e => {
              if (input.trim()) e.currentTarget.style.filter = 'brightness(1.1)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.filter = 'none'
            }}
            aria-label="Send message"
          >
            <Send size={16} color="#fff" />
          </button>
        </div>
      </div>

      <style>{`@keyframes halo-spin { to { transform: rotate(360deg); } }`}</style>
    </>
  )
}
