-- ════════════════════════════════════════════════════════════════
-- Rank Decay
-- ════════════════════════════════════════════════════════════════
-- Introduces a second, decaying XP number (`active_rank_xp`) that
-- drives leaderboard order and displayed rank badges, while `xp`
-- stays a permanent lifetime total (unlocks, rank tags, progress
-- math never touch active_rank_xp).
--
--   • active_rank_xp increases 1:1 with xp on every XP award
--     (handled by a trigger, so every existing/future XP-award
--     code path is covered automatically — no RPC call sites
--     needed to be touched).
--   • active_rank_xp decays daily once the lifetime tier is
--     Silver III or higher and the player has gone 7+ days
--     without an XP gain.
--   • active_rank_xp can never fall below the xpRequired of the
--     tier one full level below the player's current LIFETIME
--     tier (based on `xp`, not `active_rank_xp`).
-- ════════════════════════════════════════════════════════════════

-- ── 1. Columns ──────────────────────────────────────────────────
alter table public.profiles
  add column if not exists active_rank_xp integer not null default 0,
  add column if not exists last_xp_gain_at timestamptz;

-- Backfill: every existing player starts with active_rank_xp = xp,
-- and last_xp_gain_at = now() so nobody starts mid-grace-period or
-- decays the instant this migration ships.
update public.profiles
set active_rank_xp = xp,
    last_xp_gain_at = now()
where active_rank_xp = 0;

create index if not exists profiles_active_rank_xp_idx on public.profiles (active_rank_xp desc);

comment on column public.profiles.active_rank_xp is
  'Decaying XP total. Drives leaderboard order + displayed rank badge. Never exceeds xp. See trg_sync_active_rank_xp and public.apply_rank_decay().';
comment on column public.profiles.last_xp_gain_at is
  'Timestamp of the most recent XP award. Decay only applies once 7+ days have passed since this.';

-- ── 2. Lock these columns down like the other privileged columns ─
-- (protect_privileged_profile_columns already blocks direct client
-- writes to `xp` etc. for the `authenticated` role; SECURITY DEFINER
-- RPCs run as a different role and bypass this check entirely, which
-- is exactly how xp itself is already protected.)
create or replace function public.protect_privileged_profile_columns()
returns trigger
language plpgsql
as $$
begin
  if current_user = 'authenticated' then
    if new.xp                       is distinct from old.xp
    or new.active_rank_xp           is distinct from old.active_rank_xp
    or new.last_xp_gain_at          is distinct from old.last_xp_gain_at
    or new.level                    is distinct from old.level
    or new.streak                   is distinct from old.streak
    or new.longest_streak           is distinct from old.longest_streak
    or new.last_streak_date         is distinct from old.last_streak_date
    or new.is_pro                   is distinct from old.is_pro
    or new.pro_tier                 is distinct from old.pro_tier
    or new.pro_billing_interval     is distinct from old.pro_billing_interval
    or new.pro_expires_at           is distinct from old.pro_expires_at
    or new.pro_cancel_at_period_end is distinct from old.pro_cancel_at_period_end
    or new.referral_code            is distinct from old.referral_code
    or new.referred_by              is distinct from old.referred_by
    or new.referral_completed       is distinct from old.referral_completed
    or new.referral_count           is distinct from old.referral_count
    or new.referral_tier_paid       is distinct from old.referral_tier_paid
    or new.staff_member_since       is distinct from old.staff_member_since
    or new.version_level            is distinct from old.version_level
    then
      raise exception 'privileged profile columns cannot be modified directly';
    end if;
  end if;
  return new;
end;
$$;

-- ── 3. Sync trigger: active_rank_xp tracks xp gains automatically ─
-- Fires on every insert and on every update that touches xp.
-- On XP gain: active_rank_xp += xp_earned, capped at xp; last_xp_gain_at resets.
create or replace function public.sync_active_rank_xp()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.active_rank_xp := coalesce(new.active_rank_xp, new.xp, 0);
    if new.xp > 0 and new.last_xp_gain_at is null then
      new.last_xp_gain_at := now();
    end if;
    return new;
  end if;

  if new.xp > old.xp then
    -- XP gain: active_rank_xp moves by the same delta, never exceeding xp.
    new.active_rank_xp := least(new.xp, coalesce(old.active_rank_xp, old.xp) + (new.xp - old.xp));
    new.last_xp_gain_at := now();
  elsif new.xp < old.xp then
    -- Defensive: if xp is ever corrected downward (moderation action, etc.)
    -- active_rank_xp can never sit above the new lifetime total.
    new.active_rank_xp := least(coalesce(new.active_rank_xp, old.active_rank_xp), new.xp);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sync_active_rank_xp on public.profiles;
create trigger trg_sync_active_rank_xp
  before insert or update of xp on public.profiles
  for each row
  execute function public.sync_active_rank_xp();

-- ── 4. Rank tier lookup table (mirrors src/features/profile/ranks.ts) ─
-- Kept in the database purely so the decay job can resolve a lifetime
-- xp total to its tier/ordinal/rate/floor server-side without
-- duplicating the tier ladder as inline SQL literals.
create table if not exists public.rank_tiers (
  ordinal      integer primary key,
  tier_id      text not null unique,
  tier_group   text not null,
  xp_required  integer not null,
  decay_rate   numeric  not null default 0   -- per-day fractional decay rate, 0 = not decay-eligible
);

truncate public.rank_tiers;
insert into public.rank_tiers (ordinal, tier_id, tier_group, xp_required, decay_rate) values
  (0,  'rookie',        'rookie',   0,       0),
  (1,  'bronze_1',      'bronze',   1500,    0),
  (2,  'bronze_2',      'bronze',   4000,    0),
  (3,  'bronze_3',      'bronze',   8000,    0),
  (4,  'silver_1',      'silver',   15000,   0),
  (5,  'silver_2',      'silver',   27000,   0),
  (6,  'silver_3',      'silver',   42000,   0.01),   -- decay begins at Silver III
  (7,  'gold_1',        'gold',     63000,   0.01),
  (8,  'gold_2',        'gold',     90000,   0.01),
  (9,  'gold_3',        'gold',     125000,  0.01),
  (10, 'platinum_1',    'platinum', 165000,  0.01),
  (11, 'platinum_2',    'platinum', 220000,  0.01),
  (12, 'platinum_3',    'platinum', 280000,  0.01),
  (13, 'diamond_1',     'diamond',  345000,  0.01),
  (14, 'diamond_2',     'diamond',  430000,  0.01),
  (15, 'diamond_3',     'diamond',  525000,  0.007),  -- 0.7%/day from Diamond III
  (16, 'legend',        'legend',   675000,  0.007),
  (17, 'chillverse_og', 'og',       900000,  0.007);

comment on table public.rank_tiers is
  'Mirrors RANK_TIERS in src/features/profile/ranks.ts. Keep both in sync when tiers change. Used only for server-side rank-decay math.';

-- ── 5. Daily decay job ────────────────────────────────────────────
create or replace function public.apply_rank_decay()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_lifetime_ordinal int;
  v_floor_xp bigint;
  v_rate numeric;
  v_new_active bigint;
begin
  for r in
    select p.id, p.xp, p.active_rank_xp
    from public.profiles p
    where p.last_xp_gain_at is not null
      and p.last_xp_gain_at < now() - interval '7 days'
      and p.active_rank_xp > 0
  loop
    select rt.ordinal into v_lifetime_ordinal
    from public.rank_tiers rt
    where rt.xp_required <= r.xp
    order by rt.ordinal desc
    limit 1;

    -- Decay only applies from Silver III (ordinal 6) upward.
    if v_lifetime_ordinal is null or v_lifetime_ordinal < 6 then
      continue;
    end if;

    select xp_required into v_floor_xp
    from public.rank_tiers
    where ordinal = greatest(v_lifetime_ordinal - 1, 0);

    select decay_rate into v_rate
    from public.rank_tiers
    where ordinal = v_lifetime_ordinal;

    v_new_active := greatest(v_floor_xp, floor(r.active_rank_xp * (1 - v_rate)));

    if v_new_active < r.active_rank_xp then
      update public.profiles
      set active_rank_xp = v_new_active
      where id = r.id;
    end if;
  end loop;
end;
$$;

comment on function public.apply_rank_decay() is
  'Run once/day via pg_cron. Decays active_rank_xp for players past the 7-day grace period, floored at one tier below their lifetime xp tier.';

-- Schedule it — 3am UTC daily, following the existing cron job convention
-- (see halo-lucky-user-midnight / blog-feed-random-share-daily).
select cron.unschedule(jobid) from cron.job where jobname = 'rank-decay-daily';
select cron.schedule('rank-decay-daily', '0 3 * * *', 'select public.apply_rank_decay();');

-- ── 6. Expose active_rank_xp through get_public_profile() ─────────
-- Used by PlayerProfile.tsx / ProfilePreviewModal.tsx to look up the
-- badge tier for the profile being viewed.
create or replace function public.get_public_profile(p_user_id uuid)
returns table(
  id uuid, username text, original_username text, display_name text, avatar text,
  country text, interests text[], xp integer, active_rank_xp integer, level integer, streak integer,
  bio text, gender text, play_time text, info_tags text[], favorite_game text,
  grid_cards text[], show_follow_counts boolean, equipped_profile_effect_url text,
  created_at timestamptz, presence text, is_pro boolean, staff_member_since date,
  banner_url text, equipped_avatar text, pro_tier text, pro_badge_color text,
  pro_first_subscribed_at timestamptz, display_name_font text, display_name_color text,
  profile_theme_color text, pro_expires_at timestamptz
)
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  v_visibility text;
  v_visible boolean;
begin
  select p.profile_visibility into v_visibility
  from public.profiles p where p.id = p_user_id;

  if v_visibility is null then
    return;
  end if;

  v_visible :=
    auth.uid() = p_user_id
    or v_visibility = 'everyone'
    or exists (
      select 1 from public.follows f
      where f.following_id = p_user_id and f.follower_id = auth.uid()
    );

  return query
  select
    p.id, p.username, p.original_username, p.display_name, p.avatar,
    p.country, p.interests, p.xp, p.active_rank_xp, p.level, p.streak,
    case when v_visible then p.bio else null end,
    case when v_visible then p.gender else null end,
    case when v_visible then p.play_time else null end,
    case when v_visible then p.info_tags else '{}'::text[] end,
    case when v_visible then p.favorite_game else null end,
    case when v_visible then p.grid_cards else '{}'::text[] end,
    p.show_follow_counts, p.equipped_profile_effect_url,
    p.created_at, p.presence, p.is_pro, p.staff_member_since,
    p.banner_url, p.equipped_avatar,
    p.pro_tier, p.pro_badge_color, p.pro_first_subscribed_at,
    p.display_name_font, p.display_name_color, p.profile_theme_color,
    p.pro_expires_at
  from public.profiles p
  where p.id = p_user_id;
end;
$$;

grant execute on function public.get_public_profile(uuid) to authenticated, anon;
