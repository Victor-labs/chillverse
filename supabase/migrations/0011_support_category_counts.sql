-- supabase/migrations/0011_support_category_counts.sql
-- ════════════════════════════════════════════════════════════════════════
-- Migration 0011 — Support center: category article counts
--
-- Adds public.list_support_categories_with_counts(), a security-definer RPC
-- that returns every support category alongside the number of *published*
-- articles it contains. Used by the Help Center home page to render
-- "X articles" under each topic without an extra round trip per category.
--
-- Depends on migration 0010 (support_categories, support_articles).
-- Safe to re-run.
-- ════════════════════════════════════════════════════════════════════════

create or replace function public.list_support_categories_with_counts()
returns table (
  id            uuid,
  slug          text,
  name          text,
  description   text,
  icon          text,
  sort_order    int,
  created_at    timestamptz,
  article_count bigint
)
language sql
security definer
set search_path = public
stable
as $$
  select
    c.id, c.slug, c.name, c.description, c.icon, c.sort_order, c.created_at,
    count(a.id) filter (where a.is_published) as article_count
  from public.support_categories c
  left join public.support_articles a on a.category_id = c.id
  group by c.id
  order by c.sort_order;
$$;

grant execute on function public.list_support_categories_with_counts() to anon, authenticated;
