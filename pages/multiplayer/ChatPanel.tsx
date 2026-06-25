// src/pages/multiplayer/ChatPanel.tsx
import { useState, useRef, useEffect } from 'react'
import { Send, MessageCircle, X, ChevronDown } from 'lucide-react'
import type { RoomMessageEnriched } from './multiplayerTypes'

const AVATAR_COLORS = [
  '#ff6b6b', '#4f8ef7', '#9b6dff', '#3ecf8e',
  '#f5c542', '#ff4d8b', '#ff9a3c', '#00e5ff',
]

function avatarColor(name: string): string {
  return AVATAR_COLORS[(name.charCodeAt(0) || 0) % AVATAR_COLORS.length]
}

interface ChatPanelProps {
  messages: RoomMessageEnriched[]
  myId: string
  onSend: (text: string) => Promise<void>
}

export default function ChatPanel({ messages, myId, onSend }: ChatPanelProps) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend() {
    const trimmed = text.trim()
    if (!trimmed || sending) return
    setSending(true)
    setText('')
    await onSend(trimmed)
    setSending(false)
    inputRef.current?.focus()
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const unreadCount = messages.length

  // ── Message bubble ──────────────────────────────────────────
  function Bubble({ msg }: { msg: RoomMessageEnriched }) {
    const isMine = msg.player_id === myId
    const initials = msg.senderName.charAt(0).toUpperCase()
    const color = avatarColor(msg.senderName)
    const time = new Date(msg.created_at).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    })

    return (
      <div className={`flex gap-2 mb-2 ${isMine ? 'flex-row-reverse' : 'flex-row'}`}>
        {/* Avatar */}
        <div
          className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white"
          style={{ background: color }}
        >
          {initials}
        </div>

        <div className={`flex flex-col ${isMine ? 'items-end' : 'items-start'} max-w-[75%]`}>
          {!isMine && (
            <span className="text-[10px] font-medium mb-0.5" style={{ color: 'var(--text-muted)' }}>
              {msg.senderName}
            </span>
          )}
          <div
            className="px-3 py-2 rounded-2xl text-sm leading-relaxed"
            style={{
              background: isMine
                ? 'linear-gradient(135deg, #6c50ff, #a78bfa)'
                : 'var(--surface2)',
              color: 'var(--text)',
              borderRadius: isMine ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
            }}
          >
            {msg.message}
          </div>
          <span className="text-[9px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {time}
          </span>
        </div>
      </div>
    )
  }

  // ────────────────────────────────────────────────────────────
  // Desktop: right-side panel (lg: always visible)
  // Mobile: slide-up drawer triggered by toggle button
  // ────────────────────────────────────────────────────────────

  return (
    <>
      {/* ── Mobile toggle button ── */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="lg:hidden fixed bottom-5 right-5 z-50 flex items-center gap-2 px-4 py-2.5 rounded-full shadow-lg"
        style={{
          background: 'linear-gradient(135deg, #6c50ff, #a78bfa)',
          color: '#fff',
          border: 'none',
          cursor: 'pointer',
          fontSize: 13,
          fontWeight: 700,
        }}
      >
        <MessageCircle size={16} />
        Chat
        {unreadCount > 0 && !open && (
          <span
            className="rounded-full px-1.5 py-0.5 text-[10px] font-bold"
            style={{ background: '#ff4ecd', color: '#fff', minWidth: 18, textAlign: 'center' }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* ── Mobile overlay ── */}
      {open && (
        <div
          className="lg:hidden fixed inset-0 z-[60]"
          style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
          onClick={() => setOpen(false)}
        />
      )}

      {/* ── Chat panel (mobile drawer + desktop sidebar) ── */}
      <div
        className={`
          fixed z-[70] flex flex-col
          lg:top-[68px] lg:right-0 lg:bottom-0 lg:w-72 lg:translate-y-0 lg:translate-x-0 lg:rounded-none
          bottom-0 left-0 right-0 rounded-t-2xl
          transition-transform duration-300
          lg:!translate-y-0
          ${open ? 'translate-y-0' : 'translate-y-full lg:translate-y-0'}
        `}
        style={{
          background: 'var(--surface)',
          borderLeft: '1px solid rgba(108,80,255,0.16)',
          borderTop: '1px solid rgba(108,80,255,0.16)',
          maxHeight: '80vh',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0"
          style={{ borderColor: 'rgba(108,80,255,0.16)' }}
        >
          <div className="flex items-center gap-2">
            <MessageCircle size={15} style={{ color: '#a78bfa' }} />
            <span className="font-semibold text-sm" style={{ color: 'var(--text)' }}>
              Room Chat
            </span>
          </div>
          <button
            type="button"
            className="lg:hidden"
            onClick={() => setOpen(false)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)' }}
          >
            <ChevronDown size={18} />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-3" style={{ minHeight: 0 }}>
          {messages.length === 0 && (
            <p className="text-center text-xs mt-8" style={{ color: 'var(--text-muted)' }}>
              No messages yet. Say hi! 👋
            </p>
          )}
          {messages.map(msg => (
            <Bubble key={msg.id} msg={msg} />
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div
          className="flex items-end gap-2 p-3 border-t flex-shrink-0"
          style={{ borderColor: 'rgba(108,80,255,0.16)' }}
        >
          <textarea
            ref={inputRef}
            rows={1}
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Type a message…"
            className="flex-1 resize-none rounded-xl px-3 py-2 text-sm outline-none"
            style={{
              background: 'var(--surface2)',
              border: '1px solid rgba(108,80,255,0.2)',
              color: 'var(--text)',
              lineHeight: 1.4,
              maxHeight: 80,
              overflow: 'hidden',
            }}
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!text.trim() || sending}
            className="flex-shrink-0 rounded-xl flex items-center justify-center transition-opacity"
            style={{
              width: 36,
              height: 36,
              background: text.trim()
                ? 'linear-gradient(135deg, #6c50ff, #a78bfa)'
                : 'var(--surface2)',
              border: 'none',
              cursor: text.trim() ? 'pointer' : 'not-allowed',
              opacity: sending ? 0.6 : 1,
              color: '#fff',
            }}
          >
            <Send size={15} />
          </button>
        </div>
      </div>
    </>
  )
}
