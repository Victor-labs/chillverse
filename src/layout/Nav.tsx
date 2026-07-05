// src/components/Nav.tsx
import { Link } from 'react-router-dom'
import Wordmark from './Wordmark'

export default function Nav() {
  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 300,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 40px', height: 60,
      background: 'rgba(18,6,4,0.75)', backdropFilter: 'blur(24px)',
      borderBottom: '1px solid rgba(255,106,44,0.16)',
    }}>
      <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
        {/* Spinning, glowing mini cube logo */}
        <div style={{ width: 34, height: 34, perspective: '130px' }}>
          <div style={{ width: 34, height: 34, position: 'relative', transformStyle: 'preserve-3d', animation: 'nav-spin 16s linear infinite' }}>
            <div className="nav-logo-face" style={{
              position: 'absolute', width: 34, height: 34,
              border: '1.5px solid rgba(255,106,44,0.7)', background: 'rgba(255,106,44,0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 10, fontWeight: 800, fontFamily: 'monospace', color: '#ffab7a',
              borderRadius: 6, transform: 'translateZ(17px)',
            }}>CV</div>
          </div>
        </div>
        <Wordmark size={20} animated />
      </Link>

      <ul style={{ display: 'flex', alignItems: 'center', gap: 32, listStyle: 'none', margin: 0, padding: 0 }} className="hidden md:flex">
        {[['/#features','Features'],['/#leaderboard','Leaderboard'],['/#community','Community']].map(([href, label]) => (
          <li key={label}>
            <a href={href} style={{ fontSize: 14, fontWeight: 500, color: '#e0b8a0', textDecoration: 'none', transition: 'color 0.2s' }}
              onMouseEnter={e => { (e.target as HTMLElement).style.color = '#fff1e6' }}
              onMouseLeave={e => { (e.target as HTMLElement).style.color = '#e0b8a0' }}>
              {label}
            </a>
          </li>
        ))}
      </ul>

      <Link to="/login" style={{
        padding: '9px 22px', borderRadius: 24, fontSize: 14, fontWeight: 700,
        color: '#fff', textDecoration: 'none',
        background: 'linear-gradient(135deg, #ff6a2c, #8a2d0a)',
        boxShadow: '0 4px 24px rgba(255,106,44,0.45)',
        transition: 'all 0.2s',
      }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)' }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(0)' }}
      >
        Play Now →
      </Link>
    </nav>
  )
}
