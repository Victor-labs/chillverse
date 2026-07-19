// src/features/support/MyTickets.tsx
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Inbox } from 'lucide-react'
import { ripple } from '../../shared/lib/ripple'
import { useAuth } from '../auth/useAuth'
import { fetchMyTickets } from './api'
import {
  SUPPORT_TICKET_STATUS_LABELS, SUPPORT_TICKET_STATUS_COLORS,
  SUPPORT_TICKET_PRIORITY_LABELS, SUPPORT_TICKET_PRIORITY_COLORS,
} from './constants'
import StatusBadge from './components/StatusBadge'
import type { SupportTicket } from '../../shared/types'

export default function MyTickets() {
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()

  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      setLoading(false)
      return
    }
    let active = true
    setLoading(true)
    fetchMyTickets(user.id)
      .then(data => { if (active) { setTickets(data); setError(null) } })
      .catch((err: Error) => { if (active) setError(err.message || 'Could not load your tickets.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [user, authLoading])

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <button
        type="button"
        onClick={() => navigate('/support')}
        style={{
          display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none',
          color: 'var(--text-dim)', fontSize: 13, fontWeight: 600, cursor: 'pointer', marginBottom: 18, padding: 0,
        }}
      >
        <ArrowLeft size={15} /> Back to Help Center
      </button>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22, gap: 12, flexWrap: 'wrap' }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)' }}>My Tickets</h1>
        <button
          type="button"
          onClick={(e) => { ripple(e); navigate('/support/tickets/new') }}
          className="ripple-wrap"
          style={{
            display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, fontWeight: 700, color: '#fff',
            padding: '9px 15px', borderRadius: 10, border: 'none', cursor: 'pointer',
            background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
          }}
        >
          <Plus size={14} /> New ticket
        </button>
      </div>

      {error && <div style={errorBoxStyle}>{error}</div>}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-dim)', fontSize: 13.5 }}>Loading…</div>
      ) : tickets.length === 0 ? (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
          padding: '48px 20px', textAlign: 'center',
        }}>
          <Inbox size={30} color="var(--text-muted)" />
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>No tickets yet</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-muted)', maxWidth: 320 }}>
            When you contact support, your requests and their status will show up here.
          </div>
        </div>
      ) : (
        tickets.map(ticket => (
          <div key={ticket.id} style={ticketCardStyle}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', minWidth: 0 }}>{ticket.subject}</div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <StatusBadge
                  label={SUPPORT_TICKET_STATUS_LABELS[ticket.status]}
                  color={SUPPORT_TICKET_STATUS_COLORS[ticket.status]}
                />
                <StatusBadge
                  label={SUPPORT_TICKET_PRIORITY_LABELS[ticket.priority]}
                  color={SUPPORT_TICKET_PRIORITY_COLORS[ticket.priority]}
                />
              </div>
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.6, marginBottom: 10 }}>
              {ticket.message}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              Submitted {new Date(ticket.created_at).toLocaleString()}
            </div>
          </div>
        ))
      )}
    </div>
  )
}

const ticketCardStyle: React.CSSProperties = {
  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16,
  padding: '16px 18px', marginBottom: 12,
  boxShadow: 'var(--elev-raise-sm)',
}

const errorBoxStyle: React.CSSProperties = {
  background: 'rgba(255,79,79,0.08)', border: '1px solid rgba(255,79,79,0.25)', borderRadius: 12,
  padding: '12px 16px', color: '#ff8080', fontSize: 13, marginBottom: 20,
}
