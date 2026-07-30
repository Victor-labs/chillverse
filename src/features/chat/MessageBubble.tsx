// src/features/chat/MessageBubble.tsx
// Extracted out of Chat.tsx so every chat surface — Global, DMs, and Clubs —
// renders messages with the exact same component, not a lookalike. Chat.tsx
// imports these instead of defining its own copies; ClubChat.tsx uses them
// directly. If the bubble style ever changes, it changes everywhere at once.

import { memo } from 'react'
import { Phone, Check, CheckCheck, Star } from 'lucide-react'
import { nameStyleFor } from '../../shared/lib/displayNameStyle'
import VoiceNotePlayer from './voiceNotes/VoiceNotePlayer'
import HiddenContentNotice from '../moderation/HiddenContentNotice'

export interface Message {
  id: string
  sender_id: string | null
  content: string
  created_at: string
  deleted: boolean
  hidden: boolean
  hidden_reason: string | null
  reply_to_id: string | null
  replyPreview?: string
  /** Display name of whoever sent the message being replied to — shown stacked
   *  above the reply, since names are otherwise hidden outside of reply context. */
  replyPreviewName?: string
  senderName?: string
  senderNameFont?: string | null
  senderNameColor?: string | null
  senderUsername?: string
  /** 'text' (default) | 'voice_note' | 'call_log' | 'rank_tag' | 'poll'. */
  type: MessageType
  audio_path: string | null
  audio_duration_seconds: number | null
  call_id: string | null
  /** Set only when type === 'rank_tag'. */
  rank_tag_group: string | null
  /** Set only when type === 'poll'. */
  poll_id: string | null
  /** Custom label to show in place of "Message deleted" — e.g. Clubs shows
   *  who deleted it (president/VP). Undefined falls back to the generic label. */
  deletedLabel?: string
}
export type MessageType = 'text' | 'voice_note' | 'call_log' | 'rank_tag' | 'poll'

/** Read-receipt state for one of MY OWN messages: 'sent' = persisted but not yet
 *  confirmed read by the other member, 'read' = their last_read_at has passed
 *  this message's created_at. null where read state isn't meaningfully tracked
 *  (Global Chat, Clubs — too many members for one "read" state to mean anything). */
export type ReadReceipt = 'sent' | 'read' | null

/** Pre-processed render-ready message with consecutive-group metadata. */
export interface GroupedMessage extends Message {
  isGroupFirst: boolean
  isGroupLast: boolean
}

export const GROUP_GAP_MS = 5 * 60 * 1000 // 5 min — new burst starts after this gap

/** Splits a flat message list into consecutive-sender "bursts" for compact rendering. */
export function groupMessages(messages: Message[]): GroupedMessage[] {
  return messages.map((m, i) => {
    const prev = messages[i - 1]
    const next = messages[i + 1]
    const isStandalone = (t: MessageType) => t === 'rank_tag' || t === 'poll'
    const isGroupFirst = !prev || prev.sender_id !== m.sender_id || isStandalone(prev.type) || isStandalone(m.type) ||
      (new Date(m.created_at).getTime() - new Date(prev.created_at).getTime()) > GROUP_GAP_MS
    const isGroupLast = !next || next.sender_id !== m.sender_id || isStandalone(next.type) || isStandalone(m.type) ||
      (new Date(next.created_at).getTime() - new Date(m.created_at).getTime()) > GROUP_GAP_MS
    return { ...m, isGroupFirst, isGroupLast }
  })
}

export function Avatar({ name, avatarUrl, size = 40, radius = 13 }: { name: string; avatarUrl?: string | null; size?: number; radius?: number }) {
  const colors = ['#ff6b6b','#4f8ef7','#9b6dff','#3ecf8e','#f5c542','#ff4d8b','var(--accent2)','#00e5ff']
  const color = colors[(name.charCodeAt(0) || 0) % colors.length]
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        style={{ width:size, height:size, borderRadius:radius, objectFit:'cover', flexShrink:0, display:'block' }}
        onError={e => {
          const el = e.currentTarget
          el.style.display = 'none'
          const fallback = el.nextElementSibling as HTMLElement | null
          if (fallback) fallback.style.display = 'flex'
        }}
      />
    )
  }
  return (
    <div style={{ width:size, height:size, borderRadius:radius, background:color, color:'#fff', fontWeight:700, fontSize:size*0.35, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
      {(name || '?').charAt(0).toUpperCase()}
    </div>
  )
}

export interface MessageLineProps {
  msg: GroupedMessage
  isMine: boolean
  onContextMenu: (msg: Message, x: number, y: number) => void
  onDoubleClick: (msg: Message) => void
  formatTime: (iso: string) => string
  readReceipt: ReadReceipt
  /** Whether the viewer has starred this message — DMs only, shows a small badge. */
  isStarred: boolean
  /** Whether this is a Global Chat / Club thread (as opposed to a DM) — used to
   *  decide whether a received bubble's leading corner should defer to the name
   *  row shown above the first message of a group. */
  isGroupChat: boolean
}

/** Small diagonal corner-bracket accent, absolutely positioned over one corner
 *  of a bubble. Two of these (an opposite diagonal pair) frame each message:
 *  top-left + bottom-right for received bubbles, top-right + bottom-left for
 *  sent ones — matching the app's accent color instead of a flat border. */
export function BracketCorner({ position, color = 'var(--accent)' }: {
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  color?: string
}) {
  const size = 10
  const thickness = 1.5
  const base: React.CSSProperties = { position:'absolute', width:size, height:size, pointerEvents:'none' }
  const placement: Record<string, React.CSSProperties> = {
    'top-left':     { top:-1, left:-1, borderTop:`${thickness}px solid ${color}`, borderLeft:`${thickness}px solid ${color}`, borderTopLeftRadius:3 },
    'top-right':    { top:-1, right:-1, borderTop:`${thickness}px solid ${color}`, borderRight:`${thickness}px solid ${color}`, borderTopRightRadius:3 },
    'bottom-left':  { bottom:-1, left:-1, borderBottom:`${thickness}px solid ${color}`, borderLeft:`${thickness}px solid ${color}`, borderBottomLeftRadius:3 },
    'bottom-right': { bottom:-1, right:-1, borderBottom:`${thickness}px solid ${color}`, borderRight:`${thickness}px solid ${color}`, borderBottomRightRadius:3 },
  }
  return <span style={{ ...base, ...placement[position] }} />
}

/** One message, rendered as a neomorphic "soft" bubble framed by a diagonal
 *  pair of accent corner-brackets — sized to that message's own content,
 *  never to a sibling's. Consecutive messages from the same sender stack by
 *  simply rendering several of these one after another. Long-press (mobile)
 *  or right-click (desktop) both fire the native `contextmenu` event, which
 *  is what opens the action menu — no separate button needed. */
export const MessageLine = memo(function MessageLine({
  msg, isMine, onContextMenu, onDoubleClick, formatTime, readReceipt, isStarred, isGroupChat,
}: MessageLineProps) {
  const showLeadingCorner = !(isGroupChat && !isMine && msg.isGroupFirst)
  return (
    <div
      className="msg-bubble-col"
      onContextMenu={e => { if (!msg.deleted) { e.preventDefault(); onContextMenu(msg, e.clientX, e.clientY) } }}
      onDoubleClick={() => onDoubleClick(msg)}
      style={{
        position:'relative', cursor:'context-menu', userSelect:'none',
        display:'inline-block', width:'fit-content', maxWidth:'100%',
        marginBottom:4,
        padding:'5px 9px',
        borderRadius:8,
        background:'var(--surface)',
        boxShadow:'3px 3px 7px rgba(10,10,12,0.45), -2px -2px 5px rgba(38,38,48,0.35)',
      }}>

      {!isMine && showLeadingCorner && <BracketCorner position="top-left" />}
      {!isMine && <BracketCorner position="bottom-right" />}
      {isMine && <BracketCorner position="top-right" />}
      {isMine && <BracketCorner position="bottom-left" />}

      {msg.replyPreview && !msg.deleted && (
        <div style={{ marginBottom:3, display:'flex', flexDirection:'column', alignItems: isMine ? 'flex-end' : 'flex-start' }}>
          <span style={{ fontSize:10, fontWeight:700, color:'#4f8ef7' }}>{msg.replyPreviewName || 'Unknown'}</span>
          <span style={{ fontSize:10.5, color:'var(--text-dim)', maxWidth:200, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            {msg.replyPreview.length > 60 ? `${msg.replyPreview.slice(0, 60)}…` : msg.replyPreview}
          </span>
        </div>
      )}

      <span style={{ fontSize:12.5, lineHeight:1.4, color:'var(--text)', fontStyle: msg.deleted ? 'italic' : 'normal', opacity: msg.deleted ? 0.6 : 1, wordBreak:'break-word' }}>
        {msg.hidden ? (
          <HiddenContentNotice reason={msg.hidden_reason} isOwner={isMine} inline />
        ) : msg.deleted ? (msg.deletedLabel ?? 'Message deleted') : msg.type === 'voice_note' ? (
          msg.audio_path ? (
            <VoiceNotePlayer audioPath={msg.audio_path} durationSeconds={msg.audio_duration_seconds ?? 0} tint={isMine ? 'light' : 'dark'} />
          ) : (
            <span style={{ fontStyle:'italic', opacity:0.75 }}>Uploading voice note…</span>
          )
        ) : msg.type === 'call_log' ? (
          <span style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
            <Phone size={13} />
            {msg.content}
            {msg.audio_duration_seconds ? ` · ${Math.floor(msg.audio_duration_seconds / 60)}:${String(msg.audio_duration_seconds % 60).padStart(2, '0')}` : ''}
          </span>
        ) : msg.content}
        {' '}
        <span style={{ display:'inline-flex', alignItems:'center', gap:2, whiteSpace:'nowrap' }}>
          {isStarred && <Star size={9} fill="#ffc107" style={{ color:'#ffc107' }} />}
          <span style={{ fontSize:9.5, color:'var(--text-muted)' }}>{formatTime(msg.created_at)}</span>
          {isMine && !msg.deleted && readReceipt === 'read' && <CheckCheck size={11} style={{ color:'var(--accent)' }} />}
          {isMine && !msg.deleted && readReceipt === 'sent' && <Check size={11} style={{ color:'var(--text-muted)' }} />}
        </span>
      </span>
    </div>
  )
})

export interface MessageBurstProps {
  burst: GroupedMessage[]
  isMine: boolean
  senderLabel: string
  senderNameFont?: string | null
  senderNameColor?: string | null
  avatarUrl: string | null
  onOpenProfile: (msg: Message) => void
  onContextMenu: (msg: Message, x: number, y: number) => void
  onDoubleClick: (msg: Message) => void
  formatTime: (iso: string) => string
  readReceiptFor: (msg: Message) => ReadReceipt
  /** Message ids the viewer has starred — used to show the badge (DMs only). */
  starredIds: Set<string>
  /** Avatars only make sense where more than two people share the thread
   *  (Global Chat, Clubs) — a DM never shows one. Even then this only ever
   *  renders for other people's messages; your own avatar is never shown. */
  isGroupChat: boolean
}

/** A consecutive run of messages from one sender. The avatar (group chats
 *  only, and only for other senders — never your own) appears once per
 *  burst, aligned to the bottom line. Each message underneath keeps
 *  rendering its own independent chat-line via MessageLine. */
export const MessageBurst = memo(function MessageBurst({
  burst, isMine, senderLabel, senderNameFont, senderNameColor, avatarUrl,
  onOpenProfile, onContextMenu, onDoubleClick, formatTime, readReceiptFor, starredIds, isGroupChat,
}: MessageBurstProps) {
  const first = burst[0]

  return (
    <div style={{ display:'flex', flexDirection: isMine ? 'row-reverse' : 'row', alignItems:'flex-start', gap:6, marginBottom:4 }}>
      {isGroupChat && !isMine && (
        <button
          type="button"
          onClick={() => onOpenProfile(first)}
          style={{ background:'none', border:'none', padding:0, cursor:'pointer', flexShrink:0 }}
          title={senderLabel}>
          <Avatar name={senderLabel} avatarUrl={avatarUrl} size={30} radius={10} />
        </button>
      )}

      <div style={{ display:'flex', flexDirection:'column', alignItems: isMine ? 'flex-end' : 'flex-start', maxWidth:'78%' }}>
        {isGroupChat && !isMine && (
          <span style={{ fontSize:11.5, fontWeight:700, color:'#4f8ef7', marginBottom:3, marginLeft:2, ...nameStyleFor({ display_name_font: senderNameFont, display_name_color: senderNameColor }) }}>
            {senderLabel}
          </span>
        )}
        {burst.map(msg => (
          <MessageLine
            key={msg.id}
            msg={msg}
            isMine={isMine}
            onContextMenu={onContextMenu}
            onDoubleClick={onDoubleClick}
            formatTime={formatTime}
            readReceipt={readReceiptFor(msg)}
            isStarred={starredIds.has(msg.id)}
            isGroupChat={isGroupChat}
          />
        ))}
      </div>
    </div>
  )
})
