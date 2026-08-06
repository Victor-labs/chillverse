-- supabase/migrations/0100_public_status_page.sql
-- ════════════════════════════════════════════════════════════════════════
-- Migration 0100 — Public status page (chillverse.com.ng/status)
--
-- Five pieces:
-- 1. status_components — the 5 public-facing service groups. State is
--    admin-set only (operational/degraded/partial_outage/major_outage/
--    maintenance), never auto-detected. Publicly readable, no infra
--    details in any column — labels/descriptions are user-facing only.
-- 2. status_incidents + status_incident_updates — the incident timeline
--    (Investigating → Identified → Monitoring → Resolved), same shape as
--    Discord/Claude's status pages.
-- 3. status_metrics — response-time pings, written only by the
--    status-ping edge function (service role) on a pg_cron schedule.
-- 4. status_subscribers — email list for incident alerts. No public
--    read/insert policy at all; only the status-subscribe edge function
--    (service role) touches this table, so there's no anon-key abuse
--    surface.
-- 5. status_audit_log — dedicated audit trail for status actions (kept
--    separate from moderation_log, whose action/target_type columns
--    have fixed CHECK constraints unrelated to status-page actions).
-- 6. Admin RPCs — same posture as migration 0056: SECURITY DEFINER +
--    is_admin_role() gated.
-- ════════════════════════════════════════════════════════════════════════

-- 1. Status components ──────────────────────────────────────────────────
create table if not exists public.status_components (
  key             text primary key,
  label           text not null,
  description     text,
  sort_order      int not null default 0,
  state           text not null default 'operational'
                    check (state in ('operational','degraded','partial_outage','major_outage','maintenance')),
  state_message   text,
  state_updated_at timestamptz not null default now(),
  updated_by      uuid references auth.users(id)
);

alter table public.status_components enable row level security;

drop policy if exists "status components are publicly readable" on public.status_components;
create policy "status components are publicly readable" on public.status_components
  for select using (true);

insert into public.status_components (key, label, description, sort_order) values
  ('purchases', 'Purchases',           'Diamonds, Premium subscriptions, and Mall checkout', 1),
  ('network',   'Calls & Network',     'Chat, multiplayer rooms, and real-time connections', 2),
  ('push',      'Push Notifications',  'Mobile and browser push delivery',                   3),
  ('marketing', 'Marketing',           'Blog, careers, and public marketing pages',          4),
  ('webapp',    'Server & Web Pages',  'Core app, sign-in, and general page loads',          5)
on conflict (key) do nothing;

-- 2. Incidents ────────────────────────────────────────────────────────
create table if not exists public.status_incidents (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  component_key text references public.status_components(key) on delete set null,
  severity      text not null check (severity in ('maintenance','degraded','partial_outage','major_outage')),
  status        text not null default 'investigating'
                  check (status in ('investigating','identified','monitoring','resolved')),
  started_at    timestamptz not null default now(),
  resolved_at   timestamptz,
  created_by    uuid references auth.users(id),
  created_at    timestamptz not null default now()
);

alter table public.status_incidents enable row level security;

drop policy if exists "status incidents are publicly readable" on public.status_incidents;
create policy "status incidents are publicly readable" on public.status_incidents
  for select using (true);

create index if not exists status_incidents_started_at_idx on public.status_incidents (started_at desc);

create table if not exists public.status_incident_updates (
  id          uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.status_incidents(id) on delete cascade,
  status      text not null check (status in ('investigating','identified','monitoring','resolved')),
  message     text not null,
  created_by  uuid references auth.users(id),
  created_at  timestamptz not null default now()
);

alter table public.status_incident_updates enable row level security;

drop policy if exists "status incident updates are publicly readable" on public.status_incident_updates;
create policy "status incident updates are publicly readable" on public.status_incident_updates
  for select using (true);

create index if not exists status_incident_updates_incident_idx on public.status_incident_updates (incident_id, created_at);

-- 3. Response-time metrics (written by status-ping edge function only) ──
create table if not exists public.status_metrics (
  id          bigint generated always as identity primary key,
  recorded_at timestamptz not null default now(),
  latency_ms  int,
  ok          boolean not null default true
);

alter table public.status_metrics enable row level security;

drop policy if exists "status metrics are publicly readable" on public.status_metrics;
create policy "status metrics are publicly readable" on public.status_metrics
  for select using (true);

create index if not exists status_metrics_recorded_at_idx on public.status_metrics (recorded_at desc);

-- 4. Email subscribers (service-role only — no public policies) ────────
create table if not exists public.status_subscribers (
  id                 uuid primary key default gen_random_uuid(),
  email              text not null unique,
  confirmed          boolean not null default false,
  confirm_token      uuid not null default gen_random_uuid(),
  unsubscribe_token  uuid not null default gen_random_uuid(),
  created_at         timestamptz not null default now(),
  confirmed_at       timestamptz
);

alter table public.status_subscribers enable row level security;
-- Deliberately no policies: only the service role (edge functions) may
-- touch this table. Public users never query it directly.

-- 5. Dedicated audit trail (kept separate from moderation_log, whose
--    action/target_type columns have fixed CHECK constraints unrelated
--    to status-page actions) ──────────────────────────────────────────
create table if not exists public.status_audit_log (
  id          uuid primary key default gen_random_uuid(),
  admin_id    uuid references auth.users(id),
  action      text not null check (action in ('set_component','create_incident','update_incident')),
  target      text not null,
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

alter table public.status_audit_log enable row level security;
-- No public policies — admin-only via the RPCs below (service definer bypasses RLS on write;
-- reads are not exposed to the client at all in v1).

-- 6. Admin RPCs ──────────────────────────────────────────────────────────
create or replace function public.admin_set_status_component(
  p_key text,
  p_state text,
  p_message text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
begin
  if v_caller is null or not public.is_admin_role(v_caller) then
    raise exception 'CV_ADMIN_FORBIDDEN: admin only';
  end if;

  if not exists (select 1 from public.status_components where key = p_key) then
    raise exception 'CV_ADMIN_NOT_FOUND: component not found';
  end if;

  if p_state not in ('operational','degraded','partial_outage','major_outage','maintenance') then
    raise exception 'CV_ADMIN_VALIDATION: invalid state';
  end if;

  update public.status_components set
    state = p_state,
    state_message = p_message,
    state_updated_at = now(),
    updated_by = v_caller
  where key = p_key;

  insert into public.status_audit_log (admin_id, action, target, metadata)
    values (v_caller, 'set_component', p_key, jsonb_build_object('state', p_state, 'message', p_message));
end;
$$;

revoke execute on function public.admin_set_status_component(text, text, text) from public;
grant execute on function public.admin_set_status_component(text, text, text) to authenticated;

create or replace function public.admin_create_incident(
  p_title text,
  p_component_key text,
  p_severity text,
  p_message text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_id uuid;
begin
  if v_caller is null or not public.is_admin_role(v_caller) then
    raise exception 'CV_ADMIN_FORBIDDEN: admin only';
  end if;

  if p_title is null or trim(p_title) = '' then
    raise exception 'CV_ADMIN_VALIDATION: title is required';
  end if;

  if p_severity not in ('maintenance','degraded','partial_outage','major_outage') then
    raise exception 'CV_ADMIN_VALIDATION: invalid severity';
  end if;

  insert into public.status_incidents (title, component_key, severity, status, created_by)
    values (p_title, p_component_key, p_severity, 'investigating', v_caller)
    returning id into v_id;

  insert into public.status_incident_updates (incident_id, status, message, created_by)
    values (v_id, 'investigating', coalesce(nullif(trim(p_message), ''), 'We are investigating this issue.'), v_caller);

  if p_component_key is not null then
    update public.status_components set
      state = case when p_severity = 'maintenance' then 'maintenance' else p_severity end,
      state_message = p_title,
      state_updated_at = now(),
      updated_by = v_caller
    where key = p_component_key;
  end if;

  insert into public.status_audit_log (admin_id, action, target, metadata)
    values (v_caller, 'create_incident', v_id::text, jsonb_build_object('title', p_title, 'severity', p_severity, 'component', p_component_key));

  return v_id;
end;
$$;

revoke execute on function public.admin_create_incident(text, text, text, text) from public;
grant execute on function public.admin_create_incident(text, text, text, text) to authenticated;

create or replace function public.admin_update_incident(
  p_incident_id uuid,
  p_status text,
  p_message text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_component text;
  v_open_others int;
begin
  if v_caller is null or not public.is_admin_role(v_caller) then
    raise exception 'CV_ADMIN_FORBIDDEN: admin only';
  end if;

  if p_status not in ('investigating','identified','monitoring','resolved') then
    raise exception 'CV_ADMIN_VALIDATION: invalid status';
  end if;

  select component_key into v_component from public.status_incidents where id = p_incident_id;
  if not found then
    raise exception 'CV_ADMIN_NOT_FOUND: incident not found';
  end if;

  update public.status_incidents set
    status = p_status,
    resolved_at = case when p_status = 'resolved' then now() else resolved_at end
  where id = p_incident_id;

  insert into public.status_incident_updates (incident_id, status, message, created_by)
    values (p_incident_id, p_status, coalesce(nullif(trim(p_message), ''), initcap(p_status)), v_caller);

  -- If resolved and no other open incidents for the same component, flip it back to operational.
  if p_status = 'resolved' and v_component is not null then
    select count(*) into v_open_others
    from public.status_incidents
    where component_key = v_component and status <> 'resolved' and id <> p_incident_id;

    if v_open_others = 0 then
      update public.status_components set
        state = 'operational', state_message = null, state_updated_at = now(), updated_by = v_caller
      where key = v_component;
    end if;
  end if;

  insert into public.status_audit_log (admin_id, action, target, metadata)
    values (v_caller, 'update_incident', p_incident_id::text, jsonb_build_object('status', p_status));
end;
$$;

revoke execute on function public.admin_update_incident(uuid, text, text) from public;
grant execute on function public.admin_update_incident(uuid, text, text) to authenticated;

notify pgrst, 'reload schema';
