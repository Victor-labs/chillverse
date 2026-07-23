-- 0072_halo_daily_challenge_no_diamonds.sql
-- Removes diamonds from Halo's Daily Challenge per user feedback. The
-- diamond_reward column is dropped outright (not just zeroed) since this
-- feature has no real player-facing history yet — its rough value is
-- folded into xp_reward instead so completing a challenge still feels
-- worth roughly the same as before.
--
-- New xp_reward values: xp_earned 45 (was 30 XP + 15 diamonds),
-- games_today 50 (was 40 XP + 10 diamonds), games_won 70 (was 50 XP + 20
-- diamonds). This is an approximate fold, not a strict conversion rate —
-- there's no project-wide diamond:XP exchange rate defined anywhere else
-- to match exactly.
--
-- get_or_create_halo_challenge() and claim_halo_challenge() both return a
-- table with diamond_reward as a column, so their signatures change —
-- Postgres requires DROP before CREATE for a changed RETURNS TABLE, unlike
-- open_mystery_box() in the previous migration which kept its columns.

drop function if exists public.get_or_create_halo_challenge();
drop function if exists public.claim_halo_challenge();

alter table public.halo_daily_challenge drop column if exists diamond_reward;

create or replace function public.get_or_create_halo_challenge()
returns table(
  challenge_key text, target_value int, progress int, completed boolean,
  claimed boolean, xp_reward int, intro_text text
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
  v_intro_id uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  return query
    select hdc.challenge_key, hdc.target_value, hdc.progress, hdc.completed,
           hdc.claimed, hdc.xp_reward, hl.text
    from public.halo_daily_challenge hdc
    left join public.halo_lines hl on hl.id = hdc.intro_line_id
    where hdc.user_id = v_uid and hdc.challenge_date = v_today;

  if found then
    return;
  end if;

  v_roll := random();
  if v_roll < 0.34 then
    v_challenge_key := 'xp_earned';   v_target := 200; v_xp := 45;
  elsif v_roll < 0.67 then
    v_challenge_key := 'games_today'; v_target := 3;   v_xp := 50;
  else
    v_challenge_key := 'games_won';   v_target := 2;   v_xp := 70;
  end if;

  select gnl.id into v_intro_id from public.get_next_halo_line('challenge_intro') as gnl;

  insert into public.halo_daily_challenge
    (user_id, challenge_date, challenge_key, target_value, xp_reward, intro_line_id)
  values (v_uid, v_today, v_challenge_key, v_target, v_xp, v_intro_id)
  on conflict (user_id, challenge_date) do nothing;

  return query
    select hdc.challenge_key, hdc.target_value, hdc.progress, hdc.completed,
           hdc.claimed, hdc.xp_reward, hl.text
    from public.halo_daily_challenge hdc
    left join public.halo_lines hl on hl.id = hdc.intro_line_id
    where hdc.user_id = v_uid and hdc.challenge_date = v_today;
end;
$$;

grant execute on function public.get_or_create_halo_challenge() to authenticated;

create or replace function public.claim_halo_challenge()
returns table(xp_reward int)
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

  return query select v_row.xp_reward;
end;
$$;

grant execute on function public.claim_halo_challenge() to authenticated;
