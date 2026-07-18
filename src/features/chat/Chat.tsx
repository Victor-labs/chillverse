// src/pages/Chat.tsx
import { useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo, memo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  ArrowLeft, Search, MoreVertical,
  Smile, Send, X, Trash2, Reply, Flag, Lock,
  MessageCircle, UserPlus, ShieldOff, UserCheck,
  ExternalLink, Check, CheckCheck, Pin, PinOff, Phone,
  Megaphone, BarChart3, Timer, Zap, Eye, EyeOff, Star, Paperclip,
} from 'lucide-react'
import { ripple } from '../../shared/lib/ripple'
import { supabase } from '../../shared/lib/supabase'
import { updateMissionProgress } from '../missions/weeklyMissions'
import { notifyMessage, notifyRankTag } from '../achievements/achievements'
import { useAuth } from '../auth/useAuth'
import PageOnboarding from '../onboarding/PageOnboarding'
import StartCallButton from './calling/StartCallButton'
import VoiceNoteRecorderButton from './voiceNotes/VoiceNoteRecorderButton'
import VoiceNotePlayer from './voiceNotes/VoiceNotePlayer'
import { uploadVoiceNote } from './voiceNotes/voiceNoteStorage'
import type { VoiceRecorderResult } from './voiceNotes/useVoiceRecorder'
import ReportModal from '../safety/ReportModal'
import { containsProfanity, PROFANITY_BLOCKED_MESSAGE } from '../../shared/lib/profanityFilter'
import { isProActive } from '../../shared/lib/proPlans'
import HiddenContentNotice from '../moderation/HiddenContentNotice'
import { useModRole } from '../moderation/useModRole'
import { RANK_GROUPS, type RankGroupId } from '../profile/ranks'
import PollMessage from './PollMessage'
import PollComposerModal from './PollComposerModal'
import StarredMessagesPanel from './StarredMessagesPanel'
import { starMessage, unstarMessage, fetchMyStarredMessageIds } from './starredMessages'

// ─── Types ──────────────────────────────────────────────────
interface RoomMember {
  user_id: string
  profile: { username: string; display_name: string | null; avatar: string }
}
interface ChatRoom {
  id: string
  type: string
  name: string | null
  members: RoomMember[]
  lastMsg: string
  lastMsgTime: string
  lastMsgAt: string | null // raw ISO timestamp, used for recency sort (lastMsgTime is pre-formatted for display only)
  unread: number
  pinned: boolean
  clearedAt: string | null // messages at/before this timestamp are hidden for me (soft clear)
  pinnedMessageId: string | null // room-wide pinned message, visible to all members
  spotlightMessageId: string | null // temporary pin (Staff/Mod/Admin, Global Chat only) — see migration 0040
  spotlightExpiresAt: string | null
  slowMode: boolean // Global Chat only
  slowModeSeconds: number
}
interface Message {
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
  reactions: { emoji: string; user_id: string }[]
  senderName?: string
  senderUsername?: string
  /** 'text' (default) | 'voice_note' | 'call_log' | 'rank_tag' | 'poll' — see migrations 0009, 0038, 0039. */
  type: MessageType
  audio_path: string | null
  audio_duration_seconds: number | null
  call_id: string | null
  /** Set only when type === 'rank_tag' — one of the 8 RANK_GROUP_IDS. */
  rank_tag_group: string | null
  /** Set only when type === 'poll'. */
  poll_id: string | null
}
type MessageType = 'text' | 'voice_note' | 'call_log' | 'rank_tag' | 'poll'
interface SearchedProfile {
  id: string
  username: string
  display_name: string | null
  avatar: string
}

/** Read-receipt state for one of MY OWN messages: 'sent' = persisted but not yet
 *  confirmed read by the other DM member, 'read' = their last_read_at has passed
 *  this message's created_at. Only computed for DMs — global chat has too many
 *  members for a single "read" state to mean anything. */
type ReadReceipt = 'sent' | 'read' | null

/** Result of checking the `blocks` table for the two members of an open DM. */
type DmBlockState = 'none' | 'blockedByMe' | 'blockedMe'

/** Pre-processed render-ready message with consecutive-group metadata. */
interface GroupedMessage extends Message {
  isGroupFirst: boolean
  isGroupLast: boolean
}

const GROUP_GAP_MS = 5 * 60 * 1000 // 5 min — new burst starts after this gap
const MESSAGE_PAGE_SIZE = 30 // most-recent-page size for initial load + each "load older" fetch
const MAX_MESSAGE_LENGTH = 2000 // must match the `messages.content` check constraint in the DB
const TYPING_IDLE_MS = 3000 // stop broadcasting "typing" after this long without a keystroke
const NEAR_BOTTOM_PX = 150 // how close to the bottom counts as "already reading the latest"
const MARK_READ_THROTTLE_MS = 2000 // minimum gap between last_read_at writes

/** Splits a flat message list into consecutive-sender "bursts" for compact rendering. */
function groupMessages(messages: Message[]): GroupedMessage[] {
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

const EMOJIS = ['😂','🔥','💀','👑','😍','🎮','💯','🙌','😅','🤯','❤️','👀','🫡','💪','🏆']

function IBtn({ onClick, children, style, title }: {
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void
  children: React.ReactNode
  style?: React.CSSProperties
  title?: string
}) {
  return (
    <button type="button" onClick={onClick} title={title}
      style={{ width:36, height:36, borderRadius:10, flexShrink:0, background:'var(--surface)', border:'1px solid rgba(255,255,255,0.06)', color:'var(--text-dim)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', transition:'color 0.15s', ...style }}
      onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)' }}
      onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-dim)' }}>
      {children}
    </button>
  )
}

function Avatar({ name, avatarUrl, size = 40, radius = 13 }: { name: string; avatarUrl?: string | null; size?: number; radius?: number }) {
  const colors = ['#ff6b6b','#4f8ef7','#9b6dff','#3ecf8e','#f5c542','#ff4d8b','#ff9a3c','#00e5ff']
  const color = colors[(name.charCodeAt(0) || 0) % colors.length]
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        style={{ width:size, height:size, borderRadius:radius, objectFit:'cover', flexShrink:0, display:'block' }}
        onError={e => {
          // fall back to initials if image fails to load
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

/** Small green presence dot, absolutely positioned over the bottom-right corner
 *  of whatever avatar it's rendered alongside. Caller wraps both in a `position:
 *  relative` container. */
function OnlineDot({ size = 10 }: { size?: number }) {
  return (
    <span style={{
      position:'absolute', right:-1, bottom:-1, width:size, height:size, borderRadius:'50%',
      background:'#3ecf8e', border:'2px solid var(--surface)', boxShadow:'0 0 0 1px rgba(0,0,0,0.15)',
    }} />
  )
}

function SkeletonBubbles() {
  const widths = [62, 38, 71, 48]
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:12, padding:'4px 0' }}>
      {widths.map((w, i) => (
        <div key={i} style={{ display:'flex', flexDirection: i % 2 ? 'row-reverse' : 'row', gap:8 }}>
          <div style={{ width:30, height:30, borderRadius:10, background:'var(--surface2)', flexShrink:0, animation:'skeletonPulse 1.4s ease-in-out infinite' }} />
          <div style={{ width:`${w}%`, maxWidth:260, height:44, borderRadius:16, background:'var(--surface2)', animation:'skeletonPulse 1.4s ease-in-out infinite' }} />
        </div>
      ))}
    </div>
  )
}

function SkeletonRoomList() {
  return (
    <div style={{ display:'flex', flexDirection:'column' }}>
      {[0, 1, 2, 3, 4].map(i => (
        <div key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 16px' }}>
          <div style={{ width:44, height:44, borderRadius:13, flexShrink:0, background:'var(--surface2)', animation:'skeletonPulse 1.4s ease-in-out infinite' }} />
          <div style={{ flex:1, minWidth:0, display:'flex', flexDirection:'column', gap:6 }}>
            <div style={{ width: i % 2 ? '55%' : '40%', height:13, borderRadius:4, background:'var(--surface2)', animation:'skeletonPulse 1.4s ease-in-out infinite' }} />
            <div style={{ width: i % 2 ? '75%' : '60%', height:11, borderRadius:4, background:'var(--surface2)', animation:'skeletonPulse 1.4s ease-in-out infinite' }} />
          </div>
        </div>
      ))}
    </div>
  )
}

interface MessageLineProps {
  msg: GroupedMessage
  isMine: boolean
  emojiForMsg: string | null
  onContextMenu: (msg: Message, x: number, y: number) => void
  onDoubleClick: (msg: Message) => void
  onToggleEmojiPicker: (msgId: string) => void
  onAddReaction: (msgId: string, emoji: string) => void
  myId: string | null
  formatTime: (iso: string) => string
  readReceipt: ReadReceipt
  /** Whether the viewer has starred this message — DMs only, shows a small badge. */
  isStarred: boolean
  /** Whether this line's underline hooks in toward the avatar (only the burst's
   *  first/only avatar-aligned edge needs the hook — every line still gets its
   *  own underline, sized to itself, never to a sibling's width). */
  isGroupChat: boolean
}

/** One message, rendered as flat text sitting on its own underline — sized to
 *  that message's own content, never to a sibling's. Consecutive messages from
 *  the same sender stack by simply rendering several of these one after another;
 *  each one keeps (and is pushed down by) its own line instead of one shared
 *  line stretching to fit whatever's widest in the stack. */
const MessageLine = memo(function MessageLine({
  msg, isMine, emojiForMsg, onContextMenu, onDoubleClick, onToggleEmojiPicker, onAddReaction, myId, formatTime, readReceipt, isStarred, isGroupChat,
}: MessageLineProps) {
  const lineColor = 'rgba(255,255,255,0.28)'
  return (
    <div
      className="msg-bubble-col"
      onContextMenu={e => { if (!msg.deleted) { e.preventDefault(); onContextMenu(msg, e.clientX, e.clientY) } }}
      onDoubleClick={() => onDoubleClick(msg)}
      style={{
        position:'relative', cursor:'context-menu', userSelect:'none',
        // `width: fit-content` (rather than plain `inline-block`, which falls
        // back to filling all available space once the text needs to wrap)
        // is what keeps this box — and therefore its border — sized to
        // whatever the longest actual rendered line is, instead of
        // stretching out to the full bubble column width for any message
        // that happens to wrap onto more than one line.
        display:'inline-block', width:'fit-content', maxWidth:'100%',
        marginBottom:8,
        paddingBottom: msg.reactions.length > 0 ? 16 : 6,
        borderBottom:`1.5px solid ${lineColor}`,
        borderBottomLeftRadius: !isMine ? 9 : 0,
        borderBottomRightRadius: isMine ? 9 : 0,
        paddingLeft: !isMine ? 8 : 0,
        paddingRight: isMine ? 8 : 0,
        marginLeft: isGroupChat && !isMine ? -8 : 0,
        marginRight: isGroupChat && isMine ? -8 : 0,
      }}>

      {/* Short accent "hook" that joins the underline into the corner — fixed
          height so it stays a small hook next to the last line regardless of
          how many lines the message wraps onto, instead of a full-height
          border that used to run all the way up to the first line. */}
      <div style={{
        position:'absolute', bottom:0, height:20, width:0,
        pointerEvents:'none',
        left: !isMine ? 0 : undefined,
        right: isMine ? 0 : undefined,
        borderLeft: !isMine ? `1.5px solid ${lineColor}` : undefined,
        borderRight: isMine ? `1.5px solid ${lineColor}` : undefined,
      }} />

      {/* Reply header — target user's name + their quoted text, stacked directly above
          this line. This is the ONLY place a name appears on a received message; own

          messages never show a name at all. */}
      {msg.replyPreview && !msg.deleted && (
        <div style={{ marginBottom:3, display:'flex', flexDirection:'column', alignItems: isMine ? 'flex-end' : 'flex-start' }}>
          <span style={{ fontSize:10.5, fontWeight:700, color:'#4f8ef7' }}>{msg.replyPreviewName || 'Unknown'}</span>
          <span style={{ fontSize:11, color:'var(--text-dim)', maxWidth:200, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            {msg.replyPreview.length > 60 ? `${msg.replyPreview.slice(0, 60)}…` : msg.replyPreview}
          </span>
        </div>
      )}

      {/* Message content, with the timestamp/ticks flowing inline right after the
          text — plain inline flow (no flex-shrink) so short text like "hey" can
          never get squeezed into a one-letter-per-line collapse. Text wraps at
          word boundaries the normal way only once it's actually too long. */}
      <span style={{ fontSize:13.5, lineHeight:1.45, color:'var(--text)', fontStyle: msg.deleted ? 'italic' : 'normal', opacity: msg.deleted ? 0.6 : 1, wordBreak:'break-word' }}>
        {msg.hidden ? (
          <HiddenContentNotice reason={msg.hidden_reason} isOwner={isMine} inline />
        ) : msg.deleted ? 'Message deleted' : msg.type === 'voice_note' ? (
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
        <span style={{ display:'inline-flex', alignItems:'center', gap:3, whiteSpace:'nowrap' }}>
          {isStarred && <Star size={10} fill="#ffc107" style={{ color:'#ffc107' }} />}
          <span style={{ fontSize:10, color:'var(--text-muted)' }}>{formatTime(msg.created_at)}</span>
          {isMine && !msg.deleted && readReceipt === 'read' && <CheckCheck size={12} style={{ color:'var(--accent)' }} />}
          {isMine && !msg.deleted && readReceipt === 'sent' && <Check size={12} style={{ color:'var(--text-muted)' }} />}
        </span>
      </span>

      {/* Reaction badge — sits flush below this line */}
      {msg.reactions.length > 0 && (
        <div style={{
          position:'absolute', bottom:0, zIndex:2,
          display:'flex', gap:4, flexWrap:'nowrap',
          ...(isMine ? { right:0 } : { left:0 }),
        }}>
          {Object.entries(
            msg.reactions.reduce<Record<string, { count: number; mine: boolean }>>((acc, r) => {
              if (!acc[r.emoji]) acc[r.emoji] = { count:0, mine:false }
              acc[r.emoji].count++
              if (r.user_id === myId) acc[r.emoji].mine = true
              return acc
            }, {})
          ).map(([emoji, { count, mine }]) => (
            <button key={emoji} type="button" onClick={() => onAddReaction(msg.id, emoji)}
              style={{ display:'flex', alignItems:'center', gap:3, padding:'2px 6px', borderRadius:20, fontSize:12, cursor:'pointer', background: mine ? 'rgba(255,107,0,0.15)' : 'var(--surface2)', border:'2px solid var(--bg)', boxShadow:'0 2px 6px rgba(0,0,0,0.3)' }}>
              {emoji} {count > 1 && <span style={{ fontSize:11, color:'var(--text-dim)' }}>{count}</span>}
            </button>
          ))}
        </div>
      )}

      {/* Hover-revealed reaction trigger */}
      {!msg.deleted && (
        <button
          type="button"
          onClick={() => onToggleEmojiPicker(msg.id)}
          className="msg-react-trigger"
          style={{
            position:'absolute', top:0, transform:'none',
            ...(isMine ? { right:'100%', marginRight:6 } : { left:'100%', marginLeft:6 }),
            background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', padding:2, opacity:0, transition:'opacity 0.15s',
          }}>
          <Smile size={12} />
        </button>
      )}

      {emojiForMsg === msg.id && (
        <div style={{ display:'flex', gap:4, flexWrap:'wrap', padding:8, background:'var(--surface2)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:14, boxShadow:'0 12px 40px rgba(0,0,0,0.5)', marginTop:4, maxWidth:220, zIndex:3, position:'relative' }}>
          {EMOJIS.map(em => (
            <button key={em} type="button" onClick={() => onAddReaction(msg.id, em)} style={{ background:'none', border:'none', cursor:'pointer', fontSize:18, padding:2 }}>{em}</button>
          ))}
        </div>
      )}
    </div>
  )
})

/** Distinct full-width "official" card for a Staff/Moderator/Admin rank tag —
 *  deliberately not styled like MessageLine's underline chat bubbles, so it
 *  reads as an announcement rather than a regular message. Global Chat only. */
const RankTagAnnouncement = memo(function RankTagAnnouncement({
  msg, senderLabel, formatTime, myId,
}: {
  msg: Message
  senderLabel: string
  formatTime: (iso: string) => string
  myId: string | null
}) {
  const group = RANK_GROUPS.find(g => g.id === msg.rank_tag_group)
  const color = group?.color ?? '#f5c542'
  return (
    <div style={{ margin: '10px 0', padding: '10px 14px', borderRadius: 14, background: `${color}14`, border: `1px solid ${color}55` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <Megaphone size={13} style={{ color, flexShrink: 0 }} />
        <span style={{ fontSize: 11, fontWeight: 800, color, textTransform: 'uppercase', letterSpacing: 0.3 }}>
          @{group?.label ?? 'Rank'} tagged — by {senderLabel}
        </span>
        <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 'auto', flexShrink: 0 }}>{formatTime(msg.created_at)}</span>
      </div>
      <div style={{ fontSize: 13.5, lineHeight: 1.45, color: 'var(--text)', fontStyle: msg.deleted ? 'italic' : 'normal', opacity: msg.deleted ? 0.6 : 1 }}>
        {msg.hidden ? (
          <HiddenContentNotice reason={msg.hidden_reason} isOwner={msg.sender_id === myId} />
        ) : msg.deleted ? 'Message deleted' : msg.content}
      </div>
    </div>
  )
})

interface MessageBurstProps {
  burst: GroupedMessage[]
  isMine: boolean
  senderLabel: string
  avatarUrl: string | null
  myProfile: { username: string; display_name: string | null; avatar: string | null } | null
  emojiForMsg: string | null
  onOpenProfile: (msg: Message) => void
  onContextMenu: (msg: Message, x: number, y: number) => void
  onDoubleClick: (msg: Message) => void
  onToggleEmojiPicker: (msgId: string) => void
  onAddReaction: (msgId: string, emoji: string) => void
  myId: string | null
  formatTime: (iso: string) => string
  readReceiptFor: (msg: Message) => ReadReceipt
  /** Message ids the viewer has starred — used to show the badge (DMs only). */
  starredIds: Set<string>
  /** Avatars only make sense where more than two people share the thread (Global
   *  Chat) — a DM never shows one, since which side of the screen a message sits
   *  on already identifies the sender. */
  isGroupChat: boolean
}

/** A consecutive run of messages from one sender. The avatar (Global Chat only)
 *  appears once per burst, aligned to the bottom line. Each message underneath
 *  keeps rendering its own independent chat-line — replying, or just sending
 *  another message, always starts a new line of its own width, simply pushed
 *  further down the stack rather than widening anything above it. */
const MessageBurst = memo(function MessageBurst({
  burst, isMine, senderLabel, avatarUrl, myProfile, emojiForMsg,
  onOpenProfile, onContextMenu, onDoubleClick, onToggleEmojiPicker, onAddReaction, myId, formatTime, readReceiptFor, starredIds, isGroupChat,
}: MessageBurstProps) {
  const first = burst[0]

  return (
    <div style={{ display:'flex', flexDirection: isMine ? 'row-reverse' : 'row', alignItems:'flex-end', gap:8, marginBottom:6 }}>
      {isGroupChat && (
        <button
          type="button"
          onClick={() => onOpenProfile(first)}
          style={{ background:'none', border:'none', padding:0, cursor:'pointer', flexShrink:0, marginBottom:8 }}
          title={senderLabel}>
          <Avatar name={isMine ? (myProfile?.display_name || myProfile?.username || 'Me') : senderLabel} avatarUrl={avatarUrl} size={30} radius={10} />
        </button>
      )}

      <div style={{ display:'flex', flexDirection:'column', alignItems: isMine ? 'flex-end' : 'flex-start', maxWidth:'78%' }}>
        {/* Sender name — Global Chat only, and only for other players' messages;
            your own messages never get one, since you already know who sent them. */}
        {isGroupChat && !isMine && (
          <span style={{ fontSize:11.5, fontWeight:700, color:'#4f8ef7', marginBottom:3, marginLeft:2 }}>
            {senderLabel}
          </span>
        )}
        {burst.map(msg => (
          <MessageLine
            key={msg.id}
            msg={msg}
            isMine={isMine}
            emojiForMsg={emojiForMsg}
            onContextMenu={onContextMenu}
            onDoubleClick={onDoubleClick}
            onToggleEmojiPicker={onToggleEmojiPicker}
            onAddReaction={onAddReaction}
            myId={myId}
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


interface PlayerProfileModalProps {
  profile: SearchedProfile | { id: string; username: string; display_name: string | null; avatar: string }
  myId: string | null
  onClose: () => void
  onStartChat?: (userId: string) => Promise<boolean>
  onBlockChange?: (userId: string, blocked: boolean) => void
}

function PlayerProfileModal({ profile, myId, onClose, onStartChat, onBlockChange }: PlayerProfileModalProps) {
  const navigate = useNavigate()
  const [followStatus, setFollowStatus] = useState<'none' | 'following' | 'blocked'>('none')
  const [actionLoading, setActionLoading] = useState(false)
  const [messaging, setMessaging] = useState(false)
  const [messageError, setMessageError] = useState('')

  useEffect(() => {
    if (!myId || profile.id === myId) return
    const check = async () => {
      const { data: follows } = await supabase.from('follows')
        .select('id').eq('follower_id', myId).eq('following_id', profile.id).maybeSingle()
      if (follows) { setFollowStatus('following'); return }
      const { data: blocks } = await supabase.from('blocks')
        .select('id').eq('blocker_id', myId).eq('blocked_id', profile.id).maybeSingle()
      if (blocks) setFollowStatus('blocked')
    }
    check()
  }, [myId, profile.id])

  async function handleFollow() {
    if (!myId || actionLoading) return
    setActionLoading(true)
    if (followStatus === 'following') {
      await supabase.from('follows').delete().eq('follower_id', myId).eq('following_id', profile.id)
      setFollowStatus('none')
    } else {
      await supabase.from('follows').insert({ follower_id: myId, following_id: profile.id })
      setFollowStatus('following')
    }
    setActionLoading(false)
  }

  async function handleBlock() {
    if (!myId || actionLoading) return
    setActionLoading(true)
    if (followStatus === 'blocked') {
      await supabase.from('blocks').delete().eq('blocker_id', myId).eq('blocked_id', profile.id)
      setFollowStatus('none')
      onBlockChange?.(profile.id, false)
    } else {
      // also unfollow if was following
      await supabase.from('follows').delete().eq('follower_id', myId).eq('following_id', profile.id)
      await supabase.from('blocks').insert({ blocker_id: myId, blocked_id: profile.id })
      setFollowStatus('blocked')
      onBlockChange?.(profile.id, true)
    }
    setActionLoading(false)
  }

  async function handleMessage() {
    if (!onStartChat || messaging) return
    setMessaging(true)
    setMessageError('')
    const ok = await onStartChat(profile.id)
    setMessaging(false)
    if (ok) onClose()
    else setMessageError("Couldn't open this conversation. Please try again.")
  }

  const isOwnProfile = profile.id === myId
  const displayLabel = profile.display_name || profile.username

  return (
    <>
      <div style={{ position:'fixed', inset:0, zIndex:200, background:'rgba(0,0,0,0.6)', backdropFilter:'blur(4px)' }} onClick={onClose} />
      <div style={{ position:'fixed', top:'50%', left:'50%', transform:'translate(-50%,-50%)', zIndex:201, background:'var(--surface2)', border:'1px solid rgba(255,255,255,0.09)', borderRadius:22, padding:24, width: Math.min(300, window.innerWidth - 32), boxShadow:'0 20px 60px rgba(0,0,0,0.7)' }}>
        <button type="button" onClick={onClose} style={{ position:'absolute', top:14, right:14, background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)' }}>
          <X size={16} />
        </button>
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:12, marginBottom:20 }}>
          <Avatar name={displayLabel} avatarUrl={profile.avatar || null} size={64} radius={18} />
          <div style={{ textAlign:'center' }}>
            <div style={{ fontSize:16, fontWeight:700, color:'var(--text)' }}>{displayLabel}</div>
            <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:3 }}>@{profile.username}</div>
          </div>
        </div>
        {!isOwnProfile && (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            <button type="button" onClick={handleFollow} disabled={actionLoading || followStatus === 'blocked'}
              style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, padding:'10px 16px', borderRadius:12, border:'none', cursor: actionLoading || followStatus === 'blocked' ? 'not-allowed' : 'pointer', background: followStatus === 'following' ? 'rgba(62,207,142,0.15)' : 'linear-gradient(135deg,var(--accent),var(--accent2))', color: followStatus === 'following' ? '#3ecf8e' : '#fff', fontSize:13, fontWeight:600, opacity: followStatus === 'blocked' ? 0.4 : 1, transition:'all 0.15s' }}>
              {followStatus === 'following' ? <><UserCheck size={14} /> Following</> : <><UserPlus size={14} /> Follow</>}
            </button>
            {onStartChat && (
              <button type="button" onClick={handleMessage} disabled={messaging}
                style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, padding:'10px 16px', borderRadius:12, border:'1px solid rgba(255,255,255,0.1)', background:'transparent', color:'var(--text-dim)', fontSize:13, fontWeight:600, cursor: messaging ? 'not-allowed' : 'pointer', opacity: messaging ? 0.6 : 1, transition:'all 0.15s' }}>
                <MessageCircle size={14} /> {messaging ? 'Opening…' : 'Message'}
              </button>
            )}
            {messageError && (
              <p style={{ fontSize:11.5, color:'#ff6b6b', textAlign:'center', margin:0 }}>{messageError}</p>
            )}
            <button type="button" onClick={() => { onClose(); navigate(`/profile/${profile.id}`) }}
              style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, padding:'10px 16px', borderRadius:12, border:'1px solid rgba(79,142,247,0.3)', background:'rgba(79,142,247,0.08)', color:'#4f8ef7', fontSize:13, fontWeight:600, cursor:'pointer', transition:'all 0.15s' }}>
              <ExternalLink size={14} /> View Full Profile
            </button>
            <button type="button" onClick={handleBlock} disabled={actionLoading}
              style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, padding:'10px 16px', borderRadius:12, border:'none', cursor: actionLoading ? 'not-allowed' : 'pointer', background: followStatus === 'blocked' ? 'rgba(255,107,107,0.15)' : 'rgba(255,107,107,0.08)', color: followStatus === 'blocked' ? '#ff6b6b' : 'var(--text-muted)', fontSize:13, fontWeight:600, transition:'all 0.15s' }}>
              <ShieldOff size={14} /> {followStatus === 'blocked' ? 'Unblock' : 'Block'}
            </button>
          </div>
        )}
        {isOwnProfile && (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            <button type="button" onClick={() => { onClose(); navigate('/profile') }}
              style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, padding:'10px 16px', borderRadius:12, border:'1px solid rgba(79,142,247,0.3)', background:'rgba(79,142,247,0.08)', color:'#4f8ef7', fontSize:13, fontWeight:600, cursor:'pointer', transition:'all 0.15s' }}>
              <ExternalLink size={14} /> View My Profile
            </button>
          </div>
        )}
      </div>
    </>
  )
}

export default function Chat() {
  const { session } = useAuth()
  const myId = session?.user?.id ?? null
  const { isStaff, canCreatePoll } = useModRole()
  const navigate = useNavigate()
  const location = useLocation()

  const [rooms, setRooms] = useState<ChatRoom[]>([])
  const [roomsLoading, setRoomsLoading] = useState(true)
  const [activeRoom, setActiveRoom] = useState<ChatRoom | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [msgsLoading, setMsgsLoading] = useState(false)
  const [hasMoreOlder, setHasMoreOlder] = useState(false)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const roomMembersRef = useRef<RoomMember[]>([])
  const creatingDmWithRef = useRef<Set<string>>(new Set()) // guards startDmWith against double-taps/slow-network races
  const [startingDmId, setStartingDmId] = useState<string | null>(null)
  const [dmStartError, setDmStartError] = useState<string | null>(null)
  useEffect(() => {
    if (!dmStartError) return
    const t = setTimeout(() => setDmStartError(null), 5000)
    return () => clearTimeout(t)
  }, [dmStartError])

  // Own profile (avatar, display_name, pro status) — loaded once on mount
  const [myProfile, setMyProfile] = useState<{ username: string; display_name: string | null; avatar: string | null; is_pro: boolean | null; pro_expires_at: string | null } | null>(null)

  useEffect(() => {
    if (!myId) return
    let cancelled = false
    supabase.from('profiles').select('username, display_name, avatar, is_pro, pro_expires_at').eq('id', myId).single()
      .then(({ data }) => { if (!cancelled && data) setMyProfile(data) })
    return () => { cancelled = true }
  }, [myId])
  const myIsPro = isProActive(myProfile)

  // Users I've blocked — used to hide their content everywhere in this view (most
  // importantly Global Chat, where the server can't reject their messages the way
  // it does for DMs, since they're still a legitimate member of that shared room).
  const [myBlockedIds, setMyBlockedIds] = useState<Set<string>>(new Set())
  useEffect(() => {
    if (!myId) return
    let cancelled = false
    supabase.from('blocks').select('blocked_id').eq('blocker_id', myId)
      .then(({ data }) => { if (!cancelled && data) setMyBlockedIds(new Set(data.map(b => b.blocked_id))) })
    return () => { cancelled = true }
  }, [myId])
  const handleBlockChange = useCallback((userId: string, blocked: boolean) => {
    setMyBlockedIds(prev => {
      const next = new Set(prev)
      if (blocked) next.add(userId); else next.delete(userId)
      return next
    })
  }, [])

  const [showConv, setShowConv] = useState(false)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [isRecordingVoiceNote, setIsRecordingVoiceNote] = useState(false)
  const [micError, setMicError] = useState<string | null>(null)
  useEffect(() => {
    if (!micError) return
    const t = setTimeout(() => setMicError(null), 4000)
    return () => clearTimeout(t)
  }, [micError])
  const [composerError, setComposerError] = useState<string | null>(null)
  useEffect(() => {
    if (!composerError) return
    const t = setTimeout(() => setComposerError(null), 4000)
    return () => clearTimeout(t)
  }, [composerError])
  const [reportTarget, setReportTarget] = useState<{ id: string; senderName: string } | null>(null)

  // Search state — split: room search vs player search
  const [roomSearch, setRoomSearch] = useState('')
  const [playerSearch, setPlayerSearch] = useState('')
  const [playerResults, setPlayerResults] = useState<SearchedProfile[]>([])
  const [playerSearching, setPlayerSearching] = useState(false)

  const [emojiOpen, setEmojiOpen] = useState(false)
  // Composer action drawer — collapses emoji/rank-tag/poll icons behind a single
  // paperclip button, same retractable pattern as the conversation header drawer.
  const [composerDrawerOpen, setComposerDrawerOpen] = useState(false)
  const [ctxMsg, setCtxMsg] = useState<Message | null>(null)
  const [ctxPos, setCtxPos] = useState({ x: 0, y: 0 })
  const [emojiForMsg, setEmojiForMsg] = useState<string | null>(null)
  const [replyTo, setReplyTo] = useState<Message | null>(null)
  // Ghost Read (DMs only) — per-visit toggle, resets each time a room is opened
  // (see openRoom below). While active, markRoomAsRead is a no-op so the other
  // person's read receipt never flips for this visit.
  const [ghostReadActive, setGhostReadActive] = useState(false)
  // Rank Tag (Staff/Moderator/Admin, Global Chat only) — a pending tag attaches
  // to the next message sent, same pattern as replyTo above.
  const [rankTagPickerOpen, setRankTagPickerOpen] = useState(false)
  const [pendingRankTag, setPendingRankTag] = useState<RankGroupId | null>(null)
  // Polls (Staff/Moderator/Admin + Verified, Global Chat only)
  const [pollModalOpen, setPollModalOpen] = useState(false)
  const [pollRefreshToken, setPollRefreshToken] = useState(0)
  // Starred messages — private per-user bookmarks (see migration 0041)
  const [starredPanelOpen, setStarredPanelOpen] = useState(false)
  const [myStarredIds, setMyStarredIds] = useState<Set<string>>(new Set())

  // Player profile modal
  const [viewProfile, setViewProfile] = useState<SearchedProfile | null>(null)
  // DM header options (tap avatar/name in DM to delete chat)
  const [dmOptionsOpen, setDmOptionsOpen] = useState(false)
  // Conversation-level 3-dot menu (top-right inside an open chat: clear chat, pin/unpin, block)
  const [convMenuOpen, setConvMenuOpen] = useState(false)
  // Pinned message banner content — fetched separately since ChatRoom only stores the id
  const [pinnedMsgPreview, setPinnedMsgPreview] = useState<{ id: string; content: string; senderName: string } | null>(null)
  const [spotlightMsgPreview, setSpotlightMsgPreview] = useState<{ id: string; content: string; senderName: string } | null>(null)
  // Slow Mode — client-side cooldown UX only; real enforcement is the RLS
  // policy in migration 0040. Staff/Moderator/Admin are exempt (see there).
  const [slowModeCooldownUntil, setSlowModeCooldownUntil] = useState<number | null>(null)
  const [nowTick, setNowTick] = useState(Date.now())
  useEffect(() => {
    if (!slowModeCooldownUntil) return
    const id = setInterval(() => setNowTick(Date.now()), 500)
    return () => clearInterval(id)
  }, [slowModeCooldownUntil])
  useEffect(() => {
    if (slowModeCooldownUntil && nowTick >= slowModeCooldownUntil) setSlowModeCooldownUntil(null)
  }, [nowTick, slowModeCooldownUntil])
  const [slowModePickerOpen, setSlowModePickerOpen] = useState(false)
  // Spotlight — which message's context menu currently has its duration submenu open.
  const [spotlightPickerFor, setSpotlightPickerFor] = useState<Message | null>(null)
  const [spotlightCustomMinutes, setSpotlightCustomMinutes] = useState('')
  const slowModeCooldownRemaining = slowModeCooldownUntil ? Math.max(0, Math.ceil((slowModeCooldownUntil - nowTick) / 1000)) : 0
  const isSlowModeCooling = activeRoom?.type === 'global' && !!activeRoom.slowMode && !isStaff && slowModeCooldownRemaining > 0
  // Per-room row menu in the room list (pin/delete), keyed by room id, null = closed
  const [roomMenuOpenFor, setRoomMenuOpenFor] = useState<string | null>(null)
  const [roomMenuPos, setRoomMenuPos] = useState({ x: 0, y: 0 })
  const [convMenuPos, setConvMenuPos] = useState({ x: 0, y: 0 })
  // Retractable action drawer in the conversation header — collapsed by default,
  // slides open horizontally to reveal call/search/menu icons, slides back in on toggle.
  const [headerDrawerOpen, setHeaderDrawerOpen] = useState(false)
  // In-conversation message search, opened from the header drawer's search icon.
  const [msgSearchOpen, setMsgSearchOpen] = useState(false)
  const [msgSearchQuery, setMsgSearchQuery] = useState('')

  const msgEnd = useRef<HTMLDivElement>(null)
  const subRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const playerSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Read receipts (DM only) — the other member's last_read_at, kept live via
  //    the room's realtime channel so ticks flip from sent → read without a reload.
  const [otherLastReadAt, setOtherLastReadAt] = useState<string | null>(null)
  const lastMarkReadAtRef = useRef(0)

  // ── Block enforcement for the currently open DM ──────────────
  const [dmBlockState, setDmBlockState] = useState<DmBlockState>('none')

  // ── Presence: who's online app-wide, who's typing in THIS room ──
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set())
  const [typingUserIds, setTypingUserIds] = useState<Set<string>>(new Set())
  const presenceChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Scroll behavior: 'bottom' snaps to the newest message, 'preserve' keeps
  //    the reading position stable after older history is prepended above it.
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const scrollModeRef = useRef<'none' | 'bottom' | 'preserve'>('none')
  const preserveScrollInfoRef = useRef<{ scrollHeight: number; scrollTop: number } | null>(null)
  const isNearBottomRef = useRef(true)

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  // ── App-wide online presence — every signed-in user tracks themselves on a
  //    shared channel so DM headers and the room list can show a live green dot.
  //    Best-effort last_seen_at write on the way out covers the "offline" case.
  useEffect(() => {
    if (!myId) return
    const channel = supabase.channel('chat-online-presence', { config: { presence: { key: myId } } })
    channel
      .on('presence', { event: 'sync' }, () => {
        setOnlineUserIds(new Set(Object.keys(channel.presenceState())))
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') await channel.track({ online: true })
      })
    return () => {
      channel.untrack().finally(() => supabase.removeChannel(channel))
      supabase.from('profiles').update({ last_seen_at: new Date().toISOString() }).eq('id', myId)
    }
  }, [myId])

  // ── Per-room typing presence — separate channel scoped to the open conversation ──
  useEffect(() => {
    if (!activeRoom || !myId) { setTypingUserIds(new Set()); return }
    const channel = supabase.channel(`chat-typing:${activeRoom.id}`, { config: { presence: { key: myId } } })
    presenceChannelRef.current = channel
    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<{ typing: boolean }>()
        const typing = new Set<string>()
        for (const [userId, metas] of Object.entries(state)) {
          if (userId === myId) continue
          if (metas.some(m => m.typing)) typing.add(userId)
        }
        setTypingUserIds(typing)
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') await channel.track({ typing: false })
      })
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
      channel.untrack().finally(() => supabase.removeChannel(channel))
      if (presenceChannelRef.current === channel) presenceChannelRef.current = null
    }
  }, [activeRoom?.id, myId])

  function handleTextChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setText(e.target.value)
    const channel = presenceChannelRef.current
    if (!channel) return
    channel.track({ typing: true })
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
    typingTimeoutRef.current = setTimeout(() => { channel.track({ typing: false }) }, TYPING_IDLE_MS)
  }

  /** Persists my read position for the active room, throttled so scrolling
   *  doesn't fire a write on every frame. Other member's UI updates via realtime. */
  const markRoomAsRead = useCallback((roomId: string) => {
    if (!myId || ghostReadActive) return
    const now = Date.now()
    if (now - lastMarkReadAtRef.current < MARK_READ_THROTTLE_MS) return
    lastMarkReadAtRef.current = now
    supabase.from('room_members').update({ last_read_at: new Date().toISOString() })
      .eq('room_id', roomId).eq('user_id', myId)
      .then(({ error }) => { if (error) console.error('Failed to mark room as read:', error.message) })
  }, [myId, ghostReadActive])

  // ── Ensure global chat room exists & user is a member ──────
  async function ensureGlobalRoom(): Promise<string | null> {
    if (!myId) return null

    // Find existing global room
    const { data: globalRooms } = await supabase
      .from('chat_rooms')
      .select('id')
      .eq('type', 'global')
      .limit(1)

    let globalRoomId: string

    if (!globalRooms || globalRooms.length === 0) {
      // Try to create — do NOT use created_by (column may not exist in schema)
      const { data: created, error: createErr } = await supabase
        .from('chat_rooms')
        .insert({ type: 'global', name: 'Global Chat' })
        .select('id')
        .single()

      if (createErr || !created) {
        // Another request may have created it simultaneously — retry fetch
        const { data: retry } = await supabase
          .from('chat_rooms').select('id').eq('type', 'global').limit(1)
        if (!retry?.length) return null
        globalRoomId = retry[0].id
      } else {
        globalRoomId = created.id
      }
    } else {
      globalRoomId = globalRooms[0].id
    }

    // Ensure current user is a member (upsert-safe)
    const { data: existingMembership } = await supabase
      .from('room_members')
      .select('user_id')
      .eq('room_id', globalRoomId)
      .eq('user_id', myId)
      .maybeSingle()

    if (!existingMembership) {
      await supabase
        .from('room_members')
        .insert({ room_id: globalRoomId, user_id: myId })
    }

    return globalRoomId
  }

  // ── Load rooms ──────────────────────────────────────────────
  useEffect(() => { if (myId) loadRooms() }, [myId])
  useEffect(() => { if (myId) fetchMyStarredMessageIds(myId).then(setMyStarredIds) }, [myId])

  // Room-list-wide realtime: keeps "recent chats move to top" live even for rooms
  // that aren't currently open (the per-room subscription in openRoom only covers
  // the active conversation). Also auto-un-hides a room I'd deleted-for-me if the
  // other person sends something new into it.
  const activeRoomIdRef = useRef<string | null>(null)
  useEffect(() => { activeRoomIdRef.current = activeRoom?.id ?? null }, [activeRoom?.id])

  useEffect(() => {
    if (!myId) return
    const listChannel = supabase
      .channel(`room-list:${myId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, async (payload) => {
        const raw = payload.new as { room_id: string; content: string; created_at: string }

        setRooms(prev => {
          const idx = prev.findIndex(r => r.id === raw.room_id)
          if (idx === -1) return prev // not a room I'm currently showing — ignore (covers rooms I'm not a member of)
          const room = prev[idx]
          const updated: ChatRoom = { ...room, lastMsg: raw.content, lastMsgTime: formatTime(raw.created_at), lastMsgAt: raw.created_at }
          const rest = prev.filter((_, i) => i !== idx)

          // Global Chat always stays first; pinned rooms float above unpinned, each
          // group re-sorted by recency. Skip resort entirely for the room the user
          // currently has open, so the list doesn't jump under their thumb mid-read.
          if (updated.type === 'global' || updated.id === activeRoomIdRef.current) {
            const merged = [updated, ...rest]
            const globalRoom = merged.find(r => r.type === 'global')
            const others = merged.filter(r => r.type !== 'global')
            return globalRoom ? [globalRoom, ...others] : others
          }

          const globalRoom = rest.find(r => r.type === 'global')
          const others = rest.filter(r => r.type !== 'global')
          const withUpdated = [...others, updated]
          const pinned = withUpdated.filter(r => r.pinned).sort((a, b) => (new Date(b.lastMsgAt ?? 0).getTime()) - (new Date(a.lastMsgAt ?? 0).getTime()))
          const unpinned = withUpdated.filter(r => !r.pinned).sort((a, b) => (new Date(b.lastMsgAt ?? 0).getTime()) - (new Date(a.lastMsgAt ?? 0).getTime()))
          return globalRoom ? [globalRoom, ...pinned, ...unpinned] : [...pinned, ...unpinned]
        })

        // If this room was hidden-for-me ("delete chat"), a fresh incoming message
        // should bring it back into view rather than staying silently hidden.
        const { data: myMembership } = await supabase
          .from('room_members').select('hidden_at').eq('room_id', raw.room_id).eq('user_id', myId).maybeSingle()
        if (myMembership?.hidden_at) {
          await supabase.from('room_members').update({ hidden_at: null }).eq('room_id', raw.room_id).eq('user_id', myId)
          loadRooms() // room was excluded from `rooms` state entirely — needs a full reload to reappear
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(listChannel) }
  }, [myId])

  async function loadRooms() {
    setRoomsLoading(true)

    // Ensure user is always in the global room
    await ensureGlobalRoom()

    const { data: memberRows, error: memErr } = await supabase
      .from('room_members').select('room_id, pinned, cleared_at, hidden_at').eq('user_id', myId)

    if (memErr || !memberRows?.length) { setRoomsLoading(false); return }

    // Rooms I've hidden ("delete chat") are excluded from the list entirely — but if a
    // NEW message lands in one after I hid it, the realtime handler below un-hides it.
    const myRoomState = new Map(memberRows.map(r => [r.room_id, r]))
    const visibleRoomIds = memberRows.filter(r => !r.hidden_at).map(r => r.room_id)
    if (!visibleRoomIds.length) { setRooms([]); setRoomsLoading(false); return }

    const { data: roomRows } = await supabase
      .from('chat_rooms').select('id, type, name, pinned_message_id, spotlight_message_id, spotlight_expires_at, slow_mode, slow_mode_seconds').in('id', visibleRoomIds)

    if (!roomRows?.length) { setRooms([]); setRoomsLoading(false); return }

    const built: ChatRoom[] = await Promise.all(roomRows.map(async (room) => {
      const myState = myRoomState.get(room.id)
      const clearedAt = myState?.cleared_at ?? null

      const [{ data: memberData }, { data: lastMsgData }] = await Promise.all([
        supabase
          .from('room_members')
          .select('user_id, profiles(username, display_name, avatar)')
          .eq('room_id', room.id),
        // Respect the soft-clear cutoff: a cleared chat's "last message" preview
        // should reflect only what's still visible to me, not what I cleared.
        (clearedAt
          ? supabase.from('messages').select('content, created_at')
              .eq('room_id', room.id).eq('deleted', false).gt('created_at', clearedAt)
              .order('created_at', { ascending: false }).limit(1)
          : supabase.from('messages').select('content, created_at')
              .eq('room_id', room.id).eq('deleted', false)
              .order('created_at', { ascending: false }).limit(1)
        ),
      ])

      const members: RoomMember[] = (memberData ?? []).map((m: Record<string, unknown>) => ({
        user_id: m.user_id as string,
        profile: (m.profiles as { username: string; display_name: string | null; avatar: string }) ?? { username: '?', display_name: null, avatar: '?' },
      }))

      const lastMsg = lastMsgData?.[0]
      return {
        id: room.id, type: room.type, name: room.name, members,
        lastMsg: lastMsg?.content ?? '',
        lastMsgTime: lastMsg ? formatTime(lastMsg.created_at) : '',
        lastMsgAt: lastMsg?.created_at ?? null,
        unread: 0,
        pinned: myState?.pinned ?? false,
        clearedAt,
        pinnedMessageId: room.pinned_message_id ?? null,
        spotlightMessageId: room.spotlight_message_id ?? null,
        spotlightExpiresAt: room.spotlight_expires_at ?? null,
        slowMode: room.slow_mode ?? false,
        slowModeSeconds: room.slow_mode_seconds ?? 10,
      }
    }))

    // Sort: Global Chat always first, then pinned DMs, then the rest by most-recent message.
    const globalRoom = built.find(r => r.type === 'global')
    const dmRooms = built.filter(r => r.type !== 'global')
    const byRecency = (a: ChatRoom, b: ChatRoom) => {
      const at = a.lastMsgAt ? new Date(a.lastMsgAt).getTime() : 0
      const bt = b.lastMsgAt ? new Date(b.lastMsgAt).getTime() : 0
      return bt - at
    }
    const pinnedDms = dmRooms.filter(r => r.pinned).sort(byRecency)
    const unpinnedDms = dmRooms.filter(r => !r.pinned).sort(byRecency)
    const sorted = globalRoom ? [globalRoom, ...pinnedDms, ...unpinnedDms] : [...pinnedDms, ...unpinnedDms]

    // Deduplicate by room id (guards against race between startDmWith + loadRooms)
    const seen = new Set<string>()
    const deduped = sorted.filter(r => { if (seen.has(r.id)) return false; seen.add(r.id); return true })

    setRooms(deduped)
    setRoomsLoading(false)
  }

  // ── Player search (debounced) ────────────────────────────────
  useEffect(() => {
    if (playerSearchTimer.current) clearTimeout(playerSearchTimer.current)
    if (!playerSearch.trim()) { setPlayerResults([]); return }
    setPlayerSearching(true)
    playerSearchTimer.current = setTimeout(async () => {
      const q = playerSearch.trim().toLowerCase()
      const { data } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar')
        .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
        .limit(8)
      setPlayerResults(data ?? [])
      setPlayerSearching(false)
    }, 350)
    return () => { if (playerSearchTimer.current) clearTimeout(playerSearchTimer.current) }
  }, [playerSearch])

  // ── Open room ───────────────────────────────────────────────
  const openRoom = useCallback(async (room: ChatRoom) => {
    setActiveRoom(room)
    setShowConv(true)
    setMessages([]); setMsgsLoading(true)
    setReplyTo(null); setText('')
    setGhostReadActive(false)
    setPendingRankTag(null); setRankTagPickerOpen(false)
    setEmojiOpen(false)
    setHasMoreOlder(false)
    setOtherLastReadAt(null)
    setDmBlockState('none')
    setHeaderDrawerOpen(false)
    setComposerDrawerOpen(false)
    setMsgSearchOpen(false)
    setMsgSearchQuery('')
    isNearBottomRef.current = true

    // Most recent page only — newest-first query, then reversed for display.
    // If I've cleared this chat, only fetch messages after that cutoff.
    let query = supabase
      .from('messages')
      .select('id, sender_id, content, created_at, deleted, hidden, hidden_reason, reply_to_id, type, audio_path, audio_duration_seconds, call_id, rank_tag_group, poll_id')
      .eq('room_id', room.id)
    if (room.clearedAt) query = query.gt('created_at', room.clearedAt)
    const { data, error } = await query
      .order('created_at', { ascending: false })
      .limit(MESSAGE_PAGE_SIZE)

    if (error || !data) { setMsgsLoading(false); return }

    const page = [...data].reverse()
    setHasMoreOlder(data.length === MESSAGE_PAGE_SIZE)

    // Collect all unique sender IDs not in members to resolve names
    const unknownIds = [...new Set(page.map(m => m.sender_id).filter(Boolean)
      .filter(id => !room.members.find(mb => mb.user_id === id)))] as string[]

    let extraProfiles: RoomMember[] = []
    if (unknownIds.length > 0) {
      const { data: pData } = await supabase
        .from('profiles').select('id, username, display_name, avatar').in('id', unknownIds)
      extraProfiles = (pData ?? []).map(p => ({
        user_id: p.id,
        profile: { username: p.username, display_name: p.display_name, avatar: p.avatar },
      }))
    }
    const allMembers = [...room.members, ...extraProfiles]
    roomMembersRef.current = allMembers

    // For a DM: resolve block state (either direction) and the other member's
    // current read position, both needed for the composer guard + read ticks.
    const otherMember = room.type === 'dm' ? room.members.find(mb => mb.user_id !== myId) : undefined
    if (room.type === 'dm' && myId && otherMember) {
      const [{ data: iBlockedThem }, { data: theyBlockedMe }, { data: theirMembership }] = await Promise.all([
        supabase.from('blocks').select('blocked_id').eq('blocker_id', myId).eq('blocked_id', otherMember.user_id).maybeSingle(),
        supabase.from('blocks').select('blocker_id').eq('blocker_id', otherMember.user_id).eq('blocked_id', myId).maybeSingle(),
        supabase.from('room_members').select('last_read_at').eq('room_id', room.id).eq('user_id', otherMember.user_id).maybeSingle(),
      ])
      setDmBlockState(iBlockedThem ? 'blockedByMe' : theyBlockedMe ? 'blockedMe' : 'none')
      setOtherLastReadAt(theirMembership?.last_read_at ?? null)
    }

    // Batch-fetch reactions + reply previews for the whole page in 2 round-trips total,
    // instead of N sequential awaits inside a per-message loop.
    const msgIds = page.map(m => m.id)
    const replyIds = [...new Set(page.map(m => m.reply_to_id).filter(Boolean))] as string[]

    const [{ data: allReactions }, { data: allReplySources }] = await Promise.all([
      msgIds.length
        ? supabase.from('message_reactions').select('message_id, emoji, user_id').in('message_id', msgIds)
        : Promise.resolve({ data: [] as { message_id: string; emoji: string; user_id: string }[] }),
      replyIds.length
        ? supabase.from('messages').select('id, sender_id, content, deleted').in('id', replyIds)
        : Promise.resolve({ data: [] as { id: string; sender_id: string | null; content: string; deleted: boolean }[] }),
    ])

    const reactionsByMsg = new Map<string, { emoji: string; user_id: string }[]>()
    for (const r of allReactions ?? []) {
      const list = reactionsByMsg.get(r.message_id) ?? []
      list.push({ emoji: r.emoji, user_id: r.user_id })
      reactionsByMsg.set(r.message_id, list)
    }
    const replyContentById = new Map<string, string>()
    const replySenderById = new Map<string, string | null>()
    for (const r of allReplySources ?? []) {
      replyContentById.set(r.id, r.deleted ? 'Message deleted' : r.content)
      replySenderById.set(r.id, r.sender_id)
    }
    const nameForSender = (id: string | null | undefined) => {
      if (!id) return 'Unknown'
      const member = allMembers.find(mb => mb.user_id === id)
      return member ? (member.profile.display_name || member.profile.username) : 'Unknown'
    }

    const enriched: Message[] = page.map(m => {
      const senderMember = allMembers.find(mb => mb.user_id === m.sender_id)
      const senderName = senderMember ? (senderMember.profile.display_name || senderMember.profile.username) : 'Unknown'
      const senderUsername = senderMember ? senderMember.profile.username : undefined
      return {
        ...m,
        deleted: m.deleted ?? false,
        hidden: m.hidden ?? false,
        reactions: reactionsByMsg.get(m.id) ?? [],
        senderName,
        senderUsername,
        replyPreview: m.reply_to_id ? replyContentById.get(m.reply_to_id) : undefined,
        replyPreviewName: m.reply_to_id ? nameForSender(replySenderById.get(m.reply_to_id)) : undefined,
      }
    })

    scrollModeRef.current = 'bottom'
    setMessages(enriched)
    setMsgsLoading(false)
    markRoomAsRead(room.id)

    // Pinned message banner — fetch its content since ChatRoom only carries the id
    setPinnedMsgPreview(null)
    if (room.pinnedMessageId) {
      const { data: pinnedRow } = await supabase
        .from('messages').select('id, sender_id, content').eq('id', room.pinnedMessageId).maybeSingle()
      if (pinnedRow) {
        const pinnedSender = allMembers.find(mb => mb.user_id === pinnedRow.sender_id)
        setPinnedMsgPreview({
          id: pinnedRow.id,
          content: pinnedRow.content,
          senderName: pinnedSender ? (pinnedSender.profile.display_name || pinnedSender.profile.username) : 'Unknown',
        })
      }
    }

    // Spotlight banner — same idea as the pinned banner above, but temporary
    // (see spotlightExpiresAt) and Global Chat only.
    setSpotlightMsgPreview(null)
    if (room.spotlightMessageId && room.spotlightExpiresAt && new Date(room.spotlightExpiresAt) > new Date()) {
      const { data: spotlightRow } = await supabase
        .from('messages').select('id, sender_id, content').eq('id', room.spotlightMessageId).maybeSingle()
      if (spotlightRow) {
        const spotlightSender = allMembers.find(mb => mb.user_id === spotlightRow.sender_id)
        setSpotlightMsgPreview({
          id: spotlightRow.id,
          content: spotlightRow.content,
          senderName: spotlightSender ? (spotlightSender.profile.display_name || spotlightSender.profile.username) : 'Unknown',
        })
      }
    }

    // ── Real-time subscription — appends only the new row, never re-fetches the list.
    //    Also syncs message edits/deletes, live reactions, pin changes, and the other
    //    DM member's read position, all on one channel scoped to this room. ──
    if (subRef.current) supabase.removeChannel(subRef.current)
    subRef.current = supabase
      .channel(`room:${room.id}:${Date.now()}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `room_id=eq.${room.id}`
      }, async (payload) => {
        const raw = payload.new as { id: string; sender_id: string; content: string; created_at: string; deleted: boolean; hidden: boolean; hidden_reason: string | null; reply_to_id: string | null; type: 'text' | 'voice_note' | 'call_log' | 'rank_tag' | 'poll'; audio_path: string | null; audio_duration_seconds: number | null; call_id: string | null; rank_tag_group: string | null; poll_id: string | null }

        // Resolve sender name (may be a new global chat participant not in original members)
        let senderName = 'Unknown'
        let senderUsername: string | undefined
        const memberMatch = roomMembersRef.current.find(mb => mb.user_id === raw.sender_id)
        if (memberMatch) {
          senderName = memberMatch.profile.display_name || memberMatch.profile.username
          senderUsername = memberMatch.profile.username
        } else {
          const { data: pData } = await supabase.from('profiles').select('username, display_name').eq('id', raw.sender_id).single()
          if (pData) {
            senderName = pData.display_name || pData.username
            senderUsername = pData.username
          }
        }

        // Only auto-scroll if the reader was already at the bottom — otherwise
        // they're reading history and shouldn't get yanked down mid-scroll.
        scrollModeRef.current = isNearBottomRef.current ? 'bottom' : 'none'
        if (isNearBottomRef.current) markRoomAsRead(room.id)

        setMessages(ms => {
          // Deduplicate — if msg already added (optimistic send), skip
          if (ms.find(m => m.id === raw.id)) return ms
          return [...ms, { ...raw, reactions: [], senderName, senderUsername }]
        })
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'messages',
        filter: `room_id=eq.${room.id}`
      }, (payload) => {
        // Live-syncs edits made by anyone in the room — message deletion, and a
        // voice note's audio_path arriving shortly after the row itself (upload
        // to Storage happens after the DB row exists, since the storage path is
        // keyed by message id). Without this, other viewers see "Message
        // deleted" or a perpetually-uploading voice note until they reload.
        const raw = payload.new as { id: string; content: string; deleted: boolean; hidden: boolean; hidden_reason: string | null; audio_path: string | null }
        setMessages(ms => ms.map(m => m.id === raw.id
          ? { ...m, deleted: raw.deleted, hidden: raw.hidden, hidden_reason: raw.hidden_reason, content: raw.deleted ? 'Message deleted' : raw.content, audio_path: raw.audio_path }
          : m))
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'message_reactions',
        filter: `room_id=eq.${room.id}`
      }, (payload) => {
        const raw = payload.new as { message_id: string; emoji: string; user_id: string }
        setMessages(ms => ms.map(m => {
          if (m.id !== raw.message_id) return m
          const withoutSameUser = m.reactions.filter(r => r.user_id !== raw.user_id)
          return { ...m, reactions: [...withoutSameUser, { emoji: raw.emoji, user_id: raw.user_id }] }
        }))
      })
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'message_reactions',
        filter: `room_id=eq.${room.id}`
      }, (payload) => {
        const raw = payload.old as { message_id: string; user_id: string }
        setMessages(ms => ms.map(m => m.id !== raw.message_id
          ? m
          : { ...m, reactions: m.reactions.filter(r => r.user_id !== raw.user_id) }))
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'chat_rooms',
        filter: `id=eq.${room.id}`
      }, async (payload) => {
        // Live-syncs pin/unpin, Spotlight, and Slow Mode changes made by staff.
        const raw = payload.new as {
          pinned_message_id: string | null
          spotlight_message_id: string | null
          spotlight_expires_at: string | null
          slow_mode: boolean
          slow_mode_seconds: number
        }
        setActiveRoom(r => (r && r.id === room.id) ? {
          ...r,
          pinnedMessageId: raw.pinned_message_id,
          spotlightMessageId: raw.spotlight_message_id,
          spotlightExpiresAt: raw.spotlight_expires_at,
          slowMode: raw.slow_mode,
          slowModeSeconds: raw.slow_mode_seconds,
        } : r)
        setRooms(prev => prev.map(r => r.id === room.id ? {
          ...r,
          pinnedMessageId: raw.pinned_message_id,
          spotlightMessageId: raw.spotlight_message_id,
          spotlightExpiresAt: raw.spotlight_expires_at,
          slowMode: raw.slow_mode,
          slowModeSeconds: raw.slow_mode_seconds,
        } : r))

        if (!raw.pinned_message_id) { setPinnedMsgPreview(null) } else {
          const { data: pinnedRow } = await supabase
            .from('messages').select('id, sender_id, content').eq('id', raw.pinned_message_id).maybeSingle()
          if (pinnedRow) {
            const pinnedSender = roomMembersRef.current.find(mb => mb.user_id === pinnedRow.sender_id)
            setPinnedMsgPreview({
              id: pinnedRow.id,
              content: pinnedRow.content,
              senderName: pinnedSender ? (pinnedSender.profile.display_name || pinnedSender.profile.username) : 'Unknown',
            })
          }
        }

        if (!raw.spotlight_message_id || !raw.spotlight_expires_at || new Date(raw.spotlight_expires_at) <= new Date()) {
          setSpotlightMsgPreview(null)
        } else {
          const { data: spotlightRow } = await supabase
            .from('messages').select('id, sender_id, content').eq('id', raw.spotlight_message_id).maybeSingle()
          if (spotlightRow) {
            const spotlightSender = roomMembersRef.current.find(mb => mb.user_id === spotlightRow.sender_id)
            setSpotlightMsgPreview({
              id: spotlightRow.id,
              content: spotlightRow.content,
              senderName: spotlightSender ? (spotlightSender.profile.display_name || spotlightSender.profile.username) : 'Unknown',
            })
          }
        }
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'poll_votes',
        filter: `room_id=eq.${room.id}`
      }, () => {
        // A vote count changed somewhere in this room — every visible
        // PollMessage refetches its own data. Simpler than diffing individual
        // vote rows, and Global Chat rarely has many polls open at once.
        setPollRefreshToken(t => t + 1)
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'polls',
        filter: `room_id=eq.${room.id}`
      }, () => {
        // Covers a poll being ended early (closed_at set) by someone else.
        setPollRefreshToken(t => t + 1)
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'room_members',
        filter: `room_id=eq.${room.id}`
      }, (payload) => {
        // The other DM member's read position moved — flip sent → read live.
        const raw = payload.new as { user_id: string; last_read_at: string }
        if (raw.user_id !== myId) setOtherLastReadAt(raw.last_read_at)
      })
      .subscribe()
  }, [myId, markRoomAsRead])

  // ── Load older messages (scroll-up pagination) ──────────────
  const loadOlderMessages = useCallback(async () => {
    if (!activeRoom || loadingOlder || !hasMoreOlder || messages.length === 0) return
    setLoadingOlder(true)

    // Snapshot the current scroll geometry so we can restore the reader's exact
    // position after older messages are prepended above what they're looking at —
    // otherwise the browser keeps scrollTop fixed and the whole view jumps down.
    const container = scrollContainerRef.current
    if (container) {
      preserveScrollInfoRef.current = { scrollHeight: container.scrollHeight, scrollTop: container.scrollTop }
    }

    const oldestCreatedAt = messages[0].created_at
    let query = supabase
      .from('messages')
      .select('id, sender_id, content, created_at, deleted, hidden, hidden_reason, reply_to_id, type, audio_path, audio_duration_seconds, call_id, rank_tag_group, poll_id')
      .eq('room_id', activeRoom.id)
      .lt('created_at', oldestCreatedAt)
    // Never page past a soft-clear cutoff — that history is hidden for me.
    if (activeRoom.clearedAt) query = query.gt('created_at', activeRoom.clearedAt)
    const { data, error } = await query
      .order('created_at', { ascending: false })
      .limit(MESSAGE_PAGE_SIZE)

    if (error || !data || data.length === 0) {
      setHasMoreOlder(false)
      setLoadingOlder(false)
      return
    }

    const olderPage = [...data].reverse()
    setHasMoreOlder(data.length === MESSAGE_PAGE_SIZE)

    const allMembers = roomMembersRef.current
    const msgIds = olderPage.map(m => m.id)
    const replyIds = [...new Set(olderPage.map(m => m.reply_to_id).filter(Boolean))] as string[]

    const [{ data: olderReactions }, { data: olderReplySources }] = await Promise.all([
      msgIds.length
        ? supabase.from('message_reactions').select('message_id, emoji, user_id').in('message_id', msgIds)
        : Promise.resolve({ data: [] as { message_id: string; emoji: string; user_id: string }[] }),
      replyIds.length
        ? supabase.from('messages').select('id, sender_id, content, deleted').in('id', replyIds)
        : Promise.resolve({ data: [] as { id: string; sender_id: string | null; content: string; deleted: boolean }[] }),
    ])

    const reactionsByMsg = new Map<string, { emoji: string; user_id: string }[]>()
    for (const r of olderReactions ?? []) {
      const list = reactionsByMsg.get(r.message_id) ?? []
      list.push({ emoji: r.emoji, user_id: r.user_id })
      reactionsByMsg.set(r.message_id, list)
    }
    const replyContentById = new Map<string, string>()
    const replySenderById = new Map<string, string | null>()
    for (const r of olderReplySources ?? []) {
      replyContentById.set(r.id, r.deleted ? 'Message deleted' : r.content)
      replySenderById.set(r.id, r.sender_id)
    }
    const nameForSender = (id: string | null | undefined) => {
      if (!id) return 'Unknown'
      const member = allMembers.find(mb => mb.user_id === id)
      return member ? (member.profile.display_name || member.profile.username) : 'Unknown'
    }

    const enrichedOlder: Message[] = olderPage.map(m => {
      const senderMember = allMembers.find(mb => mb.user_id === m.sender_id)
      const senderName = senderMember ? (senderMember.profile.display_name || senderMember.profile.username) : 'Unknown'
      const senderUsername = senderMember ? senderMember.profile.username : undefined
      return {
        ...m,
        deleted: m.deleted ?? false,
        hidden: m.hidden ?? false,
        reactions: reactionsByMsg.get(m.id) ?? [],
        senderName,
        senderUsername,
        replyPreview: m.reply_to_id ? replyContentById.get(m.reply_to_id) : undefined,
        replyPreviewName: m.reply_to_id ? nameForSender(replySenderById.get(m.reply_to_id)) : undefined,
      }
    })

    scrollModeRef.current = 'preserve'
    setMessages(ms => [...enrichedOlder, ...ms])
    setLoadingOlder(false)
  }, [activeRoom, loadingOlder, hasMoreOlder, messages])

  // ── Scroll behavior, driven by scrollModeRef ─────────────────
  // Fixes a real bug in the previous implementation: prepending older messages
  // and then unconditionally re-running a "scroll to bottom" effect on every
  // `messages.length` change caused the view to snap back to the newest message
  // immediately after the user scrolled up to read history — pagination was
  // effectively unusable. This single effect distinguishes the two cases:
  //   'bottom'   → room just opened, I sent a message, or a live message arrived
  //                while I was already reading the latest — snap to the newest.
  //   'preserve' → older history was just prepended above what I was reading —
  //                keep my exact reading position stable using a scrollHeight delta.
  useLayoutEffect(() => {
    const el = scrollContainerRef.current
    if (!el) return
    if (scrollModeRef.current === 'bottom') {
      el.scrollTop = el.scrollHeight
      scrollModeRef.current = 'none'
    } else if (scrollModeRef.current === 'preserve' && preserveScrollInfoRef.current) {
      const prev = preserveScrollInfoRef.current
      el.scrollTop = el.scrollHeight - prev.scrollHeight + prev.scrollTop
      preserveScrollInfoRef.current = null
      scrollModeRef.current = 'none'
    }
  }, [messages])

  useEffect(() => () => { if (subRef.current) supabase.removeChannel(subRef.current) }, [])

  // ── Start private DM with a user ────────────────────────────
  async function startDmWith(targetUserId: string): Promise<boolean> {
    if (!myId || targetUserId === myId) return false

    // Guard against slow-network double-taps.
    if (creatingDmWithRef.current.has(targetUserId)) return false
    creatingDmWithRef.current.add(targetUserId)
    setStartingDmId(targetUserId)
    setDmStartError(null)

    try {
      // Atomic, server-side: looks up an existing DM or creates one and adds
      // both members in a single transaction (see migration 0011). This
      // replaced a two-request client-side flow that could leave the other
      // person never actually added to a brand-new DM room.
      const { data: roomIdResult, error: rpcError } = await supabase.rpc('get_or_create_dm_room', { p_other_user_id: targetUserId })
      const roomId = roomIdResult as string | null
      if (rpcError || !roomId) {
        console.error('Failed to start DM:', rpcError?.message)
        setDmStartError(rpcError?.message || "Couldn't open that conversation. Please try again.")
        return false
      }

      // Fetch the target user's profile for the room member list
      const { data: targetProfile } = await supabase
        .from('profiles').select('username, display_name, avatar').eq('id', targetUserId).single()

      // Build the room object directly and open it — no setTimeout race
      const roomObj: ChatRoom = {
        id: roomId!,
        type: 'dm',
        name: null,
        members: [
          {
            user_id: myId,
            profile: {
              username: myProfile?.username ?? '',
              display_name: myProfile?.display_name ?? null,
              avatar: myProfile?.avatar ?? '',
            },
          },
          {
            user_id: targetUserId,
            profile: {
              username: targetProfile?.username ?? '',
              display_name: targetProfile?.display_name ?? null,
              avatar: targetProfile?.avatar ?? '',
            },
          },
        ],
        lastMsg: '',
        lastMsgTime: '',
        lastMsgAt: null,
        unread: 0,
        pinned: false,
        clearedAt: null,
        pinnedMessageId: null,
        spotlightMessageId: null,
        spotlightExpiresAt: null,
        slowMode: false,
        slowModeSeconds: 10,
      }

      setPlayerSearch('')
      setPlayerResults([])

      // Add to rooms list (or skip if already there), then open
      let roomToOpen = roomObj
      setRooms(prev => {
        const existing = prev.find(r => r.id === roomId)
        if (existing) {
          roomToOpen = existing
          return prev
        }
        const globalRoom = prev.find(r => r.type === 'global')
        const dms = prev.filter(r => r.type !== 'global')
        return globalRoom ? [globalRoom, roomObj, ...dms] : [roomObj, ...dms]
      })
      // Small tick to ensure state is settled before opening. openRoom is
      // async and normally not awaited by its other callers (room-list
      // clicks), so a throw inside it would otherwise vanish as an unhandled
      // promise rejection with nothing telling the player it failed.
      try {
        await new Promise(resolve => setTimeout(resolve, 0))
        await openRoom(roomToOpen)
      } catch (openErr) {
        console.error('Failed to open DM room:', openErr)
        setDmStartError("Couldn't open that conversation. Please try again.")
        return false
      }
      return true
    } catch (err) {
      console.error('startDmWith unexpected error:', err)
      setDmStartError("Couldn't open that conversation. Please try again.")
      return false
    } finally {
      creatingDmWithRef.current.delete(targetUserId)
      setStartingDmId(null)
    }
  }

  // Handles the handoff from PlayerProfile.tsx's "Message" button, which
  // navigates here with `state: { openDmWith: userId }` for a user the
  // player may never have chatted with before. Waits for the initial room
  // list load to finish (so startDmWith's own setRooms update doesn't race
  // it) and clears the state afterward so refreshing/going back doesn't
  // re-trigger a duplicate DM lookup.
  useEffect(() => {
    const targetUserId = (location.state as { openDmWith?: string } | null)?.openDmWith
    if (!targetUserId || !myId || roomsLoading) return
    let cancelled = false
    startDmWith(targetUserId).finally(() => {
      if (!cancelled) navigate(location.pathname, { replace: true, state: {} })
    })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state, myId, roomsLoading])

  // ── Send ────────────────────────────────────────────────────
  interface MessageInsertPayload {
    room_id: string
    sender_id: string
    content: string
    reply_to_id?: string
    type?: MessageType
    audio_duration_seconds?: number
    rank_tag_group?: RankGroupId
  }

  async function sendMsg() {
    const trimmed = text.trim()
    if (!trimmed || !activeRoom || !myId || sending) return
    if (trimmed.length > MAX_MESSAGE_LENGTH) return // guards against a pasted block over the DB check-constraint limit
    if (activeRoom.type === 'dm' && dmBlockState !== 'none') return // composer is hidden in this state, but guard defensively
    if (activeRoom.type === 'global' && activeRoom.slowMode && !isStaff && slowModeCooldownRemaining > 0) return
    if (containsProfanity(trimmed)) { setComposerError(PROFANITY_BLOCKED_MESSAGE); return }

    setSending(true)

    try {
      // Stop broadcasting "typing" the instant the message goes out.
      if (typingTimeoutRef.current) { clearTimeout(typingTimeoutRef.current); typingTimeoutRef.current = null }
      presenceChannelRef.current?.track({ typing: false })

      const rankTag = pendingRankTag && isStaff && activeRoom.type === 'global' ? pendingRankTag : null

      const payload: MessageInsertPayload = { room_id: activeRoom.id, sender_id: myId, content: trimmed }
      if (replyTo) payload.reply_to_id = replyTo.id
      if (rankTag) { payload.type = 'rank_tag'; payload.rank_tag_group = rankTag }
      const { data: inserted, error } = await supabase.from('messages').insert(payload).select('id, sender_id, content, created_at, deleted, hidden, hidden_reason, reply_to_id, type, audio_path, audio_duration_seconds, call_id, rank_tag_group, poll_id').single()
      if (!error && inserted) {
        // Weekly mission: messages_sent
        if (myId) updateMissionProgress(myId, 'messages_sent', 1).catch(console.error)
        // Notify the other person in a DM (skip global chat to avoid spamming everyone)
        if (myId && activeRoom.type === 'dm') {
          activeRoom.members
            .filter(mb => mb.user_id !== myId)
            .forEach(mb => notifyMessage(myId, mb.user_id, inserted.content).catch(console.error))
        }
        // Rank tag: fan out to every user currently in that rank group
        if (myId && rankTag) {
          notifyRankTag(myId, rankTag, { messageId: inserted.id }).catch(console.error)
        }
        // Optimistically add own message immediately without waiting for realtime
        const myMember = activeRoom.members.find(mb => mb.user_id === myId)
        const senderName = myMember ? (myMember.profile.display_name || myMember.profile.username) : 'Me'
        const senderUsername = myMember?.profile.username
        scrollModeRef.current = 'bottom'
        setMessages(ms => {
          if (ms.find(m => m.id === inserted.id)) return ms
          return [...ms, { ...inserted, deleted: false, reactions: [], senderName, senderUsername, replyPreview: replyTo?.content, replyPreviewName: replyTo?.senderName }]
        })
        setText(''); setReplyTo(null); setPendingRankTag(null)
        if (activeRoom.type === 'global' && activeRoom.slowMode && !isStaff) {
          setSlowModeCooldownUntil(Date.now() + activeRoom.slowModeSeconds * 1000)
        }
      } else if (!error) {
        setText(''); setReplyTo(null); setPendingRankTag(null)
      } else if (error.message?.includes('CV_PROFANITY')) {
        setComposerError(PROFANITY_BLOCKED_MESSAGE)
      } else {
        // Previously: unhandled errors (RLS denial, network hiccup mid-request, etc.)
        // failed silently — the composer just sat there with no feedback. Surface
        // something so it's clear the send didn't go through.
        console.error('Failed to send message:', error.message)
        setComposerError('Message failed to send. Please try again.')
      }
    } catch (err) {
      // Guards against the send button getting permanently stuck disabled: if the
      // request itself throws (offline, CORS, etc.) rather than resolving with an
      // { error } object, the old code skipped setSending(false) entirely below.
      console.error('Unexpected error sending message:', err)
      setComposerError('Message failed to send. Please try again.')
    } finally {
      setSending(false)
    }
  }

  /** Voice-note counterpart to sendMsg(). Two-step by necessity: the storage
   *  path convention (`<room_id>/<message_id>.<ext>`) requires a message id
   *  before the file can be uploaded, so the row is inserted first with
   *  audio_path null (MessageRow renders an "Uploading…" state for that),
   *  then patched with the real path once the upload finishes. */
  async function sendVoiceNote({ blob, mimeType, durationSeconds }: VoiceRecorderResult) {
    if (!activeRoom || !myId || sending) return
    if (activeRoom.type === 'dm' && dmBlockState !== 'none') return
    if (!myIsPro) { setMicError('Voice notes are a Chillverse Pro perk (Orbit or Void).'); return }
    setSending(true)

    const payload: MessageInsertPayload = {
      room_id: activeRoom.id,
      sender_id: myId,
      content: '🎙️ Voice message',
      type: 'voice_note',
      audio_duration_seconds: durationSeconds,
    }
    if (replyTo) payload.reply_to_id = replyTo.id

    const { data: inserted, error } = await supabase.from('messages').insert(payload)
      .select('id, sender_id, content, created_at, deleted, hidden, hidden_reason, reply_to_id, type, audio_path, audio_duration_seconds, call_id, rank_tag_group, poll_id').single()

    if (error || !inserted) {
      if (error?.message?.includes('CV_VOICE_NOTES_PRO_ONLY')) {
        setMicError('Voice notes are a Chillverse Pro perk (Orbit or Void).')
      }
      setSending(false)
      return
    }

    if (myId && activeRoom.type === 'dm') {
      activeRoom.members.filter(mb => mb.user_id !== myId)
        .forEach(mb => notifyMessage(myId, mb.user_id, '🎙️ Voice message').catch(console.error))
    }
    updateMissionProgress(myId, 'messages_sent', 1).catch(console.error)

    const myMember = activeRoom.members.find(mb => mb.user_id === myId)
    const senderName = myMember ? (myMember.profile.display_name || myMember.profile.username) : 'Me'
    const senderUsername = myMember?.profile.username
    scrollModeRef.current = 'bottom'
    setMessages(ms => {
      if (ms.find(m => m.id === inserted.id)) return ms
      return [...ms, { ...inserted, deleted: false, reactions: [], senderName, senderUsername, replyPreview: replyTo?.content, replyPreviewName: replyTo?.senderName }]
    })
    setReplyTo(null)
    setSending(false)

    try {
      const audioPath = await uploadVoiceNote(activeRoom.id, inserted.id, blob, mimeType)
      const { error: patchError } = await supabase.from('messages').update({ audio_path: audioPath }).eq('id', inserted.id)
      if (patchError) throw new Error(patchError.message)
      setMessages(ms => ms.map(m => m.id === inserted.id ? { ...m, audio_path: audioPath } : m))
    } catch (err) {
      console.error('Voice note upload failed:', err)
      setMessages(ms => ms.map(m => m.id === inserted.id ? { ...m, type: 'text', content: '⚠️ Voice message failed to send' } : m))
    }
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg() }
  }

  async function addReaction(msgId: string, emoji: string) {
    if (!myId) return

    const target = messages.find(m => m.id === msgId)
    const existing = target?.reactions.find(r => r.user_id === myId)

    // Tapping the same emoji again removes it (toggle-off); tapping a different
    // emoji replaces it — a user can only have ONE reaction per message at a time.
    if (existing && existing.emoji === emoji) {
      await supabase.from('message_reactions').delete().eq('message_id', msgId).eq('user_id', myId)
      setMessages(ms => ms.map(m => m.id !== msgId ? m : { ...m, reactions: m.reactions.filter(r => r.user_id !== myId) }))
      setEmojiForMsg(null)
      return
    }

    // Replace: clear any prior reaction from this user on this message, then add the new one.
    await supabase.from('message_reactions').delete().eq('message_id', msgId).eq('user_id', myId)
    await supabase.from('message_reactions').insert({ message_id: msgId, user_id: myId, emoji })

    setMessages(ms => ms.map(m => {
      if (m.id !== msgId) return m
      const withoutMine = m.reactions.filter(r => r.user_id !== myId)
      return { ...m, reactions: [...withoutMine, { emoji, user_id: myId ?? '' }] }
    }))
    setEmojiForMsg(null)
  }

  async function deleteMsg(id: string) {
    await supabase.from('messages').update({ deleted: true }).eq('id', id).eq('sender_id', myId)
    setMessages(ms => ms.map(m => m.id === id ? { ...m, deleted: true, content: 'Message deleted' } : m))
    setCtxMsg(null)
  }

  // ── Pin / clear / delete-for-me ──────────────────────────────

  /** Toggle "pin chat" for the given room — pinned rooms float to the top of the list. */
  async function togglePinChat(roomId: string) {
    if (!myId) return
    const room = rooms.find(r => r.id === roomId)
    if (!room) return
    const nextPinned = !room.pinned
    const { error } = await supabase.from('room_members').update({ pinned: nextPinned }).eq('room_id', roomId).eq('user_id', myId)
    if (error) {
      console.error('Failed to update pin state — has the pin/clear/delete migration been run on this Supabase project?', error.message)
      return
    }
    setRooms(prev => {
      const updated = prev.map(r => r.id === roomId ? { ...r, pinned: nextPinned } : r)
      const globalRoom = updated.find(r => r.type === 'global')
      const others = updated.filter(r => r.type !== 'global')
      const byRecency = (a: ChatRoom, b: ChatRoom) => (new Date(b.lastMsgAt ?? 0).getTime()) - (new Date(a.lastMsgAt ?? 0).getTime())
      const pinnedRooms = others.filter(r => r.pinned).sort(byRecency)
      const unpinnedRooms = others.filter(r => !r.pinned).sort(byRecency)
      return globalRoom ? [globalRoom, ...pinnedRooms, ...unpinnedRooms] : [...pinnedRooms, ...unpinnedRooms]
    })
    if (activeRoom?.id === roomId) setActiveRoom(r => r ? { ...r, pinned: nextPinned } : r)
  }

  /** Soft-clear a chat for me only — hides everything up to now, other member unaffected. */
  async function clearChatForMe(roomId: string) {
    if (!myId) return
    const cutoff = new Date().toISOString()
    const { error } = await supabase.from('room_members').update({ cleared_at: cutoff }).eq('room_id', roomId).eq('user_id', myId)
    if (error) {
      console.error('Failed to clear chat — has the pin/clear/delete migration been run on this Supabase project?', error.message)
      return
    }
    setRooms(prev => prev.map(r => r.id === roomId ? { ...r, clearedAt: cutoff, lastMsg: '', lastMsgTime: '' } : r))
    if (activeRoom?.id === roomId) {
      setActiveRoom(r => r ? { ...r, clearedAt: cutoff } : r)
      setMessages([])
    }
  }

  /** Delete-for-me: hides a DM from my room list without affecting the other member. Global Chat is exempt. */
  async function deleteChatForMe(roomId: string) {
    if (!myId) return
    const room = rooms.find(r => r.id === roomId)
    if (!room || room.type === 'global') return
    const { error } = await supabase.from('room_members').update({ hidden_at: new Date().toISOString() }).eq('room_id', roomId).eq('user_id', myId)
    if (error) {
      console.error('Failed to delete chat — has the pin/clear/delete migration been run on this Supabase project?', error.message)
      return
    }
    setRooms(prev => prev.filter(r => r.id !== roomId))
    if (activeRoom?.id === roomId) { setActiveRoom(null); setShowConv(false); setMessages([]) }
  }

  /** Pin a message to the top of the active conversation, visible to all members.
   *  Global Chat: Staff/Moderator/Admin only. DMs: any member, unchanged. */
  async function pinMessage(msg: Message) {
    if (!activeRoom) return
    if (activeRoom.type === 'global' && !isStaff) return
    const { error } = await supabase.from('chat_rooms').update({ pinned_message_id: msg.id }).eq('id', activeRoom.id)
    if (error) {
      console.error('Failed to pin message — has the pin/clear/delete migration been run on this Supabase project?', error.message)
      return
    }
    setActiveRoom(r => r ? { ...r, pinnedMessageId: msg.id } : r)
    setRooms(prev => prev.map(r => r.id === activeRoom.id ? { ...r, pinnedMessageId: msg.id } : r))
    setPinnedMsgPreview({
      id: msg.id,
      content: msg.deleted ? 'Message deleted' : msg.content,
      senderName: msg.sender_id === myId ? 'You' : (msg.senderName || 'Unknown'),
    })
    setCtxMsg(null)
  }

  async function unpinMessage() {
    if (!activeRoom) return
    if (activeRoom.type === 'global' && !isStaff) return
    const { error } = await supabase.from('chat_rooms').update({ pinned_message_id: null }).eq('id', activeRoom.id)
    if (error) {
      console.error('Failed to unpin message:', error.message)
      return
    }
    setActiveRoom(r => r ? { ...r, pinnedMessageId: null } : r)
    setRooms(prev => prev.map(r => r.id === activeRoom.id ? { ...r, pinnedMessageId: null } : r))
    setPinnedMsgPreview(null)
  }

  /** Temporary pin, separate from the permanent pin above. Staff/Moderator/
   *  Admin, Global Chat only. Auto-expires client-side (no cron) — see the
   *  spotlightExpiresAt check wherever this is rendered/synced. */
  async function spotlightMessage(msg: Message, durationMinutes: number) {
    if (!activeRoom || activeRoom.type !== 'global' || !isStaff) return
    const expiresAt = new Date(Date.now() + durationMinutes * 60_000).toISOString()
    const { error } = await supabase.from('chat_rooms')
      .update({ spotlight_message_id: msg.id, spotlight_expires_at: expiresAt }).eq('id', activeRoom.id)
    if (error) {
      console.error('Failed to spotlight message:', error.message)
      return
    }
    setActiveRoom(r => r ? { ...r, spotlightMessageId: msg.id, spotlightExpiresAt: expiresAt } : r)
    setRooms(prev => prev.map(r => r.id === activeRoom.id ? { ...r, spotlightMessageId: msg.id, spotlightExpiresAt: expiresAt } : r))
    setSpotlightMsgPreview({
      id: msg.id,
      content: msg.deleted ? 'Message deleted' : msg.content,
      senderName: msg.sender_id === myId ? 'You' : (msg.senderName || 'Unknown'),
    })
    setCtxMsg(null)
  }

  async function clearSpotlight() {
    if (!activeRoom || activeRoom.type !== 'global' || !isStaff) return
    const { error } = await supabase.from('chat_rooms')
      .update({ spotlight_message_id: null, spotlight_expires_at: null }).eq('id', activeRoom.id)
    if (error) {
      console.error('Failed to clear spotlight:', error.message)
      return
    }
    setActiveRoom(r => r ? { ...r, spotlightMessageId: null, spotlightExpiresAt: null } : r)
    setRooms(prev => prev.map(r => r.id === activeRoom.id ? { ...r, spotlightMessageId: null, spotlightExpiresAt: null } : r))
    setSpotlightMsgPreview(null)
  }

  /** Staff/Moderator/Admin, Global Chat only. Staff themselves are exempt
   *  from the cooldown (enforced server-side in migration 0040). */
  async function toggleSlowMode(enabled: boolean, seconds: 10 | 20 | 30) {
    if (!activeRoom || activeRoom.type !== 'global' || !isStaff) return
    const { error } = await supabase.from('chat_rooms')
      .update({ slow_mode: enabled, slow_mode_seconds: seconds }).eq('id', activeRoom.id)
    if (error) {
      console.error('Failed to toggle Slow Mode:', error.message)
      return
    }
    setActiveRoom(r => r ? { ...r, slowMode: enabled, slowModeSeconds: seconds } : r)
    setRooms(prev => prev.map(r => r.id === activeRoom.id ? { ...r, slowMode: enabled, slowModeSeconds: seconds } : r))
  }

  /** Private per-user bookmark — DMs only (see toggleStar's guard below and
   *  the context-menu condition that hides Star in Global Chat). Capped at
   *  MAX_STARRED_PER_ROOM per conversation. Nobody else ever sees this
   *  (see migration 0046). */
  async function toggleStar(messageId: string) {
    if (!myId || !activeRoom || activeRoom.type !== 'dm') return
    const currentlyStarred = myStarredIds.has(messageId)
    setMyStarredIds(prev => {
      const next = new Set(prev)
      currentlyStarred ? next.delete(messageId) : next.add(messageId)
      return next
    })
    const { error } = currentlyStarred ? await unstarMessage(myId, messageId) : await starMessage(myId, messageId, activeRoom.id)
    if (error) {
      setMyStarredIds(prev => {
        const next = new Set(prev)
        currentlyStarred ? next.add(messageId) : next.delete(messageId)
        return next
      })
      if (!currentlyStarred) setComposerError(error) // cap-reached message; unstar failures are rare enough to just log
      else console.error('Failed to toggle star:', error)
    }
  }

  function formatTime(iso: string) {
    const d = new Date(iso); const now = new Date(); const diff = now.getTime() - d.getTime()
    if (diff < 60000) return 'now'
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m`
    if (diff < 86400000) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    return d.toLocaleDateString([], { day: 'numeric', month: 'short' })
  }

  function roomLabel(room: ChatRoom): string {
    if (room.type === 'global') return 'Global Chat'
    if (room.name) return room.name
    const other = room.members.find(m => m.user_id !== myId)
    if (other) return other.profile.display_name || other.profile.username
    return 'Chat'
  }

  // Open sender profile from a message click
  function openSenderProfile(msg: Message) {
    if (!msg.sender_id) return
    const member = activeRoom?.members.find(mb => mb.user_id === msg.sender_id)
    if (member) {
      setViewProfile({ id: msg.sender_id, username: member.profile.username, display_name: member.profile.display_name, avatar: member.profile.avatar })
    } else if (msg.senderUsername) {
      setViewProfile({ id: msg.sender_id, username: msg.senderUsername, display_name: msg.senderName ?? null, avatar: '' })
    }
  }

  const filteredRooms = rooms.filter(r => !roomSearch || roomLabel(r).toLowerCase().includes(roomSearch.toLowerCase()))
  const totalUnread = rooms.reduce((s, r) => s + r.unread, 0)
  const groupedMessages = useMemo(() => groupMessages(messages), [messages])

  const showList = !isMobile || !showConv
  const showChat = !isMobile || showConv

  return (
    <div className="flex h-[calc(100dvh-60px)] overflow-hidden relative">
      <PageOnboarding pageKey="chat" />

      {/* ── Contact list + player search ── */}
      {showList && (
        <div className="w-full sm:w-[320px] flex-shrink-0 flex flex-col overflow-hidden" style={{ borderRight: isMobile ? 'none' : '1px solid rgba(255,255,255,0.06)' }}>

          {/* Header */}
          <div className="p-0 sm:p-3 md:p-4 pb-2">
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12, padding: isMobile ? '12px 12px 0' : 0 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <span style={{ fontSize:17, fontWeight:700, color:'var(--text)' }}>Messages</span>
                {totalUnread > 0 && <span style={{ background:'var(--accent)', color:'#fff', fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:10 }}>{totalUnread}</span>}
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                <IBtn><MoreVertical size={15} /></IBtn>
              </div>
            </div>

            {/* Room search */}
            <div style={{ display:'flex', alignItems:'center', gap:8, background:'var(--surface2)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:12, padding:'8px 12px', marginBottom:8, marginInline: isMobile ? 12 : 0 }}>
              <Search size={14} style={{ color:'var(--text-muted)', flexShrink:0 }} />
              <input type="text" placeholder="Search chats…" value={roomSearch} onChange={e => setRoomSearch(e.target.value)}

                style={{ flex:1, background:'transparent', border:'none', outline:'none', fontSize:13, color:'var(--text)' }} />
            </div>

            {/* Player search — with chat icon + prompt */}
            <div style={{ marginBottom: 4, paddingInline: isMobile ? 12 : 0 }}>
              <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:6 }}>
                <MessageCircle size={13} style={{ color:'#4f8ef7', flexShrink:0 }} />
                <span style={{ fontSize:11, color:'var(--text-muted)', fontWeight:600 }}>Start a chat — enter a username</span>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:8, background:'var(--surface2)', border:'1px solid rgba(79,142,247,0.18)', borderRadius:12, padding:'8px 12px' }}>
                <Search size={14} style={{ color:'#4f8ef7', flexShrink:0 }} />
                <input type="text" placeholder="Find players by username…" value={playerSearch} onChange={e => setPlayerSearch(e.target.value)}
                  style={{ flex:1, background:'transparent', border:'none', outline:'none', fontSize:13, color:'var(--text)' }} />
                {playerSearch && (
                  <button type="button" onClick={() => { setPlayerSearch(''); setPlayerResults([]) }} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', padding:0, display:'flex' }}>
                    <X size={13} />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Player search results */}
          {playerSearch.trim() && (
            <div style={{ borderBottom:'1px solid rgba(255,255,255,0.05)', paddingBottom:6 }}>
              <div style={{ padding:'4px 16px 6px', fontSize:10, fontWeight:600, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em' }}>Players</div>
              {playerSearching ? (
                <div style={{ display:'flex', justifyContent:'center', padding:16 }}>
                  <span style={{ width:20, height:20, border:'2px solid var(--surface3)', borderTopColor:'#4f8ef7', borderRadius:'50%', display:'block', animation:'spin 0.8s linear infinite' }} />
                </div>
              ) : playerResults.length === 0 ? (
                <div style={{ padding:'8px 16px', fontSize:12, color:'var(--text-muted)' }}>No players found</div>
              ) : (
                playerResults.map(p => (
                  <button key={p.id} type="button" onClick={() => setViewProfile(p)}
                    style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 16px', width:'100%', background:'transparent', border:'none', cursor:'pointer', textAlign:'left', transition:'background 0.12s' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
                    <Avatar name={p.display_name || p.username} avatarUrl={p.avatar || null} size={36} radius={10} />
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:13, fontWeight:600, color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.display_name || p.username}</div>
                      <div style={{ fontSize:11, color:'var(--text-muted)' }}>@{p.username}</div>
                    </div>
                    <button type="button" onClick={e => { e.stopPropagation(); startDmWith(p.id) }}
                      disabled={startingDmId === p.id}
                      title="Start chat"
                      style={{ background:'rgba(79,142,247,0.12)', border:'1px solid rgba(79,142,247,0.3)', borderRadius:8, padding:'5px 8px', cursor: startingDmId === p.id ? 'not-allowed' : 'pointer', color:'#4f8ef7', display:'flex', alignItems:'center', gap:4, fontSize:11, fontWeight:600, flexShrink:0, opacity: startingDmId === p.id ? 0.6 : 1 }}>
                      {startingDmId === p.id
                        ? <span style={{ width:12, height:12, border:'2px solid rgba(79,142,247,0.3)', borderTopColor:'#4f8ef7', borderRadius:'50%', display:'block', animation:'spin 0.8s linear infinite' }} />
                        : <MessageCircle size={12} />}
                      {startingDmId === p.id ? 'Opening…' : 'Chat'}
                    </button>
                  </button>
                ))
              )}
            </div>
          )}

          {/* Room list */}
          {dmStartError && (
            <div style={{ margin:'8px 16px', padding:'8px 12px', borderRadius:10, background:'rgba(255,107,107,0.1)', border:'1px solid rgba(255,107,107,0.25)', fontSize:12, color:'#ff6b6b' }}>
              {dmStartError}
            </div>
          )}
          <div style={{ flex:1, overflowY:'auto' }}>
            {roomsLoading ? (
              <SkeletonRoomList />
            ) : filteredRooms.length === 0 ? (
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100%', padding:40, gap:12 }}>
                <MessageCircle size={40} style={{ color:'var(--text-muted)' }} />
                <p style={{ fontSize:14, fontWeight:600, color:'var(--text-dim)', textAlign:'center' }}>No chats yet</p>
                <p style={{ fontSize:12, color:'var(--text-muted)', textAlign:'center', lineHeight:1.5 }}>Start a conversation from someone's profile.</p>
              </div>
            ) : (
              filteredRooms.map(room => {
                const isGlobal = room.type === 'global'
                return (
                  <div key={room.id} className="ripple-wrap" style={{ position:'relative' }}>
                    <div role="button" tabIndex={0} onClick={(e) => { ripple(e); openRoom(room) }}
                      onKeyDown={e => { if (e.key === 'Enter') openRoom(room) }}
                      style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 44px 12px 16px', width:'100%', cursor:'pointer', background: activeRoom?.id === room.id && !isMobile ? 'rgba(79,142,247,0.08)' : isGlobal ? 'rgba(79,142,247,0.04)' : 'transparent', border:'none', borderBottom: isGlobal ? '2px solid rgba(79,142,247,0.15)' : '1px solid rgba(255,255,255,0.04)', textAlign:'left', transition:'background 0.15s' }}
                      onMouseEnter={e => { if (activeRoom?.id !== room.id) e.currentTarget.style.background = isGlobal ? 'rgba(79,142,247,0.10)' : 'rgba(255,255,255,0.03)' }}
                      onMouseLeave={e => { if (activeRoom?.id !== room.id) e.currentTarget.style.background = isGlobal ? 'rgba(79,142,247,0.04)' : 'transparent' }}>
                      {/* Globe avatar for global chat, real profile pic for DMs */}
                      {isGlobal ? (
                        <div style={{ width:44, height:44, borderRadius:13, flexShrink:0, background:'linear-gradient(135deg,#4f8ef7,#9b6dff)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, boxShadow:'0 0 14px rgba(79,142,247,0.35)' }}>
                          🌍
                        </div>
                      ) : (() => {
                        const other = room.members.find(m => m.user_id !== myId)
                        return (
                          <div style={{ position:'relative', flexShrink:0 }}>
                            <Avatar name={roomLabel(room)} avatarUrl={other?.profile?.avatar || null} size={44} />
                            {other && onlineUserIds.has(other.user_id) && <OnlineDot />}
                          </div>
                        )
                      })()}
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:3 }}>
                          <div style={{ display:'flex', alignItems:'center', gap:6, minWidth:0 }}>
                            {room.pinned && <Pin size={11} style={{ color:'#4f8ef7', flexShrink:0 }} />}
                            <span style={{ fontSize:14, fontWeight:700, color: isGlobal ? '#4f8ef7' : 'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{roomLabel(room)}</span>
                            {isGlobal && (
                              <span style={{ fontSize:9, fontWeight:800, color:'#fff', background:'linear-gradient(135deg,#4f8ef7,#9b6dff)', borderRadius:5, padding:'1px 6px', flexShrink:0 }}>GLOBAL</span>
                            )}
                          </div>
                          <span style={{ fontSize:11, color:'var(--text-muted)', flexShrink:0, marginLeft:8 }}>{room.lastMsgTime}</span>
                        </div>
                        <span style={{ fontSize:12, color:'var(--text-muted)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', display:'block' }}>
                          {isGlobal && !room.lastMsg ? '👋 Say hello to everyone!' : room.lastMsg || 'No messages yet'}
                        </span>
                      </div>
                      {room.unread > 0 && <span style={{ fontSize:10, fontWeight:700, color:'#fff', background:'var(--accent)', borderRadius:10, padding:'2px 6px', flexShrink:0 }}>{room.unread}</span>}
                    </div>

                    {/* Per-row 3-dot menu — Pin / Delete (DMs only, Global Chat is exempt) */}
                    {!isGlobal && (
                      <div style={{ position:'absolute', right:8, top:'50%', transform:'translateY(-50%)' }}>
                        <button type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            const rect = e.currentTarget.getBoundingClientRect()
                            setRoomMenuPos({ x: rect.right, y: rect.bottom + 4 })
                            setRoomMenuOpenFor(o => o === room.id ? null : room.id)
                          }}
                          style={{ width:28, height:28, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)' }}>
                          <MoreVertical size={15} />
                        </button>
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}

      {/* ── Conversation panel ── */}
      {showChat && (
        <div style={{ flex:1, display:'flex', flexDirection:'column', minWidth:0, position:'relative' }}>
          {activeRoom ? (
            <>
              {/* Conv topbar — single full-width header block: title on the left, back
                  arrow + retractable action drawer on the right. The drawer is a small
                  rectangle that slides open horizontally to reveal icons, then retracts
                  cleanly back into the header on toggle. */}
              <div style={{ display:'flex', alignItems:'center', gap:10, padding:'0 12px 0 16px', height:56, flexShrink:0, background:'rgba(17,17,19,0.90)', backdropFilter:'blur(14px)', borderBottom:'1px solid rgba(255,255,255,0.05)', position:'relative' }}>
                <div style={{ display:'flex', alignItems:'center', gap:10, flex:1, minWidth:0,
                  cursor: activeRoom.type === 'dm' ? 'pointer' : 'default' }}
                  onClick={() => { if (activeRoom.type === 'dm') setDmOptionsOpen(true) }}>
                  {activeRoom.type === 'global' ? (
                    <div style={{ width:34, height:34, borderRadius:10, flexShrink:0, background:'linear-gradient(135deg,#4f8ef7,#9b6dff)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18 }}>
                      🌍
                    </div>
                  ) : (() => {
                    const other = activeRoom.members.find(m => m.user_id !== myId)
                    return (
                      <div style={{ position:'relative', flexShrink:0 }}>
                        <Avatar name={roomLabel(activeRoom)} avatarUrl={other?.profile?.avatar || null} size={34} radius={10} />
                        {other && onlineUserIds.has(other.user_id) && <OnlineDot size={9} />}
                      </div>
                    )
                  })()}
                  <div style={{ minWidth:0 }}>
                    <div style={{ fontSize:14, fontWeight:700, color: activeRoom.type === 'global' ? '#4f8ef7' : 'var(--text)' }}>{roomLabel(activeRoom)}</div>
                    {activeRoom.type === 'global' && (
                      <div style={{ fontSize:11, color:'var(--text-muted)' }}>
                        🌐 Open to all Chillverse players
                      </div>
                    )}
                    {activeRoom.type === 'global' && activeRoom.slowMode && (
                      <div style={{ fontSize:10.5, color:'var(--accent)', fontWeight:600 }}>
                        🐢 Slow mode: {activeRoom.slowModeSeconds}s
                      </div>
                    )}
                    {activeRoom.type === 'dm' && (() => {
                      const other = activeRoom.members.find(m => m.user_id !== myId)
                      if (!other || !onlineUserIds.has(other.user_id)) return null
                      return <div style={{ fontSize:11, color:'#3ecf8e', fontWeight:600 }}>Online</div>
                    })()}
                  </div>
                </div>

                {/* Retractable action drawer + back arrow, grouped on the right */}
                <div style={{ display:'flex', alignItems:'center', gap:6, flexShrink:0 }}>
                  <div style={{
                    display:'flex', alignItems:'center', gap:6,
                    /* overflow must stay visible while the Slow Mode picker is open, otherwise
                       the dropdown (positioned absolute, top:110%) gets clipped by this
                       container's own bounding box and never appears — looks "non-functional". */
                    overflow: slowModePickerOpen ? 'visible' : 'hidden',
                    maxWidth: headerDrawerOpen ? 220 : 0,
                    opacity: headerDrawerOpen ? 1 : 0,
                    background: headerDrawerOpen ? 'var(--surface2)' : 'transparent',
                    border: headerDrawerOpen ? '1px solid rgba(255,255,255,0.08)' : '1px solid transparent',
                    borderRadius:10,
                    padding: headerDrawerOpen ? '2px 4px' : '2px 0',
                    transition:'max-width 0.28s ease, opacity 0.2s ease, padding 0.28s ease, background 0.2s ease',
                  }}>
                    {activeRoom.type === 'dm' && dmBlockState === 'none' && (() => {
                      const other = activeRoom.members.find(m => m.user_id !== myId)
                      if (!other) return null
                      return <StartCallButton roomId={activeRoom.id} callee={{ id: other.user_id, username: other.profile.username, display_name: other.profile.display_name, avatar: other.profile.avatar }} size={32} />
                    })()}
                    {activeRoom.type === 'dm' && (
                      <IBtn onClick={() => setGhostReadActive(v => !v)} style={{ width:32, height:32, ...(ghostReadActive ? { color:'var(--accent)', borderColor:'var(--accent)' } : {}) }}
                        title={ghostReadActive ? 'Ghost Read is on — reopen the chat to turn it off' : 'Open without marking as read (this visit only)'}>
                        {ghostReadActive ? <EyeOff size={14} /> : <Eye size={14} />}
                      </IBtn>
                    )}
                    {activeRoom.type === 'dm' && (
                      <IBtn onClick={() => setStarredPanelOpen(true)} style={{ width:32, height:32 }} title="Starred messages">
                        <Star size={14} />
                      </IBtn>
                    )}
                    <IBtn onClick={() => { setMsgSearchOpen(o => !o); if (msgSearchOpen) setMsgSearchQuery('') }} style={{ width:32, height:32 }}>
                      <Search size={14} />
                    </IBtn>
                    {activeRoom.type === 'global' && isStaff && (
                      <div style={{ position:'relative' }}>
                        <IBtn onClick={() => setSlowModePickerOpen(v => !v)} style={{ width:32, height:32, ...(activeRoom.slowMode ? { color:'var(--accent)', borderColor:'var(--accent)' } : {}) }} title="Slow Mode">
                          <Timer size={14} />
                        </IBtn>
                        {slowModePickerOpen && (
                          <>
                          <div style={{ position:'fixed', inset:0, zIndex:49 }} onClick={() => setSlowModePickerOpen(false)} />
                          <div style={{ position:'absolute', top:'110%', right:0, background:'var(--surface2)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:14, padding:8, display:'flex', flexDirection:'column', gap:3, boxShadow:'0 12px 40px rgba(0,0,0,0.5)', minWidth:150, zIndex:50 }}>
                            <div style={{ fontSize:10.5, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:0.3, padding:'2px 6px 4px' }}>Slow mode</div>
                            <button type="button" onClick={() => { toggleSlowMode(false, activeRoom.slowModeSeconds as 10|20|30); setSlowModePickerOpen(false) }}
                              style={{ textAlign:'left', background: !activeRoom.slowMode ? 'var(--surface)' : 'none', border:'none', borderRadius:8, padding:'7px 9px', fontSize:12.5, fontWeight:600, color: !activeRoom.slowMode ? 'var(--accent)' : 'var(--text)', cursor:'pointer' }}>
                              Off
                            </button>
                            {([10, 20, 30] as const).map(s => (
                              <button key={s} type="button" onClick={() => { toggleSlowMode(true, s); setSlowModePickerOpen(false) }}
                                style={{ textAlign:'left', background: activeRoom.slowMode && activeRoom.slowModeSeconds === s ? 'var(--surface)' : 'none', border:'none', borderRadius:8, padding:'7px 9px', fontSize:12.5, fontWeight:600, color: activeRoom.slowMode && activeRoom.slowModeSeconds === s ? 'var(--accent)' : 'var(--text)', cursor:'pointer' }}>
                                {s} seconds
                              </button>
                            ))}
                          </div>
                          </>
                        )}
                      </div>
                    )}
                    {activeRoom.type === 'dm' && (
                      <IBtn onClick={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect()
                        setConvMenuPos({ x: rect.right, y: rect.bottom + 4 })
                        setConvMenuOpen(o => !o)
                      }} style={{ width:32, height:32 }}><MoreVertical size={14} /></IBtn>
                    )}
                  </div>
                  <IBtn onClick={() => setHeaderDrawerOpen(o => !o)} style={{ background: headerDrawerOpen ? 'var(--surface2)' : 'var(--surface)' }}>
                    {headerDrawerOpen ? <X size={15} /> : <MoreVertical size={15} />}
                  </IBtn>
                  <IBtn onClick={() => { setShowConv(false); if (!isMobile) setActiveRoom(null) }}>
                    <ArrowLeft size={15} />
                  </IBtn>
                </div>
              </div>

              {/* Message search bar — slides in below the header when the drawer's search icon is toggled */}
              {msgSearchOpen && (
                <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 14px', background:'var(--surface2)', borderBottom:'1px solid rgba(255,255,255,0.05)', flexShrink:0 }}>
                  <Search size={13} style={{ color:'var(--text-muted)', flexShrink:0 }} />
                  <input
                    type="text"
                    autoFocus
                    placeholder="Search in this chat…"
                    value={msgSearchQuery}
                    onChange={e => setMsgSearchQuery(e.target.value)}
                    style={{ flex:1, background:'transparent', border:'none', outline:'none', fontSize:13, color:'var(--text)' }}
                  />
                  {msgSearchQuery && (
                    <button type="button" onClick={() => setMsgSearchQuery('')} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', padding:0, display:'flex' }}>
                      <X size={13} />
                    </button>
                  )}
                </div>
              )}

              {/* Spotlight banner — temporary pin, shows above the permanent pin below */}
              {spotlightMsgPreview && activeRoom.type === 'global' && (
                <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 16px', background:'rgba(255,193,7,0.10)', borderBottom:'1px solid rgba(255,255,255,0.05)', flexShrink:0 }}>
                  <Zap size={13} style={{ color:'#ffc107', flexShrink:0 }} />
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:10.5, fontWeight:700, color:'#ffc107' }}>Spotlight — {spotlightMsgPreview.senderName}</div>
                    <div style={{ fontSize:12, color:'var(--text-dim)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{spotlightMsgPreview.content}</div>
                  </div>
                  {isStaff && (
                    <button type="button" onClick={clearSpotlight} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', padding:4, flexShrink:0 }}>
                      <X size={13} />
                    </button>
                  )}
                </div>
              )}

              {/* Pinned message banner */}
              {pinnedMsgPreview && (
                <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 16px', background:'rgba(79,142,247,0.08)', borderBottom:'1px solid rgba(255,255,255,0.05)', flexShrink:0 }}>
                  <Pin size={13} style={{ color:'#4f8ef7', flexShrink:0 }} />
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:10.5, fontWeight:700, color:'#4f8ef7' }}>{pinnedMsgPreview.senderName}</div>
                    <div style={{ fontSize:12, color:'var(--text-dim)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{pinnedMsgPreview.content}</div>
                  </div>
                  {(activeRoom.type !== 'global' || isStaff) && (
                    <button type="button" onClick={unpinMessage} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', padding:4, flexShrink:0 }}>
                      <X size={13} />
                    </button>
                  )}
                </div>
              )}

              {/* Messages */}
              <div
                ref={scrollContainerRef}
                onScroll={e => {
                  const el = e.currentTarget
                  isNearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX
                  if (isNearBottomRef.current) markRoomAsRead(activeRoom.id)
                  if (el.scrollTop < 80) loadOlderMessages()
                }}
                style={{ flex:1, overflowY:'auto', padding:'12px 10px', display:'flex', flexDirection:'column' }}>
                {msgsLoading ? (
                  <SkeletonBubbles />
                ) : messages.length === 0 ? (
                  <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', flex:1, gap:10 }}>
                    <MessageCircle size={32} style={{ color:'var(--text-muted)' }} />
                    <p style={{ fontSize:13, color:'var(--text-muted)' }}>No messages yet. Say hello!</p>
                  </div>
                ) : (
                  <>
                    {loadingOlder && (
                      <div style={{ display:'flex', justifyContent:'center', padding:'8px 0 12px' }}>
                        <span style={{ width:18, height:18, border:'2px solid var(--surface3)', borderTopColor:'var(--accent)', borderRadius:'50%', display:'block', animation:'spin 0.8s linear infinite' }} />
                      </div>
                    )}
                    {(() => {
                      const notBlocked = groupedMessages.filter(m => !m.sender_id || !myBlockedIds.has(m.sender_id))
                      const query = msgSearchQuery.trim().toLowerCase()
                      const visible = query
                        ? notBlocked.filter(m => !m.deleted && !m.hidden && m.content.toLowerCase().includes(query))
                        : notBlocked

                      // Fold the flat, filtered list into consecutive-sender bursts — one
                      // chat-line block per burst, sharing a single avatar and underline.
                      // While searching, every match stands alone as its own block so it
                      // keeps its own avatar/context regardless of the original grouping.
                      const bursts: GroupedMessage[][] = []
                      for (const m of visible) {
                        const last = bursts[bursts.length - 1]
                        if (!query && last && !m.isGroupFirst) last.push(m)
                        else bursts.push([m])
                      }

                      // Resolve avatar for a sender: own messages use myProfile, others look up in room members
                      const avatarFor = (msg: Message, isMine: boolean): string | null => {
                        if (isMine) return myProfile?.avatar ?? null
                        const member = activeRoom?.members.find(mb => mb.user_id === msg.sender_id)
                        return member?.profile?.avatar ?? null
                      }

                      // Read receipt only means something for a DM — with a single
                      // other member, "read" is unambiguous. Global chat skips this.
                      const readReceiptFor = (msg: Message): ReadReceipt => {
                        const isMine = msg.sender_id === myId
                        if (!isMine || msg.deleted) return null
                        return activeRoom.type === 'dm' && otherLastReadAt && new Date(msg.created_at) <= new Date(otherLastReadAt)
                          ? 'read'
                          : 'sent'
                      }

                      if (query && bursts.length === 0) {
                        return (
                          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', flex:1, gap:8, padding:'40px 0' }}>
                            <Search size={26} style={{ color:'var(--text-muted)' }} />
                            <p style={{ fontSize:12.5, color:'var(--text-muted)' }}>No messages match "{msgSearchQuery.trim()}"</p>
                          </div>
                        )
                      }

                      return bursts.map(burst => {
                        const first = burst[0]
                        const isMine = first.sender_id === myId
                        const senderLabel = isMine ? 'You' : (first.senderName || 'Unknown')

                        // Rank Tags and Polls are always a burst of one (see the grouping
                        // fix in groupMessages) and render full-width, outside the normal
                        // avatar+bubble column — deliberately not styled like a chat message.
                        if (burst.length === 1 && first.type === 'rank_tag') {
                          return <RankTagAnnouncement key={first.id} msg={first} senderLabel={senderLabel} formatTime={formatTime} myId={myId} />
                        }
                        if (burst.length === 1 && first.type === 'poll' && first.poll_id) {
                          return first.hidden
                            ? <HiddenContentNotice key={first.id} reason={first.hidden_reason} isOwner={isMine} />
                            : <PollMessage key={first.id} pollId={first.poll_id} myId={myId} isStaff={isStaff} formatTime={formatTime} refreshToken={pollRefreshToken} />
                        }

                        return (
                          <MessageBurst
                            key={first.id}
                            burst={burst}
                            isMine={isMine}
                            senderLabel={senderLabel}
                            avatarUrl={avatarFor(first, isMine)}
                            myProfile={myProfile}
                            emojiForMsg={emojiForMsg}
                            onOpenProfile={openSenderProfile}
                            onContextMenu={(m, x, y) => { setCtxMsg(m); setCtxPos({ x, y }) }}
                            onDoubleClick={m => setReplyTo(m)}
                            onToggleEmojiPicker={id => setEmojiForMsg(emojiForMsg === id ? null : id)}
                            onAddReaction={addReaction}
                            myId={myId}
                            formatTime={formatTime}
                            readReceiptFor={readReceiptFor}
                            starredIds={myStarredIds}
                            isGroupChat={activeRoom.type === 'global'}
                          />
                        )
                      })
                    })()}
                  </>
                )}
                <div ref={msgEnd} />
              </div>

              {/* Typing indicator — WhatsApp-style, shown just above the composer */}
              {typingUserIds.size > 0 && (
                <div style={{ padding:'2px 16px 4px', fontSize:11.5, fontStyle:'italic', color:'var(--text-muted)', flexShrink:0 }}>
                  {activeRoom.type === 'dm'
                    ? `${roomLabel(activeRoom)} is typing…`
                    : (() => {
                        const names = [...typingUserIds]
                          .map(id => activeRoom.members.find(m => m.user_id === id))
                          .filter((m): m is RoomMember => !!m)
                          .map(m => m.profile.display_name || m.profile.username)
                        if (names.length === 0) return null
                        if (names.length === 1) return `${names[0]} is typing…`
                        if (names.length === 2) return `${names[0]} and ${names[1]} are typing…`
                        return `${names.length} people are typing…`
                      })()}
                </div>
              )}

              {/* Reply bar */}
              {replyTo && (
                <div style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 14px', background:'var(--surface2)', borderTop:'1px solid rgba(255,255,255,0.04)' }}>
                  <Reply size={14} style={{ color:'var(--accent)', flexShrink:0 }} />
                  <div style={{ flex:1, fontSize:12, color:'var(--text-dim)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    <span style={{ color:'var(--accent)', fontWeight:600 }}>Replying to {replyTo.sender_id === myId ? 'yourself' : (replyTo.senderName || 'Unknown')}: </span>{replyTo.content}
                  </div>
                  <button type="button" onClick={() => setReplyTo(null)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)' }}><X size={14} /></button>
                </div>
              )}

              {/* Pending rank tag — clears itself on send, mirrors the reply bar above */}
              {pendingRankTag && (() => {
                const g = RANK_GROUPS.find(rg => rg.id === pendingRankTag)!
                return (
                  <div style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 14px', background:'var(--surface2)', borderTop:'1px solid rgba(255,255,255,0.04)' }}>
                    <Megaphone size={14} style={{ color: g.color, flexShrink:0 }} />
                    <div style={{ flex:1, fontSize:12, color:'var(--text-dim)' }}>
                      <span style={{ color: g.color, fontWeight:700 }}>Tagging @{g.label}</span> — notifies everyone in that rank
                    </div>
                    <button type="button" onClick={() => setPendingRankTag(null)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)' }}><X size={14} /></button>
                  </div>
                )
              })()}

              {/* Block banner — replaces the composer entirely when either party has blocked the other in this DM */}
              {activeRoom.type === 'dm' && dmBlockState !== 'none' ? (
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:10, padding:'12px 16px', background:'rgba(255,107,107,0.08)', borderTop:'1px solid rgba(255,107,107,0.15)' }}>
                  <span style={{ fontSize:12.5, color:'#ff6b6b', fontWeight:600 }}>
                    {dmBlockState === 'blockedByMe' ? 'You blocked this user.' : "You can't reply to this conversation."}
                  </span>
                  {dmBlockState === 'blockedByMe' && (
                    <button type="button"
                      onClick={async () => {
                        const other = activeRoom.members.find(m => m.user_id !== myId)
                        if (!myId || !other) return
                        await supabase.from('blocks').delete().eq('blocker_id', myId).eq('blocked_id', other.user_id)
                        setDmBlockState('none')
                        handleBlockChange(other.user_id, false)
                      }}
                      style={{ fontSize:12, fontWeight:700, color:'#ff6b6b', background:'rgba(255,107,107,0.12)', border:'1px solid rgba(255,107,107,0.3)', borderRadius:10, padding:'6px 12px', cursor:'pointer', flexShrink:0 }}>
                      Unblock
                    </button>
                  )}
                </div>
              ) : (
                /* Input bar — text + emoji + send, or a voice-note recorder in place of the send button when idle */
                <div style={{ display:'flex', flexDirection:'column' }}>
                  {micError && (
                    <div style={{ padding:'6px 16px', fontSize:11.5, color:'#ff6b6b', background:'rgba(255,107,107,0.08)' }}>{micError}</div>
                  )}
                  {composerError && (
                    <div style={{ padding:'6px 16px', fontSize:11.5, color:'#ff6b6b', background:'rgba(255,107,107,0.08)' }}>{composerError}</div>
                  )}
                  <div style={{ display:'flex', alignItems:'flex-end', gap:8, padding:'10px 12px', background:'rgba(17,17,19,0.92)', backdropFilter:'blur(14px)', borderTop:'1px solid rgba(255,255,255,0.05)' }}>
                    {!isRecordingVoiceNote && (
                      <div style={{ position:'relative', flexShrink:0 }}>
                        <IBtn onClick={() => setComposerDrawerOpen(o => !o)} style={{ background: composerDrawerOpen ? 'var(--surface2)' : 'var(--surface)' }}>
                          {composerDrawerOpen ? <X size={15} /> : <Paperclip size={15} />}
                        </IBtn>
                        <div style={{
                          position:'absolute', left:0, bottom:'calc(100% + 8px)',
                          display:'flex', flexDirection:'column', alignItems:'center', gap:6, overflow:'hidden',
                          maxHeight: composerDrawerOpen ? 160 : 0,
                          opacity: composerDrawerOpen ? 1 : 0,
                          transform: composerDrawerOpen ? 'translateY(0)' : 'translateY(8px)',
                          pointerEvents: composerDrawerOpen ? 'auto' : 'none',
                          background: 'var(--surface2)',
                          border: '1px solid rgba(255,255,255,0.08)',
                          borderRadius:14,
                          padding: composerDrawerOpen ? '6px' : '0 6px',
                          boxShadow:'0 12px 40px rgba(0,0,0,0.5)',
                          transition:'max-height 0.28s ease, opacity 0.2s ease, transform 0.28s ease, padding 0.28s ease',
                          zIndex:50,
                        }}>
                          <IBtn onClick={() => setEmojiOpen(v => !v)} style={{ width:32, height:32 }}><Smile size={14} /></IBtn>
                          {isStaff && activeRoom.type === 'global' && (
                            <IBtn onClick={() => setRankTagPickerOpen(v => !v)} title="Tag a rank group" style={{ width:32, height:32 }}><Megaphone size={14} /></IBtn>
                          )}
                          {canCreatePoll && activeRoom.type === 'global' && (
                            <IBtn onClick={() => setPollModalOpen(true)} title="Create a poll" style={{ width:32, height:32 }}><BarChart3 size={14} /></IBtn>
                          )}
                        </div>
                      </div>
                    )}
                    {!isRecordingVoiceNote && (
                      <div style={{ flex:1, background:'var(--surface)', boxShadow:'inset 2px 2px 6px var(--neu-dark)', border:'1px solid rgba(255,255,255,0.05)', borderRadius:14, padding:'9px 12px', display:'flex', alignItems:'flex-end' }}>
                        <textarea rows={1} value={text} onChange={handleTextChange} onKeyDown={handleKey}
                          placeholder={isSlowModeCooling ? `Slow mode: wait ${slowModeCooldownRemaining}s…` : 'Type a message…'} maxLength={MAX_MESSAGE_LENGTH}
                          style={{ flex:1, background:'transparent', border:'none', outline:'none', color:'var(--text)', fontSize:13.5, resize:'none', maxHeight:80, overflowY:'auto', lineHeight:1.4, fontFamily:'inherit' }} />
                      </div>
                    )}
                    {isSlowModeCooling ? (
                      <button type="button" disabled title={`Slow mode: wait ${slowModeCooldownRemaining}s`}
                        style={{ width:40, height:40, borderRadius:11, flexShrink:0, border:'none', background:'var(--surface2)', color:'var(--text-dim)', cursor:'not-allowed', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11.5, fontWeight:700, opacity:0.75 }}>
                        {slowModeCooldownRemaining}s
                      </button>
                    ) : text.trim() ? (
                      <button type="button" onClick={sendMsg} disabled={!text.trim() || sending}
                        style={{ width:40, height:40, borderRadius:11, flexShrink:0, border:'none', background:'linear-gradient(135deg,var(--accent),var(--accent2))', boxShadow:'0 4px 14px rgba(255,107,0,0.35)', color:'#fff', cursor: !text.trim() || sending ? 'not-allowed' : 'pointer', display:'flex', alignItems:'center', justifyContent:'center', transition:'all 0.15s', opacity: !text.trim() || sending ? 0.6 : 1 }}>
                        <Send size={16} />
                      </button>
                    ) : myIsPro ? (
                      <VoiceNoteRecorderButton
                        onSend={sendVoiceNote}
                        onError={setMicError}
                        onRecordingChange={setIsRecordingVoiceNote}
                        disabled={sending}
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => navigate('/pro')}
                        title="Voice notes are a Chillverse Pro perk"
                        style={{ width:40, height:40, borderRadius:11, flexShrink:0, border:'1px solid rgba(255,255,255,0.08)', background:'var(--surface2)', color:'var(--text-dim)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}
                      >
                        <Lock size={15} />
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Emoji picker */}
              {emojiOpen && (
                <div style={{ position:'absolute', bottom:70, right:14, background:'var(--surface2)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:16, padding:12, display:'flex', flexWrap:'wrap', gap:4, boxShadow:'0 12px 40px rgba(0,0,0,0.5)', maxWidth:230, zIndex:50 }}>
                  {EMOJIS.map(em => (
                    <button key={em} type="button" onClick={() => { setText(t => t + em); setEmojiOpen(false) }} style={{ background:'none', border:'none', cursor:'pointer', fontSize:20, padding:3 }}>{em}</button>
                  ))}
                </div>
              )}

              {/* Rank tag picker — Staff/Moderator/Admin, Global Chat only */}
              {rankTagPickerOpen && (
                <div style={{ position:'absolute', bottom:70, right:14, background:'var(--surface2)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:16, padding:10, display:'flex', flexDirection:'column', gap:4, boxShadow:'0 12px 40px rgba(0,0,0,0.5)', minWidth:170, zIndex:50 }}>
                  <div style={{ fontSize:10.5, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:0.3, padding:'2px 6px 4px' }}>Tag a rank</div>
                  {RANK_GROUPS.map(g => (
                    <button key={g.id} type="button"
                      onClick={() => { setPendingRankTag(g.id); setRankTagPickerOpen(false) }}
                      style={{ display:'flex', alignItems:'center', gap:8, background:'none', border:'none', cursor:'pointer', padding:'6px 8px', borderRadius:8, textAlign:'left' }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface)' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'none' }}>
                      <span style={{ width:9, height:9, borderRadius:'50%', background:g.color, flexShrink:0 }} />
                      <span style={{ fontSize:13, fontWeight:600, color:'var(--text)' }}>{g.label}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Context menu — React / Reply / Block / Delete */}
              {ctxMsg && (
                <>
                  <div style={{ position:'fixed', inset:0, zIndex:90 }} onClick={() => setCtxMsg(null)} />
                  <div style={{ position:'fixed', left: Math.min(ctxPos.x, window.innerWidth - 175), top: Math.min(ctxPos.y, window.innerHeight - 180), zIndex:100, background:'var(--surface2)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:14, overflow:'hidden', boxShadow:'0 12px 40px rgba(0,0,0,0.5)', minWidth:165 }}>
                    {[
                      { icon: <Smile size={14} />, label:'React', action: () => { setEmojiForMsg(ctxMsg.id); setCtxMsg(null) } },
                      { icon: <Reply size={14} />, label:'Reply', action: () => { setReplyTo(ctxMsg); setCtxMsg(null) } },
                      ...(activeRoom?.type === 'dm' ? [{
                        icon: <Star size={14} fill={myStarredIds.has(ctxMsg.id) ? 'currentColor' : 'none'} />,
                        label: myStarredIds.has(ctxMsg.id) ? 'Unstar' : 'Star',
                        action: () => { toggleStar(ctxMsg.id); setCtxMsg(null) }
                      }] : []),
                      ...(!ctxMsg.deleted && (activeRoom?.type !== 'global' || isStaff) ? [
                        activeRoom?.pinnedMessageId === ctxMsg.id
                          ? { icon: <PinOff size={14} />, label:'Unpin', action: unpinMessage }
                          : { icon: <Pin size={14} />, label:'Pin', action: () => pinMessage(ctxMsg) }
                      ] : []),
                      ...(!ctxMsg.deleted && activeRoom?.type === 'global' && isStaff ? [
                        { icon: <Zap size={14} />, label:'Spotlight', action: () => { setSpotlightPickerFor(ctxMsg); setCtxMsg(null) } }
                      ] : []),
                      ...(ctxMsg.sender_id !== myId ? [{
                        icon: <UserPlus size={14} />,
                        label: 'View Profile',
                        action: () => { openSenderProfile(ctxMsg); setCtxMsg(null) }
                      }] : []),
                      ...(ctxMsg.sender_id !== myId ? [{
                        icon: <ShieldOff size={14} />,
                        label: 'Block',
                        action: async () => {
                          if (myId && ctxMsg.sender_id) {
                            await supabase.from('blocks').upsert({ blocker_id: myId, blocked_id: ctxMsg.sender_id })
                            handleBlockChange(ctxMsg.sender_id, true)
                          }
                          setCtxMsg(null)
                        }
                      }] : []),
                      ...(ctxMsg.sender_id !== myId ? [{
                        icon: <Flag size={14} />,
                        label: 'Report',
                        action: () => {
                          setReportTarget({ id: ctxMsg.id, senderName: ctxMsg.senderName || 'this user' })
                          setCtxMsg(null)
                        }
                      }] : []),
                      ...(ctxMsg.sender_id === myId ? [{ icon: <Trash2 size={14} />, label:'Delete', action: () => deleteMsg(ctxMsg.id) }] : []),
                    ].map(({ icon, label, action }) => (
                      <button key={label} type="button" onClick={action}
                        style={{ display:'flex', alignItems:'center', gap:10, padding:'11px 16px', width:'100%', background:'none', border:'none', cursor:'pointer', fontSize:13, color: label === 'Delete' || label === 'Block' || label === 'Report' ? '#ff6b6b' : 'var(--text-dim)' }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'none' }}>
                        {icon} {label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </>
          ) : (
            !isMobile && (
              <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:14 }}>
                <MessageCircle size={48} style={{ color:'var(--text-muted)' }} />
                <p style={{ fontSize:15, fontWeight:600, color:'var(--text-dim)' }}>Select a conversation</p>
                <p style={{ fontSize:13, color:'var(--text-muted)' }}>Choose from your chats on the left</p>
              </div>
            )
          )}
        </div>
      )}

      {/* Spotlight duration picker — opened from the Spotlight context-menu action above */}
      {spotlightPickerFor && (
        <>
          <div style={{ position:'fixed', inset:0, zIndex:90 }} onClick={() => { setSpotlightPickerFor(null); setSpotlightCustomMinutes('') }} />
          <div style={{ position:'fixed', left: Math.min(ctxPos.x, window.innerWidth - 210), top: Math.min(ctxPos.y, window.innerHeight - 220), zIndex:100, background:'var(--surface2)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:14, padding:10, boxShadow:'0 12px 40px rgba(0,0,0,0.5)', minWidth:195 }}>
            <div style={{ fontSize:10.5, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:0.3, padding:'2px 6px 6px' }}>Spotlight duration</div>
            {[{ label: '10 minutes', minutes: 10 }, { label: '1 hour', minutes: 60 }].map(p => (
              <button key={p.minutes} type="button"
                onClick={() => { spotlightMessage(spotlightPickerFor, p.minutes); setSpotlightPickerFor(null); setSpotlightCustomMinutes('') }}
                style={{ display:'block', width:'100%', textAlign:'left', background:'none', border:'none', borderRadius:8, padding:'8px 9px', fontSize:12.5, fontWeight:600, color:'var(--text)', cursor:'pointer' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'none' }}>
                {p.label}
              </button>
            ))}
            <div style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 9px 2px' }}>
              <input type="number" min={1} max={1440} value={spotlightCustomMinutes} onChange={e => setSpotlightCustomMinutes(e.target.value)}
                placeholder="Custom (min)"
                style={{ width:90, background:'var(--surface)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:7, padding:'6px 8px', fontSize:12, color:'var(--text)' }} />
              <button type="button"
                disabled={!spotlightCustomMinutes || Number(spotlightCustomMinutes) <= 0}
                onClick={() => {
                  const mins = Number(spotlightCustomMinutes)
                  if (mins > 0) { spotlightMessage(spotlightPickerFor, mins); setSpotlightPickerFor(null); setSpotlightCustomMinutes('') }
                }}
                style={{ padding:'6px 10px', borderRadius:7, border:'none', background:'var(--accent)', color:'#fff', fontSize:12, fontWeight:700, cursor: !spotlightCustomMinutes || Number(spotlightCustomMinutes) <= 0 ? 'default' : 'pointer', opacity: !spotlightCustomMinutes || Number(spotlightCustomMinutes) <= 0 ? 0.5 : 1 }}>
                Set
              </button>
            </div>
          </div>
        </>
      )}

      {/* Conversation-header 3-dot menu — Pin/Unpin chat, Clear chat, Block user. Same
          fixed/top-level pattern as the room-row menu above — the old version was nested
          inside the topbar's backdrop-filter container, which was the actual cause of it
          rendering behind other elements instead of floating cleanly on top. */}
      {convMenuOpen && activeRoom && (
        <>
          <div style={{ position:'fixed', inset:0, zIndex:190 }} onClick={() => setConvMenuOpen(false)} />
          <div style={{ position:'fixed', left: Math.min(convMenuPos.x - 180, window.innerWidth - 188), top: Math.min(convMenuPos.y, window.innerHeight - 140), zIndex:200, background:'var(--surface2)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:14, overflow:'hidden', boxShadow:'0 12px 40px rgba(0,0,0,0.5)', minWidth:180 }}>
            {[
              {
                icon: activeRoom.pinned ? <PinOff size={14} /> : <Pin size={14} />,
                label: activeRoom.pinned ? 'Unpin chat' : 'Pin chat',
                action: () => { togglePinChat(activeRoom.id); setConvMenuOpen(false) },
              },
              {
                icon: <Trash2 size={14} />,
                label: 'Clear chat',
                action: () => { clearChatForMe(activeRoom.id); setConvMenuOpen(false) },
                danger: true,
              },
              {
                icon: <ShieldOff size={14} />,
                label: 'Block user',
                action: async () => {
                  const other = activeRoom.members.find(m => m.user_id !== myId)
                  if (myId && other) {
                    await supabase.from('blocks').upsert({ blocker_id: myId, blocked_id: other.user_id })
                    handleBlockChange(other.user_id, true)
                    setDmBlockState('blockedByMe')
                  }
                  setConvMenuOpen(false)
                },
                danger: true,
              },
            ].map(({ icon, label, action, danger }) => (
              <button key={label} type="button" onClick={action}
                style={{ display:'flex', alignItems:'center', gap:10, padding:'11px 16px', width:'100%', background:'none', border:'none', cursor:'pointer', fontSize:13, color: danger ? '#ff6b6b' : 'var(--text-dim)' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'none' }}>
                {icon} {label}
              </button>
            ))}
          </div>
        </>
      )}

      {/* Room-row 3-dot menu — Pin / Delete chat. Rendered at the true top level (fixed,
          viewport-anchored) rather than nested inside the scrolling room list, so it can
          never get visually clipped or layered behind sibling rows the way an
          absolute-positioned nested menu can. Also lives outside showChat's block so it
          still works on mobile while only the room list (not a conversation) is showing. */}
      {roomMenuOpenFor && (() => {
        const menuRoom = rooms.find(r => r.id === roomMenuOpenFor)
        if (!menuRoom) return null
        return (
          <>
            <div style={{ position:'fixed', inset:0, zIndex:190 }} onClick={() => setRoomMenuOpenFor(null)} />
            <div style={{ position:'fixed', left: Math.min(roomMenuPos.x - 170, window.innerWidth - 178), top: Math.min(roomMenuPos.y, window.innerHeight - 100), zIndex:200, background:'var(--surface2)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:14, overflow:'hidden', boxShadow:'0 12px 40px rgba(0,0,0,0.5)', minWidth:170 }}>
              {[
                {
                  icon: menuRoom.pinned ? <PinOff size={14} /> : <Pin size={14} />,
                  label: menuRoom.pinned ? 'Unpin chat' : 'Pin chat',
                  action: () => { togglePinChat(menuRoom.id); setRoomMenuOpenFor(null) },
                },
                {
                  icon: <Trash2 size={14} />,
                  label: 'Delete chat',
                  action: () => { deleteChatForMe(menuRoom.id); setRoomMenuOpenFor(null) },
                  danger: true,
                },
              ].map(({ icon, label, action, danger }) => (
                <button key={label} type="button" onClick={() => action()}
                  style={{ display:'flex', alignItems:'center', gap:10, padding:'11px 16px', width:'100%', background:'none', border:'none', cursor:'pointer', fontSize:13, color: danger ? '#ff6b6b' : 'var(--text-dim)' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'none' }}>
                  {icon} {label}
                </button>
              ))}
            </div>
          </>
        )
      })()}

      {/* Player profile modal */}
      {viewProfile && (
        <PlayerProfileModal
          profile={viewProfile}
          myId={myId}
          onClose={() => setViewProfile(null)}
          onStartChat={startDmWith}
          onBlockChange={(userId, blocked) => {
            handleBlockChange(userId, blocked)
            if (activeRoom?.type === 'dm' && activeRoom.members.some(m => m.user_id === userId)) {
              setDmBlockState(blocked ? 'blockedByMe' : 'none')
            }
          }}
        />
      )}

      {/* DM options modal — delete chat */}
      {dmOptionsOpen && activeRoom && activeRoom.type === 'dm' && (
        <>
          <div style={{ position:'fixed', inset:0, zIndex:200, background:'rgba(0,0,0,0.5)', backdropFilter:'blur(3px)' }} onClick={() => setDmOptionsOpen(false)} />
          <div style={{ position:'fixed', top:'50%', left:'50%', transform:'translate(-50%,-50%)', zIndex:201, background:'var(--surface2)', border:'1px solid rgba(255,255,255,0.09)', borderRadius:18, padding:'20px 20px 16px', width: Math.min(260, window.innerWidth - 32), boxShadow:'0 20px 60px rgba(0,0,0,0.7)' }}>
            <button type="button" onClick={() => setDmOptionsOpen(false)} style={{ position:'absolute', top:12, right:12, background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)' }}>
              <X size={15} />
            </button>
            <p style={{ fontSize:14, fontWeight:700, color:'var(--text)', marginBottom:14 }}>Chat options</p>
            <button type="button"
              onClick={() => {
                if (!activeRoom) return
                deleteChatForMe(activeRoom.id)
                setDmOptionsOpen(false)
              }}
              style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', width:'100%', borderRadius:11, border:'none', background:'rgba(255,107,107,0.1)', color:'#ff6b6b', fontSize:13, fontWeight:600, cursor:'pointer' }}>
              <Trash2 size={14} /> Delete Chat
            </button>
          </div>
        </>
      )}

      {reportTarget && myId && (
        <ReportModal
          reporterId={myId}
          targetType="message"
          targetId={reportTarget.id}
          targetLabel={`message from ${reportTarget.senderName}`}
          onClose={() => setReportTarget(null)}
        />
      )}

      {activeRoom && (
        <PollComposerModal
          open={pollModalOpen}
          onClose={() => setPollModalOpen(false)}
          roomId={activeRoom.id}
          maxDurationHours={isStaff ? 168 : 48}
          onCreated={() => { scrollModeRef.current = 'bottom' }}
        />
      )}

      <StarredMessagesPanel
        open={starredPanelOpen}
        onClose={() => setStarredPanelOpen(false)}
        myId={myId}
        roomId={activeRoom?.type === 'dm' ? activeRoom.id : null}
        roomLabel={activeRoom ? roomLabel(activeRoom) : ''}
      />

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes skeletonPulse { 0%, 100% { opacity: 0.35; } 50% { opacity: 0.7; } }
        .msg-react-trigger { opacity: 0; }
        @media (hover: hover) {
          .msg-bubble-col:hover .msg-react-trigger { opacity: 1; }
        }
      `}</style>
    </div>
  )
}
