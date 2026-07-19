// src/features/search/SearchPage.tsx
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Search as SearchIcon } from 'lucide-react'
import { ripple } from '../../shared/lib/ripple'
import { searchPlayers, searchGames, searchMallItems, type PlayerResult } from './search'
import FollowSuggestions from './FollowSuggestions'
import Avatar from '../../shared/components/Avatar'
import { useAuth } from '../auth/useAuth'
import type { GameMeta } from '../games/games'
import type { MallItem } from '../../shared/types'

type Tab = 'players' | 'games' | 'mall'

const TABS: { id: Tab; label: string }[] = [
  { id: 'players', label: 'Players' },
  { id: 'games', label: 'Games' },
  { id: 'mall', label: 'Mall Items' },
]

export default function SearchPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [tab, setTab] = useState<Tab>('players')
  const [query, setQuery] = useState('')
  const [players, setPlayers] = useState<PlayerResult[]>([])
  const [games, setGames] = useState<GameMeta[]>([])
  const [mallItems, setMallItems] = useState<MallItem[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!query.trim()) {
      setPlayers([]); setGames([]); setMallItems([])
      return
    }
    setLoading(true)
    const t = setTimeout(async () => {
      if (tab === 'players') setPlayers(await searchPlayers(query))
      if (tab === 'games') setGames(searchGames(query))
      if (tab === 'mall') setMallItems(await searchMallItems(query))
      setLoading(false)
    }, 250)
    return () => clearTimeout(t)
  }, [query, tab])

  function goToPlayer(id: string) {
    navigate(`/profile/${id}`)
  }

  function goToGame() {
    navigate('/games')
  }

  function goToMall() {
    navigate('/mall')
  }

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', paddingBottom: 56 }}>
      {/* ── Top bar — back button always returns, never a dead end ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 20px', marginBottom: 16, paddingTop: 4 }}>
        <button
          type="button"
          onClick={(e) => { ripple(e); navigate(-1) }}
          style={{
            width: 38, height: 38, borderRadius: 11,
            background: 'var(--surface)', border: '1px solid var(--border)',
            boxShadow: 'var(--elev-raise-sm)', color: 'var(--text-dim)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', flexShrink: 0,
          }}
        >
          <ArrowLeft size={16} />
        </button>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', margin: 0 }}>Search</h1>
          <p style={{ fontSize: 11.5, color: 'var(--text-muted)', margin: 0 }}>Players, games, and mall items</p>
        </div>
      </div>

      <div style={{ padding: '0 20px' }}>
        {/* Search input */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 13, background: 'var(--surface2)', border: '1px solid var(--border)', marginBottom: 12 }}>
          <SearchIcon size={15} style={{ color: 'var(--text-muted)' }} />
          <input
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search players, games, mall items…"
            style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: 'var(--text)', fontSize: 14 }}
          />
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
          {TABS.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              style={{
                padding: '7px 14px', borderRadius: 20, fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
                background: tab === t.id ? 'var(--accent)' : 'var(--surface2)',
                color: tab === t.id ? '#fff' : 'var(--text-dim)',
                border: 'none',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Results */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {!query.trim() && tab === 'players' && user && (
            <FollowSuggestions myId={user.id} />
          )}

          {!query.trim() && (
            <p style={{ fontSize: 12.5, color: 'var(--text-muted)', textAlign: 'center', padding: '32px 0' }}>
              Start typing to search {TABS.find(t => t.id === tab)?.label.toLowerCase()}
            </p>
          )}

          {query.trim() && loading && (
            <p style={{ fontSize: 12.5, color: 'var(--text-muted)', textAlign: 'center', padding: '24px 0' }}>Searching…</p>
          )}

          {query.trim() && !loading && tab === 'players' && players.length === 0 && (
            <p style={{ fontSize: 12.5, color: 'var(--text-muted)', textAlign: 'center', padding: '24px 0' }}>No players found</p>
          )}
          {tab === 'players' && players.map(p => (
            <div
              key={p.id}
              role="button"
              tabIndex={0}
              onClick={() => goToPlayer(p.id)}
              onKeyDown={e => { if (e.key === 'Enter') goToPlayer(p.id) }}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--border)', cursor: 'pointer', textAlign: 'left' }}
            >
              <Avatar src={p.avatar} name={p.display_name || p.username} userId={p.id} size={36} radius={10} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>{p.display_name || p.username}</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>@{p.username}</div>
              </div>
            </div>
          ))}

          {query.trim() && !loading && tab === 'games' && games.length === 0 && (
            <p style={{ fontSize: 12.5, color: 'var(--text-muted)', textAlign: 'center', padding: '24px 0' }}>No games found</p>
          )}
          {tab === 'games' && games.map(g => (
            <button
              key={g.id}
              type="button"
              onClick={goToGame}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--border)', cursor: 'pointer', textAlign: 'left' }}
            >
              <div style={{ width: 36, height: 36, borderRadius: 10, background: `${g.accent}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <g.icon size={17} style={{ color: g.accent }} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>{g.name}</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.tagline}</div>
              </div>
            </button>
          ))}

          {query.trim() && !loading && tab === 'mall' && mallItems.length === 0 && (
            <p style={{ fontSize: 12.5, color: 'var(--text-muted)', textAlign: 'center', padding: '24px 0' }}>No mall items found</p>
          )}
          {tab === 'mall' && mallItems.map(item => (
            <button
              key={item.id}
              type="button"
              onClick={goToMall}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--border)', cursor: 'pointer', textAlign: 'left' }}
            >
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                {item.image_url ? <img src={item.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : null}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>{item.name}</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{item.price_gems ? `${item.price_gems} 💎` : 'Free'}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
