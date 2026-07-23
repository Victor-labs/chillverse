// src/components/EditProfileModal.tsx
import { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import type React from 'react'
import {
  X, Check, ImageIcon, ChevronDown, Lock, Heart,
  UserRound, Sunrise, Moon, Circle, EyeOff,
} from 'lucide-react'
import { supabase } from '../../shared/lib/supabase'
import { ripple } from '../../shared/lib/ripple'
import { GAMES } from '../games/games'
import { updateMissionProgress } from '../missions/weeklyMissions'
import type { Profile } from '../../shared/types'

// ── Types ─────────────────────────────────────────────────────
// (AlbumPic type removed along with BannerPicker — banners are equipped
// from Inventory now, not here.)

export type InfoTagKey = 'gender' | 'play_time' | 'country' | 'presence'

// brief says "max 15 words" for the bio — keep the limit centralized so
// it's one source of truth if it ever needs tuning.
const BIO_WORD_LIMIT = 15

const PRESENCE_META: Record<string, { label: string; color: string; Icon: typeof Circle }> = {
  online:    { label: 'Online',    color: '#3ecf8e', Icon: Circle },
  idle:      { label: 'Idle',      color: '#f5c542', Icon: Moon },
  offline:   { label: 'Offline',   color: '#888899', Icon: Circle },
  invisible: { label: 'Invisible', color: '#555566', Icon: EyeOff },
}

const GENDER_OPTIONS = [
  { id: 'male',   label: 'Male' },
  { id: 'female', label: 'Female' },
  { id: 'other',  label: 'Other' },
]

const PLAY_TIME_OPTIONS = [
  { id: 'morning', label: 'Morning', Icon: Sunrise },
  { id: 'night',   label: 'Night',   Icon: Moon },
] as const

const INFO_TAG_META: Record<InfoTagKey, { label: string }> = {
  gender:    { label: 'Gender' },
  play_time: { label: 'Preferred Time' },
  country:   { label: 'Country' },
  presence:  { label: 'Status' },
}

function countWords(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length
}

function truncateToWords(s: string, max: number): string {
  const words = s.trim().split(/\s+/).filter(Boolean)
  if (words.length <= max) return s
  return words.slice(0, max).join(' ')
}

// ── Section heading ───────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 10, marginTop: 26 }}>
      {children}
    </p>
  )
}

// ── Banner picker ─────────────────────────────────────────────
// REMOVED: banners are equipped automatically from Inventory (equipping
// an owned album pic sets profiles.banner_url directly — see
// features/economy/Inventory.tsx). This picker was a redundant, dead-end
// duplicate of that flow, so it no longer renders in Edit Profile. Kept
// here commented out only as a historical reference, not exported/used.
/*
function BannerPicker({
  albumPics, selected, onSelect,
}: {
  albumPics: AlbumPic[]
  selected: string | null
  onSelect: (url: string | null) => void
}) {
  const locked = albumPics.length === 0

  if (locked) {
    return (
      <div>
        <SectionLabel>Banner</SectionLabel>
        <div style={{ height: 110, borderRadius: 16, background: 'var(--surface)', border: '1px dashed rgba(255,255,255,0.12)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <Lock size={20} style={{ color: 'var(--text-muted)' }} />
          <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '0 24px' }}>
            Unlock album pics to set a banner
          </p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <SectionLabel>Banner — choose an album pic</SectionLabel>
      <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
        <button type="button" onClick={() => onSelect(null)}
          style={{ flexShrink: 0, width: 96, height: 64, borderRadius: 12, border: selected === null ? '2px solid var(--accent)' : '1px solid rgba(255,255,255,0.1)', background: 'var(--surface)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 10, fontWeight: 700 }}>
          None
        </button>
        {albumPics.map(pic => (
          <button key={pic.id} type="button" onClick={() => onSelect(pic.imageUrl)}
            style={{ flexShrink: 0, width: 96, height: 64, borderRadius: 12, overflow: 'hidden', border: selected === pic.imageUrl ? '2px solid var(--accent)' : '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', padding: 0, position: 'relative' }}>
            <img src={pic.imageUrl} alt={pic.label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            {selected === pic.imageUrl && (
              <div style={{ position: 'absolute', top: 4, right: 4, width: 18, height: 18, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Check size={11} color="#fff" />
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
*/

// ── Info tag picker (pick up to 2, Likes always shown separately) ──
function InfoTagsPicker({
  selected, onToggle, gender, playTime, country, presence,
}: {
  selected: InfoTagKey[]
  onToggle: (key: InfoTagKey) => void
  gender: string
  playTime: string | null
  country: string | null
  presence: string
}) {
  const previewFor = (key: InfoTagKey): string => {
    if (key === 'gender') return GENDER_OPTIONS.find(g => g.id === gender)?.label ?? 'Not set'
    if (key === 'play_time') return PLAY_TIME_OPTIONS.find(p => p.id === playTime)?.label ?? 'Not set'
    if (key === 'country') return country || 'Not set'
    if (key === 'presence') return PRESENCE_META[presence]?.label ?? 'Offline'
    return ''
  }

  return (
    <div>
      <SectionLabel>Info tags — pick up to 2 (Likes is always shown)</SectionLabel>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 12, background: 'rgba(255,77,139,0.08)', border: '1px solid rgba(255,77,139,0.2)', marginBottom: 10, width: 'fit-content' }}>
        <Heart size={13} color="#ff4d8b" style={{ fill: '#ff4d8b' }} />
        <span style={{ fontSize: 12, fontWeight: 700, color: '#ff4d8b' }}>Likes</span>
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>· locked</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {(Object.keys(INFO_TAG_META) as InfoTagKey[]).map(key => {
          const isSelected = selected.includes(key)
          const disabled = !isSelected && selected.length >= 2
          return (
            <button key={key} type="button" disabled={disabled} onClick={() => onToggle(key)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderRadius: 14, border: isSelected ? '1px solid var(--accent)' : '1px solid rgba(255,255,255,0.07)', background: isSelected ? 'color-mix(in srgb, var(--accent) 8%, transparent)' : 'var(--surface)', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.45 : 1, textAlign: 'left' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{INFO_TAG_META[key].label}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{previewFor(key)}</div>
              </div>
              <div style={{ width: 20, height: 20, borderRadius: 6, border: isSelected ? 'none' : '1.5px solid rgba(255,255,255,0.15)', background: isSelected ? 'var(--accent)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {isSelected && <Check size={12} color="#fff" />}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Gender + play time sub-pickers (only shown if tag is selected) ──
function GenderPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ marginTop: 12 }}>
      <label style={{ display: 'block', fontSize: 11, color: 'var(--text-dim)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 8 }}>Gender</label>
      <div style={{ display: 'flex', gap: 8 }}>
        {GENDER_OPTIONS.map(opt => (
          <button key={opt.id} type="button" onClick={() => onChange(opt.id)}
            style={{ flex: 1, padding: '10px 4px', borderRadius: 12, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, background: value === opt.id ? 'var(--accent)' : 'var(--surface)', color: value === opt.id ? '#fff' : 'var(--text-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <UserRound size={13} /> {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function PlayTimePicker({ value, onChange }: { value: string | null; onChange: (v: string) => void }) {
  return (
    <div style={{ marginTop: 12 }}>
      <label style={{ display: 'block', fontSize: 11, color: 'var(--text-dim)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 8 }}>Preferred Time to Play</label>
      <div style={{ display: 'flex', gap: 8 }}>
        {PLAY_TIME_OPTIONS.map(opt => {
          const Icon = opt.Icon
          return (
            <button key={opt.id} type="button" onClick={() => onChange(opt.id)}
              style={{ flex: 1, padding: '10px 4px', borderRadius: 12, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, background: value === opt.id ? 'var(--accent)' : 'var(--surface)', color: value === opt.id ? '#fff' : 'var(--text-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <Icon size={14} /> {opt.label}
            </button>
          )
        })}
      </div>
      <p style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 6 }}>Only the icon shows on your profile.</p>
    </div>
  )
}

// ── Favorite game dropdown ────────────────────────────────────
function FavoriteGameDropdown({ value, onChange }: { value: string | null; onChange: (v: string | null) => void }) {
  const [open, setOpen] = useState(false)
  const current = GAMES.find(g => g.dbKey === value)

  return (
    <div style={{ position: 'relative' }}>
      <SectionLabel>Game you love playing</SectionLabel>
      <button type="button" onClick={() => setOpen(o => !o)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderRadius: 14, border: '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer', boxSizing: 'border-box' }}>
        {current ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: `${current.accent}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <current.icon size={14} style={{ color: current.accent }} />
            </div>
            <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>{current.name}</span>
          </div>
        ) : (
          <span style={{ fontSize: 13.5, color: 'var(--text-muted)' }}>Select a game…</span>
        )}
        <ChevronDown size={15} style={{ color: 'var(--text-muted)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
      </button>
      {open && (
        <div style={{ marginTop: 6, borderRadius: 14, border: '1px solid var(--border)', background: 'var(--surface2)', overflow: 'hidden', maxHeight: 280, overflowY: 'auto' }}>
          {value && (
            <button type="button" onClick={() => { onChange(null); setOpen(false) }}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', background: 'none', border: 'none', borderBottom: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 12.5, textAlign: 'left' }}>
              <X size={13} /> Clear selection
            </button>
          )}
          {GAMES.map(g => (
            <button key={g.dbKey} type="button" onClick={() => { onChange(g.dbKey); setOpen(false) }}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', background: value === g.dbKey ? 'color-mix(in srgb, var(--accent) 8%, transparent)' : 'none', border: 'none', borderBottom: '1px solid var(--border)', cursor: 'pointer', textAlign: 'left' }}>
              <div style={{ width: 26, height: 26, borderRadius: 7, background: `${g.accent}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <g.icon size={13} style={{ color: g.accent }} />
              </div>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{g.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Grid advert card picker ────────────────────────────────────
const OPTIONAL_GRID_CARDS = [
  { id: 'achievements', label: 'Achievements' },
  { id: 'rank',         label: 'Rank' },
  { id: 'leaderboard',  label: 'Leaderboard Position' },
]

function GridCardsPicker({ selected, onToggle }: { selected: string[]; onToggle: (id: string) => void }) {
  return (
    <div>
      <SectionLabel>Profile cards — pick up to 3</SectionLabel>
      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10, marginTop: -4 }}>
        Wishlist, Followers/Following, and Current XP always show and can't be removed.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {OPTIONAL_GRID_CARDS.map(card => {
          const isSelected = selected.includes(card.id)
          const disabled = !isSelected && selected.length >= 3
          return (
            <button key={card.id} type="button" disabled={disabled} onClick={() => onToggle(card.id)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderRadius: 14, border: isSelected ? '1px solid var(--accent)' : '1px solid rgba(255,255,255,0.07)', background: isSelected ? 'color-mix(in srgb, var(--accent) 8%, transparent)' : 'var(--surface)', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.45 : 1, textAlign: 'left' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{card.label}</span>
              <div style={{ width: 20, height: 20, borderRadius: 6, border: isSelected ? 'none' : '1.5px solid rgba(255,255,255,0.15)', background: isSelected ? 'var(--accent)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {isSelected && <Check size={12} color="#fff" />}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Wishlist editor ────────────────────────────────────────────
interface WishlistItem { id: string; item_name: string; item_type: string; item_image: string | null }
const WISHLIST_MAX = 10

function WishlistEditor({ profileId }: { profileId: string }) {
  const [items, setItems] = useState<WishlistItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('wishlist').select('id, item_name, item_type, item_image').eq('user_id', profileId).order('added_at', { ascending: false })
      .then(({ data }) => { setItems((data ?? []) as WishlistItem[]); setLoading(false) })
  }, [profileId])

  async function removeItem(id: string) {
    await supabase.from('wishlist').delete().eq('id', id)
    setItems(prev => prev.filter(i => i.id !== id))
  }

  return (
    <div>
      <SectionLabel>Wishlist ({items.length}/{WISHLIST_MAX})</SectionLabel>
      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10, marginTop: -4 }}>
        Always shown on your profile. Add items from the Mall — remove them here.
      </p>
      {loading ? (
        <div style={{ padding: '20px 0', textAlign: 'center' }}>
          <span style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid var(--surface3)', borderTopColor: 'var(--accent)', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />
        </div>
      ) : items.length === 0 ? (
        <div style={{ padding: '20px 0', textAlign: 'center', background: 'var(--surface)', borderRadius: 14, border: '1px dashed rgba(255,255,255,0.1)' }}>
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Your wishlist is empty</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {items.map(item => (
            <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <div style={{ width: 36, height: 36, borderRadius: 9, background: 'var(--surface2)', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {item.item_image ? <img src={item.item_image} alt={item.item_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <ImageIcon size={14} style={{ color: 'var(--text-muted)' }} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.item_name}</div>
              </div>
              <button type="button" onClick={() => removeItem(item.id)}
                style={{ width: 26, height: 26, borderRadius: 8, background: 'rgba(255,100,100,0.1)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ff6b6b', flexShrink: 0 }}>
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Discard confirmation ───────────────────────────────────────
function DiscardConfirm({ onDiscard, onKeepEditing }: { onDiscard: () => void; onKeepEditing: () => void }) {
  return (
    <div onClick={e => e.stopPropagation()} style={{ position: 'fixed', inset: 0, zIndex: 20002, background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 320, background: 'var(--surface2)', borderRadius: 22, border: '1px solid var(--border)', boxShadow: 'var(--elev-popover)', padding: '24px 22px', textAlign: 'center' }}>
        <p style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', marginBottom: 8 }}>Unsaved changes</p>
        <p style={{ fontSize: 12.5, color: 'var(--text-dim)', lineHeight: 1.6, marginBottom: 20 }}>
          You're leaving this page with unsaved changes.
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={onDiscard}
            style={{ flex: 1, padding: 12, borderRadius: 12, border: '1px solid rgba(255,100,100,0.25)', cursor: 'pointer', background: 'rgba(255,100,100,0.08)', color: '#ff6b6b', fontSize: 13, fontWeight: 700 }}>
            Discard
          </button>
          <button type="button" onClick={onKeepEditing} className="btn-primary"
            style={{ flex: 1, padding: 12, fontSize: 13 }}>
            Save Changes
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main modal ──────────────────────────────────────────────────
export interface EditProfileSavedFields {
  display_name: string | null
  bio: string | null
  banner_url: string | null
  info_tags: string[]
  gender: string | null
  play_time: 'morning' | 'night' | null
  favorite_game: string | null
  grid_cards: string[]
}

interface EditProfileModalProps {
  profile: Profile
  bannerUrl: string | null
  presence: string
  onClose: () => void
  onSaved: (updates: EditProfileSavedFields) => void
  onToast: (msg: string) => void
}

export default function EditProfileModal({
  profile, bannerUrl, presence, onClose, onSaved, onToast,
}: EditProfileModalProps) {
  const [visible, setVisible] = useState(false)
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // ── Editable state, seeded from current profile ──
  const [displayName, setDisplayName] = useState(profile.display_name || profile.username)
  const [bio, setBio] = useState(profile.bio || '')
  // Banner is no longer editable here (equipped via Inventory instead), so this
  // is just a pass-through constant, not state — avoids an unused setter.
  const banner = bannerUrl
  const [infoTags, setInfoTags] = useState<InfoTagKey[]>((profile.info_tags ?? []) as InfoTagKey[])
  const [gender, setGender] = useState(profile.gender || '')
  const [playTime, setPlayTime] = useState<string | null>(profile.play_time || null)
  const [favoriteGame, setFavoriteGame] = useState<string | null>(profile.favorite_game || null)
  const [gridCards, setGridCards] = useState<string[]>(profile.grid_cards ?? [])

  const initialSnapshot = useMemo(() => JSON.stringify({
    displayName: profile.display_name || profile.username,
    bio: profile.bio || '',
    banner: bannerUrl,
    infoTags: profile.info_tags ?? [],
    gender: profile.gender || '',
    playTime: profile.play_time || null,
    favoriteGame: profile.favorite_game || null,
    gridCards: profile.grid_cards ?? [],
  }), [profile, bannerUrl])

  const currentSnapshot = JSON.stringify({ displayName, bio, banner, infoTags, gender, playTime, favoriteGame, gridCards })
  const isDirty = currentSnapshot !== initialSnapshot

  useEffect(() => { requestAnimationFrame(() => setVisible(true)) }, [])

  function requestClose() {
    if (isDirty) { setShowDiscardConfirm(true); return }
    animateOutThenClose()
  }

  function animateOutThenClose() {
    setVisible(false)
    setTimeout(onClose, 280)
  }

  function toggleInfoTag(key: InfoTagKey) {
    setInfoTags(prev => {
      if (prev.includes(key)) return prev.filter(k => k !== key)
      if (prev.length >= 2) return prev
      return [...prev, key]
    })
  }

  function toggleGridCard(id: string) {
    setGridCards(prev => {
      if (prev.includes(id)) return prev.filter(c => c !== id)
      if (prev.length >= 3) return prev
      return [...prev, id]
    })
  }

  async function save() {
    if (saving) return
    setSaving(true)
    setError('')

    const { error: err } = await supabase.from('profiles').update({
      display_name: displayName.trim() || profile.username,
      bio: bio.trim() || null,
      banner_url: banner,
      info_tags: infoTags,
      gender: gender || null,
      play_time: playTime,
      favorite_game: favoriteGame,
      grid_cards: gridCards,
    }).eq('id', profile.id)

    setSaving(false)
    if (err) { setError(err.message); return }

    // Weekly missions
    const trimmedName = displayName.trim() || profile.username
    const trimmedBio = bio.trim()
    if (trimmedName !== (profile.display_name || profile.username)) {
      updateMissionProgress(profile.id, 'display_name_changed', 1).catch(console.error)
    }
    if (trimmedBio && !(profile.bio || '').trim()) {
      updateMissionProgress(profile.id, 'bio_added', 1).catch(console.error)
    }
    if (trimmedBio && gender && playTime && favoriteGame) {
      updateMissionProgress(profile.id, 'profile_complete', 1, true).catch(console.error)
    }

    onSaved({
      display_name: displayName.trim() || profile.username,
      bio: bio.trim() || null,
      banner_url: banner,
      info_tags: infoTags,
      gender: gender || null,
      play_time: playTime as 'morning' | 'night' | null,
      favorite_game: favoriteGame,
      grid_cards: gridCards,
    })
    onToast('Profile updated')
    animateOutThenClose()
  }

  const wordCount = countWords(bio)

  // Render straight to document.body — bypasses the app shell entirely so
  // this is guaranteed to sit above everything and fill the real viewport,
  // regardless of any transform/transition on an ancestor (sidebar
  // collapse animations etc. can otherwise break position:fixed here).
  return createPortal(
    <>
      <div
        onClick={e => e.stopPropagation()}
        style={{
        position: 'fixed', inset: 0, zIndex: 20001, background: 'var(--bg)',
        transform: visible ? 'translateY(0)' : 'translateY(100%)',
        transition: 'transform 0.32s cubic-bezier(0.34,1.0,0.64,1)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* ── Header ── */}
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px', borderBottom: '1px solid var(--border)', background: 'var(--bg)' }}>
          <button type="button" onClick={requestClose}
            style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--surface)', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={16} />
          </button>
          <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>Edit Profile</span>
          <div style={{ width: 34 }} />
        </div>

        {/* ── Scrollable body ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '6px 18px 28px' }}>

          {/* Username (locked) */}
          <SectionLabel>Username</SectionLabel>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <span style={{ fontSize: 13.5, color: 'var(--text-dim)' }}>@{profile.username}</span>
            <Lock size={13} style={{ color: 'var(--text-muted)' }} />
          </div>

          {/* Display name */}
          <SectionLabel>Display Name</SectionLabel>
          <input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)} maxLength={30}
            style={{ width: '100%', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '12px 14px', color: 'var(--text)', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />

          {/* Bio */}
          <SectionLabel>Bio</SectionLabel>
          <textarea value={bio} onChange={e => setBio(truncateToWords(e.target.value, BIO_WORD_LIMIT))} rows={2} placeholder="Say something about yourself…"
            style={{ width: '100%', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '12px 14px', color: 'var(--text)', fontSize: 13.5, outline: 'none', boxSizing: 'border-box', resize: 'none', fontFamily: 'inherit' }} />
          <p style={{ fontSize: 10.5, color: wordCount >= BIO_WORD_LIMIT ? 'var(--accent)' : 'var(--text-muted)', marginTop: 5, textAlign: 'right' }}>
            {wordCount}/{BIO_WORD_LIMIT} words
          </p>

          {/* Info tags */}
          <InfoTagsPicker
            selected={infoTags} onToggle={toggleInfoTag}
            gender={gender} playTime={playTime} country={profile.country} presence={presence}
          />
          {infoTags.includes('gender') && <GenderPicker value={gender} onChange={setGender} />}
          {infoTags.includes('play_time') && <PlayTimePicker value={playTime} onChange={setPlayTime} />}
          {infoTags.includes('country') && (
            <p style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 10 }}>
              Country is set from your account details: <strong style={{ color: 'var(--text-dim)' }}>{profile.country || 'Not set'}</strong>
            </p>
          )}
          {infoTags.includes('presence') && (
            <p style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 10 }}>
              Status comes from your presence setting: <strong style={{ color: PRESENCE_META[presence]?.color }}>{PRESENCE_META[presence]?.label ?? 'Offline'}</strong>. Change it in Settings → Preferences.
            </p>
          )}

          {/* Favorite game */}
          <FavoriteGameDropdown value={favoriteGame} onChange={setFavoriteGame} />

          {/* Grid advert cards */}
          <GridCardsPicker selected={gridCards} onToggle={toggleGridCard} />

          {/* Wishlist */}
          <WishlistEditor profileId={profile.id} />

          {error && <p style={{ fontSize: 12, color: '#ff6b6b', marginTop: 16 }}>{error}</p>}
        </div>

        {/* ── Footer save bar ── */}
        <div style={{ flexShrink: 0, padding: '14px 18px', borderTop: '1px solid var(--border)', background: 'var(--bg)' }}>
          <button type="button" onClick={(e) => { ripple(e); save() }} disabled={saving} className="btn-primary"
            style={{ width: '100%', padding: 14, borderRadius: 14, fontSize: 14, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: saving ? 0.7 : 1 }}>
            {saving ? <span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} /> : <><Check size={14} /> Save Changes</>}
          </button>
        </div>
      </div>

      {showDiscardConfirm && (
        <DiscardConfirm
          onDiscard={() => { setShowDiscardConfirm(false); animateOutThenClose() }}
          onKeepEditing={() => { setShowDiscardConfirm(false); save() }}
        />
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>,
    document.body
  )
}
