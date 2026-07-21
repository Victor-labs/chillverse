-- supabase/migrations/0053_badge_availability_and_mod_search.sql
-- ════════════════════════════════════════════════════════════════════════
-- Migration 0053 — Badge availability toggle + moderator partial-name
-- user search
--
-- Part 1: Badge availability
--   Adds `is_available` to `badges` (default true, so every existing badge
--   stays earnable). Once a moderator/admin flips a badge to unavailable:
--     - `check_and_award_auto_badges` will no longer insert it for anyone
--       (each auto-award branch is now gated by `badge_is_available`).
--     - `grant_manual_badge` refuses to hand it out (raises
--       CV_MOD_BADGE_UNAVAILABLE) even if a staff member tries.
--   Players who already own the badge keep it — this only blocks new
--   awards, it doesn't retroactively strip anyone.
--   `mod_set_badge_availability` is the staff-gated RPC the client calls
--   to flip the flag; it logs to moderation_log like every other mod
--   action in this file.
--
-- Part 2: Moderator user search
--   `searchUserByUsername` (moderation.ts) requires an exact username via
--   `.ilike(...).maybeSingle()` — a moderator has to already know the
--   full, correct username before they can find someone. `mod_search_users`
--   adds a lightweight partial-match (ILIKE '%...%') lookup over
--   username/display_name, staff-gated, capped and ordered so
--   prefix-matches surface first. It returns just enough to render a
--   result row and re-resolve the exact user afterwards — no email or
--   wallet data, unlike the admin-only `admin_list_users`.
-- ════════════════════════════════════════════════════════════════════════

-- 1. Badge availability column ───────────────────────────────────────────
alter table public.badges
  add column if not exists is_available boolean not null default true;

-- 2. Helper: is a given badge currently earnable? ────────────────────────
create or replace function public.badge_is_available(p_badge_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select is_available from public.badges where id = p_badge_id), false);
$$;

-- 3. Re-gate every automatic badge award behind availability ─────────────
create or replace function public.check_and_award_auto_badges(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  v_gift_count        int;
  v_profile            record;
  v_diamond_total      numeric;
  v_pro_artifact_count int;
begin
  if auth.uid() <> p_user_id then
    raise exception 'not authorized';
  end if;

  select count(distinct recipient_id) into v_gift_count
    from public.gifts where sender_id = p_user_id;
  if v_gift_count >= 20 and public.badge_is_available('gifted_hands') then
    insert into public.player_badges (user_id, badge_id) values (p_user_id, 'gifted_hands')
      on conflict (user_id, badge_id) do nothing;
  end if;

  select streak, version_level, is_pro, pro_tier, created_at, referral_count, xp
    into v_profile
    from public.profiles where id = p_user_id;

  if coalesce(v_profile.streak, 0) >= 30 and public.badge_is_available('chillverse_brilliance') then
    insert into public.player_badges (user_id, badge_id) values (p_user_id, 'chillverse_brilliance')
      on conflict (user_id, badge_id) do nothing;
  end if;

  if coalesce(v_profile.version_level, 1) >= 2 and public.badge_is_available('chillverse_bravery') then
    insert into public.player_badges (user_id, badge_id) values (p_user_id, 'chillverse_bravery')
      on conflict (user_id, badge_id) do nothing;
  end if;

  if v_profile.is_pro and v_profile.pro_tier = 'orbit' and public.badge_is_available('orbit_subscriber') then
    insert into public.player_badges (user_id, badge_id) values (p_user_id, 'orbit_subscriber')
      on conflict (user_id, badge_id) do nothing;
  end if;

  if v_profile.is_pro and v_profile.pro_tier = 'void' and public.badge_is_available('void_subscriber') then
    insert into public.player_badges (user_id, badge_id) values (p_user_id, 'void_subscriber')
      on conflict (user_id, badge_id) do nothing;
  end if;

  if v_profile.created_at <= now() - interval '1 year' and public.badge_is_available('anniversary') then
    insert into public.player_badges (user_id, badge_id) values (p_user_id, 'anniversary')
      on conflict (user_id, badge_id) do nothing;
  end if;

  if coalesce(v_profile.referral_count, 0) >= 10 and public.badge_is_available('recruiter') then
    insert into public.player_badges (user_id, badge_id) values (p_user_id, 'recruiter')
      on conflict (user_id, badge_id) do nothing;
  end if;

  if coalesce(v_profile.referral_count, 0) >= 1 and public.badge_is_available('inviter') then
    insert into public.player_badges (user_id, badge_id) values (p_user_id, 'inviter')
      on conflict (user_id, badge_id) do nothing;
  end if;

  select coalesce(sum(amount), 0) into v_diamond_total
    from public.diamond_transactions where user_id = p_user_id;
  if v_diamond_total >= 15000 and public.badge_is_available('diamond_collector') then
    insert into public.player_badges (user_id, badge_id) values (p_user_id, 'diamond_collector')
      on conflict (user_id, badge_id) do nothing;
  end if;

  if coalesce(v_profile.xp, 0) >= 675000 and public.badge_is_available('top_ranked') then
    insert into public.player_badges (user_id, badge_id) values (p_user_id, 'top_ranked')
      on conflict (user_id, badge_id) do nothing;
  end if;

  select count(*) into v_pro_artifact_count
    from public.player_artifacts pa
    join public.artifacts a on a.id = pa.artifact_id
    where pa.user_id = p_user_id and a.requires_pro = true;

  if v_pro_artifact_count >= 5 and public.badge_is_available('relic_master') then
    insert into public.player_badges (user_id, badge_id) values (p_user_id, 'relic_master')
      on conflict (user_id, badge_id) do nothing;
  end if;
end;
$$;

-- 4. Manual grants refuse unavailable badges ──────────────────────────────
create or replace function public.grant_manual_badge(p_target_user_id uuid, p_badge_id text)
returns void
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  v_grant_type text;
  v_is_available boolean;
begin
  if not public.is_staff(auth.uid()) then
    raise exception 'not authorized';
  end if;

  select grant_type, is_available into v_grant_type, v_is_available from public.badges where id = p_badge_id;
  if v_grant_type is null then
    raise exception 'badge not found';
  end if;
  if v_grant_type <> 'manual' then
    raise exception 'this badge cannot be manually granted — it is automatic';
  end if;
  if not v_is_available then
    raise exception 'CV_MOD_BADGE_UNAVAILABLE: this badge is currently unavailable and cannot be granted';
  end if;

  insert into public.player_badges (user_id, badge_id, granted_by)
    values (p_target_user_id, p_badge_id, auth.uid())
    on conflict (user_id, badge_id) do nothing;
end;
$$;

-- 5. Staff-gated RPC to flip a badge's availability ───────────────────────
create or replace function public.mod_set_badge_availability(p_badge_id text, p_is_available boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
begin
  if v_caller is null or not public.is_staff(v_caller) then
    raise exception 'CV_MOD_FORBIDDEN: staff role required';
  end if;

  if not exists (select 1 from public.badges where id = p_badge_id) then
    raise exception 'CV_MOD_NOT_FOUND: badge not found';
  end if;

  update public.badges set is_available = p_is_available where id = p_badge_id;

  insert into public.moderation_log (moderator_id, action, target_type, target_id, metadata)
    values (v_caller, 'set_badge_availability', 'badge', p_badge_id, jsonb_build_object('is_available', p_is_available));
end;
$$;

revoke execute on function public.mod_set_badge_availability(text, boolean) from public;
grant execute on function public.mod_set_badge_availability(text, boolean) to authenticated;

-- 6. Staff-gated partial-match user search ────────────────────────────────
create or replace function public.mod_search_users(p_search text, p_limit int default 8)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_limit int;
  v_rows jsonb;
begin
  if v_caller is null or not public.is_staff(v_caller) then
    raise exception 'CV_MOD_FORBIDDEN: staff role required';
  end if;

  v_limit := least(greatest(coalesce(p_limit, 8), 1), 25);

  if p_search is null or trim(p_search) = '' then
    return '[]'::jsonb;
  end if;

  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) into v_rows
  from (
    select
      p.id as user_id,
      p.username,
      p.display_name,
      p.avatar,
      coalesce(m.role, 'user') as role,
      coalesce(m.is_banned, false) as is_banned
    from public.profiles p
    left join public.user_moderation m on m.user_id = p.id
    where p.username ilike '%' || p_search || '%'
       or p.display_name ilike '%' || p_search || '%'
    order by
      (p.username ilike p_search || '%') desc,
      p.username asc
    limit v_limit
  ) t;

  return v_rows;
end;
$$;

revoke execute on function public.mod_search_users(text, int) from public;
grant execute on function public.mod_search_users(text, int) to authenticated;

notify pgrst, 'reload schema';
