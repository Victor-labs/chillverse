// src/features/careers/WorkLanding.tsx
// Public "Work at Chillverse" careers landing page — reachable by anyone,
// signed in or not. Phase 1 of the careers spec: hero, a live photo
// carousel pulled from storage, a side-by-side "build the future" section,
// and a searchable grid of open roles that leads into the job detail page.
import { useEffect, useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import Nav from '../../layout/Nav'
import Footer from '../../layout/Footer'
import Seo from '../../shared/components/Seo'
import { fetchJobOpenings, fetchWorkerCarouselImages, type JobOpening } from './api'
import WorkerCarousel from './WorkerCarousel'
import JobCard from './JobCard'

const SIDE_IMAGE = 'https://gnobzfxtxrtcxfhhfjni.supabase.co/storage/v1/object/public/Adverts/Workers/8aff8227fd1e2fc002ee933f5d67a7bd.jpg'

const JSON_LD = [
  {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Chillverse', item: 'https://chillverse.com.ng/' },
      { '@type': 'ListItem', position: 2, name: 'Work at Chillverse', item: 'https://chillverse.com.ng/work' },
    ],
  },
]

export default function WorkLanding() {
  const [jobs, setJobs] = useState<JobOpening[]>([])
  const [loadingJobs, setLoadingJobs] = useState(true)
  const [images, setImages] = useState<string[]>([])
  const [query, setQuery] = useState('')

  useEffect(() => {
    let active = true
    fetchJobOpenings().then(({ data }) => { if (active) setJobs(data) }).finally(() => { if (active) setLoadingJobs(false) })
    fetchWorkerCarouselImages().then(({ data }) => { if (active) setImages(data) })
    return () => { active = false }
  }, [])

  const filteredJobs = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return jobs
    return jobs.filter(j =>
      j.title.toLowerCase().includes(q) ||
      j.category.toLowerCase().includes(q) ||
      j.summary.toLowerCase().includes(q),
    )
  }, [jobs, query])

  return (
    <div
      className="landing-root"
      style={{ margin: '-32px calc(-1 * clamp(1rem, 4vw, 2.5rem)) -64px', padding: '32px clamp(1rem, 4vw, 2.5rem) 64px' }}
    >
      <div style={{ maxWidth: 1160, margin: '0 auto' }}>
        <Seo
          title="Work at Chillverse"
          description="Join a team of creators, innovators, and problem-solvers building the future of Chillverse. Explore open roles across engineering, design, marketing, and community."
          path="/work"
          jsonLd={JSON_LD}
        />
        <Nav />

        {/* ── Hero ── */}
        <div style={{ textAlign: 'center', maxWidth: 720, margin: '96px auto 0' }}>
          <h1
            style={{
              fontSize: 'clamp(30px, 5.5vw, 48px)', fontWeight: 800, color: 'var(--ltext, #f2f0fb)',
              margin: '0 0 16px', letterSpacing: '0.02em', lineHeight: 1.08, textTransform: 'uppercase',
              fontFamily: "'Orbitron', sans-serif",
            }}
          >
            Work at Chillverse
          </h1>
          <p style={{ fontSize: 15.5, color: 'var(--ltext-sec, #9b96c0)', lineHeight: 1.6, margin: '0 0 6px' }}>
            Join a team of creators, innovators, and problem-solvers building the future of Chillverse.
          </p>
          <p style={{ fontSize: 15.5, color: 'var(--ltext-sec, #9b96c0)', lineHeight: 1.6, margin: 0 }}>
            Your ideas, skills, and passion can help shape experiences for a global community.
          </p>
        </div>

        {/* ── Photo carousel ── */}
        {images.length > 0 && (
          <div style={{ marginTop: 48 }}>
            <WorkerCarousel images={images} />
          </div>
        )}

        {/* ── Build the future — image beside text on tablet+, image first on phone ── */}
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 40, marginTop: 96,
            flexDirection: 'column-reverse',
          }}
          className="work-split-section"
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--brand-violet, #7c66ff)', marginBottom: 10 }}>
              Why Chillverse
            </div>
            <h2
              style={{
                fontSize: 'clamp(24px, 3.6vw, 34px)', fontWeight: 800, color: 'var(--ltext, #f2f0fb)',
                margin: '0 0 16px', lineHeight: 1.18, textTransform: 'uppercase',
                fontFamily: "'Orbitron', sans-serif",
              }}
            >
              Build the Future of Chillverse
            </h2>
            <p style={{ fontSize: 15, color: 'var(--ltext-sec, #9b96c0)', lineHeight: 1.65, margin: 0, maxWidth: 480 }}>
              Every great platform is built by passionate people. At Chillverse, you'll work on
              meaningful projects, collaborate with talented teammates, and help shape the future
              of our community.
            </p>
          </div>
          <div style={{ flex: 1, minWidth: 0, width: '100%' }}>
            <img
              src={SIDE_IMAGE}
              alt="A member of the Chillverse team at work"
              style={{ width: '100%', maxWidth: 480, height: 'auto', borderRadius: 20, display: 'block', margin: '0 auto' }}
              loading="lazy"
            />
          </div>
        </div>

        {/* ── Open roles ── */}
        <div style={{ marginTop: 112 }}>
          <div style={{ textAlign: 'center', maxWidth: 620, margin: '0 auto 36px' }}>
            <h2
              style={{
                fontSize: 'clamp(24px, 3.6vw, 34px)', fontWeight: 800, color: 'var(--ltext, #f2f0fb)',
                margin: '0 0 12px', lineHeight: 1.18, textTransform: 'uppercase',
                fontFamily: "'Orbitron', sans-serif",
              }}
            >
              Join the Minds Behind Chillverse
            </h2>
            <p style={{ fontSize: 15, color: 'var(--ltext-sec, #9b96c0)', margin: 0 }}>
              Explore Open Roles
            </p>
          </div>

          {/* Search */}
          <div style={{ maxWidth: 480, margin: '0 auto 40px', position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: 'var(--ltext-muted, #5a5678)' }} />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search roles or categories…"
              style={{
                width: '100%', padding: '13px 16px 13px 44px', borderRadius: 999,
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                color: 'var(--ltext, #f2f0fb)', fontSize: 14, outline: 'none',
              }}
            />
          </div>

          {loadingJobs ? (
            <p style={{ textAlign: 'center', color: 'var(--ltext-muted, #5a5678)', fontSize: 13.5 }}>Loading open roles…</p>
          ) : filteredJobs.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--ltext-muted, #5a5678)', fontSize: 13.5 }}>
              {jobs.length === 0 ? 'No open roles right now — check back soon.' : 'No roles match your search.'}
            </p>
          ) : (
            <div
              style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}
            >
              {filteredJobs.map(job => <JobCard key={job.id} job={job} />)}
            </div>
          )}
        </div>
      </div>

      <div style={{ marginTop: 96 }}>
        <Footer />
      </div>

      <style>{`
        @media (min-width: 768px) {
          .work-split-section { flex-direction: row !important; }
        }
      `}</style>
    </div>
  )
}
