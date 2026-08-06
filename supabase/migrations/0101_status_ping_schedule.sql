-- supabase/migrations/0101_status_ping_schedule.sql
-- Schedules status-ping (migration 0100's chart feed) via pg_net every
-- 5 minutes. pg_net is fire-and-forget (async) — we don't wait for or
-- inspect the response here, the function itself writes to status_metrics.
select cron.schedule(
  'status-ping-5min',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://gnobzfxtxrtcxfhhfjni.supabase.co/functions/v1/status-ping',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
