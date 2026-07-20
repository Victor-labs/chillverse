// src/features/settings/settingsShared.tsx
//
// Shared building blocks for the categorized settings system: the sub-page
// shell (back header + entry motion), card/row/toggle/choice primitives, and
// a small optimistic-persistence hook for profile-backed settings fields.
// Every visual choice here derives from the unified token system.
import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Check, ChevronRight } from 'lucide-react'
import { ripple } from '../../shared/lib/ripple'
import { supabase } from '../../shared/lib/supabase'
import type { Profile } from '../../shared/types'

// ─── Persistence ────────────────────────────────────────────────────────────

export async function saveProfileFields(
  userId: string,
  patch: Record<string, unknown>
): Promise<string | null> {
  const { error } = await supabase.from('profiles').update(patch).eq('id', userId)
  if (!error) return null
  // 42501 = column privilege missing (grant not yet applied server-side)
  if (error.code === '42501') return 'This setting isn’t enabled on the server yet.'
  return 'Failed to save — please try again.'
}

/** Optimistic boolean/choice field backed by a profiles column. */
export function useProfileField<T>(
  profile: Profile | null,
  column: keyof Profile & string,
  fallback: T
) {
  const initial = (profile?.[column] ?? fallback) as T
  const [value, setValue] = useState<T>(initial)
  const [synced, setSynced] = useState<T>(initial)
  const [error, setError] = useState('')

  // Re-seed when the profile row arrives after first render
  if (profile && synced !== ((profile[column] ?? fallback) as T) && value === synced) {
    const fresh = (profile[column] ?? fallback) as T
    setValue(fresh)
    setSynced(fresh)
  }

  const save = useCallback(async (next: T) => {
    if (!profile?.id) return
    const prev = value
    setValue(next)
    setError('')
    const err = await saveProfileFields(profile.id, { [column]: next })
    if (err) {
      setValue(prev)
      setError(err)
    } else {
      setSynced(next)
    }
  }, [profile?.id, column, value])

  return { value, save, error }
}

// ─── Shell ──────────────────────────────────────────────────────────────────

export function SettingsShell({ title, children }: { title: string; children: React.ReactNode }) {
  const navigate = useNavigate()
  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '0 0 48px', animation: 'settingsSlideIn 0.28s var(--ease-out) both' }}>
      <style>{`
        @keyframes settingsSlideIn { from { opacity: 0; transform: translateX(26px) } to { opacity: 1; transform: translateX(0) } }
        @keyframes popIn { from { opacity:0; transform: scale(0.92) } to { opacity:1; transform: scale(1) } }
        .settings-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 16px;
          overflow: hidden;
          box-shadow: var(--elev-raise-sm);
          margin-bottom: 20px;
        }
        .settings-card > * {
          border-radius: 0 !important;
          box-shadow: none !important;
          margin: 0 !important;
          border: none !important;
          border-bottom: 1px solid var(--border) !important;
        }
        .settings-card > *:last-child { border-bottom: none !important; }
      `}</style>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20, position: 'relative' }}>
        <button
          onClick={(e) => { ripple(e); navigate(-1) }}
          className="ripple-wrap"
          aria-label="Back"
          style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--border)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)', boxShadow: 'var(--elev-raise-sm)' }}
        >
          <ArrowLeft size={15} />
        </button>
        <div style={{ position: 'absolute', left: 0, right: 0, textAlign: 'center', fontSize: 15, fontWeight: 700, color: 'var(--text)', pointerEvents: 'none' }}>
          {title}
        </div>
      </div>
      {children}
    </div>
  )
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div className="t-label" style={{ marginBottom: 12, marginTop: 26 }}>{children}</div>
}

export function InfoLine({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 11.5, lineHeight: 1.5, color: 'var(--text-muted)', padding: '0 6px', marginTop: -12, marginBottom: 20 }}>
      {children}
    </div>
  )
}

export function ErrorLine({ children }: { children: React.ReactNode }) {
  if (!children) return null
  return (
    <div style={{ fontSize: 11.5, color: 'var(--red)', padding: '0 6px', marginTop: -12, marginBottom: 20 }}>
      {children}
    </div>
  )
}

// ─── Rows ───────────────────────────────────────────────────────────────────

export function Row({ icon, iconBg, iconColor, label, sub, value, danger = false, onClick, rightEl }: {
  icon?: React.ReactNode; iconBg?: string; iconColor?: string
  label: string; sub?: string; value?: string; danger?: boolean
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void
  rightEl?: React.ReactNode
}) {
  return (
    <div
      onClick={onClick}
      className={onClick ? 'ripple-wrap' : undefined}
      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, marginBottom: 9, cursor: onClick ? 'pointer' : 'default', boxShadow: 'var(--elev-raise-sm)' }}
    >
      {icon && (
        <div style={{ width: 30, height: 30, borderRadius: 9, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: iconBg ?? 'var(--surface2)', color: danger ? 'var(--red)' : iconColor }}>{icon}</div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: danger ? 'var(--red)' : 'var(--text)' }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 1 }}>{sub}</div>}
      </div>
      {value && <div style={{ fontSize: 12, color: 'var(--text-muted)', flexShrink: 0 }}>{value}</div>}
      {rightEl}
      {onClick && !rightEl && <ChevronRight size={15} color="var(--text-muted)" />}
    </div>
  )
}

export function Toggle({ on, onToggle, disabled = false }: { on: boolean; onToggle: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onToggle}
      disabled={disabled}
      role="switch"
      aria-checked={on}
      style={{
        width: 42, height: 24, borderRadius: 12, flexShrink: 0, padding: 2,
        background: on ? 'var(--accent)' : 'var(--surface3)',
        border: '1px solid ' + (on ? 'var(--accent)' : 'var(--border-strong)'),
        cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
        transition: 'background-color var(--dur-base) var(--ease-out), border-color var(--dur-base) var(--ease-out)',
        display: 'flex', alignItems: 'center',
      }}
    >
      <span style={{
        width: 18, height: 18, borderRadius: '50%', background: '#fff',
        boxShadow: '0 1px 3px rgba(0,0,0,0.35)',
        transform: on ? 'translateX(18px)' : 'translateX(0)',
        transition: 'transform var(--dur-base) var(--ease-spring)',
      }} />
    </button>
  )
}

export function ToggleRow({ icon, iconBg, iconColor, label, sub, on, onToggle, disabled }: {
  icon?: React.ReactNode; iconBg?: string; iconColor?: string
  label: string; sub?: string; on: boolean; onToggle: () => void; disabled?: boolean
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, marginBottom: 9, boxShadow: 'var(--elev-raise-sm)' }}>
      {icon && (
        <div style={{ width: 30, height: 30, borderRadius: 9, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: iconBg ?? 'var(--surface2)', color: iconColor }}>{icon}</div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)' }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 1 }}>{sub}</div>}
      </div>
      <Toggle on={on} onToggle={onToggle} disabled={disabled} />
    </div>
  )
}

/** Single-select choice list (Discord-style radio card). */
export function ChoiceGroup<T extends string>({ options, value, onPick }: {
  options: { id: T; label: string; sub?: string; icon?: React.ReactNode; color?: string }[]
  value: T
  onPick: (id: T) => void
}) {
  return (
    <div className="settings-card">
      {options.map(o => (
        <div
          key={o.id}
          onClick={() => onPick(o.id)}
          className="ripple-wrap"
          role="radio"
          aria-checked={value === o.id}
          style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', cursor: 'pointer', background: value === o.id ? 'color-mix(in srgb, var(--accent) 6%, transparent)' : 'transparent' }}
        >
          {o.icon && (
            <div style={{ width: 30, height: 30, borderRadius: 9, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface2)', color: o.color ?? 'var(--text-dim)' }}>
              {o.icon}
            </div>
          )}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)' }}>{o.label}</div>
            {o.sub && <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 1 }}>{o.sub}</div>}
          </div>
          {value === o.id && <Check size={16} color="var(--accent)" />}
        </div>
      ))}
    </div>
  )
}
