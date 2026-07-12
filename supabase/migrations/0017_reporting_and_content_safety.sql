-- supabase/migrations/0017_reporting_and_content_safety.sql
--
-- Fixes three items from the code-review discrepancy list:
--
-- 1. Stale posting-eligibility XP threshold: check_posting_eligibility (see
--    migration 0007) hardcoded 42000 as "Gold rank" — that was Silver III's
--    threshold before rank thresholds were last rebalanced. Gold I is
--    actually 63000 XP (src/features/profile/ranks.ts, 'gold_1'.xpRequired).
--
-- 2. No reporting feature: adds a `content_reports` table so players can
--    report a user/post/comment/message from the app, reviewed by staff the
--    same way support_tickets are (service-role access via the Supabase
--    dashboard/SQL — no separate admin RLS role exists in this project).
--
-- 3. No automated profanity/hate-speech filter: adds a small, server-side
--    enforced blocked-word check on messages/posts/comments so it can't be
--    bypassed by calling the Supabase client directly. Mirrors (and should
--    be kept in sync with) src/shared/lib/profanityFilter.ts on the client,
--    which exists only to give immediate UX feedback before the round trip.

-- 1. Posting eligibility XP fix ──────────────────────────────────
create or replace function public.check_posting_eligibility(p_user_id uuid)
returns table (
  eligible          boolean,
  is_gold_rank      boolean,
  games_completed   int,
  games_required    int,
  has_profile_pic   boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_xp int;
  v_avatar text;
  v_games int;
  v_gold_xp constant int := 63000; -- keep in sync with 'gold_1'.xpRequired in src/features/profile/ranks.ts
  v_games_required constant int := 150;
begin
  select xp, avatar into v_xp, v_avatar from public.profiles where id = p_user_id;

  select count(*) into v_games
    from public.game_sessions
    where user_id = p_user_id and result = 'completed';

  return query select
    (coalesce(v_xp, 0) >= v_gold_xp)
      and (coalesce(v_games, 0) >= v_games_required)
      and (v_avatar is not null and v_avatar like 'http%'),
    coalesce(v_xp, 0) >= v_gold_xp,
    coalesce(v_games, 0),
    v_games_required,
    (v_avatar is not null and v_avatar like 'http%');
end;
$$;

-- 2. Content reports ──────────────────────────────────────────────
create table if not exists public.content_reports (
  id           uuid primary key default gen_random_uuid(),
  reporter_id  uuid not null references public.profiles(id) on delete cascade,
  target_type  text not null check (target_type in ('user', 'post', 'comment', 'message')),
  target_id    uuid not null,
  reason       text not null check (reason in (
                 'harassment', 'hate_speech', 'inappropriate_content',
                 'spam', 'impersonation', 'cheating', 'other'
               )),
  details      text check (details is null or char_length(details) <= 500),
  status       text not null default 'open' check (status in ('open', 'reviewed', 'actioned', 'dismissed')),
  created_at   timestamptz not null default now()
);

create index if not exists content_reports_target_idx on public.content_reports (target_type, target_id);
create index if not exists content_reports_reporter_idx on public.content_reports (reporter_id);
create index if not exists content_reports_status_idx on public.content_reports (status);

alter table public.content_reports enable row level security;

-- A player can report anything, but only ever as themselves.
drop policy if exists "users can create their own reports" on public.content_reports;
create policy "users can create their own reports" on public.content_reports
  for insert to authenticated
  with check (auth.uid() = reporter_id);

-- A player can see the status of reports they filed (not other people's).
drop policy if exists "users can view their own reports" on public.content_reports;
create policy "users can view their own reports" on public.content_reports
  for select to authenticated
  using (auth.uid() = reporter_id);

-- No update/delete policy for regular users — reports are reviewed and
-- actioned by staff via the service role, same as support_tickets.

-- Lightweight rate-limit: a player can't file more than 20 reports/day.
-- Prevents report-spam being used as a harassment or DoS vector.
create or replace function public.enforce_report_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count_today int;
begin
  select count(*) into v_count_today
    from public.content_reports
    where reporter_id = new.reporter_id
      and created_at >= date_trunc('day', now());

  if v_count_today >= 20 then
    raise exception 'CV_REPORT_LIMIT: daily report limit reached, please try again tomorrow';
  end if;

  return new;
end;
$$;

drop trigger if exists on_content_report_rate_limit on public.content_reports;
create trigger on_content_report_rate_limit
  before insert on public.content_reports
  for each row execute function public.enforce_report_rate_limit();

-- 3. Baseline profanity / hate-speech filter ───────────────────────
-- Deliberately narrow: clear slurs and severe-harassment terms only,
-- mirroring the scope of the existing BANNED_PATTERNS username filter in
-- src/features/settings/Settings.tsx. Keep in sync with the client-side
-- list in src/shared/lib/profanityFilter.ts (that copy is UX-only, this
-- one is the real enforcement).
create or replace function public.contains_blocked_language(input text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select input ~* '\m(nigger|nigga|faggot|fag|retard(ed)?|spastic|chink|spic|kike|tranny|cunt|rapist)\M';
$$;

create or replace function public.block_profane_message()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if public.contains_blocked_language(new.content) then
    raise exception 'CV_PROFANITY: message contains blocked language';
  end if;
  return new;
end;
$$;

drop trigger if exists on_message_profanity_check on public.messages;
create trigger on_message_profanity_check
  before insert or update on public.messages
  for each row execute function public.block_profane_message();

create or replace function public.block_profane_post()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if public.contains_blocked_language(new.body) then
    raise exception 'CV_PROFANITY: post contains blocked language';
  end if;
  return new;
end;
$$;

drop trigger if exists on_post_profanity_check on public.posts;
create trigger on_post_profanity_check
  before insert or update on public.posts
  for each row execute function public.block_profane_post();

create or replace function public.block_profane_comment()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if public.contains_blocked_language(new.body) then
    raise exception 'CV_PROFANITY: comment contains blocked language';
  end if;
  return new;
end;
$$;

drop trigger if exists on_comment_profanity_check on public.comments;
create trigger on_comment_profanity_check
  before insert or update on public.comments
  for each row execute function public.block_profane_comment();
