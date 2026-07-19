// src/features/settings/AppTheme.tsx
//
// Theme picker. Three deliberate behaviors:
// 1. TRUE previews — every swatch and the live panel render from the actual
//    per-theme tokens by scoping `data-theme` locally, so what you see is
//    exactly what you get (not an approximate gradient chip).
// 2. Pro-aware gating — premium themes apply immediately for active Pro
//    subscribers (isProActive), and preview-before-upgrade for everyone
//    else: tapping a locked theme previews it in the panel with an unlock
//    CTA instead of an instant modal.
// 3. Free vs Premium are visually separated with lock iconography.
import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Check, Shuffle, Lock, Sparkles } from 'lucide-react'
import { ripple } from '../../shared/lib/ripple'
import { useTheme } from '../../context/ThemeContext'
import { THEMES, getTheme, type ThemeId } from '../../shared/lib/themes'
import { ProModal } from '../../context/ProModal'
import { useProfile } from '../profile/useProfile'
import { isProActive } from '../../shared/lib/proPlans'

const PREVIEW_THREADS = [
  { name: 'Mallow, Cap and 3 others', sub: 'SketchHeads',  colors: ['#f5c542', '#7c5cff', '#3ecf8e'] },
  { name: 'locke, mallow and graggle', sub: 'the-couch',   colors: ['#ff4d8b', '#2fa8ff', '#3ecf8e'] },
]
const PREVIEW_ROWS = [
  { name: 'Nelly',           msg: 'Enjoy your trip to spain!',        time: '24m', color: '#3ecf8e', unread: true },
  { name: 'bio study group', msg: 'graggle: Can someone explain #4?', time: '32m', color: '#a855f7', unread: true },
  { name: 'phibi',           msg: "I'll add them to the server",      time: '1h',  color: '#2fa8ff', unread: false },
  { name: 'Dodgeball',       msg: 'cap: Registration opens on the third!', time: '2h', color: '#f5c542', unread: false },
  { name: 'mac',             msg: 'What time should we start tonight?', time: '2h', color: '#ff4d8b', unread: false },
]

/** Miniature app rendered entirely from a theme's own tokens. */
function ThemeSwatch({ id, selected }: { id: ThemeId; selected: boolean }) {
  return (
    <div
      data-theme={id}
      aria-hidden
      style={{
        position: 'absolute', inset: 0, borderRadius: 'inherit', overflow: 'hidden',
        background: 'var(--bg)', display: 'flex',
      }}
    >
      <div style={{ width: '26%', background: 'var(--nav)', borderRight: '1px solid var(--border)' }} />
      <div style={{ flex: 1, padding: '6px 5px', display: 'flex', flexDirection: 'column', gap: 3 }}>
        <div style={{ height: 8, borderRadius: 3, background: 'var(--surface)', border: '1px solid var(--border)' }} />
        <div style={{ height: 8, borderRadius: 3, background: 'var(--surface2)' }} />
        <div style={{ height: 5, width: '62%', borderRadius: 3, background: 'var(--accent)', boxShadow: '0 0 6px var(--accent-soft)' }} />
      </div>
      {selected && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'color-mix(in srgb, var(--bg) 35%, transparent)' }}>
          <Check size={15} strokeWidth={3.5} style={{ color: 'var(--accent)' }} />
        </div>
      )}
    </div>
  )
}

export default function AppTheme() {
  const navigate = useNavigate()
  const { theme, setTheme } = useTheme()
  const { profile } = useProfile()
  const isPro = isProActive(profile)
  const [showProModal, setShowProModal] = useState(false)
  const [previewId, setPreviewId] = useState<ThemeId | null>(null)

  const freeThemes = useMemo(() => THEMES.filter(t => !t.locked), [])
  const premiumThemes = useMemo(() => THEMES.filter(t => t.locked), [])

  // What the panel shows: an un-applied preview wins over the applied theme.
  const panelTheme = previewId ?? theme
  const previewingLocked = previewId !== null && getTheme(previewId).locked && !isPro

  function handlePick(id: ThemeId, locked: boolean) {
    if (!locked || isPro) {
      setPreviewId(null)
      setTheme(id)
      return
    }
    // Locked + not Pro: preview it in the panel instead of an instant modal.
    setPreviewId(id)
  }

  function handleShuffle() {
    const pool = freeThemes.map(t => t.id).filter(id => id !== theme)
    const next = (pool.length ? pool : freeThemes.map(t => t.id))[Math.floor(Math.random() * (pool.length || freeThemes.length))]
    setPreviewId(null)
    setTheme(next)
  }

  const swatchBase: React.CSSProperties = {
    width: 58, height: 46, borderRadius: 12, flexShrink: 0, cursor: 'pointer',
    position: 'relative', padding: 0, overflow: 'hidden',
    transition: 'transform var(--dur-base) var(--ease-spring), box-shadow var(--dur-base) var(--ease-out), border-color var(--dur-base) var(--ease-out)',
  }

  return (
    <>
      <div style={{ maxWidth: 600, margin: '0 auto', padding: '0 0 190px' }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 22, position: 'relative' }}>
          <button
            onClick={(e) => { ripple(e); navigate(-1) }}
            className="ripple-wrap"
            aria-label="Back"
            style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--border)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)', boxShadow: 'var(--elev-raise-sm)' }}
          >
            <ArrowLeft size={15} />
          </button>
          <div className="t-heading" style={{ position: 'absolute', left: 0, right: 0, textAlign: 'center', pointerEvents: 'none' }}>
            App Theme
          </div>
        </div>

        {/* ── Live preview — renders in panelTheme's own tokens ── */}
        <div
          data-theme={panelTheme}
          style={{
            background: 'var(--surface)', color: 'var(--text)',
            border: '1px solid var(--border)', borderRadius: 20, padding: 18,
            boxShadow: 'var(--elev-raise)',
            transition: 'background-color var(--dur-slow) var(--ease-out), border-color var(--dur-slow) var(--ease-out), color var(--dur-slow) var(--ease-out)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div className="t-heading">Messages</div>
            {previewId !== null && (
              <span className="t-label" style={{ color: 'var(--accent)' }}>Previewing {getTheme(panelTheme).label}</span>
            )}
          </div>

          <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
            {PREVIEW_THREADS.map((t, i) => (
              <div key={i} style={{ flex: 1, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 14, padding: 10, minWidth: 0 }}>
                <div style={{ width: '100%', height: 40, borderRadius: 10, marginBottom: 8, background: `linear-gradient(135deg, ${t.colors[0]}, ${t.colors[1]})`, display: 'flex', alignItems: 'center', paddingLeft: 8, gap: 3 }}>
                  {t.colors.map((c, j) => (
                    <div key={j} style={{ width: 16, height: 16, borderRadius: '50%', background: c, border: '2px solid rgba(0,0,0,0.15)' }} />
                  ))}
                </div>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>{t.sub}</div>
              </div>
            ))}
          </div>

          {PREVIEW_ROWS.map((r, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0' }}>
              <div style={{ width: 34, height: 34, borderRadius: '50%', background: r.color, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12, fontWeight: 700 }}>
                {r.name[0].toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: r.unread ? 'var(--text)' : 'var(--text-dim)' }}>{r.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.msg}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{r.time}</span>
                {r.unread && <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)' }} />}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Picker dock ── */}
      <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, padding: '14px 16px calc(16px + env(safe-area-inset-bottom))', background: 'linear-gradient(to top, var(--bg) 68%, transparent)' }}>

        {/* Upsell bar — only while previewing a locked theme without Pro */}
        {previewingLocked && (
          <div className="su" style={{ display: 'flex', alignItems: 'center', gap: 10, maxWidth: 600, margin: '0 auto 12px', padding: '10px 14px', borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--border-strong)', boxShadow: 'var(--elev-raise-sm)' }}>
            <Sparkles size={15} style={{ color: 'var(--accent)', flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: 12, color: 'var(--text-dim)' }}>
              {getTheme(panelTheme).label} is a Premium theme.
            </span>
            <button
              onClick={(e) => { ripple(e); setShowProModal(true) }}
              className="btn-primary ripple-wrap"
              style={{ padding: '7px 14px', fontSize: 12 }}
            >
              Unlock
            </button>
            <button
              onClick={() => setPreviewId(null)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--text-muted)', padding: '7px 4px' }}
            >
              Not now
            </button>
          </div>
        )}

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', alignItems: 'flex-end', overflowX: 'auto', paddingBottom: 4 }}>
          <div>
            <div className="t-label" style={{ textAlign: 'center', marginBottom: 8 }}>Free</div>
            <div style={{ display: 'flex', gap: 10 }}>
              {freeThemes.map(t => {
                const selected = theme === t.id && previewId === null
                return (
                  <button
                    key={t.id}
                    onClick={(e) => { ripple(e); handlePick(t.id, false) }}
                    className="ripple-wrap"
                    aria-label={`${t.label} theme`}
                    aria-pressed={selected}
                    style={{
                      ...swatchBase,
                      border: selected ? '2px solid var(--accent)' : '1px solid var(--border-strong)',
                      transform: selected ? 'scale(1.07)' : 'scale(1)',
                      boxShadow: selected ? 'var(--elev-hover)' : 'var(--elev-raise-sm)',
                    }}
                  >
                    <ThemeSwatch id={t.id} selected={selected} />
                  </button>
                )
              })}
              <button
                onClick={(e) => { ripple(e); handleShuffle() }}
                className="ripple-wrap"
                aria-label="Random free theme"
                style={{ ...swatchBase, width: 46, background: 'var(--surface2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)' }}
              >
                <Shuffle size={16} />
              </button>
            </div>
          </div>

          <div>
            <div className="t-label" style={{ textAlign: 'center', marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
              {!isPro && <Lock size={9} />} Premium
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              {premiumThemes.map(t => {
                const selected = (theme === t.id && previewId === null) || previewId === t.id
                return (
                  <button
                    key={t.id}
                    onClick={(e) => { ripple(e); handlePick(t.id, true) }}
                    className="ripple-wrap"
                    aria-label={isPro ? `${t.label} theme` : `Preview ${t.label} theme (Premium)`}
                    aria-pressed={selected}
                    style={{
                      ...swatchBase,
                      border: selected ? '2px solid var(--accent)' : '1px solid var(--border-strong)',
                      transform: selected ? 'scale(1.07)' : 'scale(1)',
                      boxShadow: selected ? 'var(--elev-hover)' : 'var(--elev-raise-sm)',
                    }}
                  >
                    <ThemeSwatch id={t.id} selected={theme === t.id && previewId === null} />
                    {!isPro && (
                      <div style={{ position: 'absolute', top: 3, right: 3, width: 16, height: 16, borderRadius: 6, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Lock size={9} color="#fff" />
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-muted)', marginTop: 12 }}>
          {previewingLocked ? 'Previewing — your applied theme is unchanged.' : 'This will change the theme across all your devices.'}
        </div>
      </div>

      <ProModal
        visible={showProModal}
        onClose={() => setShowProModal(false)}
        onGoPro={() => { setShowProModal(false); navigate('/pro') }}
      />
    </>
  )
}
