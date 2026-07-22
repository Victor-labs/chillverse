// src/features/games/play/WaterTheTree.tsx
// "The Grove" is a standalone HTML/JS game, same iframe-via-srcDoc approach
// as Ludo.tsx (see that file for why srcDoc rather than a static asset URL).
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
// eslint-disable-next-line import/no-unresolved
import waterTheTreeHtml from './water-the-tree.html?raw'

export default function WaterTheTree() {
  const navigate = useNavigate()

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 500, background: '#070c09' }}>
      <button
        type="button"
        onClick={() => navigate('/multiplayer')}
        style={{
          position: 'absolute', top: 14, left: 14, zIndex: 10,
          width: 36, height: 36, borderRadius: 10, background: 'rgba(0,0,0,0.5)',
          border: '1px solid rgba(232,196,104,0.25)', backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#EDE7D9', cursor: 'pointer',
        }}
      >
        <ArrowLeft size={16} />
      </button>
      <iframe
        title="The Grove — Water the Tree"
        srcDoc={waterTheTreeHtml}
        style={{ width: '100%', height: '100%', border: 'none' }}
        sandbox="allow-scripts allow-same-origin"
      />
    </div>
  )
}
