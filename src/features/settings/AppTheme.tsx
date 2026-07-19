// src/features/settings/AppTheme.tsx
import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Check, Shuffle, Lock } from 'lucide-react'
import { ripple } from '../../shared/lib/ripple'
import { useTheme } from '../../context/ThemeContext'
import { THEMES, getTheme, type ThemeId } from '../../shared/lib/themes'
import { ProModal } from '../../context/ProModal'

// Static mock data for the live preview panel — same idea as the reference
// screenshot: a couple of pinned/group threads up top, a plain list below.
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

export default function AppTheme() {
  const navigate = useNavigate()
  const { theme, setTheme } = useTheme()
  const [showProModal, setShowProModal] = useState(false)

  const unlockedIds = useMemo(() => THEMES.filter(t => !t.locked).map(t => t.id), [])

  function handlePick(id: ThemeId, locked: boolean) {
    if (locked) {
      setShowProModal(true)
      return
    }
    setTheme(id)
  }

  function handleShuffle() {
    const others = unlockedIds.filter(id => id !== theme)
    const pool = others.length ? others : unlockedIds
    const next = pool[Math.floor(Math.random() * pool.length)]
    setTheme(next)
  }

  const activeLabel = getTheme(theme).label

  return (
    <>
      <div style={{ maxWidth: 600, margin: '0 auto', padding: '0 0 100px' }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 22, position: 'relative' }}>
          <button
            onClick={(e) => { ripple(e); navigate(-1) }}
            className="ripple-wrap"
            style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--surface)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)', boxShadow: '2px 2px 6px var(--neu-dark),-1px -1px 4px var(--neu-light)' }}
          >
            <ArrowLeft size={15} />
          </button>
          <div style={{ position: 'absolute', left: 0, right: 0, textAlign: 'center', fontSize: 15, fontWeight: 700, color: 'var(--text)', pointerEvents: 'none' }}>
            App Theme
          </div>
        </div>

        {/* ── Live preview ── */}
        <div style={{ background: 'var(--surface)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 20, padding: 18, boxShadow: '3px 3px 9px var(--neu-dark), -2px -2px 7px var(--neu-light)' }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 14 }}>Messages</div>

          <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
            {PREVIEW_THREADS.map((t, i) => (
              <div key={i} style={{ flex: 1, background: 'var(--surface2)', borderRadius: 14, padding: 10, minWidth: 0 }}>
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

      {/* ── Swatch picker, pinned near bottom like the reference ── */}
      <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, padding: '18px 16px calc(18px + env(safe-area-inset-bottom))', background: 'linear-gradient(to top, var(--bg) 60%, transparent)' }}>
        <div style={{ textAlign: 'center', fontSize: 12.5, fontWeight: 700, color: 'var(--text-dim)', marginBottom: 12 }}>{activeLabel}</div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', overflowX: 'auto', paddingBottom: 4 }}>
          {THEMES.filter(t => !t.locked).map(t => (
            <button
              key={t.id}
              onClick={(e) => { ripple(e); handlePick(t.id, false) }}
              className="ripple-wrap"
              style={{
                width: 46, height: 46, borderRadius: 12, flexShrink: 0, cursor: 'pointer',
                background: t.swatch, border: theme === t.id ? '2px solid var(--accent)' : '1px solid rgba(255,255,255,0.12)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: theme === t.id ? '0 0 0 3px rgba(255,107,0,0.18)' : 'none',
              }}
            >
              {theme === t.id && <Check size={16} color={t.id === 'white' ? '#111' : '#fff'} strokeWidth={3} />}
            </button>
          ))}

          <button
            onClick={(e) => { ripple(e); handleShuffle() }}
            className="ripple-wrap"
            style={{ width: 46, height: 46, borderRadius: 12, flexShrink: 0, cursor: 'pointer', background: 'var(--surface2)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)' }}
            aria-label="Random theme"
          >
            <Shuffle size={16} />
          </button>

          {THEMES.filter(t => t.locked).map(t => (
            <button
              key={t.id}
              onClick={(e) => { ripple(e); handlePick(t.id, true) }}
              className="ripple-wrap"
              style={{
                width: 46, height: 46, borderRadius: 12, flexShrink: 0, cursor: 'pointer',
                background: t.swatch, border: '1px solid rgba(255,255,255,0.12)', position: 'relative',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <div style={{ position: 'absolute', inset: 0, borderRadius: 12, background: 'rgba(0,0,0,0.38)' }} />
              <Lock size={15} color="#fff" style={{ position: 'relative' }} />
            </button>
          ))}
        </div>

        <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-muted)', marginTop: 12 }}>
          This will change the theme across all your devices.
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
