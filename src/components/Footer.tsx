// src/components/Footer.tsx
export default function Footer() {
  return (
    <footer style={{
      padding: '28px 40px', borderTop: '1px solid rgba(108,80,255,0.16)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      flexWrap: 'wrap', gap: 16, background: 'rgba(4,4,15,0.6)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span className="text-gradient-2" style={{ fontSize: 18, fontWeight: 800 }}>Chillverse</span>
        <span style={{ fontSize: 13, color: '#5a5678' }}>© 2026 · All rights reserved</span>
      </div>
      <div style={{ display: 'flex', gap: 24 }}>
        {[
          ['https://cvwtplatform.vercel.app/','Platform'],
          ['#','About'],
          ['/privacy','Privacy'],
          ['/terms','Terms'],
          ['#','Contact'],
        ].map(([href, label]) => (
          <a key={label} href={href} style={{ fontSize: 13, color: '#5a5678', textDecoration: 'none', transition: 'color 0.2s' }}
            onMouseEnter={e => { (e.target as HTMLElement).style.color = '#9b96c0' }}
            onMouseLeave={e => { (e.target as HTMLElement).style.color = '#5a5678' }}>
            {label}
          </a>
        ))}
      </div>
    </footer>
  )
}
