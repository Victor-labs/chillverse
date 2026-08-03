// src/features/marketing/AboutAdminPanel.tsx
// Admin-only CMS for the two editable sections of the public /about page:
// the "Chillverse History" card row and the "Our Events Held Across
// Platforms" carousel. Gated the same way as the Blog CMS (useModRole),
// but requires the stricter `isAdmin` — matches the RLS on
// about_history_cards / about_events (is_admin_role()), not just isStaff.
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ShieldAlert, Plus, Pencil, Trash2, X, Upload, History, CalendarClock } from 'lucide-react'
import { ripple } from '../../shared/lib/ripple'
import { useModRole } from '../moderation/useModRole'
import {
  fetchHistoryCards, fetchAboutEvents, saveHistoryCard, deleteHistoryCard,
  saveAboutEvent, deleteAboutEvent, uploadEventImage,
  type HistoryCard, type AboutEvent,
} from './aboutApi'
import {
  inputStyle, rowStyle, iconButtonStyle, overlayStyle, modalStyle,
  errorBoxStyle, primaryButtonStyle, secondaryButtonStyle,
} from '../blog/admin/styles'

type Tab = 'history' | 'events'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: 'var(--text-dim)', marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  )
}

// ── History card editor ───────────────────────────────────────────────────
function HistoryCardModal({
  card, nextSortOrder, onClose, onSaved,
}: {
  card: HistoryCard | null
  nextSortOrder: number
  onClose: () => void
  onSaved: () => void
}) {
  const [yearLabel, setYearLabel] = useState(card?.yearLabel ?? '')
  const [title, setTitle] = useState(card?.title ?? '')
  const [body, setBody] = useState(card?.body ?? '')
  const [sortOrder, setSortOrder] = useState(card?.sortOrder ?? nextSortOrder)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSave() {
    if (!yearLabel.trim() || !title.trim() || !body.trim()) { setError('Year, title, and body are all required.'); return }
    setSaving(true)
    setError('')
    try {
      await saveHistoryCard({ id: card?.id, yearLabel, title, body, sortOrder })
      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={{ ...modalStyle, maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', margin: 0 }}>{card ? 'Edit history card' : 'New history card'}</h2>
          <button type="button" onClick={onClose} style={iconButtonStyle}><X size={15} /></button>
        </div>

        {error && <div style={errorBoxStyle}>{error}</div>}

        <Field label="Year label (e.g. 2022, Early 2025)">
          <input style={inputStyle} value={yearLabel} onChange={(e) => setYearLabel(e.target.value)} placeholder="2022" />
        </Field>
        <Field label="Title">
          <input style={inputStyle} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="The Beginning" />
        </Field>
        <Field label="Body (keep it short — this is a card, not an article)">
          <textarea style={{ ...inputStyle, minHeight: 90, resize: 'vertical' }} value={body} onChange={(e) => setBody(e.target.value)} />
        </Field>
        <Field label="Sort order (lower shows first)">
          <input type="number" style={inputStyle} value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value))} />
        </Field>

        <div className="flex justify-end gap-2" style={{ marginTop: 6 }}>
          <button type="button" onClick={(e) => { ripple(e); onClose() }} style={secondaryButtonStyle} className="ripple-wrap">Cancel</button>
          <button type="button" disabled={saving} onClick={(e) => { ripple(e); handleSave() }} style={primaryButtonStyle} className="ripple-wrap">
            {saving ? 'Saving…' : 'Save card'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Event editor ────────────────────────────────────────────────────────
function EventModal({
  event, nextSortOrder, onClose, onSaved,
}: {
  event: AboutEvent | null
  nextSortOrder: number
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState(event?.name ?? '')
  const [subtitle, setSubtitle] = useState(event?.subtitle ?? '')
  const [eventDate, setEventDate] = useState(event?.eventDate ?? '')
  const [imageUrl, setImageUrl] = useState(event?.imageUrl ?? '')
  const [sortOrder, setSortOrder] = useState(event?.sortOrder ?? nextSortOrder)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleFilePicked(file: File | undefined) {
    if (!file) return
    setUploading(true)
    setError('')
    try {
      const url = await uploadEventImage(file)
      setImageUrl(url)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed.')
    } finally {
      setUploading(false)
    }
  }

  async function handleSave() {
    if (!name.trim() || !subtitle.trim() || !eventDate.trim() || !imageUrl.trim()) {
      setError('Event name, sub name, date, and an image are all required.')
      return
    }
    setSaving(true)
    setError('')
    try {
      await saveAboutEvent({ id: event?.id, name, subtitle, eventDate, imageUrl, sortOrder })
      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={{ ...modalStyle, maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', margin: 0 }}>{event ? 'Edit event' : 'New event'}</h2>
          <button type="button" onClick={onClose} style={iconButtonStyle}><X size={15} /></button>
        </div>

        {error && <div style={errorBoxStyle}>{error}</div>}

        <Field label="Event name">
          <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="Atasuki" />
        </Field>
        <Field label="Sub name">
          <input style={inputStyle} value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="Ninja Wars Event" />
        </Field>
        <Field label="Date (free text — supports ranges like 2024/2025/2026 till date)">
          <input style={inputStyle} value={eventDate} onChange={(e) => setEventDate(e.target.value)} placeholder="2025/11/16" />
        </Field>

        <Field label="Image">
          <div className="flex flex-col gap-2">
            {imageUrl && (
              <img src={imageUrl} alt="" style={{ width: '100%', maxHeight: 140, objectFit: 'cover', borderRadius: 10, border: '1px solid var(--border)' }} />
            )}
            <div className="flex gap-2">
              <input
                style={{ ...inputStyle, flex: 1 }}
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="Paste an image URL, or upload below"
              />
              <button
                type="button"
                disabled={uploading}
                onClick={(e) => { ripple(e); fileRef.current?.click() }}
                style={{ ...secondaryButtonStyle, padding: '10px 14px' }}
                className="ripple-wrap"
              >
                <Upload size={14} /> {uploading ? 'Uploading…' : 'Upload'}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(e) => handleFilePicked(e.target.files?.[0])}
              />
            </div>
          </div>
        </Field>
        <Field label="Sort order (lower shows first)">
          <input type="number" style={inputStyle} value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value))} />
        </Field>

        <div className="flex justify-end gap-2" style={{ marginTop: 6 }}>
          <button type="button" onClick={(e) => { ripple(e); onClose() }} style={secondaryButtonStyle} className="ripple-wrap">Cancel</button>
          <button type="button" disabled={saving || uploading} onClick={(e) => { ripple(e); handleSave() }} style={primaryButtonStyle} className="ripple-wrap">
            {saving ? 'Saving…' : 'Save event'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AboutAdminPanel() {
  const navigate = useNavigate()
  const { isAdmin, loading: roleLoading } = useModRole()
  const [tab, setTab] = useState<Tab>('history')
  const [historyCards, setHistoryCards] = useState<HistoryCard[]>([])
  const [events, setEvents] = useState<AboutEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [editingCard, setEditingCard] = useState<HistoryCard | 'new' | null>(null)
  const [editingEvent, setEditingEvent] = useState<AboutEvent | 'new' | null>(null)

  async function load() {
    setLoading(true)
    const [cards, evts] = await Promise.all([fetchHistoryCards(), fetchAboutEvents()])
    setHistoryCards(cards)
    setEvents(evts)
    setLoading(false)
  }

  useEffect(() => {
    if (roleLoading || !isAdmin) { setLoading(false); return }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleLoading, isAdmin])

  if (roleLoading) return null

  if (!isAdmin) {
    return (
      <div style={{ maxWidth: 480, margin: '60px auto', textAlign: 'center', padding: 20 }}>
        <ShieldAlert size={32} style={{ color: 'var(--text-dim)', marginBottom: 12 }} />
        <h1 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', marginBottom: 6 }}>Admins only</h1>
        <p style={{ fontSize: 13.5, color: 'var(--text-dim)' }}>This page is for Chillverse admins.</p>
      </div>
    )
  }

  async function handleDeleteCard(id: string) {
    if (!window.confirm('Delete this history card?')) return
    await deleteHistoryCard(id)
    load()
  }
  async function handleDeleteEvent(id: string) {
    if (!window.confirm('Delete this event?')) return
    await deleteAboutEvent(id)
    load()
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <button
        type="button"
        onClick={(e) => { ripple(e); navigate('/about') }}
        className="ripple-wrap"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: 12.5, fontWeight: 700, color: 'var(--text-dim)', marginBottom: 14, background: 'none', border: 'none' }}
      >
        <ChevronLeft size={15} /> Back to About
      </button>

      <h1 style={{ fontSize: 19, fontWeight: 800, color: 'var(--text)', margin: '0 0 18px' }}>About page CMS</h1>

      <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
        <button
          type="button"
          onClick={(e) => { ripple(e); setTab('history') }}
          className="ripple-wrap"
          style={{
            display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
            fontSize: 12.5, fontWeight: 700, padding: '9px 14px', borderRadius: 10,
            background: tab === 'history' ? 'var(--accent)' : 'var(--surface)',
            color: tab === 'history' ? '#fff' : 'var(--text-dim)',
            border: `1px solid ${tab === 'history' ? 'var(--accent)' : 'var(--border)'}`,
          }}
        >
          <History size={13} /> History cards
        </button>
        <button
          type="button"
          onClick={(e) => { ripple(e); setTab('events') }}
          className="ripple-wrap"
          style={{
            display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
            fontSize: 12.5, fontWeight: 700, padding: '9px 14px', borderRadius: 10,
            background: tab === 'events' ? 'var(--accent)' : 'var(--surface)',
            color: tab === 'events' ? '#fff' : 'var(--text-dim)',
            border: `1px solid ${tab === 'events' ? 'var(--accent)' : 'var(--border)'}`,
          }}
        >
          <CalendarClock size={13} /> Events
        </button>
      </div>

      {loading ? (
        <p style={{ fontSize: 12.5, color: 'var(--text-dim)' }}>Loading…</p>
      ) : tab === 'history' ? (
        <>
          <div className="flex justify-end" style={{ marginBottom: 12 }}>
            <button type="button" onClick={(e) => { ripple(e); setEditingCard('new') }} style={primaryButtonStyle} className="ripple-wrap">
              <Plus size={14} /> New card
            </button>
          </div>
          <div className="flex flex-col gap-2">
            {historyCards.length === 0 && <p style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>No history cards yet.</p>}
            {historyCards.map((card) => (
              <div key={card.id} style={rowStyle}>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', margin: 0 }}>
                    <span style={{ color: 'var(--accent)' }}>{card.yearLabel}</span> · {card.title}
                  </p>
                  <p style={{ fontSize: 12, color: 'var(--text-dim)', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{card.body}</p>
                </div>
                <div className="flex gap-2" style={{ flexShrink: 0 }}>
                  <button type="button" onClick={(e) => { ripple(e); setEditingCard(card) }} style={iconButtonStyle}><Pencil size={13} /></button>
                  <button type="button" onClick={(e) => { ripple(e); handleDeleteCard(card.id) }} style={iconButtonStyle}><Trash2 size={13} color="var(--red)" /></button>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="flex justify-end" style={{ marginBottom: 12 }}>
            <button type="button" onClick={(e) => { ripple(e); setEditingEvent('new') }} style={primaryButtonStyle} className="ripple-wrap">
              <Plus size={14} /> New event
            </button>
          </div>
          <div className="flex flex-col gap-2">
            {events.length === 0 && <p style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>No events yet.</p>}
            {events.map((evt) => (
              <div key={evt.id} style={rowStyle}>
                <div className="flex items-center gap-3" style={{ minWidth: 0 }}>
                  <img src={evt.imageUrl} alt="" style={{ width: 44, height: 44, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }} />
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', margin: 0 }}>{evt.name}</p>
                    <p style={{ fontSize: 12, color: 'var(--text-dim)', margin: '2px 0 0' }}>{evt.subtitle} · {evt.eventDate}</p>
                  </div>
                </div>
                <div className="flex gap-2" style={{ flexShrink: 0 }}>
                  <button type="button" onClick={(e) => { ripple(e); setEditingEvent(evt) }} style={iconButtonStyle}><Pencil size={13} /></button>
                  <button type="button" onClick={(e) => { ripple(e); handleDeleteEvent(evt.id) }} style={iconButtonStyle}><Trash2 size={13} color="var(--red)" /></button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {editingCard && (
        <HistoryCardModal
          card={editingCard === 'new' ? null : editingCard}
          nextSortOrder={historyCards.length}
          onClose={() => setEditingCard(null)}
          onSaved={() => { setEditingCard(null); load() }}
        />
      )}
      {editingEvent && (
        <EventModal
          event={editingEvent === 'new' ? null : editingEvent}
          nextSortOrder={events.length}
          onClose={() => setEditingEvent(null)}
          onSaved={() => { setEditingEvent(null); load() }}
        />
      )}
    </div>
  )
}
