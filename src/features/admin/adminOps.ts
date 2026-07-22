// src/features/admin/adminOps.ts
// Client wrappers for migration 0056: feature flags, maintenance mode,
// broadcast notifications, CSV export, system health. Every RPC here is
// SECURITY DEFINER + is_admin_role()-gated server-side (same posture as
// adminStats.ts) — these wrappers just surface friendly errors on top.
import { supabase } from '../../shared/lib/supabase'

function friendlyAdminError(message: string): string {
  if (message.includes('CV_ADMIN_FORBIDDEN')) return "You don't have permission to do that."
  if (message.includes('CV_ADMIN_NOT_FOUND')) return 'Not found.'
  if (message.includes('CV_ADMIN_VALIDATION')) return message.split(': ').slice(1).join(': ') || 'Invalid input.'
  return message
}

// ── Feature flags ─────────────────────────────────────────────────────
export interface FeatureFlag {
  key: string
  label: string
  description: string | null
  category: 'game' | 'map' | 'system'
  enabled: boolean
  updated_at: string
}

/** Publicly readable — any signed-in user can check flag state (that's how
 *  enforcement in Games.tsx / Exploration works), not just staff. */
export async function fetchFeatureFlags(): Promise<{ data: FeatureFlag[]; error: string | null }> {
  const { data, error } = await supabase.from('feature_flags').select('*').order('category').order('label')
  if (error) return { data: [], error: error.message }
  return { data: (data ?? []) as FeatureFlag[], error: null }
}

export async function setFeatureFlag(key: string, enabled: boolean): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('admin_set_feature_flag', { p_key: key, p_enabled: enabled })
  return { error: error ? friendlyAdminError(error.message) : null }
}

// ── Maintenance mode ─────────────────────────────────────────────────
export interface AppConfig {
  maintenance_enabled: boolean
  maintenance_message: string
  maintenance_scheduled_for: string | null
}

export async function fetchAppConfig(): Promise<{ data: AppConfig | null; error: string | null }> {
  const { data, error } = await supabase.from('app_config').select('maintenance_enabled, maintenance_message, maintenance_scheduled_for').eq('id', 1).maybeSingle()
  if (error) return { data: null, error: error.message }
  return { data: data as AppConfig | null, error: null }
}

export async function setMaintenanceMode(
  enabled: boolean,
  message?: string,
  scheduledFor?: string | null,
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('admin_set_maintenance', {
    p_enabled: enabled,
    p_message: message ?? null,
    p_scheduled_for: scheduledFor ?? null,
  })
  return { error: error ? friendlyAdminError(error.message) : null }
}

// ── Broadcast notification ───────────────────────────────────────────
export async function broadcastNotification(title: string, body: string, icon = 'megaphone'): Promise<{ count: number; error: string | null }> {
  const { data, error } = await supabase.rpc('admin_broadcast_notification', { p_title: title, p_body: body, p_icon: icon })
  if (error) return { count: 0, error: friendlyAdminError(error.message) }
  return { count: (data as number) ?? 0, error: null }
}

// ── CSV export ────────────────────────────────────────────────────────
export async function exportUsersCsv(): Promise<{ error: string | null }> {
  const { data, error } = await supabase.rpc('admin_export_users')
  if (error) return { error: friendlyAdminError(error.message) }
  downloadCsv(data as Record<string, unknown>[], `chillverse-users-${dateStamp()}.csv`)
  return { error: null }
}

export async function exportTransactionsCsv(): Promise<{ error: string | null }> {
  const { data, error } = await supabase.rpc('admin_export_transactions')
  if (error) return { error: friendlyAdminError(error.message) }
  downloadCsv(data as Record<string, unknown>[], `chillverse-transactions-${dateStamp()}.csv`)
  return { error: null }
}

function dateStamp(): string {
  return new Date().toISOString().slice(0, 10)
}

function downloadCsv(rows: Record<string, unknown>[], filename: string) {
  if (!rows || rows.length === 0) {
    // Still produce a (header-less) file rather than silently doing nothing —
    // an admin exporting an empty category should see an empty file, not
    // wonder if the click registered.
    rows = []
  }
  const headers = rows.length > 0 ? Object.keys(rows[0]) : ['no_data']
  const escape = (v: unknown) => {
    if (v === null || v === undefined) return ''
    const s = typeof v === 'object' ? JSON.stringify(v) : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const lines = [headers.join(','), ...rows.map(r => headers.map(h => escape(r[h])).join(','))]
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

// ── System health ────────────────────────────────────────────────────
export interface SystemHealth {
  generated_at: string
  client_errors: {
    errors_24h: number
    errors_7d: number
    top_messages_7d: { message: string; occurrences: number }[]
  }
  moderation_backlog: {
    open_reports: number
    oldest_open_report_age_hours: number | null
    actions_24h: number
  }
  support_backlog: {
    open_tickets: number
    oldest_open_ticket_age_hours: number | null
  }
  flags: {
    disabled_count: number
    maintenance_enabled: boolean
  }
}

export async function fetchSystemHealth(): Promise<{ data: SystemHealth | null; error: string | null }> {
  const { data, error } = await supabase.rpc('admin_system_health')
  if (error) return { data: null, error: friendlyAdminError(error.message) }
  return { data: data as SystemHealth, error: null }
}

/** A single client_error_logs row (migration 0062) — the detail view
 *  behind admin_system_health's aggregated "top messages" list. */
export interface ClientErrorLogRow {
  id: string
  message: string
  stack: string | null
  path: string | null
  username: string | null
  created_at: string
}

export async function fetchRecentClientErrors(limit = 40): Promise<{ data: ClientErrorLogRow[]; error: string | null }> {
  const { data, error } = await supabase.rpc('admin_recent_client_errors', { p_limit: limit })
  if (error) return { data: [], error: friendlyAdminError(error.message) }
  return { data: (data ?? []) as ClientErrorLogRow[], error: null }
}
