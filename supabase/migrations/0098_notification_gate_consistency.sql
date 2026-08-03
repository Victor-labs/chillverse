-- supabase/migrations/0098_notification_gate_consistency.sql
-- ════════════════════════════════════════════════════════════════════════
-- RECONCILIATION MIGRATION — not a new fix.
--
-- This records, verbatim, the notification-gating fix that is ALREADY
-- LIVE in production (project gnobzfxtxrtcxfhhfjni), applied directly to
-- the database as migration `notification_gate_consistency` on
-- 2026-08-02 21:31 UTC, but which never landed in this repo's migration
-- history — the same gap this repo has hit before (see 0082's header).
--
-- Do not "improve" on this file without re-pulling the live definitions
-- first; it is a faithful copy of pg_get_functiondef() output for every
-- function touched, taken directly from the production database.
--
-- What changed, structurally:
--   - insert_notification() is now a thin, client-facing wrapper: checks
--     auth.uid(), then delegates to _notify_internal().
--   - _notify_internal() (new) does the real work — full type allowlist,
--     a global notif_in_app gate, and per-type preference gating — and
--     has NO auth.uid() check, so it's safe to call from cron jobs and
--     the auth trigger, which have no request-level session. It is
--     granted only to postgres/service_role, never to `authenticated`,
--     so clients can never reach it directly — only through
--     insert_notification(), or from other SECURITY DEFINER functions.
--   - Every function that used to bypass insert_notification() with a
--     direct `insert into notifications` now calls _notify_internal()
--     instead, including the two set-based broadcasts (notify_rank_tag,
--     admin_broadcast_notification), which were converted to per-row
--     loops to get consistent gating rather than staying as bulk inserts.
-- ════════════════════════════════════════════════════════════════════════

-- ── Preference column backing the 'halo' gate below ─────────────────────
alter table public.profiles
  add column if not exists notif_halo boolean not null default true;

-- ── Internal notifier — full allowlist + preference gating, no auth
--    requirement (called from cron/trigger contexts with no session) ────
create or replace function public._notify_internal(
  p_user_id uuid, p_type text, p_title text, p_body text, p_icon text, p_meta jsonb
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_in_app boolean;
  v_type_pref boolean;
begin
  if p_type not in (
    'new_post','post_tag','highlight_posted','session_reset','movies_open',
    'follow','profile_view','profile_like','message','missed_call','rank_up',
    'followed_rank_up','streak','referral_milestone','referral_completed','gift',
    'come_back','exploration_complete','streak_warning',
    'follower_online','followed_map_completed',
    'halo','achievement','mission','game_goal','rank_tag','rank_down',
    'club_grace_warning','announcement'
  ) then
    raise exception 'invalid notification type';
  end if;

  select notif_in_app,
    case p_type
      when 'exploration_complete' then notif_exploration
      when 'gift' then notif_gifts
      when 'profile_like' then notif_profile_likes
      when 'session_reset' then notif_session_reset
      when 'follower_online' then notif_follower_online
      when 'profile_view' then (profile_view_alert <> 'none')
      when 'halo' then notif_halo
      else true
    end
  into v_in_app, v_type_pref
  from profiles where id = p_user_id;

  if v_in_app is false or v_type_pref is false then
    return;
  end if;

  insert into notifications(user_id, type, title, body, icon, meta)
    values (p_user_id, p_type, p_title, p_body, p_icon, p_meta);
end;
$function$;

revoke all on function public._notify_internal(uuid, text, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public._notify_internal(uuid, text, text, text, text, jsonb) to postgres, service_role;

-- ── Public wrapper — the only entry point client code / RPC calls use ──
create or replace function public.insert_notification(
  p_user_id uuid, p_type text, p_title text, p_body text, p_icon text, p_meta jsonb
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if auth.uid() is null then
    raise exception 'not authorized';
  end if;
  perform public._notify_internal(p_user_id, p_type, p_title, p_body, p_icon, p_meta);
end;
$function$;

revoke all on function public.insert_notification(uuid, text, text, text, text, jsonb) from public, anon;
grant execute on function public.insert_notification(uuid, text, text, text, text, jsonb) to authenticated, postgres, service_role;

-- ── record_mission_progress() — now calls _notify_internal directly ────
create or replace function public.record_mission_progress(
  p_metric_key text, p_increment integer default 1, p_absolute boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_week date := (date_trunc('week', (now() at time zone 'utc')))::date;
  v_row public.user_weekly_missions;
  v_amount int;
  v_old int;
  v_new int;
  v_def record;
  v_bonus int;
begin
  if v_uid is null then
    raise exception 'not authorized';
  end if;

  if p_absolute then
    v_amount := least(greatest(coalesce(p_increment, 0), 0), 3650);
  else
    v_amount := least(greatest(coalesce(p_increment, 0), 0), 50);
  end if;

  select * into v_row from public.user_weekly_missions
   where user_id = v_uid and week_start = v_week
   for update;
  if not found then
    return null;
  end if;

  v_old := coalesce((v_row.progress ->> p_metric_key)::int, 0);
  v_new := case when p_absolute then greatest(v_old, v_amount) else v_old + v_amount end;
  v_row.progress := jsonb_set(coalesce(v_row.progress, '{}'::jsonb),
                              array[p_metric_key], to_jsonb(v_new), true);

  for v_def in
    select * from public.mission_definitions
    where id = any(v_row.mission_ids)
      and metric_key = p_metric_key
      and is_active
  loop
    if v_new >= v_def.target_value and not (v_def.id = any(v_row.completed_ids)) then
      v_row.completed_ids := v_row.completed_ids || v_def.id;

      if v_def.xp_reward > 0 then
        update public.profiles
           set xp = xp + least(v_def.xp_reward, 20000),
               level = floor((xp + least(v_def.xp_reward, 20000)) / 1000) + 1
         where id = v_uid;
        v_row.total_xp_earned := coalesce(v_row.total_xp_earned, 0) + v_def.xp_reward;
      end if;

      if v_def.reward_type = 'xp_and_booster' then
        v_row.boosters_earned := coalesce(v_row.boosters_earned, 0) + 1;
      end if;

      perform public._notify_internal(
        v_uid, 'mission',
        'Mission Complete: ' || v_def.title,
        case when v_def.reward_type = 'xp_and_booster'
             then v_def.reward_label || ' — your XP Booster is ready!'
             else v_def.reward_label end,
        v_def.icon,
        jsonb_build_object(
          'mission_id', v_def.id,
          'reward_type', v_def.reward_type,
          'xp_reward', v_def.xp_reward
        )
      );
    end if;
  end loop;

  if not v_row.bonus_claimed
     and coalesce(array_length(v_row.mission_ids, 1), 0) > 0
     and (select count(*) from unnest(v_row.mission_ids) mid where mid = any(v_row.completed_ids)) = array_length(v_row.mission_ids, 1)
  then
    select round((sum(xp_reward) * 0.25) / 10.0) * 10 into v_bonus
    from public.mission_definitions
    where id = any(v_row.mission_ids);
    v_bonus := greatest(coalesce(v_bonus, 0), 50);

    update public.profiles
       set xp = xp + least(v_bonus, 20000),
           level = floor((xp + least(v_bonus, 20000)) / 1000) + 1
     where id = v_uid;

    v_row.bonus_xp_earned := v_bonus;
    v_row.bonus_claimed := true;
    v_row.total_xp_earned := coalesce(v_row.total_xp_earned, 0) + v_bonus;

    perform public._notify_internal(
      v_uid, 'mission',
      'Weekly Missions Complete!',
      'Bonus: +' || v_bonus || ' XP for clearing every mission this week.',
      'party-popper',
      jsonb_build_object('bonus_xp', v_bonus)
    );
  end if;

  update public.user_weekly_missions
     set progress = v_row.progress,
         completed_ids = v_row.completed_ids,
         total_xp_earned = v_row.total_xp_earned,
         boosters_earned = v_row.boosters_earned,
         bonus_xp_earned = v_row.bonus_xp_earned,
         bonus_claimed = v_row.bonus_claimed
   where id = v_row.id;

  return to_jsonb(v_row);
end;
$function$;

-- ── record_game_goal_progress() — exists live; not previously tracked
--    in this repo's migration history at all ──────────────────────────
create or replace function public.record_game_goal_progress(p_increment integer default 1)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_cycle public.game_goal_cycles;
  v_row public.user_game_goal_progress;
  v_amount int;
  v_new_games int;
  v_i int;
  v_xp int;
begin
  if v_uid is null then
    raise exception 'not authorized';
  end if;

  v_amount := least(greatest(coalesce(p_increment, 0), 0), 20);

  select * into v_cycle
  from public.game_goal_cycles
  where status = 'live'
  limit 1;

  if not found or v_cycle.ends_at is null or v_cycle.ends_at <= now() then
    return null;
  end if;

  insert into public.user_game_goal_progress (user_id, cycle_id)
  values (v_uid, v_cycle.id)
  on conflict (user_id, cycle_id) do nothing;

  select * into v_row
  from public.user_game_goal_progress
  where user_id = v_uid and cycle_id = v_cycle.id
  for update;

  v_new_games := v_row.games_played + v_amount;

  for v_i in 0..3 loop
    if v_new_games >= v_cycle.thresholds[v_i + 1] and not (v_i = any(v_row.completed_milestones)) then
      v_row.completed_milestones := v_row.completed_milestones || v_i;

      if v_i < 3 then
        v_xp := least(v_cycle.xp_rewards[v_i + 1], 20000);
        update public.profiles
          set xp = xp + v_xp,
              level = floor((xp + v_xp) / 1000) + 1
          where id = v_uid;
        v_row.total_xp_earned := v_row.total_xp_earned + v_xp;

        perform public._notify_internal(
          v_uid, 'game_goal',
          'Activity Goal milestone reached!',
          '+' || v_xp || ' XP for playing ' || v_cycle.thresholds[v_i + 1] || ' games this cycle.',
          'zap',
          jsonb_build_object('cycle_id', v_cycle.id, 'milestone', v_i, 'xp_reward', v_xp)
        );
      else
        insert into public.user_inventory (user_id, item_id)
        values (v_uid, v_cycle.final_reward_item_id)
        on conflict (user_id, item_id) do nothing;
        v_row.item_granted := true;

        perform public._notify_internal(
          v_uid, 'game_goal',
          'Activity Goal complete!',
          'You unlocked the final Activity Goal reward.',
          'gift',
          jsonb_build_object('cycle_id', v_cycle.id, 'milestone', v_i, 'item_id', v_cycle.final_reward_item_id)
        );
      end if;
    end if;
  end loop;

  update public.user_game_goal_progress
    set games_played = v_new_games,
        completed_milestones = v_row.completed_milestones,
        total_xp_earned = v_row.total_xp_earned,
        item_granted = v_row.item_granted,
        updated_at = now()
    where id = v_row.id;

  return to_jsonb(v_row);
end;
$function$;

-- ── claim_random_surprise() — 'halo' via _notify_internal ───────────────
create or replace function public.claim_random_surprise()
returns table(already_claimed boolean, reward_type text, reward_amount integer)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_today date := (now() at time zone 'utc')::date;
  v_existing record;
  v_roll numeric;
  v_reward_type text;
  v_amount int := 0;
  v_line_text text;
  v_body text;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select * into v_existing from public.random_surprise_claims
    where user_id = v_uid and claim_date = v_today;

  if found then
    return query select true, v_existing.reward_type, v_existing.reward_amount;
    return;
  end if;

  v_roll := random();
  if v_roll < 0.03 then
    v_reward_type := 'diamonds';
    v_amount := 15;
  elsif v_roll < 0.806 then
    v_reward_type := 'xp';
    v_amount := 15 + floor(random() * 21)::int;
  else
    v_reward_type := 'nothing';
    v_amount := 0;
  end if;

  insert into public.random_surprise_claims (user_id, claim_date, reward_type, reward_amount)
    values (v_uid, v_today, v_reward_type, v_amount)
    on conflict (user_id, claim_date) do nothing;

  if not found then
    select * into v_existing from public.random_surprise_claims
      where user_id = v_uid and claim_date = v_today;
    return query select true, v_existing.reward_type, v_existing.reward_amount;
    return;
  end if;

  if v_reward_type = 'diamonds' then
    insert into public.user_wallets (user_id, gem_balance)
      values (v_uid, v_amount)
      on conflict (user_id) do update
        set gem_balance = public.user_wallets.gem_balance + excluded.gem_balance,
            updated_at = now();
    insert into public.diamond_transactions (user_id, reference, amount, description)
      values (v_uid, 'random_surprise:' || v_today, v_amount, 'Halo random surprise');
    v_body := '+' || v_amount || ' diamonds';

  elsif v_reward_type = 'xp' then
    update public.profiles
      set xp = xp + least(v_amount, 20000),
          level = floor((xp + least(v_amount, 20000)) / 1000) + 1
      where id = v_uid;
    v_body := '+' || v_amount || ' XP';

  else
    v_body := '';
  end if;

  select gnl.text into v_line_text from public.get_next_halo_line('random_surprise') as gnl;

  perform public._notify_internal(v_uid, 'halo', coalesce(v_line_text, 'Halo left you a surprise.'), v_body, 'sparkles', '{}'::jsonb);

  return query select false, v_reward_type, v_amount;
end;
$function$;

-- ── record_halo_challenge_progress() — 'halo' via _notify_internal ─────
create or replace function public.record_halo_challenge_progress(
  p_metric_key text, p_increment integer, p_absolute boolean default false
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
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

  if not found or v_row.status <> 'accepted' or v_row.completed or v_row.challenge_key <> p_metric_key then
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
    perform public._notify_internal(v_uid, 'halo', 'Halo Challenge complete!', 'Your challenge is done — head back to claim it.', 'sparkles', '{}'::jsonb);
  end if;
end;
$function$;

-- ── send_daily_fortune_notifications() — cron, no auth.uid() ────────────
create or replace function public.send_daily_fortune_notifications()
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_today date := (now() at time zone 'utc')::date;
  v_user record;
  v_line_id uuid;
  v_line_text text;
begin
  for v_user in
    select p.id from public.profiles p
    where not exists (
      select 1 from public.daily_fortune df
      where df.user_id = p.id and df.fortune_date = v_today
    )
  loop
    select gnl.id, gnl.text into v_line_id, v_line_text
      from public.get_next_halo_line('fortune', v_user.id) as gnl;

    if v_line_id is null then
      continue;
    end if;

    insert into public.daily_fortune (user_id, fortune_date, line_id)
      values (v_user.id, v_today, v_line_id)
      on conflict (user_id, fortune_date) do nothing;

    perform public._notify_internal(v_user.id, 'halo', v_line_text, 'Chillverse Fortune', 'sparkles', '{}'::jsonb);
  end loop;
end;
$function$;

-- ── run_scheduled_notifications() — come_back / streak_warning /
--    exploration_complete, cron, no auth.uid() ──────────────────────────
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
  for r in
    select id, coalesce(display_name, username, 'Player') as uname
    from profiles
    where last_seen_at < now() - interval '2 days'
      and (come_back_notified_at is null or come_back_notified_at < last_seen_at)
  loop
    select gnl.text into v_line_text
      from public.get_next_halo_line('inactivity_nudge', r.id) as gnl;

    perform public._notify_internal(
        r.id, 'come_back',
        'Hey ' || r.uname,
        coalesce(v_line_text, 'Time to jump back into Chillverse!'),
        'sparkles', '{}'::jsonb
      );
    update profiles set come_back_notified_at = now() where id = r.id;
  end loop;

  for r in
    select id, coalesce(display_name, username, 'Player') as uname
    from profiles
    where streak > 0
      and last_streak_date = (now() at time zone 'UTC')::date - 1
      and extract(hour from now() at time zone 'UTC') >= 19
      and (streak_warning_sent_date is null
           or streak_warning_sent_date < (now() at time zone 'UTC')::date)
  loop
    perform public._notify_internal(
        r.id, 'streak_warning',
        'Hey ' || r.uname,
        'Your streak resets soon, time to jump back in to Chillverse!',
        'flame', '{}'::jsonb
      );
    update profiles
      set streak_warning_sent_date = (now() at time zone 'UTC')::date
      where id = r.id;
  end loop;

  for r in
    select distinct e.user_id
    from exploration_chamber_runs e
    where e.ends_at <= now() and e.claimed = false and e.notified = false
  loop
    perform public._notify_internal(
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

-- ── run_club_subscription_checks() — club_grace_warning, cron ───────────
create or replace function public.run_club_subscription_checks()
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  r record;
  v_over record;
begin
  for r in
    select distinct cr.created_by
    from public.chat_rooms cr
    join public.profiles p on p.id = cr.created_by
    where cr.type = 'club' and (cr.grace_started_at is not null or cr.archived_at is not null)
      and coalesce(p.is_pro, false) and (p.pro_expires_at is null or p.pro_expires_at > now())
  loop
    update public.chat_rooms
      set grace_started_at = null, archived_at = null
      where type = 'club' and created_by = r.created_by;
  end loop;

  for v_over in
    select cr.id as room_id, cr.name, cr.created_by
    from public.chat_rooms cr
    join public.profiles p on p.id = cr.created_by
    where cr.type = 'club' and cr.archived_at is null and cr.grace_started_at is null
      and not (coalesce(p.is_pro, false) and (p.pro_expires_at is null or p.pro_expires_at > now()))
      and cr.id not in (
        select id from (
          select id, row_number() over (partition by created_by order by created_at asc) as rn
          from public.chat_rooms where type = 'club' and archived_at is null
        ) ranked where rn <= 2
      )
  loop
    update public.chat_rooms set grace_started_at = now() where id = v_over.room_id;
    perform public._notify_internal(
        v_over.created_by, 'club_grace_warning',
        'Club will be archived soon',
        '"' || v_over.name || '" will be archived in 24 hours unless you renew your subscription.',
        'flag', jsonb_build_object('room_id', v_over.room_id)
      );
  end loop;

  update public.chat_rooms cr
    set archived_at = now()
    from public.profiles p
    where cr.type = 'club' and cr.created_by = p.id
      and cr.grace_started_at is not null and cr.grace_started_at < now() - interval '24 hours'
      and cr.archived_at is null
      and not (coalesce(p.is_pro, false) and (p.pro_expires_at is null or p.pro_expires_at > now()));

  delete from public.chat_rooms cr
    using public.profiles p
    where cr.type = 'club' and cr.created_by = p.id
      and cr.archived_at is not null and cr.archived_at < now() - interval '7 days'
      and not (coalesce(p.is_pro, false) and (p.pro_expires_at is null or p.pro_expires_at > now()));
end;
$function$;

-- ── handle_new_user() — referral_milestone / referral_completed,
--    auth trigger, no auth.uid() ────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_provider            text := new.raw_app_meta_data->>'provider';
  v_meta                jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_base_username       text;
  v_username            text;
  v_display_name        text;
  v_country             text;
  v_dob                 date;
  v_interests           text[];
  v_connected_platform  text;
  v_referral_code_input text;
  v_device_id           text;
  v_referrer_id         uuid;
  v_device_already_paid boolean := false;
  v_new_count           int;
  v_prev_tier_paid      int;
  v_tier                int;
  v_reward              int;
begin
  if v_provider = 'email' then
    v_base_username       := nullif(trim(v_meta->>'username'), '');
    v_display_name        := nullif(trim(v_meta->>'display_name'), '');
    v_country             := nullif(v_meta->>'country', '');
    v_connected_platform  := nullif(v_meta->>'connected_platform', '');
    v_referral_code_input := nullif(upper(trim(v_meta->>'referral_code')), '');
    v_device_id           := nullif(trim(v_meta->>'device_id'), '');

    if nullif(v_meta->>'dob', '') is not null then
      begin
        v_dob := (v_meta->>'dob')::date;
      exception when others then
        v_dob := null;
      end;
    end if;

    if v_meta ? 'interests' and jsonb_typeof(v_meta->'interests') = 'array' then
      select array_agg(x) into v_interests
      from jsonb_array_elements_text(v_meta->'interests') x;
    end if;
  elsif v_provider = 'google' then
    v_display_name := nullif(trim(v_meta->>'full_name'), '');
    v_device_id     := nullif(trim(v_meta->>'device_id'), '');
  end if;

  v_base_username := coalesce(v_base_username, split_part(new.email, '@', 1), 'player');
  v_base_username := regexp_replace(v_base_username, '[^a-zA-Z0-9_\.]', '', 'g');
  if v_base_username = '' then
    v_base_username := 'player';
  end if;

  v_username := v_base_username;
  while exists (select 1 from public.profiles where username = v_username) loop
    v_username := v_base_username || '_' || substr(md5(random()::text), 1, 4);
  end loop;

  v_display_name := coalesce(v_display_name, v_base_username);

  insert into public.profiles (
    id, username, original_username, display_name, avatar,
    country, dob, interests, connected_platform, signup_device_id
  )
  values (
    new.id, v_username, v_username, v_display_name, 'rocket',
    v_country, v_dob, coalesce(v_interests, '{}'::text[]), v_connected_platform, v_device_id
  )
  on conflict (id) do nothing;

  if v_referral_code_input is not null then
    select id into v_referrer_id
      from public.profiles
      where referral_code = v_referral_code_input and id <> new.id;

    if v_referrer_id is not null then
      update public.profiles set referred_by = v_referrer_id
        where id = new.id and referred_by is null;

      if v_device_id is not null then
        select exists (
          select 1 from public.profiles
          where signup_device_id = v_device_id
            and id <> new.id
            and referral_completed = true
        ) into v_device_already_paid;
      end if;

      if not v_device_already_paid then
        update public.profiles set referral_completed = true where id = new.id;

        update public.profiles
          set referral_count = referral_count + 1
          where id = v_referrer_id
          returning referral_count, referral_tier_paid into v_new_count, v_prev_tier_paid;

        select tier, reward into v_tier, v_reward from public.referral_tier_reward(v_new_count);

        if v_tier is not null and v_tier > v_prev_tier_paid then
          insert into public.user_wallets (user_id, gem_balance)
            values (v_referrer_id, v_reward)
            on conflict (user_id)
            do update set gem_balance = public.user_wallets.gem_balance + excluded.gem_balance,
                          updated_at = now();
          insert into public.diamond_transactions (user_id, reference, amount, description)
            values (v_referrer_id, 'referral_milestone:' || v_tier, v_reward, 'Referral milestone reached — tier ' || v_tier);

          update public.profiles set referral_tier_paid = v_tier where id = v_referrer_id;

          perform public._notify_internal(v_referrer_id, 'referral_milestone', 'Referral milestone reached! 🎉',
              format('You''ve referred %s friends — +%s diamonds added.', v_new_count, v_reward), 'gem',
              jsonb_build_object('tier', v_tier, 'reward', v_reward));
        end if;

        perform public._notify_internal(v_referrer_id, 'referral_completed', 'Your friend joined in!',
            'They just signed up using your referral code.', 'gem',
            jsonb_build_object('referred_user_id', new.id));
      end if;
    end if;
  end if;

  return new;
end;
$function$;

-- ── notify_rank_tag() — converted from a bulk INSERT...SELECT to a
--    per-row loop through _notify_internal, trading raw insert speed
--    for consistent gating ────────────────────────────────────────────
create or replace function public.notify_rank_tag(
  p_rank_group text, p_sender_id uuid, p_message_id uuid default null, p_post_id uuid default null
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  r record;
begin
  if auth.uid() is null or auth.uid() <> p_sender_id or not public.is_staff(p_sender_id) then
    raise exception 'CV_MOD_FORBIDDEN: staff only';
  end if;

  if p_rank_group not in ('rookie', 'bronze', 'silver', 'gold', 'platinum', 'diamond', 'legend', 'og') then
    raise exception 'CV_MOD_BAD_ROLE: invalid rank group';
  end if;

  for r in
    select p.id from public.profiles p
    where public.xp_in_rank_group(p.xp, p_rank_group)
      and p.id <> p_sender_id
  loop
    perform public._notify_internal(
      r.id,
      'rank_tag',
      initcap(p_rank_group) || ' rank tagged',
      case when p_message_id is not null then 'Tagged in Global Chat' else 'Tagged in a post' end,
      'megaphone',
      jsonb_build_object('rank_group', p_rank_group, 'sender_id', p_sender_id, 'message_id', p_message_id, 'post_id', p_post_id)
    );
  end loop;
end;
$function$;

-- ── admin_broadcast_notification() — same bulk-to-loop conversion ───────
create or replace function public.admin_broadcast_notification(
  p_title text, p_body text, p_icon text default 'megaphone'::text
)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_caller uuid := auth.uid();
  v_count int := 0;
  r record;
begin
  if v_caller is null or not public.is_admin_role(v_caller) then
    raise exception 'CV_ADMIN_FORBIDDEN: admin only';
  end if;

  if p_title is null or trim(p_title) = '' or p_body is null or trim(p_body) = '' then
    raise exception 'CV_ADMIN_VALIDATION: title and body are required';
  end if;

  for r in select id from public.profiles loop
    perform public._notify_internal(r.id, 'announcement', p_title, p_body, coalesce(p_icon, 'megaphone'), '{}'::jsonb);
    v_count := v_count + 1;
  end loop;

  insert into public.moderation_log (moderator_id, action, target_type, target_id, metadata)
    values (v_caller, 'broadcast_notification', 'notification', null, jsonb_build_object('title', p_title, 'recipients', v_count));

  return v_count;
end;
$function$;

-- ── recompute_leaderboard_rank_badges() — rank_down / rank_up /
--    followed_rank_up via _notify_internal ──────────────────────────────
create or replace function public.recompute_leaderboard_rank_badges()
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  r      record;
  v_name text;
begin
  for r in
    delete from public.player_badges
    where badge_id = 'leaderboard_legend'
      and user_id not in (select id from public.leaderboard_eligible_ranks() where rnk = 1)
    returning user_id
  loop
    perform public._notify_internal(r.user_id, 'rank_down', 'Dethroned!',
      'Someone overtook you — you''re no longer #1 on the leaderboard. Keep climbing to reclaim Leaderboard Legend.',
      'crown', '{}'::jsonb);
  end loop;

  for r in
    delete from public.player_badges
    where badge_id = 'runner_up_elite'
      and user_id not in (select id from public.leaderboard_eligible_ranks() where rnk = 2)
    returning user_id
  loop
    perform public._notify_internal(r.user_id, 'rank_down', 'Bumped from the Top 2',
      'You''ve dropped out of the top 2 on the leaderboard. Climb back up to reclaim Runner-Up Elite.',
      'crown', '{}'::jsonb);
  end loop;

  if public.badge_is_available('leaderboard_legend') then
    for r in
      with newly_first as (
        insert into public.player_badges (user_id, badge_id)
        select id, 'leaderboard_legend' from public.leaderboard_eligible_ranks() where rnk = 1
        on conflict (user_id, badge_id) do nothing
        returning user_id
      )
      select user_id from newly_first
    loop
      select coalesce(display_name, username) into v_name from public.profiles where id = r.user_id;

      begin
        perform public._notify_internal(
          r.user_id, 'rank_up', 'You''re #1!',
          'You reached the top of the leaderboard.', 'crown', '{}'::jsonb
        );

        perform public._notify_internal(
          f.follower_id, 'followed_rank_up',
          v_name || ' reached #1 on the leaderboard!',
          'Check out their profile.', 'crown',
          jsonb_build_object('user_id', r.user_id)
        )
        from public.follows f
        join public.profiles p on p.id = r.user_id
        where f.following_id = r.user_id and p.show_game_progression = true;
      exception when others then
        raise warning 'recompute_leaderboard_rank_badges: rank-1 notify failed for user %: %', r.user_id, sqlerrm;
      end;
    end loop;
  end if;

  if public.badge_is_available('runner_up_elite') then
    for r in
      with newly_second as (
        insert into public.player_badges (user_id, badge_id)
        select id, 'runner_up_elite' from public.leaderboard_eligible_ranks() where rnk = 2
        on conflict (user_id, badge_id) do nothing
        returning user_id
      )
      select user_id from newly_second
    loop
      select coalesce(display_name, username) into v_name from public.profiles where id = r.user_id;

      begin
        perform public._notify_internal(
          r.user_id, 'rank_up', 'You''re #2!',
          'You reached the top 2 on the leaderboard.', 'crown', '{}'::jsonb
        );

        perform public._notify_internal(
          f.follower_id, 'followed_rank_up',
          v_name || ' reached #2 on the leaderboard!',
          'Check out their profile.', 'crown',
          jsonb_build_object('user_id', r.user_id)
        )
        from public.follows f
        join public.profiles p on p.id = r.user_id
        where f.following_id = r.user_id and p.show_game_progression = true;
      exception when others then
        raise warning 'recompute_leaderboard_rank_badges: rank-2 notify failed for user %: %', r.user_id, sqlerrm;
      end;
    end loop;
  end if;
end;
$function$;

notify pgrst, 'reload schema';
