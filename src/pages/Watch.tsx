import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Film, Baby, Users, Clock, ArrowLeft } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

// ── Types ────────────────────────────────────────────────────────────────────
type Category = 'kids' | 'adult'
type SourceType = 'video' | 'playlist'

interface MovieSource {
  id: string // youtube video or playlist id
  type: SourceType
  title: string
}

type Screen = 'category' | 'player' | 'refresh'

declare global {
  interface Window {
    YT?: {
      Player: new (elementId: string, options: { events: { onStateChange: (e: { data: number }) => void } }) => { destroy: () => void; getPlayerState: () => number }
      PlayerState: { ENDED: number }
    }
    onYouTubeIframeAPIReady?: () => void
  }
}

const CLOSED_IMG = 'https://gnobzfxtxrtcxfhhfjni.supabase.co/storage/v1/object/public/Adverts/Movie/28e5fc395ea155e514992ad139d28208.webp.jpg'
const REFRESH_IMG = 'https://gnobzfxtxrtcxfhhfjni.supabase.co/storage/v1/object/public/Adverts/Movie/file_00000000037c71fb8124569759590e74.png'

const AD_VIDEO_ID = '7WY0cnJ5LNk' // Chillverse ad
const AD_TITLE = 'Advert_chillverse'
const AD_SKIP_AFTER = 5 // seconds before skip button appears

const OPEN_HOUR = 5    // 5:00 AM
const CLOSE_HOUR = 24  // midnight
const REFRESH_INTERVAL = 5 * 60 * 60 * 1000 // 5 hours in ms

// ── Helpers ──────────────────────────────────────────────────────────────────
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function isMovieOpen(): boolean {
  const h = new Date().getHours()
  return h >= OPEN_HOUR && h < CLOSE_HOUR
}

function getSecondsUntilOpen(): number {
  const now = new Date()
  const open = new Date()
  open.setHours(OPEN_HOUR, 0, 0, 0)
  if (now >= open) open.setDate(open.getDate() + 1)
  return Math.floor((open.getTime() - now.getTime()) / 1000)
}

function getSecondsUntilClose(): number {
  const now = new Date()
  const close = new Date()
  close.setHours(23, 59, 59, 0)
  return Math.max(0, Math.floor((close.getTime() - now.getTime()) / 1000))
}

function fmtCountdown(secs: number): string {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function buildEmbedUrl(src: MovieSource): string {
  const params = new URLSearchParams({
    autoplay: '1',
    modestbranding: '1',
    rel: '0',
    disablekb: '1',
    fs: '0',
    iv_load_policy: '3',
    playsinline: '1',
    enablejsapi: '1',
    origin: window.location.origin,
    controls: '0',
  })
  if (src.type === 'playlist') {
    params.set('listType', 'playlist')
    params.set('list', src.id)
    params.set('shuffle', '1')
    return `https://www.youtube.com/embed/videoseries?${params}`
  }
  return `https://www.youtube.com/embed/${src.id}?${params}`
}

// ── Countdown screen (closed) ──────────────────────────────────────────────
function ClosedScreen({ onExit }: { onExit: () => void }) {
  const [secs, setSecs] = useState(getSecondsUntilOpen())
  useEffect(() => {
    const t = setInterval(() => setSecs(getSecondsUntilOpen()), 1000)
    return () => clearInterval(t)
  }, [])

  return (
    <div style={S.root}>
      <Bubbles />
      <div style={S.header}>
        <button onClick={onExit} style={S.backBtn} aria-label="Back to dashboard"><ArrowLeft size={17} /></button>
        <Film size={20} color="#ff9a3c" />
        <span style={S.headerTitle}>Chillverse Movies</span>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 24px 40px' }}>
        <img
          src={CLOSED_IMG}
          alt="Closed"
          style={{ width: '100%', maxWidth: 340, borderRadius: 20, objectFit: 'cover', boxShadow: '0 16px 48px rgba(0,0,0,0.7)', marginBottom: 28 }}
          onError={(e) => { e.currentTarget.style.display = 'none' }}
        />
        <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 18, padding: '20px 28px', textAlign: 'center', width: '100%', maxWidth: 320 }}>
          <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, marginBottom: 8 }}>Movies open at 5:00 AM · Opens in</div>
          <div style={{ color: '#ff9a3c', fontSize: 36, fontWeight: 900, letterSpacing: 2, fontVariantNumeric: 'tabular-nums' }}>
            {fmtCountdown(secs)}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Refresh break screen ─────────────────────────────────────────────────────
function RefreshScreen({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 6000)
    return () => clearTimeout(t)
  }, [onDone])

  return (
    <div style={{ ...S.root, alignItems: 'center', justifyContent: 'center' }}>
      <Bubbles />
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 24, zIndex: 2 }}>
        <img
          src={REFRESH_IMG}
          alt="Refreshing"
          style={{ width: '100%', maxWidth: 320, borderRadius: 20, objectFit: 'cover', boxShadow: '0 16px 48px rgba(0,0,0,0.7)', marginBottom: 24 }}
          onError={(e) => { e.currentTarget.style.display = 'none' }}
        />
        <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,107,0,0.2)', borderRadius: 16, padding: '16px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>✨</div>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: 16, marginBottom: 4 }}>Refreshing your movie feed</div>
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>Shuffling new content for you…</div>
        </div>
      </div>
    </div>
  )
}

// ── Category picker ──────────────────────────────────────────────────────────
function CategoryPicker({ onPick, onExit, secsLeft }: { onPick: (cat: Category) => void; onExit: () => void; secsLeft: number }) {
  return (
    <div style={S.root}>
      <Bubbles />
      <div style={S.header}>
        <button onClick={onExit} style={S.backBtn} aria-label="Back to dashboard"><ArrowLeft size={17} /></button>
        <Film size={20} color="#ff9a3c" />
        <span style={S.headerTitle}>Chillverse Movies</span>
      </div>

      <div style={{ padding: '0 20px', zIndex: 2, flex: 1 }}>
        <div style={{ color: '#fff', fontSize: 22, fontWeight: 900, marginBottom: 4 }}>What are you watching?</div>
        <div style={{ color: 'rgba(255,255,255,0.38)', fontSize: 13, marginBottom: 28 }}>Pick your category to start</div>

        <div onClick={() => onPick('kids')} style={S.catCard}>
          <div style={{ ...S.catIconWrap, background: 'linear-gradient(135deg,#f59e0b,#fbbf24)' }}>
            <Baby size={32} color="#fff" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ color: '#fff', fontSize: 18, fontWeight: 800, marginBottom: 4 }}>Kids</div>
            <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13 }}>Cartoons, shows & fun videos</div>
          </div>
          <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: 22 }}>›</div>
        </div>

        <div onClick={() => onPick('adult')} style={{ ...S.catCard, marginTop: 14 }}>
          <div style={{ ...S.catIconWrap, background: 'linear-gradient(135deg,#ff6b00,#ff9a3c)' }}>
            <Users size={32} color="#fff" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ color: '#fff', fontSize: 18, fontWeight: 800, marginBottom: 4 }}>Adult</div>
            <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13 }}>Movies, series & more</div>
          </div>
          <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: 22 }}>›</div>
        </div>
      </div>

      <Ticker secsLeft={secsLeft} />
    </div>
  )
}

// ── Ad Player ────────────────────────────────────────────────────────────────
function AdPlayer({ onDone }: { onDone: () => void }) {
  const [skipCountdown, setSkipCountdown] = useState(AD_SKIP_AFTER)
  const [canSkip, setCanSkip] = useState(false)
  const adIframeId = useRef(`yt-ad-${Math.random().toString(36).slice(2)}`).current
  const adPlayerRef = useRef<{ destroy: () => void } | null>(null)

  // Countdown to skip
  useEffect(() => {
    const t = setInterval(() => {
      setSkipCountdown(s => {
        if (s <= 1) { setCanSkip(true); clearInterval(t); return 0 }
        return s - 1
      })
    }, 1000)
    return () => clearInterval(t)
  }, [])

  // Attach YT API to detect ad end
  useEffect(() => {
    function attach() {
      if (!window.YT?.Player) return
      adPlayerRef.current?.destroy()
      adPlayerRef.current = new window.YT.Player(adIframeId, {
        events: { onStateChange: (e) => { if (e.data === window.YT!.PlayerState.ENDED) onDone() } },
      })
    }
    if (window.YT?.Player) { attach() }
    else { window.onYouTubeIframeAPIReady = attach }
    return () => { adPlayerRef.current?.destroy(); adPlayerRef.current = null }
  }, [adIframeId, onDone])

  const adUrl = `https://www.youtube.com/embed/${AD_VIDEO_ID}?autoplay=1&modestbranding=1&rel=0&disablekb=1&fs=0&iv_load_policy=3&playsinline=1&enablejsapi=1&origin=${window.location.origin}&controls=0`

  return (
    <div style={{ position: 'relative', borderRadius: 18, overflow: 'hidden', background: '#000', boxShadow: '0 12px 40px rgba(0,0,0,0.7)', marginBottom: 12 }}>
      {/* 16:9 wrapper */}
      <div style={{ paddingTop: '56.25%', position: 'relative' }}>
        <iframe
          id={adIframeId}
          src={adUrl}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
          allow="autoplay; encrypted-media"
          allowFullScreen={false}
          referrerPolicy="strict-origin-when-cross-origin"
        />
        <div style={{ position: 'absolute', inset: 0, zIndex: 10, cursor: 'default' }} onContextMenu={e => e.preventDefault()} />

        {/* AD badge top-left */}
        <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 20, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ background: 'rgba(0,0,0,0.75)', border: '1px solid rgba(255,200,0,0.6)', color: '#ffd700', fontSize: 9, fontWeight: 800, padding: '2px 7px', borderRadius: 5, letterSpacing: '0.8px', textTransform: 'uppercase' }}>AD</span>
          <span style={{ background: 'rgba(0,0,0,0.65)', color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 5 }}>{AD_TITLE}</span>
        </div>

        {/* Skip button bottom-right */}
        <div style={{ position: 'absolute', bottom: 12, right: 12, zIndex: 20 }}>
          {canSkip ? (
            <button onClick={onDone}
              style={{ background: 'rgba(0,0,0,0.8)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff', fontSize: 11, fontWeight: 700, padding: '6px 14px', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              Skip Ad ›
            </button>
          ) : (
            <div style={{ background: 'rgba(0,0,0,0.7)', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.5)', fontSize: 11, padding: '6px 12px', borderRadius: 8 }}>
              Skip in {skipCountdown}s
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Player screen ─────────────────────────────────────────────────────────────
function PlayerScreen({ category, sources, onBack, secsLeft }: { category: Category; sources: MovieSource[]; onBack: () => void; secsLeft: number }) {
  const [idx, setIdx] = useState(0)
  const [showAd, setShowAd] = useState(true) // show ad before first video + between videos
  const shuffled = useRef(shuffle(sources)).current
  const hasContent = shuffled.length > 0
  const current = hasContent ? shuffled[idx % shuffled.length] : null
  const embedUrl = current ? buildEmbedUrl(current) : ''
  const iframeId = useRef(`yt-player-${Math.random().toString(36).slice(2)}`).current
  const playerRef = useRef<{ destroy: () => void } | null>(null)

  // When video ends → show ad before next one
  const advance = useCallback(() => {
    setShowAd(true)
    setIdx(i => i + 1)
  }, [])

  const handleAdDone = useCallback(() => setShowAd(false), [])

  // Bind YT API when showing movie (not ad)
  useEffect(() => {
    if (!hasContent || showAd) return

    function attach() {
      if (!window.YT?.Player) return
      playerRef.current?.destroy()
      playerRef.current = new window.YT.Player(iframeId, {
        events: { onStateChange: (e) => { if (e.data === window.YT!.PlayerState.ENDED) advance() } },
      })
    }

    if (window.YT?.Player) { attach() }
    else {
      if (!document.getElementById('yt-iframe-api')) {
        const tag = document.createElement('script')
        tag.id = 'yt-iframe-api'
        tag.src = 'https://www.youtube.com/iframe_api'
        document.head.appendChild(tag)
      }
      window.onYouTubeIframeAPIReady = attach
    }

    return () => { playerRef.current?.destroy(); playerRef.current = null }
  }, [idx, hasContent, iframeId, advance, showAd])

  return (
    <div style={S.root}>
      <Bubbles />
      <div style={S.header}>
        <button onClick={onBack} style={S.backBtn} aria-label="Back to categories"><ArrowLeft size={17} /></button>
        <span style={S.headerTitle}>{category === 'kids' ? '👶 Kids' : '🎬 Adult'}</span>
      </div>

      <div style={{ padding: '0 16px', zIndex: 2, flex: 1 }}>
        {!hasContent ? (
          <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 18, padding: '32px 20px', textAlign: 'center' }}>
            <Film size={28} color="rgba(255,255,255,0.3)" style={{ marginBottom: 10 }} />
            <div style={{ color: '#fff', fontWeight: 700, fontSize: 15, marginBottom: 6 }}>Nothing queued up yet</div>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>No {category} content has been added for this category yet.</div>
          </div>
        ) : (
          <>
            {/* Ad or Movie player */}
            {showAd ? (
              <AdPlayer onDone={handleAdDone} />
            ) : (
              <div style={{ position: 'relative', borderRadius: 18, overflow: 'hidden', background: '#000', boxShadow: '0 12px 40px rgba(0,0,0,0.7)', marginBottom: 16 }}>
                <div style={{ paddingTop: '56.25%', position: 'relative' }}>
                  <iframe
                    key={`${current!.id}-${idx}`}
                    id={iframeId}
                    src={embedUrl}
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
                    allow="autoplay; encrypted-media; picture-in-picture"
                    allowFullScreen={false}
                    referrerPolicy="strict-origin-when-cross-origin"
                  />
                  <div style={{ position: 'absolute', inset: 0, zIndex: 10, cursor: 'default' }} onContextMenu={(e) => e.preventDefault()} />
                </div>
              </div>
            )}

            {/* Now playing info — only show when movie is playing */}
            {!showAd && (
              <>
                <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ff6b00', boxShadow: '0 0 8px #ff6b00', animation: 'blink 1.2s infinite' }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginBottom: 2 }}>NOW PLAYING</div>
                    <div style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>{current!.title}</div>
                  </div>
                  <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: 12 }}>{idx + 1} / {shuffled.length}</div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: '12px 16px' }}>
                  <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, lineHeight: 1.6 }}>
                    🔒 Content is curated and auto-plays. Next content loads automatically when this ends.
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>

      <Ticker secsLeft={secsLeft} />
      <style>{`@keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.3} }`}</style>
    </div>
  )
}

// ── Ticker ────────────────────────────────────────────────────────────────────
function Ticker({ secsLeft: initialSecs }: { secsLeft: number }) {
  const [secs, setSecs] = useState(initialSecs)
  useEffect(() => {
    setSecs(getSecondsUntilClose())
    const t = setInterval(() => setSecs(getSecondsUntilClose()), 1000)
    return () => clearInterval(t)
  }, [])

  return (
    <div style={{ position: 'sticky', bottom: 0, zIndex: 20, padding: '10px 16px 16px', background: 'linear-gradient(0deg,rgba(17,17,19,1) 60%,transparent)' }}>
      <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '9px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <Clock size={13} color="rgba(255,255,255,0.4)" />
        <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>Movie page closes in</span>
        <span style={{ color: '#ff9a3c', fontWeight: 800, fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>{fmtCountdown(secs)}</span>
      </div>
    </div>
  )
}

// ── Ambient bubbles ───────────────────────────────────────────────────────────
function Bubbles() {
  const specs = [
    { top: '5%', left: '-12%', w: 200, a: 'wf0', d: '7s' },
    { top: '20%', right: '-10%', w: 150, a: 'wf1', d: '9s' },
    { bottom: '25%', left: '-6%', w: 130, a: 'wf2', d: '6s' },
    { bottom: '8%', right: '-8%', w: 170, a: 'wf0', d: '8s' },
  ]
  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
      {specs.map((b, i) => (
        <div key={i} style={{
          position: 'absolute', borderRadius: '50%',
          width: b.w, height: b.w,
          ...(b.top ? { top: b.top } : {}), ...(b.bottom ? { bottom: b.bottom } : {}),
          ...(b.left ? { left: b.left } : {}), ...(b.right ? { right: b.right } : {}),
          background: 'radial-gradient(circle,rgba(255,107,0,0.08) 0%,transparent 70%)',
          filter: 'blur(30px)',
          animationName: b.a, animationDuration: b.d,
          animationTimingFunction: 'ease-in-out', animationIterationCount: 'infinite',
        }} />
      ))}
      <style>{`
        @keyframes wf0 { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-18px)} }
        @keyframes wf1 { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-22px)} }
        @keyframes wf2 { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-12px)} }
      `}</style>
    </div>
  )
}

// ── Root page ─────────────────────────────────────────────────────────────────
export default function Watch() {
  const navigate = useNavigate()
  const { session } = useAuth()
  const myId = session?.user?.id ?? null
  const [open, setOpen] = useState(isMovieOpen())
  const [screen, setScreen] = useState<Screen>('category')
  const [category, setCategory] = useState<Category | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [sourcesByCategory, setSourcesByCategory] = useState<Record<Category, MovieSource[]>>({ kids: [], adult: [] })
  const [sourcesLoaded, setSourcesLoaded] = useState(false)
  const refreshTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  // Presence channel ref — kept so we can remove it on unmount
  const presenceChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  const goToDashboard = () => navigate('/dashboard')

  // ── Broadcast "watching movie" presence for the live ticker on other
  //    users' profiles. Uses Supabase Realtime Presence so it is:
  //      • Instant — no DB poll delay
  //      • Automatic — disappears the moment the tab closes / user leaves
  //      • Zero DB writes — purely in-memory on the Supabase realtime server
  useEffect(() => {
    if (!myId) return

    const channel = supabase.channel(`user-activity:${myId}`, {
      config: { presence: { key: myId } },
    })

    channel
      .on('presence', { event: 'sync' }, () => {}) // required to activate
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ activity: 'watching_movie', since: Date.now() })
        }
      })

    presenceChannelRef.current = channel

    // When the user leaves the Watch page, presence is automatically
    // cleared — Supabase removes it when the channel is unsubscribed.
    return () => {
      channel.untrack().then(() => supabase.removeChannel(channel))
      presenceChannelRef.current = null
    }
  }, [myId])

  // Load active movie sources from Supabase once
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('movie_sources')
        .select('category, type, youtube_id, title')
        .eq('active', true)
        .order('sort_order', { ascending: true })
      if (error) { console.error('movie_sources load error:', error); setSourcesLoaded(true); return }

      const grouped: Record<Category, MovieSource[]> = { kids: [], adult: [] }
      for (const row of data ?? []) {
        const cat = row.category as Category
        grouped[cat].push({ id: row.youtube_id, type: row.type as SourceType, title: row.title })
      }
      setSourcesByCategory(grouped)
      setSourcesLoaded(true)
    })()
  }, [])

  // Check open/close every 30s
  useEffect(() => {
    const t = setInterval(() => setOpen(isMovieOpen()), 30000)
    return () => clearInterval(t)
  }, [])

  // 5-hour refresh cycle
  useEffect(() => {
    if (!open) return
    refreshTimer.current = setInterval(() => setScreen('refresh'), REFRESH_INTERVAL)
    return () => { if (refreshTimer.current) clearInterval(refreshTimer.current) }
  }, [open, refreshKey])

  const handleRefreshDone = () => {
    setRefreshKey(k => k + 1)
    setScreen('category')
    setCategory(null)
  }

  const handlePick = (cat: Category) => {
    setCategory(cat)
    setScreen('player')
  }

  if (!open) return <ClosedScreen onExit={goToDashboard} />
  if (screen === 'refresh') return <RefreshScreen onDone={handleRefreshDone} />
  if (screen === 'player' && category) {
    return (
      <PlayerScreen
        key={refreshKey}
        category={category}
        sources={sourcesLoaded ? sourcesByCategory[category] : []}
        onBack={() => setScreen('category')}
        secsLeft={getSecondsUntilClose()}
      />
    )
  }
  return <CategoryPicker onPick={handlePick} onExit={goToDashboard} secsLeft={getSecondsUntilClose()} />
}

// ── Styles ────────────────────────────────────────────────────────────────────
const S: Record<string, React.CSSProperties> = {
  root: {
    minHeight: '100vh', background: '#111113',
    fontFamily: "'Inter',sans-serif",
    display: 'flex', flexDirection: 'column',
    position: 'relative', overflowX: 'hidden',
  },
  header: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '52px 20px 16px', position: 'relative', zIndex: 2,
  },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: 800 },
  backBtn: {
    width: 36, height: 36, borderRadius: 10,
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.09)',
    color: '#fff', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: "'Inter',sans-serif", flexShrink: 0,
  },
  catCard: {
    display: 'flex', alignItems: 'center', gap: 16,
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 18, padding: '18px 16px',
    cursor: 'pointer', transition: 'transform 0.15s, background 0.15s',
    boxShadow: '4px 4px 12px rgba(0,0,0,0.4), -1px -1px 6px rgba(255,255,255,0.02)',
  },
  catIconWrap: {
    width: 60, height: 60, borderRadius: 16,
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
  },
}
