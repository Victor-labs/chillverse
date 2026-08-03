// src/features/careers/JobApplyComingSoon.tsx
// Placeholder for the Phase 2 application form (see We_are_building spec).
// Wired in now so /work/:slug/apply is a real, non-404 destination for the
// "Apply Now" button, and can be swapped for the real multi-step form
// without touching JobDetail's link.
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { ripple } from '../../shared/lib/ripple'
import Nav from '../../layout/Nav'
import Footer from '../../layout/Footer'
import Seo from '../../shared/components/Seo'
import { fetchJobBySlug, type JobOpening } from './api'

export default function JobApplyComingSoon() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const [job, setJob] = useState<JobOpening | null>(null)

  useEffect(() => {
    if (!slug) return
    let active = true
    fetchJobBySlug(slug).then(({ data }) => { if (active) setJob(data) })
    return () => { active = false }
  }, [slug])

  return (
    <div
      className="landing-root"
      style={{ margin: '-32px calc(-1 * clamp(1rem, 4vw, 2.5rem)) -64px', padding: '32px clamp(1rem, 4vw, 2.5rem) 64px' }}
    >
      <div style={{ maxWidth: 560, margin: '0 auto' }}>
        <Seo title="Apply" description="Apply for a role at Chillverse." path={`/work/${slug ?? ''}/apply`} noindex />
        <Nav />

        <div style={{ paddingTop: 96 }}>
          <button
            type="button"
            onClick={(e) => { ripple(e); navigate(`/work/${slug ?? ''}`) }}
            className="ripple-wrap"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none',
              color: 'var(--ltext-sec, #9b96c0)', fontSize: 13.5, fontWeight: 600, cursor: 'pointer',
              padding: '6px 0', marginBottom: 28,
            }}
          >
            <ChevronLeft size={16} /> Back
          </button>

          <div style={{ textAlign: 'center', padding: '40px 24px' }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--ltext, #f2f0fb)', margin: '0 0 10px' }}>
              Applications open soon
            </h1>
            <p style={{ fontSize: 14, color: 'var(--ltext-sec, #9b96c0)', lineHeight: 1.6, maxWidth: 400, margin: '0 auto' }}>
              {job ? `We're finishing up the application form for ${job.title}.` : "We're finishing up the application form."} Check back shortly, or follow Chillverse's socials for an announcement.
            </p>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 96 }}>
        <Footer />
      </div>
    </div>
  )
}
