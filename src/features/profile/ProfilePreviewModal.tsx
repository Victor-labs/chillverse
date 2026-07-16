// src/features/profile/ProfilePreviewModal.tsx
//
// The "quick profile" card that pops up when you tap someone's avatar
// anywhere in the app (feed, chat, search, comments, etc). Mirrors
// Discord's profile popover: a small preview with the essentials and a
// 3-dot menu, plus a way to jump to the full profile page.
//
// A Discord-style bottom sheet at every screen size — phone AND tablet.
// It slides up and stays pinned to the bottom of the viewport until you
// tap the dimmed backdrop, hit Escape, or tap the close button; it never
// floats as a centered popover. It has a tall minimum height so it rises
// well up the screen even for a sparse profile, and only grows past that
// (up to a max, then scrolls internally) when there's a lot of content.
// On wider viewports the sheet narrows into a centered card shape, but
// stays bottom-anchored the whole time. Locks page scroll while open.
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import {
  X, MoreVertical, UserPlus, UserCheck, MessageCircle, ShieldOff, Copy, Flag, Check, Phone,
} from 'lucide-react'
import { supabase } from '../../shared/lib/supabase'
import { useAuth } from '../auth/useAuth'
import { ripple } from '../../shared/lib/ripple'
import Avatar from '../../shared/components/Avatar'
import { getUserRankTier } from './ranks'
import { usePlayerBadges } from '../badges/usePlayerBadges'
import { BadgeIcon } from '../badges/badgeIcons'
import { BADGE_RARITY_COLOR, BADGE_RARITY_RANK, badgeDisplayTitle, type BadgeDef } from '../badges/badges'
import BadgeToast from '../badges/BadgeToast'
import { AchIcon, RARITY_COLOR as ACH_RARITY_COLOR } from '../achievements/Achievements'
import AchievementMiniToast from '../achievements/AchievementMiniToast'
import { getGameById } from '../games/games'
import ReportModal from '../safety/ReportModal'
import { useCall } from '../chat/calling/CallContext'
import { MOD_AVATAR_URL } from '../moderation/modShowcase'

// ── Sheet height — its own dedicated setting ────────────────────────────
// This is the ONE number that controls how tall the profile preview sheet
// is, on every device. It's a percentage of the screen, so it always
// looks the same proportionally whether someone's zoomed in or out — it's
// not reacting to zoom as a side effect, it's just deliberately set here.
// Turn this number up or down to make the sheet taller or shorter; nothing
// else in this file needs to change.
const SHEET_HEIGHT_VH = 85

type Presence = 'online' | 'idle' | 'offline' | 'invisible'
const PRESENCE_COLORS: Record<Presence, string> = {
  online: '#3ecf8e', idle: '#f5c542', offline: '#888899', invisible: '#555566',
}

interface PreviewProfile {
  id: string
  username: string
  display_name: string | null
  avatar: string
  bio: string | null
  xp: number
  created_at: string
  presence: Presence | null
  is_pro: boolean
  original_username: string
  staff_member_since: string | null
  banner_url: string | null
}

const BADGE_PREVIEW_COUNT = 6

// Lower is better — rarest achievements shown first, mirrors the same
// pattern used for badges and on the full profile page.
const ACH_RARITY_RANK: Record<string, number> = { legendary: 0, epic: 1, rare: 2, common: 3 }
const BEST_ACHIEVEMENTS_COUNT = 3

interface PreviewAchievement {
  id: string
  title: string
  icon: string
  rarity: string
}

interface LiveActivity {
  movie: boolean
  game: string | null
  exploring: boolean
}

export default function ProfilePreviewModal({ userId, onClose }: { userId: string; onClose: () => void }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [profile, setProfile] = useState<PreviewProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [followStatus, setFollowStatus] = useState<'none' | 'following' | 'blocked'>('none')
  const [busy, setBusy] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [usernameCopied, setUsernameCopied] = useState(false)
  const [callStarting, setCallStarting] = useState(false)
  const { startCall, phase } = useCall()
  // This no longer decides "sheet vs popover" — it ONLY decides how wide/
  // narrow the sheet is. Every width is a bottom sheet, same as Discord's
  // phone AND tablet apps; on a wide viewport the sheet is just narrower
  // and card-shaped, it doesn't jump to floating in the vertical center.
  const [isWide, setIsWide] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 640)
  const [closing, setClosing] = useState(false)
  const [entered, setEntered] = useState(false)
  const [isModerator, setIsModerator] = useState(false)
  const [badgeToast, setBadgeToast] = useState<BadgeDef | null>(null)
  const [bestAchievements, setBestAchievements] = useState<PreviewAchievement[]>([])
  const [achToast, setAchToast] = useState<PreviewAchievement | null>(null)
  const [activity, setActivity] = useState<LiveActivity>({ movie: false, game: null, exploring: false })
  const menuRef = useRef<HTMLDivElement>(null)

  const isMe = user?.id === userId

  useEffect(() => {
    const raf = requestAnimationFrame(() => setEntered(true))
    return () => cancelAnimationFrame(raf)
  }, [])

  // Track viewport so the exact same modal switches between a bottom
  // sheet (mobile) and a centered card (desktop) without a page reload.
  useEffect(() => {
    function onResize() { setIsWide(window.innerWidth >= 640) }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Lock the page behind the modal — Discord's popover never lets the
  // page scroll while it's open, only the modal's own content scrolls.
  useEffect(() => {
    const prevOverflow = document.body.style.overflow
    const prevPaddingRight = document.body.style.paddingRight
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth
    document.body.style.overflow = 'hidden'
    if (scrollbarWidth > 0) document.body.style.paddingRight = `${scrollbarWidth}px`
    return () => {
      document.body.style.overflow = prevOverflow
      document.body.style.paddingRight = prevPaddingRight
    }
  }, [])

  // Escape closes it, same as Discord.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    let active = true
    setLoading(true)
    supabase.from('profiles').select('*').eq('id', userId).single().then(({ data }) => {
      if (!active) return
      setProfile((data as PreviewProfile | null) ?? null)
      setLoading(false)
    })
    supabase.from('user_moderation').select('role').eq('user_id', userId).maybeSingle().then(({ data }) => {
      if (active) setIsModerator(data?.role === 'moderator')
    })
    return () => { active = false }
  }, [userId])

  useEffect(() => {
    if (!user || isMe) return
    let active = true
    Promise.all([
      supabase.from('follows').select('follower_id').eq('follower_id', user.id).eq('following_id', userId).maybeSingle(),
      supabase.from('blocks').select('id').eq('blocker_id', user.id).eq('blocked_id', userId).maybeSingle(),
    ]).then(([followRes, blockRes]) => {
      if (!active) return
      if (blockRes.data) setFollowStatus('blocked')
      else if (followRes.data) setFollowStatus('following')
      else setFollowStatus('none')
    })
    return () => { active = false }
  }, [user, userId, isMe])

  const { badges, defs } = usePlayerBadges(userId)

  // Best 3 achievements (rarest first, mirrors PlayerProfile.tsx) — the
  // preview only has room to show a highlight reel, not the full case.
  useEffect(() => {
    let active = true
    supabase.from('player_achievements').select('achievement_id, unlocked_at, achievements(title, icon, rarity)')
      .eq('user_id', userId)
      .then(({ data }) => {
        if (!active) return
        const rows = (data ?? []) as unknown as { achievement_id: string; unlocked_at: string; achievements: { title: string; icon: string; rarity: string } | null }[]
        const best = [...rows]
          .sort((a, b) => {
            const rA = ACH_RARITY_RANK[a.achievements?.rarity ?? 'common'] ?? 3
            const rB = ACH_RARITY_RANK[b.achievements?.rarity ?? 'common'] ?? 3
            if (rA !== rB) return rA - rB
            return new Date(b.unlocked_at).getTime() - new Date(a.unlocked_at).getTime()
          })
          .slice(0, BEST_ACHIEVEMENTS_COUNT)
        setBestAchievements(best.map(r => ({
          id: r.achievement_id,
          title: r.achievements?.title ?? 'Achievement',
          icon: r.achievements?.icon ?? 'trophy',
          rarity: r.achievements?.rarity ?? 'common',
        })))
      })
    return () => { active = false }
  }, [userId])

  // Live activity ticker — subscribes to the viewed user's presence
  // channel so "watching a movie" / "playing a game" / "exploring"
  // shows up (and disappears) instantly, same as PlayerProfile.tsx.
  useEffect(() => {
    const channel = supabase.channel(`user-activity:${userId}`, {
      config: { presence: { key: userId } },
    })

    function syncActivity() {
      const state = channel.presenceState<{ activity: string; game?: string }>()
      const entries = Object.values(state).flat()
      const movieEntry = entries.find(e => e.activity === 'watching_movie')
      const gameEntry = entries.find(e => e.activity === 'playing' && e.game)
      const exploreEntry = entries.find(e => e.activity === 'exploring')
      setActivity({ movie: !!movieEntry, game: gameEntry?.game ?? null, exploring: !!exploreEntry })
    }

    channel
      .on('presence', { event: 'sync' }, syncActivity)
      .on('presence', { event: 'join' }, syncActivity)
      .on('presence', { event: 'leave' }, syncActivity)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [userId])

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    if (menuOpen) document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [menuOpen])

  function close() {
    setClosing(true)
    setTimeout(onClose, 200)
  }

  async function handleFollow() {
    if (!user || busy || followStatus === 'blocked') return
    setBusy(true)
    if (followStatus === 'following') {
      await supabase.from('follows').delete().eq('follower_id', user.id).eq('following_id', userId)
      setFollowStatus('none')
    } else {
      await supabase.from('follows').insert({ follower_id: user.id, following_id: userId })
      setFollowStatus('following')
    }
    setBusy(false)
  }

  async function handleBlock() {
    if (!user || busy) return
    setBusy(true)
    if (followStatus === 'blocked') {
      await supabase.from('blocks').delete().eq('blocker_id', user.id).eq('blocked_id', userId)
      setFollowStatus('none')
    } else {
      await supabase.from('blocks').insert({ blocker_id: user.id, blocked_id: userId })
      setFollowStatus('blocked')
    }
    setBusy(false)
    setMenuOpen(false)
  }

  function handleCopyUsername() {
    if (!profile) return
    navigator.clipboard.writeText(`@${profile.username}`).then(() => {
      setUsernameCopied(true)
      setTimeout(() => { setUsernameCopied(false); setMenuOpen(false) }, 1000)
    }).catch(() => setMenuOpen(false))
  }

  function viewFullProfile() {
    close()
    navigate(isMe ? '/profile' : `/profile/${userId}`)
  }

  function goToChat() {
    close()
    navigate('/chat', { state: { openDmWith: userId } })
  }

  async function handleCall() {
    if (!profile || callStarting || phase !== 'idle') return
    setCallStarting(true)
    try {
      const { data: roomId, error } = await supabase.rpc('get_or_create_dm_room', { p_other_user_id: userId })
      if (error || !roomId) { setCallStarting(false); return }
      await startCall(roomId as string, {
        id: profile.id, username: profile.username, display_name: profile.display_name, avatar: profile.avatar,
      }, 'audio')
      close()
    } finally {
      setCallStarting(false)
    }
  }

  const displayName = profile?.display_name || profile?.username || '…'
  const rank = profile ? getUserRankTier(profile.xp) : null
  const presence: Presence = (profile?.presence as Presence) || 'offline'
  const memberSince = profile
    ? new Date((isModerator ? profile.staff_member_since : null) ?? profile.created_at)
      .toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
    : ''

  const ownedBadges = [...badges]
    .map(b => defs.find(d => d.id === b.badge_id))
    .filter((d): d is NonNullable<typeof d> => !!d)
    .sort((a, b) => (BADGE_RARITY_RANK[a.rarity] ?? 9) - (BADGE_RARITY_RANK[b.rarity] ?? 9))
    .slice(0, BADGE_PREVIEW_COUNT)

  // ALWAYS a bottom sheet — phone and tablet alike, no separate centered
  // "desktop popover" mode. It slides up from the bottom and stays pinned
  // there until dismissed.
  //
  // Height: minHeight keeps it rising well up the screen even for a
  // sparse profile (this is what was missing before — it was hugging
  // short content and sitting low). maxHeight is the only thing content
  // can push past, and only then does the body start scrolling.
  //
  // Width: full-bleed edge-to-edge on phones; on wider viewports (tablet
  // and up) it narrows into a centered card shape, but it's still bottom-
  // anchored the whole time — it never jumps to floating in the middle.
  // A FIXED height per breakpoint now, not a min/max range — this is the
  // one thing that was still wrong. However stacked a profile is, the
  // sheet stops at this exact point and its own body scrolls past it;
  // it never grows taller, and it never sits shorter for a sparse profile.
  const sheetHeight = `${SHEET_HEIGHT_VH}vh`
  const sheetBase: React.CSSProperties = {
    width: isWide ? 'min(92vw, 460px)' : '100%',
    height: sheetHeight,
    borderRadius: '20px 20px 0 0',
    marginTop: 'auto',
    transform: entered && !closing ? 'translateY(0)' : 'translateY(100%)',
    transition: 'transform 0.32s cubic-bezier(0.32,0.72,0,1)',
  }

  return createPortal(
    <div
      onClick={close}
      style={{
        position: 'fixed', inset: 0, zIndex: 20000,
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        opacity: entered && !closing ? 1 : 0, transition: 'opacity 0.2s ease-out',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          ...sheetBase,
          background: 'var(--bg)', overflowY: 'auto', overscrollBehavior: 'contain', position: 'relative',
          boxShadow: '0 -8px 40px rgba(0,0,0,0.5)',
        }}
      >
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.22)', margin: '10px auto 0' }} />

        {/* Banner */}
        <div style={{ position: 'relative', height: 74, background: profile?.banner_url ? 'transparent' : 'linear-gradient(120deg, var(--accent), var(--accent2))', overflow: 'hidden' }}>
          {profile?.banner_url && (
            <img src={profile.banner_url} alt="banner" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center' }} />
          )}
        </div>

        {/* Close + menu buttons live outside the banner's overflow:hidden
            box now, so the dropdown floats over the card instead of being
            clipped/"sunk" into the banner. */}
        <button
          type="button" onClick={close}
          className="pv-btn"
          style={{ position: 'absolute', top: 10, right: 46, width: 30, height: 30, borderRadius: 9, background: 'rgba(0,0,0,0.28)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 2 }}
        >
          <X size={15} color="#fff" />
        </button>
        <div ref={menuRef} style={{ position: 'absolute', top: 10, right: 10, zIndex: 2 }}>
          <button
            type="button" onClick={() => setMenuOpen(v => !v)}
            className="pv-btn"
            style={{ width: 30, height: 30, borderRadius: 9, background: 'rgba(0,0,0,0.28)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
          >
            <MoreVertical size={15} color="#fff" />
          </button>
          {menuOpen && (
            <div style={{
              position: 'absolute', top: 36, right: 0, minWidth: 190, background: 'var(--surface2)',
              border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 6,
              boxShadow: '0 10px 32px rgba(0,0,0,0.5)', zIndex: 1,
            }}>
              <MenuItem icon={<UserCheck size={14} />} label="View full profile" onClick={() => { setMenuOpen(false); viewFullProfile() }} />
              {!isMe && (
                <MenuItem
                  icon={<ShieldOff size={14} />}
                  label={followStatus === 'blocked' ? 'Unblock user' : 'Block user'}
                  danger
                  onClick={handleBlock}
                />
              )}
              <MenuItem icon={usernameCopied ? <Check size={14} /> : <Copy size={14} />} label={usernameCopied ? 'Copied!' : 'Copy username'} onClick={handleCopyUsername} />
              {!isMe && (
                <MenuItem icon={<Flag size={14} />} label="Report" danger onClick={() => { setMenuOpen(false); setReportOpen(true) }} />
              )}
            </div>
          )}
        </div>

        <div style={{ padding: '0 18px 20px' }}>
          {/* Avatar overlapping the banner */}
          <div style={{ marginTop: -34, marginBottom: 8 }}>
            <div style={{ position: 'relative', width: 68, height: 68 }}>
              <Avatar
                src={isModerator ? MOD_AVATAR_URL : profile?.avatar} name={displayName} size={68} radius={20}
                ring="var(--bg)" disabled
              />
              <div style={{
                position: 'absolute', bottom: -2, right: -2, width: 16, height: 16, borderRadius: '50%',
                background: PRESENCE_COLORS[presence], border: '3px solid var(--bg)',
              }} />
            </div>
          </div>

          {loading ? (
            <div style={{ paddingTop: 2 }}>
              <div className="pv-skel" style={{ height: 19, width: '52%', borderRadius: 6, marginBottom: 8 }} />
              <div className="pv-skel" style={{ height: 12, width: '32%', borderRadius: 5, marginBottom: 16 }} />
              <div className="pv-skel" style={{ height: 64, width: '100%', borderRadius: 12 }} />
            </div>
          ) : !profile ? (
            <p style={{ fontSize: 12.5, color: 'var(--text-dim)', padding: '20px 0' }}>This profile couldn't be loaded.</p>
          ) : (
            <>
              <p style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6 }}>
                {displayName}
              </p>
              <p style={{ fontSize: 12.5, color: 'var(--text-dim)', marginTop: 1 }}>@{profile.username}</p>

              {!isModerator && rank && (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 8, padding: '3px 9px', borderRadius: 20, background: rank.color + '18', border: `1px solid ${rank.color}44` }}>
                  <span>{rank.emoji}</span>
                  <span style={{ fontSize: 10.5, fontWeight: 700, color: rank.color }}>{rank.name}</span>
                </div>
              )}

              <div className="pv-panel" style={{ marginTop: 12, background: 'var(--surface)', borderRadius: 12, padding: '2px 12px' }}>
                {profile.bio && (
                  <div className="pv-section">
                    <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 }}>About Me</p>
                    <p style={{ fontSize: 12.5, color: 'var(--text-dim)', lineHeight: 1.5 }}>{profile.bio}</p>
                  </div>
                )}

                <div className="pv-section">
                  <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 }}>Member Since</p>
                  <p style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)' }}>{memberSince}</p>
                </div>

                {!isModerator && ownedBadges.length > 0 && (
                  <div className="pv-section">
                    <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 }}>Badges</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {ownedBadges.map(def => {
                        const color = BADGE_RARITY_COLOR[def.rarity] ?? '#888899'
                        return (
                          <button
                            key={def.id}
                            type="button"
                            className="pv-btn"
                            onClick={() => setBadgeToast(def)}
                            title={badgeDisplayTitle(def, profile.original_username)}
                            style={{ width: 34, height: 34, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: color + '1c', border: `1px solid ${color}33`, cursor: 'pointer', padding: 0 }}
                          >
                            <BadgeIcon iconKey={def.icon} size={16} color={color} />
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {!isModerator && bestAchievements.length > 0 && (
                  <div className="pv-section">
                    <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 }}>Achievements</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {bestAchievements.map(a => {
                        const color = ACH_RARITY_COLOR[a.rarity] ?? '#888899'
                        return (
                          <button
                            key={a.id}
                            type="button"
                            className="pv-btn"
                            onClick={() => setAchToast(a)}
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px 3px 6px', borderRadius: 20,
                              background: color + '18', border: `1px solid ${color}44`, cursor: 'pointer',
                            }}
                          >
                            <AchIcon iconKey={a.icon} size={10} color={color} />
                            <span style={{ fontSize: 10.5, fontWeight: 700, color }}>{a.title}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>

              {activity.movie && (
                <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 12, background: 'rgba(255,107,0,0.1)', border: '1px solid rgba(255,107,0,0.28)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#ff6b00', boxShadow: '0 0 8px #ff6b00', animation: 'pulse 1.5s ease-in-out infinite', flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: 'var(--text)', fontWeight: 600 }}>🎬 Watching movies</span>
                </div>
              )}

              {activity.game && (() => {
                const gameMeta = getGameById(activity.game as string)
                const GameIcon = gameMeta?.icon
                return (
                  <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 12, background: 'rgba(79,142,247,0.1)', border: '1px solid rgba(79,142,247,0.25)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#4f8ef7', boxShadow: '0 0 8px #4f8ef7', animation: 'pulse 1.5s ease-in-out infinite', flexShrink: 0 }} />
                    {GameIcon && <GameIcon size={13} style={{ color: '#4f8ef7', flexShrink: 0 }} />}
                    <span style={{ fontSize: 12, color: 'var(--text)', fontWeight: 600 }}>
                      Playing <strong style={{ color: '#4f8ef7' }}>{gameMeta?.name ?? activity.game}</strong>
                    </span>
                  </div>
                )
              })()}

              {activity.exploring && (
                <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 12, background: 'rgba(62,207,142,0.1)', border: '1px solid rgba(62,207,142,0.28)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#3ecf8e', boxShadow: '0 0 8px #3ecf8e', animation: 'pulse 1.5s ease-in-out infinite', flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: 'var(--text)', fontWeight: 600 }}>⛵️ Exploring</span>
                </div>
              )}

              {!isModerator && !isMe && (
                <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                  <button
                    type="button" onClick={(e) => { ripple(e); handleFollow() }} disabled={busy || followStatus === 'blocked'}
                    className="ripple-wrap pv-btn"
                    style={{
                      flex: 1, padding: '11px 8px', borderRadius: 13, fontSize: 12.5, fontWeight: 700,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, border: 'none',
                      cursor: followStatus === 'blocked' ? 'not-allowed' : 'pointer',
                      background: followStatus === 'following' ? 'rgba(62,207,142,0.15)' : 'linear-gradient(135deg,var(--accent),var(--accent2))',
                      color: followStatus === 'following' ? '#3ecf8e' : '#fff',
                      opacity: followStatus === 'blocked' ? 0.4 : 1,
                    }}
                  >
                    {followStatus === 'following' ? <UserCheck size={14} /> : <UserPlus size={14} />}
                    {followStatus === 'following' ? 'Following' : 'Add Friend'}
                  </button>
                  <button
                    type="button" onClick={(e) => { ripple(e); goToChat() }}
                    className="ripple-wrap pv-btn"
                    style={{ padding: '11px 14px', borderRadius: 13, border: 'none', background: 'var(--surface2)', color: 'var(--text)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <MessageCircle size={16} />
                  </button>
                  <button
                    type="button" onClick={(e) => { ripple(e); handleCall() }} disabled={callStarting || phase !== 'idle'}
                    className="ripple-wrap pv-btn"
                    title={phase !== 'idle' ? 'Already on a call' : `Call ${displayName}`}
                    style={{ padding: '11px 14px', borderRadius: 13, border: 'none', background: 'var(--surface2)', color: (callStarting || phase !== 'idle') ? 'var(--text-muted)' : 'var(--text)', cursor: (callStarting || phase !== 'idle') ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: (callStarting || phase !== 'idle') ? 0.5 : 1 }}
                  >
                    <Phone size={16} />
                  </button>
                </div>
              )}

              <button
                type="button" onClick={viewFullProfile}
                className="pv-btn"
                style={{ width: '100%', marginTop: 10, padding: '10px 8px', borderRadius: 13, fontSize: 12, fontWeight: 700, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'var(--text-dim)', cursor: 'pointer' }}
              >
                View full profile
              </button>
            </>
          )}
        </div>
      </div>

      {reportOpen && user && profile && (
        <ReportModal
          reporterId={user.id}
          targetType="user"
          targetId={profile.id}
          targetLabel={displayName}
          onClose={() => setReportOpen(false)}
        />
      )}

      {badgeToast && profile && (
        <BadgeToast
          title={badgeDisplayTitle(badgeToast, profile.original_username)}
          icon={badgeToast.icon}
          rarity={badgeToast.rarity}
          onDone={() => setBadgeToast(null)}
        />
      )}

      {achToast && (
        <AchievementMiniToast
          title={achToast.title}
          icon={achToast.icon}
          rarity={achToast.rarity}
          onDone={() => setAchToast(null)}
        />
      )}

      <style>{`
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }

        /* Sections stack naturally inside one panel, separated by a
           hairline instead of each being its own floating card. */
        .pv-panel .pv-section { padding: 12px 0; }
        .pv-panel .pv-section:first-child { padding-top: 10px; }
        .pv-panel .pv-section:last-child { padding-bottom: 10px; }
        .pv-panel .pv-section + .pv-section { border-top: 1px solid rgba(255,255,255,0.06); }

        /* Subtle hover/press feedback on every interactive element. */
        .pv-btn { transition: transform 0.12s ease, filter 0.12s ease, opacity 0.12s ease; }
        .pv-btn:hover:not(:disabled) { filter: brightness(1.1); }
        .pv-btn:active:not(:disabled) { transform: scale(0.96); }

        @keyframes pvShimmer { 0% { background-position: 100% 50%; } 100% { background-position: 0 50%; } }
        .pv-skel { background: linear-gradient(90deg, var(--surface) 25%, var(--surface2) 37%, var(--surface) 63%); background-size: 400% 100%; animation: pvShimmer 1.4s ease infinite; }
      `}</style>
    </div>,
    document.body,
  )
}

function MenuItem({ icon, label, onClick, danger }: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      type="button" onClick={onClick}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 9, padding: '9px 10px', borderRadius: 9,
        background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
        fontSize: 12.5, fontWeight: 600, color: danger ? '#ff6b6b' : 'var(--text)',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface3)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'none')}
    >
      {icon}
      {label}
    </button>
  )
}
