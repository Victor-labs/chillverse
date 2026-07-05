// src/components/Nav.tsx
import { Link } from 'react-router-dom'

export default function Nav() {
  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 300,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 40px', height: 60,
      background: 'rgba(4,4,15,0.75)', backdropFilter: 'blur(24px)',
      borderBottom: '1px solid rgba(108,80,255,0.16)',
    }}>
      <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
        {/* Spinning mini cube logo */}
        <div style={{ width: 34, height: 34, perspective: '130px' }}>
          <div style={{ width: 34, height: 34, position: 'relative', transformStyle: 'preserve-3d', animation: 'nav-spin 16s linear infinite' }}>
            <div style={{
              position: 'absolute', width: 34, height: 34,
              border: '1.5px solid rgba(108,80,255,0.7)', background: 'rgba(108,80,255,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 10, fontWeight: 800, fontFamily: 'monospace', color: '#a78bfa',
              borderRadius: 6, transform: 'translateZ(17px)',
            }}>CV</div>
          </div>
        </div>
        <span className="text-gradient-2" style={{ fontSize: 20, fontWeight: 800 }}>Chillverse</span>
      </Link>

      <ul style={{ display: 'flex', alignItems: 'center', gap: 32, listStyle: 'none', margin: 0, padding: 0 }} className="hidden md:flex">
        {[['/#features','Features'],['/#leaderboard','Leaderboard'],['/#community','Community']].map(([href, label]) => (
          <li key={label}>
            <a href={href} style={{ fontSize: 14, fontWeight: 500, color: '#9b96c0', textDecoration: 'none', transition: 'color 0.2s' }}
              onMouseEnter={e => { (e.target as HTMLElement).style.color = '#eeeaff' }}
              onMouseLeave={e => { (e.target as HTMLElement).style.color = '#9b96c0' }}>
              {label}
            </a>
          </li>
        ))}
      </ul>

      <Link to="/login" style={{
        padding: '9px 22px', borderRadius: 24, fontSize: 14, fontWeight: 700,
        color: '#fff', textDecoration: 'none',
        background: 'linear-gradient(135deg, #6c50ff, #3d1fb5)',
        boxShadow: '0 4px 24px rgba(108,80,255,0.45)',
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
