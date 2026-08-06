// src/features/status/statusApi.ts
//
// Client wrappers for migration 0100 (+ 0101 for the ping schedule).
// Reads are plain public `.from()` selects (RLS allows anon select on all
// four status_* tables) — writes go through the admin_* RPCs, which are
// SECURITY DEFINER + is_admin_role()-gated server-side, same posture as
// adminOps.ts.
import { supabase } from '../../shared/lib/supabase'

function friendlyAdminError(message: string): string {
  if (message.includes('CV_ADMIN_FORBIDDEN')) return "You don't have permission to do that."
  if (message.includes('CV_ADMIN_NOT_FOUND')) return 'Not found.'
  if (message.includes('CV_ADMIN_VALIDATION')) return message.split(': ').slice(1).join(': ') || 'Invalid input.'
  return message
}

export type ComponentState = 'operational' | 'degraded' | 'partial_outage' | 'major_outage' | 'maintenance'
export type IncidentStatus = 'investigating' | 'identified' | 'monitoring' | 'resolved'
export type IncidentSeverity = 'maintenance' | 'degraded' | 'partial_outage' | 'major_outage'

export interface StatusComponent {
  key: string
  label: string
  description: string | null
  sort_order: number
  state: ComponentState
  state_message: string | null
  state_updated_at: string
}

export interface StatusIncidentUpdate {
  id: string
  status: IncidentStatus
  message: string
  created_at: string
}

export interface StatusIncident {
  id: string
  title: string
  component_key: string | null
  severity: IncidentSeverity
  status: IncidentStatus
  started_at: string
  resolved_at: string | null
  updates?: StatusIncidentUpdate[]
}

export interface StatusMetricPoint {
  recorded_at: string
  latency_ms: number | null
  ok: boolean
}

// ── Public reads ─────────────────────────────────────────────────────

export async function fetchStatusComponents(): Promise<{ data: StatusComponent[]; error: string | null }> {
  const { data, error } = await supabase.from('status_components').select('*').order('sort_order')
  if (error) return { data: [], error: error.message }
  return { data: (data ?? []) as StatusComponent[], error: null }
}

/** Incidents from the last N days, newest first, each with its update timeline. */
export async function fetchRecentIncidents(days = 14): Promise<{ data: StatusIncident[]; error: string | null }> {
  const since = new Date(Date.now() - days * 86400_000).toISOString()
  const { data: incidents, error } = await supabase
    .from('status_incidents')
    .select('*')
    .gte('started_at', since)
    .order('started_at', { ascending: false })
  if (error) return { data: [], error: error.message }
  if (!incidents || incidents.length === 0) return { data: [], error: null }

  const ids = incidents.map(i => i.id)
  const { data: updates } = await supabase
    .from('status_incident_updates')
    .select('*')
    .in('incident_id', ids)
    .order('created_at', { ascending: true })

  const byIncident = new Map<string, StatusIncidentUpdate[]>()
  for (const u of updates ?? []) {
    const list = byIncident.get(u.incident_id) ?? []
    list.push(u)
    byIncident.set(u.incident_id, list)
  }

  return {
    data: incidents.map(i => ({ ...i, updates: byIncident.get(i.id) ?? [] })) as StatusIncident[],
    error: null,
  }
}

/** Response-time points from the last N hours, oldest first (chart order). */
export async function fetchStatusMetrics(hours = 24): Promise<{ data: StatusMetricPoint[]; error: string | null }> {
  const since = new Date(Date.now() - hours * 3600_000).toISOString()
  const { data, error } = await supabase
    .from('status_metrics')
    .select('recorded_at, latency_ms, ok')
    .gte('recorded_at', since)
    .order('recorded_at', { ascending: true })
  if (error) return { data: [], error: error.message }
  return { data: (data ?? []) as StatusMetricPoint[], error: null }
}

// ── Admin writes ─────────────────────────────────────────────────────

export async function adminSetStatusComponent(
  key: string,
  state: ComponentState,
  message?: string | null,
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('admin_set_status_component', { p_key: key, p_state: state, p_message: message ?? null })
  return { error: error ? friendlyAdminError(error.message) : null }
}

export async function adminCreateIncident(
  title: string,
  componentKey: string | null,
  severity: IncidentSeverity,
  message: string,
): Promise<{ id: string | null; error: string | null }> {
  const { data, error } = await supabase.rpc('admin_create_incident', {
    p_title: title,
    p_component_key: componentKey,
    p_severity: severity,
    p_message: message,
  })
  if (error) return { id: null, error: friendlyAdminError(error.message) }
  return { id: data as string, error: null }
}

export async function adminUpdateIncident(
  incidentId: string,
  status: IncidentStatus,
  message: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('admin_update_incident', { p_incident_id: incidentId, p_status: status, p_message: message })
  return { error: error ? friendlyAdminError(error.message) : null }
}
