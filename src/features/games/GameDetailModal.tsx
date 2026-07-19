// src/features/games/GameDetailModal.tsx
//
// Discord-style "activity" detail sheet. Tapping a game card opens this
// instead of jumping straight into the game.
//
// Phone AND tablet: a bottom sheet that slides up and covers almost the
// full screen (not literally edge-to-edge — it has rounded top corners
// and a sliver of backdrop above it), same as the rest of the app's
// sheets (see ProfilePreviewModal). This is keyed off touch/pointer type,
// NOT just viewport width — a tablet's width alone can be wide enough to
// look "desktop-sized" while still being a touch device, which used to
// wrongly push it into the desktop layout below.
//
// Real desktop (mouse/trackpad, i.e. `pointer: fine`, above a width
// floor): a centered dialog card that does NOT cover the full screen.
//
// Back arrow (top-left) closes it. "…" (top-right) opens Copy Game ID /
// Favorite. Favoriting pins the card to the top of its section on the
// lobby and adds a star badge to it.
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  ArrowLeft, MoreVertical, Copy, Check, Star, Play, Lock, Zap, Crown, Users, Tag, Flame,
} from 'lucide-react'
import { ripple } from '../../shared/lib/ripple'
import { getRankConfig, RankProgressBar } from './play/GameShell'
import type { GameMeta } from './games'
import type { GameRank } from './play/types'

interface Props {
  game: GameMeta
  rank: GameRank
  streak: number
  bestStreak: number
  isFavorite: boolean
  onToggleFavorite: () => void
  locked: boolean
  lockedReason: string | null
  onPlay: () => void
  onClose: () => void
}

// Sheet height on phone/tablet — a percentage of the viewport, so it
// always "almost covers" the screen proportionally rather than either
// looking cramped or reading as a flat full-page swap.
const SHEET_HEIGHT_VH = 92

function computeIsDesktop(): boolean {
  if (typeof window === 'undefined') return false
  const pointerFine = window.matchMedia ? window.matchMedia('(pointer: fine)').matches : true
  // Fine pointer (mouse/trackpad) AND enough width — a touch tablet can
  // easily be wider than this, but won't have a fine pointer, so it
  // still correctly falls through to the sheet layout below.
  return pointerFine && window.innerWidth >= 820
}

export default function GameDetailModal({
  game, rank, streak, bestStreak, isFavorite, onToggleFavorite, locked, lockedReason, onPlay, onClose,
}: Props) {
  const Icon = game.icon
  const cost = game.sessionCost ?? 1
  const rankCfg = getRankConfig(rank)

  const [isDesktop, setIsDesktop] = useState(computeIsDesktop)
  const [entered, setEntered] = useState(false)
  const [closing, setClosing] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [idCopied, setIdCopied] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onResize() { setIsDesktop(computeIsDesktop()) }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    const t = requestAnimationFrame(() => setEntered(true))
    document.body.style.overflow = 'hidden'
    return () => { cancelAnimationFrame(t); document.body.style.overflow = '' }
  }, [])

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  function close() {
    setClosing(true)
    setTimeout(onClose, 220)
  }

  function handleCopyId() {
    navigator.clipboard?.writeText(game.id).catch(() => {})
    setIdCopied(true)
    setTimeout(() => { setIdCopied(false); setMenuOpen(false) }, 900)
  }

  const hasBanner = !!game.bannerUrl
  const description = game.description ?? game.tagline

  // ── Layout, split by device class ──────────────────────────────
  const sheetStyle: React.CSSProperties = isDesktop
    ? {
        width: 'min(92vw, 460px)',
        height: 'auto',
        maxHeight: '85vh',
        borderRadius: 20,
        transform: entered && !closing ? 'scale(1)' : 'scale(0.94)',
        opacity: entered && !closing ? 1 : 0,
        transition: 'transform 0.24s cubic-bezier(0.32,0.72,0,1), opacity 0.2s ease-out',
        boxShadow: 'var(--elev-popover)',
      }
    : {
        width: '100%',
        height: `${SHEET_HEIGHT_VH}vh`,
        maxHeight: `${SHEET_HEIGHT_VH}vh`,
        borderRadius: '20px 20px 0 0',
        marginTop: 'auto',
        transform: entered && !closing ? 'translateY(0)' : 'translateY(100%)',
        transition: 'transform 0.32s cubic-bezier(0.32,0.72,0,1)',
        boxShadow: '0 -12px 40px -12px var(--sh)',
      }

  return createPortal(
    <div
      onClick={close}
      style={{
        position: 'fixed', inset: 0, zIndex: 21000,
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: isDesktop ? 'center' : 'flex-end', justifyContent: 'center',
        opacity: entered && !closing ? 1 : 0, transition: 'opacity 0.2s ease-out',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          ...sheetStyle,
          background: 'var(--bg)',
          overflowY: 'auto', overscrollBehavior: 'contain',
          position: 'relative',
        }}
      >
        {!isDesktop && (
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.22)', margin: '10px auto 0' }} />
        )}

        {/* Icon strip — accent-tinted, holds the small game icon like the
            app icon above a Discord activity banner. */}
        <div style={{
          position: 'relative', height: 64,
          background: `linear-gradient(135deg, ${game.accent}55, ${game.accent}22)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginTop: isDesktop ? 0 : 4,
        }}>
          <div style={{
            width: 52, height: 52, borderRadius: 16, background: 'var(--bg)',
            border: `1px solid ${game.accent}55`, boxShadow: `0 4px 16px ${game.accent}40`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon size={24} style={{ color: game.accent }} />
          </div>

          <button
            type="button" onClick={close}
            style={{ position: 'absolute', top: 10, left: 10, width: 30, height: 30, borderRadius: 9, background: 'rgba(0,0,0,0.32)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
          >
            <ArrowLeft size={15} color="#fff" />
          </button>

          <div ref={menuRef} style={{ position: 'absolute', top: 10, right: 10, zIndex: 2 }}>
            <button
              type="button" onClick={() => setMenuOpen(v => !v)}
              style={{ width: 30, height: 30, borderRadius: 9, background: 'rgba(0,0,0,0.32)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
            >
              <MoreVertical size={15} color="#fff" />
            </button>
            {menuOpen && (
              <div style={{
                position: 'absolute', top: 36, right: 0, minWidth: 200, background: 'var(--surface2)',
                border: '1px solid var(--border)', borderRadius: 14, padding: 6,
                boxShadow: 'var(--elev-raise)',
              }}>
                <MenuItem
                  icon={idCopied ? <Check size={14} /> : <Copy size={14} />}
                  label={idCopied ? 'Copied!' : 'Copy Game ID'}
                  onClick={handleCopyId}
                />
                <MenuItem
                  icon={<Star size={14} style={{ color: isFavorite ? '#f5c542' : undefined }} fill={isFavorite ? '#f5c542' : 'none'} />}
                  label={isFavorite ? 'Remove from Favorites' : 'Add to Favorites'}
                  onClick={() => { onToggleFavorite(); setMenuOpen(false) }}
                />
              </div>
            )}
          </div>
        </div>

        {/* Banner — real image if we have one, otherwise the game's own
            icon blown up on an accent gradient so it's never blank. */}
        <div style={{
          position: 'relative', height: isDesktop ? 180 : 200,
          background: hasBanner ? '#000' : `linear-gradient(135deg, ${game.accent}33, ${game.accent}0d)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
        }}>
          {hasBanner ? (
            <img src={game.bannerUrl} alt={game.name} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center' }} />
          ) : (
            <Icon size={64} style={{ color: game.accent, opacity: 0.7 }} />
          )}
        </div>

        <div style={{ padding: '18px 20px 26px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <h2 style={{ fontSize: 19, fontWeight: 800, color: 'var(--text)' }}>{game.name}</h2>
            {isFavorite && <Star size={15} style={{ color: '#f5c542' }} fill="#f5c542" />}
            {game.requiresPro && <Crown size={14} style={{ color: '#9b6dff' }} />}
          </div>

          {/* Category / players — quick-glance info row, Discord-style */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12, flexWrap: 'wrap' }}>
            {game.players && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text-dim)' }}>
                <Users size={12} /> {game.players}
              </span>
            )}
            {game.category && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text-dim)' }}>
                <Tag size={12} /> {game.category}
              </span>
            )}
          </div>

          {/* About */}
          <p style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.55, marginBottom: 16 }}>{description}</p>

          {/* Info chips */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
            <span className="chip">{game.unlimitedPlays ? '∞ Unlimited plays' : '7 plays / day'}</span>
            {cost > 1 && (
              <span className="chip" style={{ color: game.accent }}>
                <Zap size={10} style={{ marginRight: 2, verticalAlign: -1 }} /> {cost} sessions
              </span>
            )}
            {game.requiresPro && <span className="chip" style={{ color: '#9b6dff' }}>Pro only</span>}
          </div>

          {/* Rank + personal best */}
          <div style={{ marginBottom: 10 }}>
            <RankProgressBar rank={rank} streak={streak} streakRequired={rankCfg.streakRequired} />
          </div>
          {bestStreak > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16 }}>
              <Flame size={12} style={{ color: 'var(--accent2)' }} />
              <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Best streak: <strong style={{ color: 'var(--text-dim)' }}>{bestStreak}</strong></span>
            </div>
          )}

          {locked && lockedReason && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(155,109,255,0.08)', border: '1px solid rgba(155,109,255,0.25)', borderRadius: 12, padding: '10px 12px', marginBottom: 14 }}>
              <Lock size={14} style={{ color: '#9b6dff', flexShrink: 0 }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: '#9b6dff' }}>{lockedReason}</span>
            </div>
          )}

          <button
            type="button"
            className="ripple-wrap"
            onClick={(e) => { if (locked) return; ripple(e); onPlay() }}
            disabled={locked}
            style={{
              width: '100%', padding: '13px 16px', borderRadius: 14, border: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              fontSize: 14, fontWeight: 800, cursor: locked ? 'not-allowed' : 'pointer',
              background: locked ? 'var(--surface2)' : `linear-gradient(135deg, ${game.accent}, ${game.accent}cc)`,
              color: locked ? 'var(--text-muted)' : '#fff',
              boxShadow: locked ? 'none' : `0 6px 20px ${game.accent}40`,
            }}
          >
            {locked ? <Lock size={15} /> : <Play size={15} fill="#fff" />}
            {locked ? 'Locked' : 'Play'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

function MenuItem({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button" onClick={onClick}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 9, padding: '9px 10px', borderRadius: 9,
        background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
        fontSize: 12.5, fontWeight: 600, color: 'var(--text)',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface3)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'none')}
    >
      {icon}
      {label}
    </button>
  )
}
