// src/features/careers/JobCard.tsx
import { useNavigate } from 'react-router-dom'
import { ripple } from '../../shared/lib/ripple'
import type { JobOpening } from './api'

export default function JobCard({ job }: { job: JobOpening }) {
  const navigate = useNavigate()

  return (
    <button
      type="button"
      onClick={(e) => { ripple(e); navigate(`/work/${job.slug}`) }}
      className="ripple-wrap"
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left',
        cursor: 'pointer', width: '100%', padding: 18, borderRadius: 16,
        background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
        transition: 'border-color 200ms, background 200ms',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ltext-sec, #9b96c0)' }}>
          {job.category}
        </span>
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

      <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--ltext, #f2f0fb)', margin: '0 0 6px', lineHeight: 1.3 }}>
        {job.title}
      </h3>
      <p style={{ fontSize: 12.5, color: 'var(--ltext-sec, #9b96c0)', margin: 0, lineHeight: 1.5 }}>
        {job.summary}
      </p>
    </button>
  )
}
