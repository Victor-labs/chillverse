// src/features/safety/ReportModal.tsx
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Flag, X, Check } from 'lucide-react'
import { submitReport, REPORT_REASON_LABELS } from './reports'
import type { ReportReason, ReportTargetType } from './reports'

const REASONS = Object.keys(REPORT_REASON_LABELS) as ReportReason[]

export default function ReportModal({
  reporterId,
  targetType,
  targetId,
  targetLabel,
  onClose,
}: {
  reporterId: string
  targetType: ReportTargetType
  targetId: string
  targetLabel: string
  onClose: () => void
}) {
  const [reason, setReason] = useState<ReportReason | null>(null)
  const [details, setDetails] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState(false)

  async function handleSubmit() {
    if (!reason || submitting) return
    setSubmitting(true)
    setError('')
    const { error: submitError } = await submitReport({
      reporterId, targetType, targetId, reason, details,
    })
    setSubmitting(false)
    if (submitError) {
      setError(submitError)
      return
    }
    setSubmitted(true)
  }

  return createPortal(
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 20 }}
      onClick={() => !submitting && onClose()}
    >
      <div className="neu-card" style={{ width: '100%', maxWidth: 360, padding: 20 }} onClick={e => e.stopPropagation()}>
        {submitted ? (
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(62,207,142,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
              <Check size={20} color="#3ecf8e" />
            </div>
            <p style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>Report submitted</p>
            <p style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 6 }}>
              Thanks for flagging this — our team will review it. If you want it stopped right away, blocking is instant.
            </p>
            <button
              type="button"
              onClick={onClose}
              style={{ width: '100%', marginTop: 16, padding: '10px 0', borderRadius: 10, background: 'var(--accent)', border: 'none', color: '#fff', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}
            >
              Done
            </button>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <Flag size={16} color="#ff6b6b" />
              <p style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>Report {targetLabel}</p>
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--text-dim)', cursor: submitting ? 'not-allowed' : 'pointer', padding: 4 }}
              >
                <X size={16} />
              </button>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 14 }}>
              Our team reviews every report. This won't notify the person you're reporting.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
              {REASONS.map(r => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setReason(r)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '9px 12px', borderRadius: 10, textAlign: 'left', cursor: 'pointer',
                    background: reason === r ? 'rgba(255,107,107,0.1)' : 'var(--surface2)',
                    border: reason === r ? '1px solid rgba(255,107,107,0.35)' : '1px solid rgba(255,255,255,0.05)',
                    color: reason === r ? '#ff6b6b' : 'var(--text)',
                    fontSize: 12.5, fontWeight: 600,
                  }}
                >
                  {REPORT_REASON_LABELS[r]}
                  {reason === r && <Check size={13} />}
                </button>
              ))}
            </div>

            <textarea
              value={details}
              onChange={e => setDetails(e.target.value.slice(0, 500))}
              placeholder="Add any extra detail (optional)"
              rows={3}
              maxLength={500}
              style={{
                width: '100%', background: 'var(--surface)', boxShadow: 'var(--elev-inset)',
                border: '1px solid var(--border)', borderRadius: 10, padding: '9px 12px',
                color: 'var(--text)', fontSize: 12.5, resize: 'none', fontFamily: 'inherit', marginBottom: 12,
              }}
            />

            {error && <p style={{ fontSize: 11.5, color: '#ff6b6b', marginBottom: 10 }}>{error}</p>}

            <button
              type="button"
              onClick={handleSubmit}
              disabled={!reason || submitting}
              style={{
                width: '100%', padding: '10px 0', borderRadius: 10, border: 'none',
                background: !reason || submitting ? 'var(--surface2)' : 'var(--red)',
                color: !reason || submitting ? 'var(--text-dim)' : '#fff',
                fontSize: 12.5, fontWeight: 700, cursor: !reason || submitting ? 'not-allowed' : 'pointer',
              }}
            >
              {submitting ? 'Submitting…' : 'Submit report'}
            </button>
          </>
        )}
      </div>
    </div>,
    document.body,
  )
}
