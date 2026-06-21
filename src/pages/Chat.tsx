// src/pages/Chat.tsx
import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Phone, Video, Search, MoreVertical,
  Smile, Paperclip, Send, X, Trash2, Reply,
  Image, FileText, Music, Camera,
} from 'lucide-react'
import { ripple } from '../lib/ripple'

// ─── Types ──────────────────────────────────────────────────
interface Contact {
  id: number
  name: string
  initials: string
  bg: string
  lastMsg: string
  time: string
  unread: number
  online: boolean
  status: string
}

interface Reaction { emoji: string; mine: boolean; count: number }

interface Message {
  id: number
  contactId: number
  text: string
  mine: boolean
  time: string
  reactions: Reaction[]
  replyTo?: { text: string; mine: boolean } | null
  deleted?: boolean
}

// ─── Data ───────────────────────────────────────────────────
const CONTACTS: Contact[] = [
  { id: 1, name: 'Alex R.',   initials: 'AR', bg: '#ff6b6b', lastMsg: 'GG! That last round was insane',   time: '2m',  unread: 3,  online: true,  status: 'In a match' },
  { id: 2, name: 'Maya K.',   initials: 'MK', bg: '#4f8ef7', lastMsg: 'You up for Mall run tonight?',     time: '9m',  unread: 1,  online: true,  status: 'Browsing Mall' },
  { id: 3, name: 'Zion T.',   initials: 'ZT', bg: '#9b6dff', lastMsg: 'Check my new Studio drop!',        time: '1h',  unread: 0,  online: false, status: 'Last seen 1h ago' },
  { id: 4, name: 'Jamie L.',  initials: 'JL', bg: '#3ecf8e', lastMsg: 'gg wp! Rematch tomorrow?',         time: '3h',  unread: 0,  online: true,  status: 'Online' },
  { id: 5, name: 'Brett P.',  initials: 'BP', bg: '#f5c542', lastMsg: 'Bro that clutch was insane 😂',    time: '1d',  unread: 0,  online: false, status: 'Last seen yesterday' },
  { id: 6, name: 'Cleo M.',   initials: 'CM', bg: '#ff4d8b', lastMsg: 'Want to collab on Studio?',        time: '2d',  unread: 0,  online: false, status: 'Last seen 2d ago' },
]

function initMsgs(): Message[] {
  return [
    { id: 1,  contactId: 1, text: 'Yo that game was wild last night!',                   mine: false, time: '8:42 PM', reactions: [], replyTo: null },
    { id: 2,  contactId: 1, text: 'Right?? That final circle was so stressful 😅',        mine: true,  time: '8:43 PM', reactions: [{ emoji: '😂', mine: false, count: 1 }], replyTo: null },
    { id: 3,  contactId: 1, text: 'How did you pull off that last shot though',            mine: false, time: '8:44 PM', reactions: [], replyTo: null },
    { id: 4,  contactId: 1, text: 'Pure luck not gonna lie lmaooo',                       mine: true,  time: '8:44 PM', reactions: [{ emoji: '💀', mine: false, count: 2 }], replyTo: null },
    { id: 5,  contactId: 1, text: 'GG! That last round was insane',                       mine: false, time: '8:46 PM', reactions: [], replyTo: null },
    { id: 6,  contactId: 2, text: 'Hey! Love your profile vibes 🔥',                      mine: false, time: '9:00 PM', reactions: [], replyTo: null },
    { id: 7,  contactId: 2, text: 'Thanks!! Studio mode is fun once you get it 😄',       mine: true,  time: '9:01 PM', reactions: [], replyTo: null },
    { id: 8,  contactId: 2, text: 'You up for Mall run tonight?',                         mine: false, time: '9:03 PM', reactions: [], replyTo: null },
  ]
}

const EMOJIS = ['😂','🔥','💀','👑','😍','🎮','💯','🙌','😅','🤯','❤️','👀','🫡','💪','🏆']
const FILTERS = ['All', 'Online', 'Unread']

// ─── Icon button ─────────────────────────────────────────────
function IBtn({ onClick, children, style }: { onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: 36, height: 36, borderRadius: 10, flexShrink: 0,
        background: 'var(--surface)',
        boxShadow: '2px 2px 6px var(--neu-dark), -1px -1px 4px var(--neu-light)',
        color: 'var(--text-dim)', border: 'none', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'color 0.15s',
        ...style,
      }}
      onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)' }}
      onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-dim)' }}
    >
      {children}
    </button>
  )
}

// ─── Main ───────────────────────────────────────────────────
export default function Chat() {
  const navigate = useNavigate()
  const [contacts] = useState<Contact[]>(CONTACTS)
  const [messages, setMessages] = useState<Message[]>(initMsgs())
  const [activeId, setActiveId] = useState<number | null>(1)
  const [filter, setFilter] = useState('All')
  const [search, setSearch] = useState('')
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [ctxMsg, setCtxMsg] = useState<Message | null>(null)
  const [ctxPos, setCtxPos] = useState({ x: 0, y: 0 })
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [emojiForMsg, setEmojiForMsg] = useState<number | null>(null)
  const [profileOpen, setProfileOpen] = useState(false)
  const [attachOpen, setAttachOpen] = useState(false)
  const [replyTo, setReplyTo] = useState<Message | null>(null)
  const [showConv, setShowConv] = useState(false)
  const msgEnd = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const activeContact = contacts.find(c => c.id === activeId) ?? null

  const filtered = contacts.filter(c => {
    if (filter === 'Online' && !c.online) return false
    if (filter === 'Unread' && c.unread === 0) return false
    if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const convMsgs = messages.filter(m => m.contactId === activeId)

  useEffect(() => {
    msgEnd.current?.scrollIntoView({ behavior: 'smooth' })
  }, [convMsgs.length, activeId])

  function openConv(id: number) {
    setActiveId(id)
    setShowConv(true)
    setCtxMsg(null)
    setEmojiForMsg(null)
    setProfileOpen(false)
    setAttachOpen(false)
    setReplyTo(null)
    setText('')
  }

  function sendMsg() {
    if (!text.trim() || !activeId) return
    setSending(true)
    const msg: Message = {
      id: Date.now(), contactId: activeId,
      text: text.trim(), mine: true,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      reactions: [],
      replyTo: replyTo ? { text: replyTo.text, mine: replyTo.mine } : null,
    }
    setMessages(ms => [...ms, msg])
    setText('')
    setReplyTo(null)
    setTimeout(() => setSending(false), 600)
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMsg()
    }
  }

  function addReaction(msgId: number, emoji: string) {
    setMessages(ms => ms.map(m => {
      if (m.id !== msgId) return m
      const existing = m.reactions.find(r => r.emoji === emoji)
      if (existing) {
        return { ...m, reactions: m.reactions.map(r => r.emoji === emoji ? { ...r, count: r.count + 1, mine: true } : r) }
      }
      return { ...m, reactions: [...m.reactions, { emoji, count: 1, mine: true }] }
    }))
    setEmojiForMsg(null)
  }

  function deleteMsg(id: number) {
    setMessages(ms => ms.map(m => m.id === id ? { ...m, deleted: true, text: 'Message deleted' } : m))
    setCtxMsg(null)
  }

  function openCtx(e: React.MouseEvent, msg: Message) {
    e.preventDefault()
    setCtxMsg(msg)
    setCtxPos({ x: e.clientX, y: e.clientY })
    setEmojiForMsg(null)
  }

  const totalUnread = contacts.reduce((s, c) => s + c.unread, 0)

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 60px)', overflow: 'hidden', background: 'var(--bg)' }}>

      {/* ── Contact list panel ── */}
      <div style={{
        width: showConv ? 0 : '100%',
        maxWidth: 340,
        flexShrink: 0,
        background: 'var(--surface)',
        borderRight: '1px solid rgba(255,255,255,0.05)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        transition: 'width 0.25s',
      }}
        className="md:flex"
      >
        {/* List header */}
        <div style={{ padding: '16px 16px 10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>Messages</span>
              {totalUnread > 0 && (
                <span style={{ background: 'var(--accent)', color: '#fff', fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 10 }}>{totalUnread}</span>
              )}
            </div>
            <IBtn><MoreVertical size={15} /></IBtn>
          </div>

          {/* Search */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'var(--surface2)',
            boxShadow: 'inset 2px 2px 6px var(--neu-dark)',
            borderRadius: 12, border: '1px solid rgba(255,255,255,0.05)',
            padding: '8px 12px', marginBottom: 10,
          }}>
            <Search size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <input
              type="text"
              placeholder="Search…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 13, color: 'var(--text)', minWidth: 0 }}
            />
          </div>

          {/* Filter pills */}
          <div style={{ display: 'flex', gap: 6 }}>
            {FILTERS.map(f => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                style={{
                  padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  background: filter === f ? 'rgba(255,255,255,0.10)' : 'transparent',
                  color: filter === f ? '#fff' : 'var(--text-dim)',
                  border: filter === f ? '1px solid rgba(255,255,255,0.15)' : '1px solid transparent',
                }}
              >
                {f}
                {f === 'Unread' && totalUnread > 0 && <span style={{ marginLeft: 4, fontSize: 10, color: 'var(--text-muted)' }}>{totalUnread}</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Contact rows */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {filtered.map(c => (
            <button
              key={c.id}
              type="button"
              onClick={(e) => { ripple(e); openConv(c.id) }}
              className="ripple-wrap"
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 16px', width: '100%', cursor: 'pointer',
                borderBottom: '1px solid rgba(255,255,255,0.04)',
                background: activeId === c.id ? 'rgba(255,255,255,0.07)' : 'transparent',
                border: 'none', textAlign: 'left',
                borderRadius: activeId === c.id ? 6 : 0,
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => { if (activeId !== c.id) e.currentTarget.style.background = 'rgba(255,255,255,0.03)' }}
              onMouseLeave={e => { if (activeId !== c.id) e.currentTarget.style.background = 'transparent' }}
            >
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <div style={{ width: 40, height: 40, borderRadius: 13, background: c.bg, color: '#fff', fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {c.initials}
                </div>
                {c.online && <span style={{ position: 'absolute', bottom: 1, right: 1, width: 9, height: 9, borderRadius: '50%', background: 'var(--green)', border: '2px solid var(--surface)' }} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{c.name}</span>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }}>{c.time}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>{c.lastMsg}</span>
                  {c.unread > 0 && <span style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0, marginLeft: 4 }}>{c.unread} unread</span>}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ── Conversation panel ── */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg)',
        minWidth: 0,
        position: 'relative',
      }}>
        {activeContact ? (
          <>
            {/* Conv topbar */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '0 16px', height: 56, flexShrink: 0,
              background: 'rgba(17,17,19,0.90)', backdropFilter: 'blur(14px)',
              borderBottom: '1px solid rgba(255,255,255,0.05)',
            }}>
              <IBtn onClick={() => setShowConv(false)} style={{ display: 'flex' }}><ArrowLeft size={15} /></IBtn>

              <button
                type="button"
                onClick={() => setProfileOpen(v => !v)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', minWidth: 0 }}
              >
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 10, background: activeContact.bg, color: '#fff', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {activeContact.initials}
                  </div>
                  {activeContact.online && <span style={{ position: 'absolute', bottom: 1, right: 1, width: 8, height: 8, borderRadius: '50%', background: 'var(--green)', border: '1.5px solid var(--bg)' }} />}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{activeContact.name}</div>
                  <div style={{ fontSize: 11, color: activeContact.online ? 'var(--green)' : 'var(--text-muted)' }}>{activeContact.status}</div>
                </div>
              </button>

              <div style={{ display: 'flex', gap: 6 }}>
                <IBtn><Phone size={15} /></IBtn>
                <IBtn><Video size={15} /></IBtn>
              </div>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 14px', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {convMsgs.map(msg => (
                <div
                  key={msg.id}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: msg.mine ? 'flex-end' : 'flex-start',
                    marginBottom: 6,
                  }}
                >
                  {/* Reply preview */}
                  {msg.replyTo && !msg.deleted && (
                    <div style={{
                      fontSize: 11, color: 'var(--text-dim)', padding: '4px 10px',
                      background: 'rgba(255,255,255,0.04)', borderRadius: 8,
                      borderLeft: `2px solid ${msg.mine ? 'var(--accent)' : 'var(--blue)'}`,
                      marginBottom: 4, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {msg.replyTo.text}
                    </div>
                  )}

                  {/* Bubble */}
                  <div
                    onContextMenu={e => !msg.deleted && openCtx(e, msg)}
                    style={{
                      maxWidth: '72%',
                      padding: '9px 13px',
                      borderRadius: 16,
                      background: msg.mine ? 'var(--accent)' : 'var(--surface)',
                      color: msg.mine ? '#fff' : 'var(--text)',
                      boxShadow: msg.mine
                        ? '0 2px 12px rgba(255,107,0,0.25)'
                        : '2px 2px 8px var(--neu-dark), -1px -1px 4px var(--neu-light)',
                      borderBottomRightRadius: msg.mine ? 4 : 16,
                      borderBottomLeftRadius: msg.mine ? 16 : 4,
                      fontSize: 13.5, lineHeight: 1.45,
                      fontStyle: msg.deleted ? 'italic' : 'normal',
                      opacity: msg.deleted ? 0.6 : 1,
                      cursor: 'context-menu',
                      userSelect: 'none',
                    }}
                  >
                    {msg.text}
                  </div>

                  {/* Time + emoji trigger */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{msg.time}</span>
                    {!msg.deleted && (
                      <button
                        type="button"
                        onClick={() => setEmojiForMsg(emojiForMsg === msg.id ? null : msg.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, lineHeight: 1 }}
                      >
                        <Smile size={12} />
                      </button>
                    )}
                  </div>

                  {/* Reactions */}
                  {msg.reactions.length > 0 && (
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                      {msg.reactions.map(r => (
                        <button
                          key={r.emoji}
                          type="button"
                          onClick={() => addReaction(msg.id, r.emoji)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 3,
                            padding: '3px 7px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
                            background: r.mine ? 'rgba(255,107,0,0.1)' : 'var(--surface2)',
                            border: r.mine ? '1px solid rgba(255,107,0,0.4)' : '1px solid rgba(255,255,255,0.08)',
                          }}
                        >
                          {r.emoji} {r.count > 1 && <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{r.count}</span>}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Inline emoji picker */}
                  {emojiForMsg === msg.id && (
                    <div style={{
                      display: 'flex', gap: 4, flexWrap: 'wrap', padding: 8,
                      background: 'var(--surface2)', border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: 14, boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
                      marginTop: 4, maxWidth: 220,
                    }}>
                      {EMOJIS.map(em => (
                        <button key={em} type="button" onClick={() => addReaction(msg.id, em)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 2 }}>
                          {em}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              <div ref={msgEnd} />
            </div>

            {/* Reply bar */}
            {replyTo && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 14px', background: 'var(--surface2)',
                borderTop: '1px solid rgba(255,255,255,0.04)',
              }}>
                <div style={{ flex: 1, fontSize: 12, color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <span style={{ color: 'var(--accent)', fontWeight: 600 }}>Replying: </span>{replyTo.text}
                </div>
                <button type="button" onClick={() => setReplyTo(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                  <X size={14} />
                </button>
              </div>
            )}

            {/* Input bar */}
            <div style={{
              display: 'flex', alignItems: 'flex-end', gap: 8,
              padding: '10px 12px',
              background: 'rgba(17,17,19,0.92)', backdropFilter: 'blur(14px)',
              borderTop: '1px solid rgba(255,255,255,0.05)',
            }}>
              <IBtn onClick={(e) => { ripple(e); setAttachOpen(v => !v) }}><Paperclip size={15} /></IBtn>
              <IBtn onClick={() => setEmojiOpen(v => !v)}><Smile size={15} /></IBtn>

              <div style={{
                flex: 1,
                background: 'var(--surface)',
                boxShadow: 'inset 2px 2px 6px var(--neu-dark)',
                border: '1px solid rgba(255,255,255,0.05)',
                borderRadius: 14, padding: '9px 12px',
                display: 'flex', alignItems: 'flex-end',
              }}>
                <textarea
                  ref={inputRef}
                  rows={1}
                  value={text}
                  onChange={e => setText(e.target.value)}
                  onKeyDown={handleKey}
                  placeholder="Type a message…"
                  style={{
                    flex: 1, background: 'transparent', border: 'none', outline: 'none',
                    color: 'var(--text)', fontSize: 13.5, resize: 'none',
                    maxHeight: 80, overflowY: 'auto', lineHeight: 1.4,
                    fontFamily: 'inherit',
                  }}
                />
              </div>

              <button
                type="button"
                onClick={sendMsg}
                style={{
                  width: 40, height: 40, borderRadius: 11, flexShrink: 0, border: 'none',
                  background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
                  boxShadow: '0 4px 14px rgba(255,107,0,0.35)',
                  color: '#fff', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'transform 0.15s, box-shadow 0.15s',
                  animation: sending ? 'planeLaunch 0.5s ease-out both' : 'none',
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.08)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(255,107,0,0.5)' }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(255,107,0,0.35)' }}
              >
                <Send size={16} />
              </button>
            </div>

            {/* Emoji picker full */}
            {emojiOpen && (
              <div style={{
                position: 'absolute', bottom: 70, right: 14,
                background: 'var(--surface2)', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 16, padding: 12, display: 'flex', flexWrap: 'wrap', gap: 4,
                boxShadow: '0 12px 40px rgba(0,0,0,0.5)', maxWidth: 230, zIndex: 50,
              }}>
                {EMOJIS.map(em => (
                  <button key={em} type="button" onClick={() => { setText(t => t + em); setEmojiOpen(false) }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, padding: 3 }}>
                    {em}
                  </button>
                ))}
              </div>
            )}

            {/* Attach sheet */}
            {attachOpen && (
              <div style={{
                position: 'absolute', bottom: 70, left: 14,
                background: 'var(--surface2)', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 16, padding: 12, boxShadow: '0 12px 40px rgba(0,0,0,0.5)', zIndex: 50,
              }}>
                {[{ Icon: Image, label: 'Photo' }, { Icon: FileText, label: 'File' }, { Icon: Music, label: 'Audio' }, { Icon: Camera, label: 'Camera' }].map(({ Icon, label }) => (
                  <button key={label} type="button" onClick={() => setAttachOpen(false)}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', width: '100%', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', fontSize: 13, borderRadius: 10 }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = 'var(--text)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text-dim)' }}
                  >
                    <Icon size={16} /> {label}
                  </button>
                ))}
              </div>
            )}

            {/* Context menu */}
            {ctxMsg && (
              <>
                <div style={{ position: 'fixed', inset: 0, zIndex: 90 }} onClick={() => setCtxMsg(null)} />
                <div style={{
                  position: 'fixed', left: Math.min(ctxPos.x, window.innerWidth - 170), top: Math.min(ctxPos.y, window.innerHeight - 140),
                  zIndex: 100,
                  background: 'var(--surface2)', border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 14, overflow: 'hidden', boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
                  minWidth: 160,
                }}>
                  {[
                    { icon: <Smile size={14} />, label: 'React', action: () => { setEmojiForMsg(ctxMsg.id); setCtxMsg(null) } },
                    { icon: <Reply size={14} />, label: 'Reply', action: () => { setReplyTo(ctxMsg); setCtxMsg(null) } },
                    ...(ctxMsg.mine ? [{ icon: <Trash2 size={14} />, label: 'Delete', action: () => deleteMsg(ctxMsg.id) }] : []),
                  ].map(({ icon, label, action }) => (
                    <button key={label} type="button" onClick={action}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 16px', width: '100%', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: label === 'Delete' ? 'var(--red)' : 'var(--text-dim)' }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'none' }}
                    >
                      {icon} {label}
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* Profile popover */}
            {profileOpen && activeContact && (
              <>
                <div style={{ position: 'fixed', inset: 0, zIndex: 90 }} onClick={() => setProfileOpen(false)} />
                <div style={{
                  position: 'absolute', top: 64, right: 14, zIndex: 100,
                  background: 'var(--surface2)', border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 18, padding: 18, width: 220,
                  boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                    <div style={{ width: 48, height: 48, borderRadius: 14, background: activeContact.bg, color: '#fff', fontWeight: 700, fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {activeContact.initials}
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{activeContact.name}</div>
                      <div style={{ fontSize: 11, color: activeContact.online ? 'var(--green)' : 'var(--text-muted)' }}>{activeContact.status}</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => navigate('/profile')}
                    style={{ width: '100%', padding: '9px', borderRadius: 11, fontSize: 13, fontWeight: 700 }}
                  >
                    View Profile
                  </button>
                </div>
              </>
            )}
          </>
        ) : (
          /* Empty state */
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 40 }}>💬</div>
            <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-dim)' }}>Select a conversation</p>
          </div>
        )}
      </div>
    </div>
  )
}
