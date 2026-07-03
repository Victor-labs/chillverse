-- supabase/migrations/0007_posts_feature.sql
-- ════════════════════════════════════════════════════
-- Migration 0007 — Blog/post feed feature
-- Run this in: Supabase Dashboard → SQL Editor → New query
-- Safe to run on an already-deployed project — every statement is
-- idempotent (IF EXISTS / OR REPLACE / ON CONFLICT) and can be re-run.
-- ════════════════════════════════════════════════════

-- 1. posts ────────────────────────────────────────────────────
create table if not exists public.posts (
  id               uuid primary key default gen_random_uuid(),
  author_id        uuid references public.profiles(id) on delete cascade,
  author_type      text not null default 'user' check (author_type in ('user','admin','system')),
  body             text not null check (char_length(body) between 1 and 500),
  tags             jsonb not null default '[]'::jsonb,   -- structured tags: [{type, ref_id, label}]
  likes_count      int  not null default 0,
  comments_count   int  not null default 0,
  influence        int  not null default 0,
  commentable      boolean not null default false,
  created_at       timestamptz not null default now()
);

create index if not exists posts_influence_idx on public.posts (influence desc, created_at desc);
create index if not exists posts_author_idx    on public.posts (author_id);

-- 2. comments ─────────────────────────────────────────────────
create table if not exists public.comments (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid not null references public.posts(id) on delete cascade,
  author_id   uuid not null references public.profiles(id) on delete cascade,
  body        text not null check (char_length(body) between 1 and 300),
  created_at  timestamptz not null default now()
);

create index if not exists comments_post_idx on public.comments (post_id, created_at);

-- 3. likes (one row per user per post, so we can toggle + prevent double-likes) ──
create table if not exists public.post_likes (
  post_id     uuid not null references public.posts(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (post_id, user_id)
);

-- 4. RLS ──────────────────────────────────────────────────────
alter table public.posts      enable row level security;
alter table public.comments   enable row level security;
alter table public.post_likes enable row level security;

drop policy if exists "posts are publicly readable" on public.posts;
create policy "posts are publicly readable" on public.posts
  for select using (true);

drop policy if exists "users can insert their own posts" on public.posts;
create policy "users can insert their own posts" on public.posts
  for insert with check (auth.uid() = author_id and author_type = 'user');

drop policy if exists "comments are publicly readable" on public.comments;
create policy "comments are publicly readable" on public.comments
  for select using (true);

drop policy if exists "users can comment on commentable posts" on public.comments;
create policy "users can comment on commentable posts" on public.comments
  for insert with check (
    auth.uid() = author_id
    and exists (select 1 from public.posts p where p.id = post_id and p.commentable = true)
  );

drop policy if exists "likes are publicly readable" on public.post_likes;
create policy "likes are publicly readable" on public.post_likes
  for select using (true);

drop policy if exists "users can like/unlike as themselves" on public.post_likes;
create policy "users can like/unlike as themselves" on public.post_likes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 5. Keep likes_count / comments_count / influence in sync ─────
create or replace function public.handle_post_like_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'INSERT') then
    update public.posts
      set likes_count = likes_count + 1,
          influence   = influence + 1
      where id = new.post_id;
  elsif (tg_op = 'DELETE') then
    update public.posts
      set likes_count = greatest(0, likes_count - 1),
          influence   = greatest(0, influence - 1)
      where id = old.post_id;
  end if;
  return null;
end;
$$;

drop trigger if exists on_post_like_change on public.post_likes;
create trigger on_post_like_change
  after insert or delete on public.post_likes
  for each row execute function public.handle_post_like_change();

create or replace function public.handle_post_comment_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'INSERT') then
    update public.posts
      set comments_count = comments_count + 1,
          influence      = influence + 2   -- comments weigh more than likes
      where id = new.post_id;
  elsif (tg_op = 'DELETE') then
    update public.posts
      set comments_count = greatest(0, comments_count - 1),
          influence      = greatest(0, influence - 2)
      where id = old.post_id;
  end if;
  return null;
end;
$$;

drop trigger if exists on_post_comment_change on public.comments;
create trigger on_post_comment_change
  after insert or delete on public.comments
  for each row execute function public.handle_post_comment_change();

-- 6. Posting eligibility RPC ─────────────────────────────────────
-- Gold rank (xp threshold) + 150 completed games + a real profile picture.
-- Kept server-side so the client can't fake eligibility, and so the XP
-- threshold for "Gold" only has to be defined in one place.
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
  v_gold_xp constant int := 42000; -- keep in sync with 'gold_1'.xpRequired in src/features/profile/ranks.ts
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
