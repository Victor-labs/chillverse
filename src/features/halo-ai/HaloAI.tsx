// src/pages/HaloAI.tsx/moreUpcomingUpdates
import { useState, useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Send } from 'lucide-react'
import { useHaloAI, type HaloMessage } from './useHaloAI'
import { useProfile } from '../profile/useProfile'

const LOADING_WORDS = [
  'Musing',
  'Thinking',
  'Tabulating',
  'Accessing',
  'Consulting the archives',
  'Crunching data',
  'Gathering intel',
  'Pondering',
]

const SUGGESTED_PROMPTS = [
  'How do I rank up faster?',
  'What games give the most XP?',
  'What does version 3.0 unlock?',
]

function formatTime(d: Date): string {
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

function MiniOrb({ size }: { size: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        flexShrink: 0,
        background: 'conic-gradient(#9b6dff, #4f8ef7, #3ecf8e, #9b6dff)',
        boxShadow: '0 0 20px rgba(155,109,255,0.4)',
        animation: 'spin 4s linear infinite',
      }}
    />
  )
}

export default function HaloAI() {
  const navigate = useNavigate()
  const { profile } = useProfile()
  const { messages, loading, error, messagesLeft, isIncreasedTier, sendMessage, clearError, addLocalMessage } =
    useHaloAI()
  const [input, setInput] = useState('')
  const [loadingWord, setLoadingWord] = useState(LOADING_WORDS[0])
  const scrollRef = useRef<HTMLDivElement>(null)
  const welcomedRef = useRef(false)

  useEffect(() => {
    if (!loading) return
    setLoadingWord(LOADING_WORDS[Math.floor(Math.random() * LOADING_WORDS.length)])
    const interval = setInterval(() => {
      setLoadingWord(prev => {
        const others = LOADING_WORDS.filter(w => w !== prev)
        return others[Math.floor(Math.random() * others.length)]
      })
    }, 1400)
    return () => clearInterval(interval)
  }, [loading])

  useEffect(() => {
    if (welcomedRef.current) return
    if (messages.length > 0) return
    if (!profile) return
    welcomedRef.current = true
    const welcome: HaloMessage = {
      id: 'welcome',
      role: 'halo',
      text: `Hey ${profile.display_name || profile.username}! I'm Halo 👋 Your personal Chillverse guide. Ask me about ranks, games, XP, missions, the mall — anything you see in the app. What's on your mind?`,
      timestamp: new Date(),
    }
    addLocalMessage(welcome)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, loading])

  const handleSend = (textOverride?: string) => {
    const text = (textOverride ?? input).trim()
    if (!text || loading || messagesLeft === 0) return
    setInput('')
    sendMessage(text)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const badge = isIncreasedTier
    ? { text: 'Boosted', color: 'var(--purple)', glow: true }
    : null

  const isEmpty = messages.length === 0

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--bg)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes dotPulse { 0%,80%,100% { opacity:0.2 } 40% { opacity:1 } }
      `}</style>

      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '16px 18px',
          position: 'sticky',
          top: 0,
          background: 'var(--bg)',
          zIndex: 10,
          borderBottom: '1px solid var(--border)',
        }}
      >
        <button
          onClick={() => navigate(-1)}
          style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            background: 'var(--surface)',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <ArrowLeft size={18} color="var(--text)" />
        </button>
        <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)', flex: 1 }}>Halo AI</div>
        {badge && (
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: badge.color,
              padding: '4px 10px',
              borderRadius: 12,
              background: 'var(--surface2)',
              boxShadow: badge.glow ? '0 0 12px rgba(245,197,66,0.5)' : 'none',
            }}
          >
            {badge.text}
          </div>
        )}
      </div>

      {/* Hero (empty state) */}
      {isEmpty && (
        <div style={{ padding: '24px 18px 8px', textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
            <div
              style={{
                width: 80,
                height: 80,
                borderRadius: '50%',
                background: 'conic-gradient(#9b6dff, #4f8ef7, #3ecf8e, #9b6dff)',
                boxShadow: '0 0 40px rgba(155,109,255,0.5)',
                animation: 'spin 4s linear infinite',
              }}
            />
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', marginBottom: 4 }}>
            Hey {profile?.display_name || profile?.username} 👋
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 16 }}>
            I'm Halo. Ask me anything about Chillverse.
          </div>
          <div
            style={{
              display: 'flex',
              gap: 8,
              overflowX: 'auto',
              paddingBottom: 4,
              justifyContent: 'center',
            }}
          >
            {SUGGESTED_PROMPTS.map(prompt => (
              <button
                key={prompt}
                onClick={() => handleSend(prompt)}
                style={{
                  flexShrink: 0,
                  background: 'var(--surface2)',
                  border: '1px solid rgba(155,109,255,0.2)',
                  borderRadius: 20,
                  padding: '8px 14px',
                  fontSize: 12,
                  color: 'var(--text-dim)',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Daily limit status bar */}
      {!isEmpty && (
        <div
          style={{
            padding: '8px 18px',
            fontSize: 11,
            color: messagesLeft <= 1 ? '#ff6b6b' : 'var(--text-muted)',
            textAlign: 'center',
          }}
        >
          {messagesLeft === 0 ? (
            <span>
              Daily limit reached · <Link to="/version" style={{ color: 'var(--purple)' }}>Upgrade your Version for more</Link>
            </span>
          ) : (
            <span>✦ {messagesLeft} messages left today</span>
          )}
        </div>
      )}

      {/* Chat area */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          padding: '12px 18px',
        }}
      >
        {messages.map(msg => (
          <div
            key={msg.id}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
            }}
          >
            {msg.role === 'halo' && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  marginBottom: 4,
                  marginLeft: 2,
                }}
              >
                <MiniOrb size={16} />
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: 'var(--purple)',
                    letterSpacing: 1,
                    textTransform: 'uppercase',
                  }}
                >
                  Halo
                </span>
              </div>
            )}
            <div
              style={{
                maxWidth: msg.role === 'user' ? '75%' : '80%',
                padding: '12px 16px',
                fontSize: 13.5,
                fontWeight: msg.role === 'user' ? 500 : 400,
                color: msg.role === 'user' ? '#fff' : 'var(--text)',
                background:
                  msg.role === 'user'
                    ? 'linear-gradient(135deg, var(--accent), #ff8c00)'
                    : 'var(--surface2)',
                border: msg.role === 'halo' ? '1px solid rgba(155,109,255,0.15)' : 'none',
                borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                whiteSpace: 'pre-wrap',
                lineHeight: 1.5,
              }}
            >
              {msg.text}
            </div>
            <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 4, padding: '0 2px' }}>
              {formatTime(msg.timestamp)}
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, marginLeft: 2 }}>
              <MiniOrb size={16} />
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: 'var(--purple)',
                  letterSpacing: 1,
                  textTransform: 'uppercase',
                }}
              >
                Halo
              </span>
            </div>
            <div
              style={{
                padding: '12px 16px',
                background: 'var(--surface2)',
                border: '1px solid rgba(155,109,255,0.15)',
                borderRadius: '18px 18px 18px 4px',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <span style={{ fontSize: 12.5, color: 'var(--text-dim)' }}>{loadingWord}…</span>
              <div style={{ display: 'flex', gap: 4 }}>
                {[0, 150, 300].map(delay => (
                  <span
                    key={delay}
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: 'var(--text-dim)',
                      animation: 'dotPulse 1.2s infinite',
                      animationDelay: `${delay}ms`,
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Error banner (debug mode: shows raw error for troubleshooting) */}
      {error && (
        <div
          style={{
            margin: '0 18px 10px',
            background: 'rgba(255,107,107,0.1)',
            border: '1px solid rgba(255,107,107,0.3)',
            borderRadius: 12,
            padding: '10px 14px',
            fontSize: 12,
            color: '#ff6b6b',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 10,
            maxHeight: 160,
            overflowY: 'auto',
          }}
        >
          <span style={{ userSelect: 'text', wordBreak: 'break-word', lineHeight: 1.5, fontFamily: 'monospace' }}>
            {error}
          </span>
          <button
            onClick={clearError}
            style={{
              background: 'none',
              border: 'none',
              color: '#ff6b6b',
              cursor: 'pointer',
              fontSize: 16,
              fontWeight: 700,
              lineHeight: 1,
              flexShrink: 0,
            }}
          >
            ×
          </button>
        </div>
      )}

      {/* Input bar */}
      <div
        style={{
          position: 'sticky',
          bottom: 0,
          background: 'var(--bg)',
          padding: '10px 18px 18px',
          backdropFilter: 'blur(8px)',
        }}
      >
        {messagesLeft === 0 ? (
          <div
            style={{
              background: 'var(--surface2)',
              border: '1px solid rgba(155,109,255,0.2)',
              borderRadius: 16,
              padding: '14px 16px',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 12.5, color: 'var(--text-dim)', marginBottom: 10 }}>
              {isIncreasedTier
                ? "You've used today's Halo AI messages. It resets in 24 hours."
                : "You've used today's Halo AI messages. Upgrade your Version for an increased daily limit."}
            </div>
            {!isIncreasedTier && (
              <Link
                to="/version"
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: 'var(--purple)',
                  textDecoration: 'none',
                }}
              >
                Upgrade Version →
              </Link>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10 }}>
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask Halo anything…"
              rows={1}
              style={{
                flex: 1,
                background: 'var(--surface2)',
                border: '1px solid var(--border)',
                borderRadius: 16,
                padding: '12px 16px',
                color: 'var(--text)',
                fontSize: 14,
                resize: 'none',
                maxHeight: 72,
                fontFamily: 'inherit',
              }}
            />
            <button
              onClick={() => handleSend()}
              disabled={loading || input.trim().length === 0 || messagesLeft === 0}
              style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                flexShrink: 0,
                background: 'linear-gradient(135deg, #9b6dff, #4f8ef7)',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: loading || input.trim().length === 0 || messagesLeft === 0 ? 'not-allowed' : 'pointer',
                opacity: loading || input.trim().length === 0 || messagesLeft === 0 ? 0.4 : 1,
              }}
            >
              <Send size={18} color="#fff" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
  
