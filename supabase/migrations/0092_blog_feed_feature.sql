-- supabase/migrations/0092_blog_feed_feature.sql
-- ════════════════════════════════════════════════════════════════════════
-- Migration 0092 — Blog → Feed auto-share
--
-- Every 5 days, a random *published* blog article gets dropped into the
-- main social Feed as a system post: hero image + title + excerpt
-- snippet, tapping it opens the full article at /blog/:slug.
--
-- Resilience requirement: this must keep working even if the article's
-- category is deleted, the article itself is later deleted, or the whole
-- blog_posts table is empty/reseeded. We achieve that by NOT referencing
-- blog_posts.id via a foreign key at all — the article's title, excerpt,
-- and hero image are snapshotted (copied) onto the posts row at the
-- moment it's created. The feed post is a self-contained record; deleting
-- the source article afterwards cannot cascade-delete it, break a join,
-- or throw an FK violation. (Tapping through to a since-deleted article's
-- /blog/:slug page will simply 404 there, same as sharing any dead link —
-- it never breaks the feed itself.)
--
-- Adds:
--   1. posts.blog_slug / blog_title / blog_excerpt / blog_hero_image_url
--      — plain snapshot columns, no FK.
--   2. 'blog_feature' added to posts_post_kind_check.
--   3. public.post_random_blog_article() — SECURITY DEFINER, idempotent:
--      skips silently if a blog_feature post already went out in the last
--      5 days, or if there are no published articles to pick from.
--   4. Best-effort pg_cron schedule (same defensive pattern as migrations
--      0075 / 0079 / 0082 — schedules if pg_cron is enabled, otherwise
--      raises a NOTICE with the manual command).
--
-- Depends on migration 0007 (public.posts) and 0051 (public.blog_posts).
-- Safe to re-run.
-- ════════════════════════════════════════════════════════════════════════

-- ── 1. Snapshot columns on posts ────────────────────────────────────────
alter table public.posts add column if not exists blog_slug            text;
alter table public.posts add column if not exists blog_title           text;
alter table public.posts add column if not exists blog_excerpt         text;
alter table public.posts add column if not exists blog_hero_image_url  text;

-- ── 2. Allow the new post_kind ──────────────────────────────────────────
alter table public.posts drop constraint if exists posts_post_kind_check;
alter table public.posts add constraint posts_post_kind_check
  check (post_kind in ('general', 'announcement', 'feature_update', 'blog_feature'));

-- Fast lookup for "when did we last auto-share a blog post" in the RPC below.
create index if not exists posts_blog_feature_idx
  on public.posts (created_at desc)
  where post_kind = 'blog_feature';

-- ── 3. post_random_blog_article() ───────────────────────────────────────
-- Idempotent / safe to call as often as the scheduler likes — it enforces
-- the 5-day gap itself, so a missed or doubled-up cron tick can't spam
-- the feed. Picks uniformly at random among currently published articles;
-- an article being unpublished/deleted later has no effect on posts
-- already created (see header note — no FK, values are copied in).
create or replace function public.post_random_blog_article()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_last_shared_at timestamptz;
  v_article record;
begin
  select max(created_at) into v_last_shared_at
    from public.posts
    where post_kind = 'blog_feature';

  if v_last_shared_at is not null and v_last_shared_at > (now() - interval '5 days') then
    return; -- too soon since the last auto-share
  end if;

  select bp.slug, bp.title, bp.excerpt, bp.content, bp.hero_image_url
    into v_article
    from public.blog_posts bp
    where bp.is_published = true
    order by random()
    limit 1;

  if not found then
    return; -- no published articles yet (e.g. fresh/empty database) — skip silently
  end if;

  insert into public.posts (
    author_id, author_type, body, tags, commentable, post_kind,
    blog_slug, blog_title, blog_excerpt, blog_hero_image_url
  ) values (
    null, 'system', 'Fresh from the Chillverse blog 👀', '[]'::jsonb, false, 'blog_feature',
    v_article.slug,
    v_article.title,
    coalesce(v_article.excerpt, left(v_article.content, 200) || '…'),
    v_article.hero_image_url
  );
end;
$$;

-- Intentionally not granted to anon/authenticated — same pattern as
-- pick_lucky_user() in migration 0075. This should only ever run via the
-- scheduler (pg_cron executes as the function/table owner), never from a
-- logged-in client.
revoke execute on function public.post_random_blog_article() from public, anon, authenticated;

-- ── 4. Scheduling (best-effort — see header note) ───────────────────────
-- Runs once a day; the 5-day gate inside the function itself decides
-- whether anything actually happens on a given run.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'blog-feed-random-share-daily',
      '0 12 * * *',
      $cron$select public.post_random_blog_article();$cron$
    );
  else
    raise notice 'pg_cron extension not found — post_random_blog_article() was NOT scheduled. Enable pg_cron in Database > Extensions, then re-run: select cron.schedule(''blog-feed-random-share-daily'', ''0 12 * * *'', ''select public.post_random_blog_article();''); or call it from an external daily scheduler instead.';
  end if;
end;
$$;

notify pgrst, 'reload schema';
