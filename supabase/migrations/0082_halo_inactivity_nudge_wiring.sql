-- 0082_halo_inactivity_nudge_wiring.sql
--
-- Restores the migration file for work that was already applied directly
-- to the live database but never landed in the repo's migration history
-- (see chat log — the file was lost/renumbered before being committed).
-- This file is written to exactly match what's live: CREATE OR REPLACE +
-- cron.schedule upserts, so re-running it is a safe no-op.
--
-- Wires the 'inactivity_nudge' Halo line pack into the existing
-- run_scheduled_notifications() cron function. A player who hasn't been
-- seen in 2+ days gets a 'come_back' notification, using a random
-- inactivity_nudge line (via get_next_halo_line) with a static fallback
-- if none is available. Also re-affirms the streak-warning and
-- exploration-complete blocks already in this function, and the two
-- cron jobs that depend on it.

create or replace function public.run_scheduled_notifications()
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  r record;
  v_line_text text;
begin
  -- ── 1. Re-engagement: no activity in 2+ days ──────────────────
  for r in
    select id, coalesce(display_name, username, 'Player') as uname
    from profiles
    where last_seen_at < now() - interval '2 days'
      and (come_back_notified_at is null or come_back_notified_at < last_seen_at)
  loop
    select gnl.text into v_line_text
      from public.get_next_halo_line('inactivity_nudge', r.id) as gnl;

    insert into notifications(user_id, type, title, body, icon, meta)
      values (
        r.id, 'come_back',
        'Hey ' || r.uname,
        coalesce(v_line_text, 'Time to jump back into Chillverse!'),
        'sparkles', '{}'::jsonb
      );
    update profiles set come_back_notified_at = now() where id = r.id;
  end loop;

  -- ── 2. Streak about to reset — fires once, starting 19:00 UTC on the
  --      last day the player can still play to keep it alive (5 hours
  --      before the UTC-midnight cutoff in update_streak). ───────────
  for r in
    select id, coalesce(display_name, username, 'Player') as uname
    from profiles
    where streak > 0
      and last_streak_date = (now() at time zone 'UTC')::date - 1
      and extract(hour from now() at time zone 'UTC') >= 19
      and (streak_warning_sent_date is null
           or streak_warning_sent_date < (now() at time zone 'UTC')::date)
  loop
    insert into notifications(user_id, type, title, body, icon, meta)
      values (
        r.id, 'streak_warning',
        'Hey ' || r.uname,
        'Your streak resets soon, time to jump back in to Chillverse!',
        'flame', '{}'::jsonb
      );
    update profiles
      set streak_warning_sent_date = (now() at time zone 'UTC')::date
      where id = r.id;
  end loop;

  -- ── 3. Exploration chamber run finished, unclaimed, not yet notified ──
  for r in
    select distinct e.user_id
    from exploration_chamber_runs e
    where e.ends_at <= now() and e.claimed = false and e.notified = false
  loop
    insert into notifications(user_id, type, title, body, icon, meta)
      values (
        r.user_id, 'exploration_complete',
        'Exploration complete',
        'You have finished exploring, come back and see what you earned.',
        'compass', '{}'::jsonb
      );
    update exploration_chamber_runs
      set notified = true
      where user_id = r.user_id and ends_at <= now() and claimed = false and notified = false;
  end loop;
end;
$function$;

-- Cron job — 'come_back' + streak + exploration checks, every 30 minutes.
-- cron.schedule() upserts by job name, so this is safe to re-run.
select cron.schedule(
  'run-scheduled-notifications',
  '*/30 * * * *',
  $$ select public.run_scheduled_notifications(); $$
);
