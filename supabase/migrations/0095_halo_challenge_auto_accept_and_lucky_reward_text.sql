-- 0095_halo_challenge_auto_accept_and_lucky_reward_text.sql
--
-- Two independent front-end-driven changes, bundled into one migration
-- since both are small and both belong to the "Halo Moments" redesign:
--
-- 1. Halo's Daily Challenge no longer has an Accept/Decline step (see
--    HaloChallengeIcon.tsx / HaloChallengeModal.tsx — it's a plain icon now,
--    "Today's Challenge"). New challenge rows should be born 'accepted'
--    so record_halo_challenge_progress() (migration 0078) starts tracking
--    immediately, with no client-side response required. respond_halo_
--    challenge() (migration 0078) is left in place, unused by new rows but
--    still callable — useHaloDailyFlow.ts calls it once, silently, to
--    self-heal any pre-existing row still sitting at the old 'offered'
--    default, so old rows aren't stuck for the rest of that day.
--
-- 2. pick_lucky_user()'s public highlight (migration 0076) posted a static
--    line with no reward amount. HighlightCard.tsx now renders the Halo
--    mascot for this highlight kind, so the body text should carry the
--    reward Halo is handing out, matching every other highlight kind's
--    "bake the number into the body" convention (see highlightTriggers.ts).

-- ── 1. New challenges start 'accepted' ─────────────────────────────────────
create or replace function public.get_or_create_halo_challenge()
returns table(
  challenge_key text, target_value int, progress int, completed boolean,
  claimed boolean, xp_reward int, diamond_reward int, intro_text text, status text
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
           hdc.claimed, hdc.xp_reward, hdc.diamond_reward, hl.text, hdc.status
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

  -- Born 'accepted' — no more Accept/Decline gate. status is otherwise
  -- unchanged (still 'offered'/'accepted'/'declined' per migration 0078)
  -- so respond_halo_challenge() and the old rows it may still touch keep
  -- working exactly as before.
  insert into public.halo_daily_challenge
    (user_id, challenge_date, challenge_key, target_value, xp_reward, diamond_reward, intro_line_id, status)
  values (v_uid, v_today, v_challenge_key, v_target, v_xp, v_diamonds, v_intro_id, 'accepted')
  on conflict (user_id, challenge_date) do nothing;

  return query
    select hdc.challenge_key, hdc.target_value, hdc.progress, hdc.completed,
           hdc.claimed, hdc.xp_reward, hdc.diamond_reward, hl.text, hdc.status
    from public.halo_daily_challenge hdc
    left join public.halo_lines hl on hl.id = hdc.intro_line_id
    where hdc.user_id = v_uid and hdc.challenge_date = v_today;
end;
$$;

grant execute on function public.get_or_create_halo_challenge() to authenticated;

-- ── 2. Lucky User highlight body now includes the reward ──────────────────
create or replace function public.pick_lucky_user()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'utc')::date;
  v_uid uuid;
  v_line_id uuid;
  v_xp_reward int := 150;
  v_diamond_reward int := 40;
  v_body text;
begin
  if exists (select 1 from public.lucky_user_of_the_day where pick_date = v_today) then
    return;
  end if;

  select id into v_uid
    from public.profiles
    where last_streak_date >= (v_today - interval '3 days')
    order by random()
    limit 1;

  if v_uid is null then
    -- No recently-active accounts (e.g. empty/dev database) — skip today
    -- rather than picking a dormant account or raising.
    return;
  end if;

  select gnl.id into v_line_id from public.get_next_halo_line('lucky_user') as gnl;

  insert into public.lucky_user_of_the_day
    (pick_date, user_id, xp_reward, diamond_reward, line_id)
  values (v_today, v_uid, v_xp_reward, v_diamond_reward, v_line_id)
  on conflict (pick_date) do nothing;

  -- Public recognition (plan §4.5 nice-to-have) — posts to the same feed
  -- as every other achievement highlight. Body now names the reward, same
  -- "bake the number in" convention as xp_milestone/personal_best/etc.
  v_body := 'Chosen by Halo as today''s Lucky User! +' || v_xp_reward || ' XP'
    || case when v_diamond_reward > 0 then ' · +' || v_diamond_reward || ' diamonds' else '' end;

  insert into public.highlights
    (author_id, kind, game_key, body, value, map_id, badge_id, dedup_key)
  values
    (v_uid, 'lucky_user', null, v_body, v_xp_reward, null, null, 'lucky_user:' || v_today)
  on conflict (author_id, dedup_key) do nothing;
end;
$$;
