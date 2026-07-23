-- 0068_halo_daily_challenge.sql
-- Halo's Daily Challenge (plan §2, §4.2).
--
-- SCOPING NOTE on personalization: the plan says to pick a challenge based
-- on the user's favorite_game when set. In practice, per-game progress
-- metrics only exist for 3 games today (hangman_played, speed_math_played,
-- pattern_memory_played — see Games.tsx's gameMetricMap), not a generic
-- "game_<favorite_game>" metric for every game. Building that out is a
-- bigger change than this pass — so for now, three GENERIC challenge
-- templates are picked at random, each tied to a metric_key that already
-- fires on every game session regardless of which game was played
-- (xp_earned, games_today, games_won). Favorite-game-specific challenges
-- can be added later without touching the schema — just extend the
-- template CASE in get_or_create_halo_challenge().
--
-- Progress tracking: challenge_key IS the weekly-missions metric_key it
-- tracks (no separate mapping needed). record_halo_challenge_progress()
-- below is called in parallel with record_mission_progress() from a single
-- choke point — weeklyMissions.ts's updateMissionProgress() — rather than
-- at every individual call site (Games.tsx, Chat.tsx, Mall.tsx,
-- Streak.tsx, gameSession.ts), per the plan's "same call sites, no new
-- tracking plumbing needed" but centralized so no call site can be missed.

create table if not exists public.halo_daily_challenge (
  user_id uuid not null references public.profiles(id) on delete cascade,
  challenge_date date not null default current_date,
  challenge_key text not null,       -- one of: xp_earned, games_today, games_won
  target_value int not null,
  progress int not null default 0,
  completed boolean not null default false,
  xp_reward int not null,
  diamond_reward int not null default 0,
  claimed boolean not null default false,
  intro_line_id uuid references public.halo_lines(id),
  primary key (user_id, challenge_date)
);

alter table public.halo_daily_challenge enable row level security;

drop policy if exists "Players can read own halo challenge" on public.halo_daily_challenge;
create policy "Players can read own halo challenge" on public.halo_daily_challenge
  for select
  to authenticated
  using (auth.uid() = user_id);
-- No insert/update policy — writes happen only inside the RPCs below.

-- ── get_or_create_halo_challenge() ───────────────────────────────────────
-- Idempotent per user/UTC-day. Intro line is picked ONCE and stored
-- (intro_line_id) — re-reading the same day's challenge must return the
-- same intro every time, not re-roll from halo_lines on every load.
create or replace function public.get_or_create_halo_challenge()
returns table(
  challenge_key text, target_value int, progress int, completed boolean,
  claimed boolean, xp_reward int, diamond_reward int, intro_text text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_today date := (now() at time zone 'utc')::date;
  v_roll numeric;
  v_challenge_key text;
  v_target int;
  v_xp int;
  v_diamonds int;
  v_intro_id uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  return query
    select hdc.challenge_key, hdc.target_value, hdc.progress, hdc.completed,
           hdc.claimed, hdc.xp_reward, hdc.diamond_reward, hl.text
    from public.halo_daily_challenge hdc
    left join public.halo_lines hl on hl.id = hdc.intro_line_id
    where hdc.user_id = v_uid and hdc.challenge_date = v_today;

  if found then
    return;
  end if;

  v_roll := random();
  if v_roll < 0.34 then
    v_challenge_key := 'xp_earned';   v_target := 200; v_xp := 30; v_diamonds := 15;
  elsif v_roll < 0.67 then
    v_challenge_key := 'games_today'; v_target := 3;   v_xp := 40; v_diamonds := 10;
  else
    v_challenge_key := 'games_won';   v_target := 2;   v_xp := 50; v_diamonds := 20;
  end if;

  select gnl.id into v_intro_id from public.get_next_halo_line('challenge_intro') as gnl;

  insert into public.halo_daily_challenge
    (user_id, challenge_date, challenge_key, target_value, xp_reward, diamond_reward, intro_line_id)
  values (v_uid, v_today, v_challenge_key, v_target, v_xp, v_diamonds, v_intro_id)
  on conflict (user_id, challenge_date) do nothing;

  return query
    select hdc.challenge_key, hdc.target_value, hdc.progress, hdc.completed,
           hdc.claimed, hdc.xp_reward, hdc.diamond_reward, hl.text
    from public.halo_daily_challenge hdc
    left join public.halo_lines hl on hl.id = hdc.intro_line_id
    where hdc.user_id = v_uid and hdc.challenge_date = v_today;
end;
$$;

grant execute on function public.get_or_create_halo_challenge() to authenticated;

-- ── record_halo_challenge_progress() ─────────────────────────────────────
-- Called in parallel with record_mission_progress (see weeklyMissions.ts).
-- No-ops (never errors) if there's no challenge yet today, it's already
-- completed, or the metric doesn't match today's challenge_key — this is
-- called unconditionally alongside every mission-progress update, most of
-- which won't be relevant to today's specific challenge.
create or replace function public.record_halo_challenge_progress(
  p_metric_key text, p_increment int, p_absolute boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_today date := (now() at time zone 'utc')::date;
  v_row record;
  v_amount int;
  v_new_progress int;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select * into v_row from public.halo_daily_challenge
    where user_id = v_uid and challenge_date = v_today
    for update;

  if not found or v_row.completed or v_row.challenge_key <> p_metric_key then
    return;
  end if;

  if p_absolute then
    v_amount := least(greatest(coalesce(p_increment, 0), 0), 3650);
    v_new_progress := greatest(v_row.progress, v_amount);
  else
    v_amount := least(greatest(coalesce(p_increment, 0), 0), 50);
    v_new_progress := v_row.progress + v_amount;
  end if;

  update public.halo_daily_challenge
    set progress = v_new_progress,
        completed = (v_new_progress >= v_row.target_value)
    where user_id = v_uid and challenge_date = v_today;

  if v_new_progress >= v_row.target_value then
    insert into public.notifications (user_id, type, title, body, icon)
      values (v_uid, 'halo', 'Halo Challenge complete!', 'Your challenge is done — head back to claim it.', 'sparkles');
  end if;
end;
$$;

grant execute on function public.record_halo_challenge_progress(text, int, boolean) to authenticated;

-- ── claim_halo_challenge() ───────────────────────────────────────────────
create or replace function public.claim_halo_challenge()
returns table(xp_reward int, diamond_reward int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_today date := (now() at time zone 'utc')::date;
  v_row record;
  v_xp_grant int;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select * into v_row from public.halo_daily_challenge
    where user_id = v_uid and challenge_date = v_today
    for update;

  if not found then raise exception 'no challenge for today'; end if;
  if not v_row.completed then raise exception 'challenge not completed yet'; end if;
  if v_row.claimed then raise exception 'already claimed'; end if;

  update public.halo_daily_challenge set claimed = true
    where user_id = v_uid and challenge_date = v_today;

  if v_row.xp_reward > 0 then
    v_xp_grant := least(v_row.xp_reward, 20000);
    update public.profiles
      set xp = xp + v_xp_grant,
          level = floor((xp + v_xp_grant) / 1000) + 1
      where id = v_uid;
  end if;

  if v_row.diamond_reward > 0 then
    insert into public.user_wallets (user_id, gem_balance)
      values (v_uid, v_row.diamond_reward)
      on conflict (user_id) do update
        set gem_balance = public.user_wallets.gem_balance + excluded.gem_balance,
            updated_at = now();
    insert into public.diamond_transactions (user_id, reference, amount, description)
      values (v_uid, 'halo_challenge:' || v_today, v_row.diamond_reward, 'Halo Daily Challenge reward');
  end if;

  return query select v_row.xp_reward, v_row.diamond_reward;
end;
$$;

grant execute on function public.claim_halo_challenge() to authenticated;
