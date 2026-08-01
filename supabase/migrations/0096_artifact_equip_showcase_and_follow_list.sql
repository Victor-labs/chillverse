-- supabase/migrations/0096_artifact_equip_showcase_and_follow_list.sql
-- ════════════════════════════════════════════════════════════════════════
-- Migration 0096 — Two features for the profile preview sheet:
--
-- 1. Artifact equip + showcase. player_artifacts already tracks which
--    artifacts a player has unlocked (via Exploration), and the profile
--    preview already READS an is_equipped flag off it through the
--    user_items view — but nothing ever WROTE that flag, so every
--    profile shows "No artifact". This migration adds the missing write
--    path: exactly one equipped artifact at a time, plus up to three
--    additional "showcased" artifacts (distinct from the equipped one)
--    that surface in ArtifactQuickSheet below the equipped tile.
--
-- 2. get_follow_list() — a single capped, popularity-sorted RPC for the
--    followers/following sheet, so "top 50 by follower count" is computed
--    server-side in one round trip instead of pulling a user's entire
--    follow list into the client to sort.
--
-- Everything here is additive and idempotent (IF NOT EXISTS / OR REPLACE
-- throughout) — safe to run against the existing live schema.
--
-- NOTE: fixed vs. the original draft — player_artifacts.artifact_id and
-- artifacts.id are `text` in the live schema, not `uuid`. All affected
-- function params/return columns below use `text` accordingly.
-- ════════════════════════════════════════════════════════════════════════

-- ── 1a. Columns ─────────────────────────────────────────────────────────
alter table if exists public.player_artifacts
  add column if not exists is_equipped boolean not null default false;

alter table if exists public.player_artifacts
  add column if not exists is_showcased boolean not null default false;

-- Only one equipped artifact per user at a time.
create unique index if not exists player_artifacts_one_equipped_per_user
  on public.player_artifacts (user_id)
  where is_equipped;

-- An artifact can't simultaneously be the equipped one and a showcase
-- slot — showcase is defined as "up to three OTHERS".
alter table if exists public.player_artifacts drop constraint if exists player_artifacts_equip_showcase_exclusive;
alter table if exists public.player_artifacts
  add constraint player_artifacts_equip_showcase_exclusive
  check (not (is_equipped and is_showcased));

-- ── 1b. Cap showcased artifacts at 3 per user ───────────────────────────
create or replace function public.enforce_artifact_showcase_cap()
returns trigger
language plpgsql
as $$
begin
  if new.is_showcased and (
    select count(*) from public.player_artifacts
    where user_id = new.user_id and is_showcased and id <> new.id
  ) >= 3 then
    raise exception 'You can only showcase up to 3 artifacts';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_artifact_showcase_cap on public.player_artifacts;
create trigger trg_artifact_showcase_cap
  before insert or update of is_showcased on public.player_artifacts
  for each row
  when (new.is_showcased)
  execute function public.enforce_artifact_showcase_cap();

-- ── 1c. Equip / unequip / showcase toggle RPCs ──────────────────────────
-- security definer so the RLS-protected player_artifacts table doesn't
-- need broad client-side update grants — every write is funneled through
-- these functions, each of which verifies p_user_id = auth.uid() itself.

create or replace function public.set_equipped_artifact(p_artifact_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_owns    boolean;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select exists(
    select 1 from public.player_artifacts
    where user_id = v_user_id and artifact_id = p_artifact_id
  ) into v_owns;

  if not v_owns then
    raise exception 'You have not unlocked this artifact';
  end if;

  update public.player_artifacts set is_equipped = false
  where user_id = v_user_id and is_equipped and artifact_id <> p_artifact_id;

  update public.player_artifacts
  set is_equipped = true, is_showcased = false
  where user_id = v_user_id and artifact_id = p_artifact_id;
end;
$$;

grant execute on function public.set_equipped_artifact(text) to authenticated;

create or replace function public.unequip_artifact()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  update public.player_artifacts set is_equipped = false
  where user_id = v_user_id and is_equipped;
end;
$$;

grant execute on function public.unequip_artifact() to authenticated;

create or replace function public.toggle_artifact_showcase(p_artifact_id text)
returns boolean -- returns the new is_showcased state
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id   uuid := auth.uid();
  v_owns      boolean;
  v_equipped  boolean;
  v_current   boolean;
  v_next      boolean;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select is_equipped, is_showcased into v_equipped, v_current
  from public.player_artifacts
  where user_id = v_user_id and artifact_id = p_artifact_id;

  v_owns := found;
  if not v_owns then
    raise exception 'You have not unlocked this artifact';
  end if;

  if v_equipped then
    raise exception 'This artifact is already equipped — showcase applies to your other artifacts';
  end if;

  v_next := not v_current;

  update public.player_artifacts
  set is_showcased = v_next
  where user_id = v_user_id and artifact_id = p_artifact_id;

  return v_next;
end;
$$;

grant execute on function public.toggle_artifact_showcase(text) to authenticated;

-- ── 1d. Public read of any profile's equipped + showcased artifacts ────
-- player_artifacts' RLS (like the rest of the inventory tables) only
-- lets a user read their own rows. ProfilePreviewModal needs to show
-- this for whichever profile is open, own or not — same situation
-- get_public_profile() already solves for the rest of this sheet, so
-- this follows that exact precedent: a narrow, read-only, security
-- definer function instead of loosening the table's RLS.
create or replace function public.get_player_artifact_showcase(p_user_id uuid)
returns table (
  artifact_id text,
  is_equipped boolean,
  is_showcased boolean,
  name text,
  media_url text,
  tier text
)
language sql
stable
security definer
set search_path = public
as $$
  select pa.artifact_id, pa.is_equipped, pa.is_showcased, a.name, a.media_url, a.tier
  from public.player_artifacts pa
  join public.artifacts a on a.id = pa.artifact_id
  where pa.user_id = p_user_id
    and (pa.is_equipped or pa.is_showcased);
$$;

grant execute on function public.get_player_artifact_showcase(uuid) to authenticated, anon;

-- ── 2. Capped, popularity-sorted follow list ────────────────────────────
create or replace function public.get_follow_list(
  p_profile_id uuid,
  p_mode text,      -- 'followers' | 'following'
  p_viewer_id uuid
)
returns table (
  id uuid,
  username text,
  display_name text,
  xp integer,
  avatar text,
  followers_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    p.username,
    p.display_name,
    p.xp,
    p.avatar,
    coalesce(fc.followers_count, 0) as followers_count
  from public.follows f
  join public.profiles p
    on p.id = case when p_mode = 'followers' then f.follower_id else f.following_id end
  left join public.profile_follow_counts fc on fc.id = p.id
  where
    (case when p_mode = 'followers' then f.following_id else f.follower_id end) = p_profile_id
    and not exists (
      select 1 from public.blocks b
      where b.blocker_id = p_viewer_id and b.blocked_id = p.id
    )
    and not exists (
      select 1 from public.blocks b
      where b.blocker_id = p.id and b.blocked_id = p_viewer_id
    )
  order by followers_count desc, p.xp desc
  limit 50;
$$;

grant execute on function public.get_follow_list(uuid, text, uuid) to authenticated;
