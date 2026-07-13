-- 0023_rate_limiting.sql
--
-- Server-side rate limiting infrastructure, backing
-- supabase/functions/_shared/rateLimit.ts. Edge functions call
-- check_and_increment_rate_limit() with the service-role client to atomically
-- bump a fixed-window counter and decide allow/deny in one round trip,
-- avoiding a race between a SELECT and a subsequent UPDATE.

create table if not exists public.rate_limits (
  rate_key text not null,
  window_start timestamptz not null,
  request_count integer not null default 1,
  primary key (rate_key, window_start)
);

comment on table public.rate_limits is
  'Fixed-window request counters used by edge function rate limiting. Rows are short-lived; purge anything older than a day or two.';

-- RLS is enabled with NO policies attached on purpose: only the
-- service-role key (which bypasses RLS entirely) can read or write this
-- table. Edge functions must always use the admin/service-role client for
-- rate limiting, never the anon or user-scoped client.
alter table public.rate_limits enable row level security;

create index if not exists idx_rate_limits_window_start on public.rate_limits (window_start);

create or replace function public.check_and_increment_rate_limit(
  p_key text,
  p_window_seconds integer
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window_start timestamptz;
  v_count integer;
begin
  -- Bucket "now" into a fixed window (e.g. every 60s) so all requests
  -- within the same window share a single row.
  v_window_start := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);

  insert into public.rate_limits (rate_key, window_start, request_count)
  values (p_key, v_window_start, 1)
  on conflict (rate_key, window_start)
  do update set request_count = public.rate_limits.request_count + 1
  returning request_count into v_count;

  return v_count;
end;
$$;

-- Lock the function down to service_role only — it must never be callable
-- directly by anon/authenticated clients (that would let any signed-in
-- player bump or inspect arbitrary rate-limit keys, including other users').
revoke all on function public.check_and_increment_rate_limit(text, integer) from public;
revoke all on function public.check_and_increment_rate_limit(text, integer) from anon;
revoke all on function public.check_and_increment_rate_limit(text, integer) from authenticated;
grant execute on function public.check_and_increment_rate_limit(text, integer) to service_role;

-- Housekeeping: old windows can be purged periodically, e.g. by extending
-- the existing cleanup-rooms cron or a separate scheduled job:
--   delete from public.rate_limits where window_start < now() - interval '2 days';
