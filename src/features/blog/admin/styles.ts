// src/features/blog/admin/styles.ts
// Shared inline style tokens for the blog CMS admin UI — kept in one place
// so the dashboard/table/editor/media/taxonomy tabs stay visually consistent.
import type { CSSProperties } from 'react'

export const inputStyle: CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: 10,
  background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)',
  fontSize: 13, fontWeight: 400, outline: 'none', fontFamily: 'inherit',
}

export const rowStyle: CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14,
  padding: '13px 16px',
}

export const iconButtonStyle: CSSProperties = {
  width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
  background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 9,
}

export const overlayStyle: CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex',
  alignItems: 'flex-start', justifyContent: 'center', padding: '40px 16px', zIndex: 100, overflowY: 'auto',
}

export const modalStyle: CSSProperties = {
  width: '100%', maxWidth: 880, background: 'var(--surface)', border: '1px solid var(--border)',
  borderRadius: 18, padding: 22, boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
}

export const errorBoxStyle: CSSProperties = {
  background: 'rgba(255,79,79,0.08)', border: '1px solid rgba(255,79,79,0.25)', borderRadius: 12,
  padding: '12px 16px', color: '#ff8080', fontSize: 13, marginBottom: 16,
}

export const primaryButtonStyle: CSSProperties = {
  fontSize: 13, fontWeight: 700, color: '#fff', cursor: 'pointer',
  background: 'var(--accent)', border: 'none', borderRadius: 10, padding: '10px 18px',
  display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center',
}

export const secondaryButtonStyle: CSSProperties = {
  fontSize: 13, fontWeight: 700, color: 'var(--text-dim)', cursor: 'pointer',
  background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 18px',
  display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center',
}

const STATUS_META: Record<string, { label: string; color: string }> = {
  draft:     { label: 'Draft',     color: 'var(--text-muted)' },
  scheduled: { label: 'Scheduled', color: 'var(--blue)' },
  published: { label: 'Published', color: 'var(--green)' },
  archived:  { label: 'Archived',  color: 'var(--red)' },
}

export function statusMeta(status: string) {
  return STATUS_META[status] ?? STATUS_META.draft
}

export function statusBadgeStyle(status: string): CSSProperties {
  const m = statusMeta(status)
  return {
    fontSize: 10, fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase',
    color: m.color, background: `color-mix(in srgb, ${m.color} 14%, transparent)`,
    borderRadius: 999, padding: '3px 8px', whiteSpace: 'nowrap',
  }
}

export function estimateReadingTime(content: string): number {
  const words = content.trim().split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.round(words / 200))
}

export function wordCount(content: string): number {
  return content.trim() === '' ? 0 : content.trim().split(/\s+/).filter(Boolean).length
}
