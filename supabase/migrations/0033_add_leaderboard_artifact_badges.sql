-- supabase/migrations/0033_add_leaderboard_artifact_badges.sql
-- ════════════════════════════════════════════════════════════════════════
-- Migration 0033 — New badges: Leaderboard Legend, Runner-Up Elite, Relic
-- Master + `tap_shows_task` column
--
-- WHY grant_type = 'manual':
-- "Top 1 / Top 2 on the leaderboard" and "own 5 pro artifacts" are, in
-- principle, server-verifiable conditions. But the function that
-- automatically checks & awards badges (`check_and_award_auto_badges`)
-- isn't defined anywhere in this repo's migrations — like `badges` itself
-- (see the NOTE in 0026), it predates the tracked migration history, so
-- its current body is unknown here and it would be unsafe to blindly
-- CREATE OR REPLACE it without seeing what it already does (gifting,
-- streak, version upgrade, per the comment above checkAndAwardAutoBadges
-- in src/features/badges/badges.ts).
--
-- So, matching the precedent set by 0026 (CV) and 0032 (Peak Performer),
-- these three ship as grant_type = 'manual' for now, awarded from the
-- Moderation Panel's Users tab via grantManualBadge(). If/when real
-- automatic detection is wanted, either share `check_and_award_auto_badges`'s
-- current SQL so it can be safely extended, or a new, separate checker
-- function can be added instead (leaving the existing one untouched) —
-- just say the word.
--
-- Icon keys 'hand-metal', 'sailboat', 'hand-fist' are mapped in
-- src/features/badges/badgeIcons.tsx.
--
-- `tap_shows_task`:
-- New nullable boolean column. When true, tapping the badge (BadgeRow /
-- BadgesModal toast) shows the badge's `description` text instead of its
-- `title` — e.g. tapping "Leaderboard Legend" shows "Top 1 on the
-- leaderboard". "Relic Master" (sailboat) is left false/default, so
-- tapping it just shows the title "Relic Master" as normal.
-- ════════════════════════════════════════════════════════════════════════

alter table public.badges
  add column if not exists tap_shows_task boolean not null default false;

insert into public.badges (id, title, description, icon, rarity, grant_type, is_dynamic_username, tap_shows_task)
values
  (
    'leaderboard_legend',
    'Leaderboard Legend',
    'Top 1 on the leaderboard.',
    'hand-metal',
    'legendary',
    'manual',
    false,
    true
  ),
  (
    'runner_up_elite',
    'Runner-Up Elite',
    'Top 2 on the leaderboard.',
    'hand-fist',
    'epic',
    'manual',
    false,
    true
  ),
  (
    'relic_master',
    'Relic Master',
    'Own 5 pro artifacts.',
    'sailboat',
    'rare',
    'manual',
    false,
    false
  )
on conflict (id) do nothing;

notify pgrst, 'reload schema';
