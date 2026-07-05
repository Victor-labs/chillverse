// src/components/Footer.tsx
import Wordmark from './Wordmark'

export default function Footer() {
  return (
    <footer style={{
      padding: '28px 40px', borderTop: '1px solid rgba(255,106,44,0.16)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      flexWrap: 'wrap', gap: 16, background: 'rgba(18,6,4,0.6)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Wordmark size={18} animated={false} />
        <span style={{ fontSize: 13, color: '#8a6552' }}>© 2026 · All rights reserved</span>
      </div>
      <div style={{ display: 'flex', gap: 24 }}>
        {[
          ['https://cvwtplatform.vercel.app/','Platform'],
          ['#','About'],
          ['/privacy','Privacy'],
          ['/terms','Terms'],
          ['#','Contact'],
        ].map(([href, label]) => (
          <a key={label} href={href} style={{ fontSize: 13, color: '#8a6552', textDecoration: 'none', transition: 'color 0.2s' }}
            onMouseEnter={e => { (e.target as HTMLElement).style.color = '#e0b8a0' }}
            onMouseLeave={e => { (e.target as HTMLElement).style.color = '#8a6552' }}>
            {label}
          </a>
        ))}
      </div>
    </footer>
  )
}
