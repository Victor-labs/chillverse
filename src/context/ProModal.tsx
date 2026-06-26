// src/context/ProModal.tsx
import { useState, useEffect, useRef } from 'react'
import { X, Crown, Zap } from 'lucide-react'

interface Slide {
  type: 'image' | 'video'
  src: string
  text: string
}

interface ProModalProps {
  visible: boolean
  onClose: () => void
  onGoPro?: () => void
}

const SLIDES: Slide[] = [
  {
    type: 'video',
    src: 'https://gnobzfxtxrtcxfhhfjni.supabase.co/storage/v1/object/public/Adverts/Go%20pro/7b061d6fb30ca32a12b9919ce0b32ffd_720w.mp4',
    text: 'Enjoy higher limit sessions',
  },
  {
    type: 'image',
    src: 'https://gnobzfxtxrtcxfhhfjni.supabase.co/storage/v1/object/public/Adverts/Go%20pro/file_00000000b478722f930745622a15686c.png',
    text: 'What you get from premium...',
  },
  {
    type: 'image',
    src: 'https://gnobzfxtxrtcxfhhfjni.supabase.co/storage/v1/object/public/Adverts/Go%20pro/file_0000000064ec722fba2390457cd3558b.png',
    text: 'Higher session limits for your gameplay!',
  },
  {
    type: 'image',
    src: 'https://gnobzfxtxrtcxfhhfjni.supabase.co/storage/v1/object/public/Adverts/Go%20pro/file_000000003530722fb8d89d5ce311a994.png',
    text: 'Sleek avatars...',
  },
  {
    type: 'image',
    src: 'https://gnobzfxtxrtcxfhhfjni.supabase.co/storage/v1/object/public/Adverts/Go%20pro/file_00000000098871f6b629201e0ace9eec.png',
    text: 'Each version upgrade for exploration!',
  },
  {
    type: 'image',
    src: 'https://gnobzfxtxrtcxfhhfjni.supabase.co/storage/v1/object/public/Adverts/Go%20pro/3b048c91dea684276581af9c7a6fe2bc.jpg',
    text: 'More movies at your disposal',
  },
  {
    type: 'image',
    src: 'https://gnobzfxtxrtcxfhhfjni.supabase.co/storage/v1/object/public/Adverts/Go%20pro/3a4708dd6445d7d58fba9e786570c389.jpg',
    text: 'More multiplayer games...',
  },
  {
    type: 'image',
    src: 'https://gnobzfxtxrtcxfhhfjni.supabase.co/storage/v1/object/public/Adverts/Go%20pro/01f7a240defbdbd9d40b9fc78ee6ee50.gif',
    text: 'Sleek Avatar boosts your profile, Go get one now...',
  },
  {
    type: 'video',
    src: 'https://gnobzfxtxrtcxfhhfjni.supabase.co/storage/v1/object/public/Adverts/Go%20pro/4d513c5779590a4a404d3f324f8c4d11_720w.mp4',
    text: 'Enjoy multiple versions that bring about nice, smooth animations.',
  },
]

const INTERVAL = 4000
const FIRST_SLIDE_DELAY = 6000

export function ProModal({ visible, onClose, onGoPro }: ProModalProps) {
  const [idx, setIdx] = useState<number>(0)
  const [contentVisible, setContentVisible] = useState<boolean>(true)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)

  useEffect(() => {
    if (!visible) return
    setIdx(0)
    setContentVisible(true)
  }, [visible])

  useEffect(() => {
    if (!visible) return
    // First slide gets 6s, subsequent slides get 4s
    const delay = idx === 0 ? FIRST_SLIDE_DELAY : INTERVAL
    timerRef.current = setTimeout(() => {
      setContentVisible(false)
      setTimeout(() => {
        setIdx(i => (i + 1) % SLIDES.length)
        setContentVisible(true)
      }, 450)
    }, delay)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [visible, idx])

  useEffect(() => {
    if (SLIDES[idx].type === 'video' && videoRef.current) {
      videoRef.current.currentTime = 0
      videoRef.current.play().catch(() => {})
    }
  }, [idx])

  const jumpTo = (i: number) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setContentVisible(false)
    setTimeout(() => { setIdx(i); setContentVisible(true) }, 450)
  }

  if (!visible) return null

  const slide = SLIDES[idx]

  return (
    <>
      <style>{`
        @keyframes cv-modalIn   { 0%{opacity:0;transform:scale(0.92)} 100%{opacity:1;transform:scale(1)} }
        @keyframes cv-overlayIn { 0%{opacity:0} 100%{opacity:1} }
        @keyframes cv-shimmer   { 0%{background-position:-200% center} 100%{background-position:200% center} }
        @keyframes cv-crown     { 0%,100%{transform:scale(1) rotate(-8deg)} 50%{transform:scale(1.15) rotate(-8deg)} }
        @keyframes cv-dot       { 0%,100%{opacity:0.5} 50%{opacity:1} }
      `}</style>

      <div onClick={onClose} style={{
        position:'fixed',inset:0,zIndex:9999,
        background:'rgba(0,0,0,0.80)',backdropFilter:'blur(14px)',
        display:'flex',alignItems:'center',justifyContent:'center',
        padding:'24px 20px',
        animation:'cv-overlayIn 0.3s ease forwards',
        fontFamily:"'Inter',sans-serif",
      }}>
        <div onClick={e=>e.stopPropagation()} style={{
          width:'100%',maxWidth:360,
          background:'linear-gradient(160deg,#1c1c22,#141418)',
          border:'1px solid rgba(255,255,255,0.09)',
          borderRadius:28,
          boxShadow:'0 32px 80px rgba(0,0,0,0.85),0 0 0 1px rgba(255,107,0,0.08)',
          overflow:'hidden',
          animation:'cv-modalIn 0.35s cubic-bezier(0.34,1.3,0.64,1) forwards',
          position:'relative',
        }}>

          {/* Top shimmer strip */}
          <div style={{
            position:'absolute',top:0,left:0,right:0,height:2,
            background:'linear-gradient(90deg,transparent,#ff6b00,#ff9a3c,#ff6b00,transparent)',
            backgroundSize:'200% 100%',animation:'cv-shimmer 3s linear infinite',
          }}/>

          {/* Header */}
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'18px 18px 12px'}}>
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <div style={{
                width:34,height:34,borderRadius:10,
                background:'linear-gradient(135deg,#ff6b00,#ff9a3c)',
                display:'flex',alignItems:'center',justifyContent:'center',
                boxShadow:'0 4px 14px rgba(255,107,0,0.45)',
                animation:'cv-crown 2.5s ease-in-out infinite',
              }}>
                <Crown size={17} color="#fff" fill="#fff"/>
              </div>
              <div>
                <div style={{color:'#fff',fontWeight:800,fontSize:15}}>Go Premium</div>
                <div style={{color:'rgba(255,255,255,0.38)',fontSize:11}}>Unlock the full Chillverse</div>
              </div>
            </div>
            <button onClick={onClose} style={{
              width:30,height:30,borderRadius:8,
              background:'rgba(255,255,255,0.07)',
              border:'1px solid rgba(255,255,255,0.1)',
              display:'flex',alignItems:'center',justifyContent:'center',
              cursor:'pointer',color:'rgba(255,255,255,0.5)',
            }}>
              <X size={14}/>
            </button>
          </div>

          {/* Carousel card */}
          <div style={{padding:'0 14px'}}>
            <div style={{
              borderRadius:20,overflow:'hidden',
              background:'rgba(255,255,255,0.03)',
              border:'1px solid rgba(255,255,255,0.07)',
              boxShadow:'inset 0 2px 8px rgba(0,0,0,0.3)',
            }}>
              {/* Media */}
              <div style={{position:'relative',width:'100%',height:210,background:'#0d0d10',overflow:'hidden'}}>
                {slide.type === 'video' ? (
                  <video
                    key={idx} ref={videoRef}
                    src={slide.src} autoPlay muted loop playsInline
                    style={{width:'100%',height:'100%',objectFit:'cover',display:'block',
                      transition:'opacity 0.45s ease',opacity:contentVisible?1:0}}
                  />
                ) : (
                  <img
                    key={idx} src={slide.src} alt={`slide-${idx+1}`}
                    style={{width:'100%',height:'100%',objectFit:'cover',display:'block',
                      transition:'opacity 0.45s ease',opacity:contentVisible?1:0}}
                    onError={e=>{(e.target as HTMLImageElement).style.opacity='0'}}
                  />
                )}
                {/* Counter badge */}
                <div style={{
                  position:'absolute',top:10,right:10,
                  background:'rgba(0,0,0,0.6)',backdropFilter:'blur(6px)',
                  borderRadius:8,padding:'3px 8px',
                  color:'rgba(255,255,255,0.6)',fontSize:10,fontWeight:700,
                }}>{idx+1} / {SLIDES.length}</div>
              </div>

              {/* Caption */}
              <div style={{padding:'14px 16px 16px',minHeight:56,display:'flex',alignItems:'center',justifyContent:'center'}}>
                <p style={{
                  color:'#fff',fontSize:14,fontWeight:600,
                  textAlign:'center',lineHeight:1.5,margin:0,
                  transition:'opacity 0.45s ease,transform 0.45s ease',
                  opacity:contentVisible?1:0,
                  transform:contentVisible?'translateY(0)':'translateY(6px)',
                }}>{slide.text}</p>
              </div>
            </div>
          </div>

          {/* Dots */}
          <div style={{display:'flex',justifyContent:'center',gap:6,padding:'12px 0 4px'}}>
            {SLIDES.map((_,i)=>(
              <div key={i} onClick={()=>jumpTo(i)} style={{
                width:i===idx?18:6,height:6,borderRadius:3,
                background:i===idx?'linear-gradient(90deg,#ff6b00,#ff9a3c)':'rgba(255,255,255,0.18)',
                cursor:'pointer',
                transition:'width 0.35s ease,background 0.35s ease',
                animation:i===idx?'cv-dot 2s infinite':'none',
              }}/>
            ))}
          </div>

          {/* Go Pro button */}
          <div style={{padding:'12px 14px 18px'}}>
            <button
              onClick={onGoPro??onClose}
              style={{
                width:'100%',
                background:'linear-gradient(135deg,#ff6b00,#ff9a3c)',
                border:'none',borderRadius:16,padding:'14px 20px',
                display:'flex',alignItems:'center',justifyContent:'center',gap:8,
                cursor:'pointer',
                boxShadow:'0 6px 24px rgba(255,107,0,0.45)',
                fontFamily:"'Inter',sans-serif",
                transition:'opacity 0.2s,transform 0.15s',
                position:'relative',overflow:'hidden',
              }}
              onMouseEnter={e=>(e.currentTarget.style.opacity='0.9')}
              onMouseLeave={e=>(e.currentTarget.style.opacity='1')}
              onMouseDown={e=>(e.currentTarget.style.transform='scale(0.97)')}
              onMouseUp={e=>(e.currentTarget.style.transform='scale(1)')}
            >
              <div style={{
                position:'absolute',inset:0,
                background:'linear-gradient(90deg,transparent 0%,rgba(255,255,255,0.15) 50%,transparent 100%)',
                backgroundSize:'200% 100%',animation:'cv-shimmer 2.5s linear infinite',
              }}/>
              <Zap size={16} color="#fff" fill="#fff" style={{position:'relative',zIndex:1}}/>
              <span style={{color:'#fff',fontSize:15,fontWeight:800,letterSpacing:0.3,position:'relative',zIndex:1}}>
                Go Premium
              </span>
            </button>
            <p style={{color:'rgba(255,255,255,0.25)',fontSize:11,textAlign:'center',marginTop:8,lineHeight:1.4}}>
              Tap to view plans &amp; pricing
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
