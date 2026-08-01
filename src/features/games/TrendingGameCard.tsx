// src/features/games/TrendingGameCard.tsx
import { Flame, Play, Lock } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { ripple } from '../../shared/lib/ripple'

interface Props {
  name: string
  tagline: string
  accent: string
  icon: LucideIcon
  bannerUrl?: string
  isHot?: boolean
  isNew?: boolean
  locked?: boolean
  onOpen: () => void
}

export default function TrendingGameCard({ name, tagline, accent, icon: Icon, bannerUrl, isHot, isNew, locked, onOpen }: Props) {
  return (
    <div
      className="ripple-wrap"
      onClick={(e) => { ripple(e); onOpen() }}
      style={{
        flexShrink: 0, width: 148, cursor: 'pointer', position: 'relative',
      }}
    >
      <div style={{
        position: 'relative', width: '100%', aspectRatio: '1/1', borderRadius: 16,
        overflow: 'hidden', background: bannerUrl ? 'var(--surface2)' : `${accent}18`,
        border: `1px solid ${bannerUrl ? 'var(--border)' : `${accent}33`}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: 'var(--elev-raise-sm)',
      }}>
        {bannerUrl ? (
          <img src={bannerUrl} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <Icon size={40} style={{ color: accent, opacity: 0.85 }} />
        )}

        {isHot && (
          <span style={{
            position: 'absolute', top: 8, left: 8, display: 'flex', alignItems: 'center', gap: 3,
            fontSize: 9.5, fontWeight: 800, color: '#fff', background: 'var(--red, #ff4f4f)',
            borderRadius: 7, padding: '2px 6px 2px 5px',
          }}>
            <Flame size={9} /> HOT
          </span>
        )}
        {!isHot && isNew && (
          <span style={{
            position: 'absolute', top: 8, left: 8, fontSize: 9.5, fontWeight: 800, color: '#06251a',
            background: 'var(--accent, #3ecf8e)', borderRadius: 7, padding: '2px 6px',
          }}>
            NEW
          </span>
        )}

        <div style={{
          position: 'absolute', bottom: 8, right: 8, width: 28, height: 28, borderRadius: '50%',
          background: locked ? 'rgba(0,0,0,0.55)' : 'var(--accent, #3ecf8e)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
        }}>
          {locked ? <Lock size={12} style={{ color: '#fff' }} /> : <Play size={12} fill="#06251a" style={{ color: '#06251a', marginLeft: 1 }} />}
        </div>
      </div>

      <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', margin: '8px 0 2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</p>
      <p style={{ fontSize: 10.5, color: 'var(--text-muted)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tagline}</p>
    </div>
  )
}
