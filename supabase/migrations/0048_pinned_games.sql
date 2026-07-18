-- supabase/migrations/0048_pinned_games.sql
-- ════════════════════════════════════════════════════════════════════════
-- Migration 0048 — Pinned games (Games lobby "favorite" star)
--
-- Backs the star/favorite toggle in the new Discord-style game detail
-- sheet. Starring a game pins its card to the top of its section in the
-- Games lobby. This is a private per-user UI preference, NOT the existing
-- public `favorite_game` column (singular — the one showcased game picked
-- in Edit Profile and shown on the profile page). Different feature,
-- different column, on purpose — don't merge them.
--
-- Lives on `profiles` like other self-editable prefs (bio, favorite_game,
-- grid_cards, etc.) since the existing "update own profile" RLS policy
-- already covers plain user-editable columns like this one.
-- ════════════════════════════════════════════════════════════════════════

alter table public.profiles
  add column if not exists pinned_games text[] not null default '{}';
