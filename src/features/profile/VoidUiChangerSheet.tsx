// src/features/profile/VoidUiChangerSheet.tsx
//
// "Void UI changer 👽" — picks the whole-page skin for this profile.
// Opened from the row at the very top of Edit Profile (Void tier only).
//
// Previews are TRUE previews, in the same spirit as the app theme picker
// in features/settings/AppTheme.tsx: each card is a miniature profile
// rendered from that skin's own tokens, so what you see is what lands on
// your page. Nothing here is an approximate gradient chip.
//
// Saves immediately on Apply (matching VoidProfileEdit.tsx) rather than
// riding along with Edit Profile's footer save — the choice is a single
// value with a visible, instant result, so deferring it would just make
// the preview lie until the sheet is dismissed.
import { useState, useEffect } from 'react'
import type React from 'react'
import { createPortal } from 'react-dom'
import { X, Check, Loader2 } from 'lucide-react'
import { supabase } from '../../shared/lib/supabase'
import { ripple } from '../../shared/lib/ripple'
import {
  PROFILE_SKINS, getProfileSkin, profileSkinStyle, profileSkinOverlayStyle, profileSkinAttr,
  type ProfileSkinId,
} from '../../shared/lib/profileSkins'
import ProfileSkinStyles from './ProfileSkinStyles'

interface VoidUiChangerSheetProps {
  displayName: string
  current: ProfileSkinId | null
  onClose: () => void
  onSaved: (skin: ProfileSkinId | null) => void
  onToast: (msg: string) => void
}

/** Miniature profile page rendered entirely from a skin's own tokens. */
function SkinPreview({ skin, name }: { skin: ProfileSkinId | null; name: string }) {
  const overlay = profileSkinOverlayStyle(skin)

  return (
    <div
      aria-hidden
      data-cv-skin={profileSkinAttr(skin)}
      style={{
        ...profileSkinStyle(skin, 'var(--bg)'),
        backgroundAttachment: 'scroll',
        position: 'relative',
        height: 150, borderRadius: 12, overflow: 'hidden',
      }}
    >
      {overlay && <div style={overlay} />}

      {/* Banner */}
      <div style={{ height: 34, background: 'linear-gradient(120deg, var(--accent), var(--accent2))' }} />

      <div style={{ padding: '0 12px', marginTop: -13, position: 'relative', zIndex: 1 }}>
        {/* Avatar + name */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
          <div style={{
            width: 26, height: 26, borderRadius: 'var(--radius-sm)', background: 'var(--surface3)',
            border: '2px solid var(--bg)', flexShrink: 0,
          }} />
          <div style={{ paddingBottom: 2 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text)', lineHeight: 1.1 }}>{name}</div>
            <div style={{ fontSize: 7.5, color: 'var(--text-muted)' }}>Level 24 · 1.2k XP</div>
          </div>
        </div>

        {/* Stat cards — these carry the skin's surface texture */}
        <div style={{ display: 'flex', gap: 6, marginTop: 9 }}>
          {['128', '64', '31'].map((v, i) => (
            <div key={i} style={{
              flex: 1, borderRadius: 'var(--radius-sm)', padding: '6px 4px', textAlign: 'center',
              background: 'var(--surface)', border: '1px solid var(--border)',
            }}>
              <div style={{ fontSize: 9, fontWeight: 800, color: 'var(--text)' }}>{v}</div>
            </div>
          ))}
        </div>

        {/* A real .btn-primary, so the button treatment is honest */}
        <div style={{ display: 'flex', gap: 6, marginTop: 8, alignItems: 'center' }}>
          <div className="btn-primary" style={{
            flex: 1, padding: '6px 0', textAlign: 'center', fontSize: 8,
            fontWeight: 800, borderRadius: 'var(--radius-sm)',
          }}>
            Follow
          </div>
          <div style={{
            width: 46, padding: '6px 0', textAlign: 'center', fontSize: 8,
            fontWeight: 700, color: 'var(--text)', borderRadius: 'var(--radius-sm)',
            background: 'var(--surface2)', border: '1px solid var(--border-strong)',
          }}>
            Share
          </div>
        </div>
      </div>
    </div>
  )
}

function SkinCard({
  skin, label, blurb, name, selected, busy, onSelect,
}: {
  skin: ProfileSkinId | null
  label: string
  blurb: string
  name: string
  selected: boolean
  busy: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={(e: React.MouseEvent<HTMLButtonElement>) => { ripple(e); onSelect() }}
      style={{
        width: '100%', textAlign: 'left', padding: 10, marginBottom: 12,
        borderRadius: 18, cursor: 'pointer', background: 'var(--surface)',
        border: selected ? '1px solid rgba(155,109,255,0.65)' : '1px solid var(--border)',
        boxShadow: selected ? '0 0 0 3px rgba(155,109,255,0.14)' : 'none',
        transition: 'border-color var(--dur-base) var(--ease-out), box-shadow var(--dur-base) var(--ease-out)',
      }}
    >
      <SkinPreview skin={skin} name={name} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 10, padding: '0 2px 2px' }}>
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--text)' }}>{label}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.4 }}>{blurb}</div>
        </div>
        {(selected || busy) && (
          <div style={{
            width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
            background: 'rgba(155,109,255,0.16)', border: '1px solid rgba(155,109,255,0.55)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {busy
              ? <Loader2 size={12} strokeWidth={3} style={{ color: '#9b6dff', animation: 'cv-skin-spin 0.8s linear infinite' }} />
              : <Check size={12} strokeWidth={3} style={{ color: '#9b6dff' }} />}
          </div>
        )}
      </div>
    </button>
  )
}

export default function VoidUiChangerSheet({
  displayName, current, onClose, onSaved, onToast,
}: VoidUiChangerSheetProps) {
  const [visible, setVisible] = useState(false)
  const [choice, setChoice] = useState<ProfileSkinId | null>(current)
  const [saving, setSaving] = useState(false)

  useEffect(() => { requestAnimationFrame(() => setVisible(true)) }, [])

  function animateOutThenClose() {
    setVisible(false)
    setTimeout(onClose, 280)
  }

  // Applies on tap, like the app theme picker — there is no separate save
  // step. The previous build hid the write behind an Apply button, which
  // read as "nothing happened": tapping a card only moved a local
  // highlight, and Edit Profile's own Save button doesn't touch this
  // column, so closing the sheet silently discarded the pick.
  //
  // Optimistic: the highlight moves immediately, then reverts if the
  // write fails, so the UI never claims a state the database doesn't have.
  async function pick(next: ProfileSkinId | null) {
    if (saving || next === choice) return
    const previous = choice
    setChoice(next)
    setSaving(true)
    // Goes through an RPC, not a direct update: `authenticated` has a
    // deliberate column-level UPDATE allow-list on profiles and
    // profile_ui_skin is not on it, so a direct write fails with 42501.
    // The function also enforces the Void tier server-side, which the
    // client-side gate on its own never did.
    const { error } = await supabase.rpc('set_profile_ui_skin', { p_skin: next })
    setSaving(false)
    if (error) {
      setChoice(previous)
      onToast(error.message)
      return
    }
    onSaved(next)
    onToast(next ? `${getProfileSkin(next)?.label} applied` : 'Reset to default')
  }

  return createPortal(
    <div
      onClick={e => e.stopPropagation()}
      style={{
        position: 'fixed', inset: 0, zIndex: 20002, background: 'var(--bg)',
        transform: visible ? 'translateY(0)' : 'translateY(100%)',
        transition: 'transform 0.32s cubic-bezier(0.34,1.0,0.64,1)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px', borderBottom: '1px solid var(--border)', background: 'var(--bg)' }}>
        <button type="button" onClick={animateOutThenClose}
          style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--surface)', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <X size={16} />
        </button>
        <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>Void UI changer 👽</span>
        <div style={{ width: 34 }} />
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px 28px' }}>
        <ProfileSkinStyles />
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 18, lineHeight: 1.55 }}>
          Reskins your whole profile page — background, cards, borders, fonts and buttons.
          Everyone who opens your profile sees it this way too. Tap to apply — it saves straight away.
        </p>

        <SkinCard
          skin={null}
          label="Default"
          blurb="The standard Chillverse look, following your app theme."
          name={displayName}
          selected={choice === null}
          busy={saving && choice === null}
          onSelect={() => pick(null)}
        />

        {PROFILE_SKINS.map(s => (
          <SkinCard
            key={s.id}
            skin={s.id}
            label={s.label}
            blurb={s.blurb}
            name={displayName}
            selected={choice === s.id}
            busy={saving && choice === s.id}
            onSelect={() => pick(s.id)}
          />
        ))}

        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.5 }}>
          A skin replaces your Profile Theme colour while it's active. Set this back to
          Default to use your colour again.
        </p>
      </div>

      {/* Footer — Done only dismisses; each tap above has already saved. */}
      <div style={{ flexShrink: 0, padding: '14px 18px', borderTop: '1px solid var(--border)', background: 'var(--bg)' }}>
        <button type="button" onClick={(e) => { ripple(e); animateOutThenClose() }} className="btn-primary"
          style={{ width: '100%', padding: 14, borderRadius: 14, fontSize: 14, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <Check size={14} /> Done
        </button>
      </div>
    </div>,
    document.body,
  )
}
