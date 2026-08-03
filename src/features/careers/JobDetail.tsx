// src/features/careers/JobDetail.tsx
import { useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { ripple } from '../../shared/lib/ripple'
import { renderLiteMarkdown } from '../../shared/lib/markdownLite'
import Nav from '../../layout/Nav'
import Footer from '../../layout/Footer'
import Seo from '../../shared/components/Seo'
import { fetchJobBySlug, type JobOpening } from './api'

export default function JobDetail() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()

  const [job, setJob] = useState<JobOpening | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!slug) return
    let active = true
    setLoading(true)
    setError(null)
    fetchJobBySlug(slug).then(({ data }) => {
      if (!active) return
      if (!data) setError('This role could not be found — it may have closed.')
      setJob(data)
      setLoading(false)
    })
    return () => { active = false }
  }, [slug])

  return (
    <div
      className="landing-root"
      style={{ margin: '-32px calc(-1 * clamp(1rem, 4vw, 2.5rem)) -64px', padding: '32px clamp(1rem, 4vw, 2.5rem) 64px' }}
    >
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <Seo
          title={job ? job.title : 'Open Role'}
          description={job ? job.summary : 'Explore open roles at Chillverse.'}
          path={`/work/${slug ?? ''}`}
        />
        <Nav />

        <div style={{ paddingTop: 96 }}>
          <button
            type="button"
            onClick={(e) => { ripple(e); navigate('/work') }}
            className="ripple-wrap"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none',
              color: 'var(--ltext-sec, #9b96c0)', fontSize: 13.5, fontWeight: 600, cursor: 'pointer',
              padding: '6px 0', marginBottom: 28,
            }}
          >
            <ChevronLeft size={16} /> All roles
          </button>

          {loading && (
            <p style={{ textAlign: 'center', color: 'var(--ltext-muted, #5a5678)', fontSize: 13.5 }}>Loading…</p>
          )}

          {!loading && error && (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <p style={{ fontSize: 15, color: 'var(--ltext, #f2f0fb)', fontWeight: 700, marginBottom: 8 }}>{error}</p>
              <Link to="/work" style={{ color: 'var(--brand-violet, #7c66ff)', fontSize: 13.5 }}>← See all open roles</Link>
            </div>
          )}

          {!loading && job && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ltext-sec, #9b96c0)' }}>
                  {job.category}
                </span>
                <span style={{ color: 'var(--ltext-muted, #5a5678)', fontSize: 11 }}>·</span>
                <span
                  style={{
                    fontSize: 10.5, fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase',
                    padding: '3px 9px', borderRadius: 999,
                    color: job.compensation === 'paid' ? '#8ef0c0' : '#f0d68e',
                    background: job.compensation === 'paid' ? 'rgba(62,207,142,0.14)' : 'rgba(240,214,142,0.14)',
                    border: `1px solid ${job.compensation === 'paid' ? 'rgba(62,207,142,0.3)' : 'rgba(240,214,142,0.3)'}`,
                  }}
                >
                  {job.compensation === 'paid' ? 'Paid' : 'Voluntary'}
                </span>
              </div>

              <h1
                style={{
                  fontSize: 'clamp(26px, 4.5vw, 38px)', fontWeight: 800, color: 'var(--ltext, #f2f0fb)',
                  margin: '0 0 28px', lineHeight: 1.15,
                }}
              >
                {job.title}
              </h1>

              <div style={{ fontSize: 15, color: 'var(--ltext-sec, #9b96c0)', lineHeight: 1.75 }}>
                {renderLiteMarkdown(job.description)}
              </div>

              <div style={{ marginTop: 44, textAlign: 'center' }}>
                <button
                  type="button"
                  onClick={(e) => { ripple(e); navigate(`/work/${job.slug}/apply`) }}
                  className="ripple-wrap"
                  style={{
                    padding: '14px 36px', borderRadius: 999, fontSize: 14.5, fontWeight: 800, color: '#fff',
                    background: 'linear-gradient(135deg, var(--brand-violet, #7c66ff), #3d1fb5)', border: 'none',
                    cursor: 'pointer', boxShadow: '0 4px 18px rgba(108,80,255,0.28)',
                  }}
                >
                  Apply Now
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <div style={{ marginTop: 96 }}>
        <Footer />
      </div>
    </div>
  )
}
