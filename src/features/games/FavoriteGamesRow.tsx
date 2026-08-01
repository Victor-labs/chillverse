// src/features/games/FavoriteGamesRow.tsx
import { useState } from 'react'
import { Star, Info, X } from 'lucide-react'
import { ripple } from '../../shared/lib/ripple'
import type { GameMeta, GameId } from './games'

export default function FavoriteGamesRow({ games, onOpenGame }: { games: GameMeta[]; onOpenGame: (id: GameId) => void }) {
  const [showInfo, setShowInfo] = useState(false)

  return (
    <section style={{ marginBottom: 22 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
        <Star size={15} style={{ color: '#f5c542' }} fill="#f5c542" />
        <p style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', margin: 0, flex: 1 }}>Favorite Games</p>
        <button
          type="button"
          aria-label="About Favorite Games"
          onClick={(e) => { ripple(e); setShowInfo(true) }}
          style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--surface2)', border: 'none', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
        >
          <Info size={13} />
        </button>
      </div>

      {games.length === 0 ? (
        <div className="neu-card" style={{ padding: 20, textAlign: 'center' }}>
          <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: 0 }}>
            Star a game to pin it here.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 4 }}>
          {games.map(g => {
            const Icon = g.icon
            return (
              <div
                key={g.id}
                className="ripple-wrap"
                onClick={(e) => { ripple(e); onOpenGame(g.id) }}
                style={{ flexShrink: 0, width: 148, cursor: 'pointer' }}
              >
                <div style={{
                  position: 'relative', width: '100%', aspectRatio: '1/1', borderRadius: 16, overflow: 'hidden',
                  background: g.bannerUrl ? 'var(--surface2)' : `${g.accent}18`,
                  border: `1px solid ${g.bannerUrl ? 'var(--border)' : `${g.accent}33`}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--elev-raise-sm)',
                }}>
                  {g.bannerUrl ? (
                    <img src={g.bannerUrl} alt={g.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <Icon size={40} style={{ color: g.accent, opacity: 0.85 }} />
                  )}
                  <div style={{ position: 'absolute', top: 8, right: 8, width: 22, height: 22, borderRadius: '50%', background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Star size={11} style={{ color: '#f5c542' }} fill="#f5c542" />
                  </div>
                </div>
                <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', margin: '8px 0 2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.name}</p>
                <p style={{ fontSize: 10.5, color: 'var(--text-muted)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.tagline}</p>
              </div>
            )
          })}
        </div>
      )}

      {showInfo && (
        <div
          onClick={() => setShowInfo(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9998, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, backdropFilter: 'blur(2px)' }}
        >
          <div
            className="neu-card"
            onClick={(e) => e.stopPropagation()}
            style={{ width: '100%', maxWidth: 320, padding: 22, borderRadius: 20, textAlign: 'center', position: 'relative' }}
          >
            <button
              type="button"
              onClick={() => setShowInfo(false)}
              aria-label="Close"
              style={{ position: 'absolute', top: 12, right: 12, width: 26, height: 26, borderRadius: '50%', border: 'none', background: 'var(--surface2)', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
            >
              <X size={13} />
            </button>
            <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(245,197,66,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '4px auto 12px' }}>
              <Star size={20} style={{ color: '#f5c542' }} fill="#f5c542" />
            </div>
            <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', margin: '0 0 6px' }}>Favorite Games</p>
            <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
              Games you star appear here. Star any game from its detail card to pin it to this row.
            </p>
          </div>
        </div>
      )}
    </section>
  )
}
