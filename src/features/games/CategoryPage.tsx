// src/features/games/CategoryPage.tsx
// Dedicated page per Categories chip (All/Board/Hard/Session Binge/Easy/
// Strategy/Pro) — big header, then a grid of every game that falls under
// it. Tapping a card deep-links into the Game Zone lobby via
// location.state.openGame (same mechanism Multiplayer's "Vs AI" already
// uses), so locking/session logic stays single-sourced in Games.tsx.
import { ArrowLeft, Lock } from 'lucide-react'
import { ripple } from '../../shared/lib/ripple'
import { CATEGORIES, getGamesForCategory, type CategoryKey, type GameId } from './games'

export default function CategoryPage({
  category, onBack, onOpenGame,
}: {
  category: CategoryKey
  onBack: () => void
  onOpenGame: (id: GameId) => void
}) {
  const label = CATEGORIES.find(c => c.key === category)?.label ?? 'Games'
  const games = getGamesForCategory(category)

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', paddingBottom: 48 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
        <button
          type="button"
          onClick={onBack}
          style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--elev-raise-sm)', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
        >
          <ArrowLeft size={15} />
        </button>
        <h1 style={{ fontSize: 22, fontWeight: 900, color: 'var(--text)', margin: 0, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</h1>
      </div>

      {games.length === 0 ? (
        <div className="neu-card" style={{ padding: 28, textAlign: 'center' }}>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
            No games in this category yet — check back soon.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {games.map(g => {
            const Icon = g.icon
            return (
              <div
                key={g.id}
                className="neu-card ripple-wrap"
                onClick={(e) => { ripple(e); onOpenGame(g.id) }}
                style={{ padding: 16, cursor: 'pointer', position: 'relative' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: `${g.accent}18`, border: `1px solid ${g.accent}33`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon size={18} style={{ color: g.accent }} />
                  </div>
                  {g.requiresPro && <Lock size={13} style={{ color: 'var(--text-muted)', marginTop: 3 }} />}
                </div>
                <p style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)', margin: '0 0 3px' }}>{g.name}</p>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0, lineHeight: 1.35 }}>{g.tagline}</p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
