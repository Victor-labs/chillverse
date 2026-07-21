// src/features/support/MyTickets.tsx
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Inbox, ChevronDown, ChevronUp, Send } from 'lucide-react'
import { ripple } from '../../shared/lib/ripple'
import { useAuth } from '../auth/useAuth'
import { fetchMyTickets, fetchTicketReplies, submitTicketReply } from './api'
import {
  SUPPORT_TICKET_STATUS_LABELS, SUPPORT_TICKET_STATUS_COLORS,
  SUPPORT_TICKET_PRIORITY_LABELS, SUPPORT_TICKET_PRIORITY_COLORS,
} from './constants'
import StatusBadge from './components/StatusBadge'
import type { SupportTicket, SupportTicketReply } from '../../shared/types'

export default function MyTickets() {
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()

  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

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
            <button
              type="button"
              onClick={() => setExpandedId(expandedId === ticket.id ? null : ticket.id)}
              style={{
                display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12,
                width: '100%', background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left',
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>{ticket.subject}</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
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
              {expandedId === ticket.id
                ? <ChevronUp size={18} color="var(--text-muted)" style={{ flexShrink: 0, marginTop: 2 }} />
                : <ChevronDown size={18} color="var(--text-muted)" style={{ flexShrink: 0, marginTop: 2 }} />}
            </button>

            <div style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.6, margin: '10px 0' }}>
              {ticket.message}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              Submitted {new Date(ticket.created_at).toLocaleString()}
            </div>

            {expandedId === ticket.id && <TicketThread ticket={ticket} />}
          </div>
        ))
      )}
    </div>
  )
}

function TicketThread({ ticket }: { ticket: SupportTicket }) {
  const { user } = useAuth()
  const [replies, setReplies] = useState<SupportTicketReply[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    let active = true
    setLoading(true)
    fetchTicketReplies(ticket.id)
      .then(data => { if (active) { setReplies(data); setError(null) } })
      .catch((err: Error) => { if (active) setError(err.message || 'Could not load replies.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [ticket.id])

  const canReply = ticket.status !== 'closed'

  async function handleSend() {
    if (!user || !draft.trim() || sending) return
    setSending(true)
    setError(null)
    try {
      await submitTicketReply(ticket.id, draft.trim())
      const fresh = await fetchTicketReplies(ticket.id)
      setReplies(fresh)
      setDraft('')
    } catch (err) {
      setError((err as Error).message || 'Could not send your reply.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
      {loading ? (
        <div style={{ fontSize: 12.5, color: 'var(--text-muted)', padding: '8px 0' }}>Loading conversation…</div>
      ) : replies.length === 0 ? (
        <div style={{ fontSize: 12.5, color: 'var(--text-muted)', padding: '4px 0 12px' }}>
          No replies yet — our team will respond here soon.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
          {replies.map(reply => (
            <div
              key={reply.id}
              style={{
                alignSelf: reply.is_staff ? 'flex-start' : 'flex-end',
                maxWidth: '85%',
                background: reply.is_staff ? 'var(--surface-2, rgba(255,255,255,0.04))' : 'color-mix(in srgb, var(--accent) 14%, transparent)',
                border: '1px solid var(--border)',
                borderRadius: 12,
                padding: '9px 12px',
              }}
            >
              <div style={{ fontSize: 10.5, fontWeight: 700, color: reply.is_staff ? 'var(--accent)' : 'var(--text-dim)', marginBottom: 3 }}>
                {reply.is_staff ? 'Chillverse Support' : 'You'}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{reply.body}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
                {new Date(reply.created_at).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      )}

      {error && <div style={{ ...errorBoxStyle, marginBottom: 10 }}>{error}</div>}

      {canReply ? (
        <div style={{ display: 'flex', gap: 8 }}>
          <textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            placeholder="Add a reply…"
            rows={2}
            style={{
              flex: 1, resize: 'vertical', minHeight: 40, borderRadius: 10, border: '1px solid var(--border)',
              background: 'var(--surface)', color: 'var(--text)', fontSize: 13, padding: '8px 10px', fontFamily: 'inherit',
            }}
          />
          <button
            type="button"
            onClick={(e) => { ripple(e); handleSend() }}
            disabled={!draft.trim() || sending}
            className="ripple-wrap"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, flexShrink: 0,
              borderRadius: 10, border: 'none', cursor: draft.trim() && !sending ? 'pointer' : 'not-allowed',
              background: 'linear-gradient(135deg, var(--accent), var(--accent2))', opacity: draft.trim() && !sending ? 1 : 0.5,
              alignSelf: 'flex-end',
            }}
          >
            <Send size={15} color="#fff" />
          </button>
        </div>
      ) : (
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>This ticket is closed. Open a new ticket if you still need help.</div>
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
