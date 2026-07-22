-- supabase/migrations/0067_blog_staff_cms.sql
-- ════════════════════════════════════════════════════════════════════════
-- Migration 0067 — Blog CMS access for staff, + hero image uploads
--
-- Two changes:
--   1. blog_posts write policies widen from admin-only (is_admin_role) to
--      staff-or-above (is_staff — covers 'staff', 'moderator', 'admin', per
--      migration 0027), so any staff account can write/manage posts from
--      /blog/admin, not just full admins. Read-all (drafts included) widens
--      the same way, so staff can see unpublished drafts in the CMS list.
--   2. A public "blog-images" storage bucket for hero images uploaded from
--      the CMS, mirroring the "feed-images" bucket pattern from migration
--      0028 (public bucket + staff-only write, since blog posts are public
--      content once published).
--
-- Depends on migration 0024 (is_staff) and 0051 (blog_posts).
-- Safe to re-run.
-- ════════════════════════════════════════════════════════════════════════

-- ── 1. Widen blog_posts RLS from admin-only to staff-or-above ──────────
drop policy if exists "admins can read all blog posts" on public.blog_posts;
create policy "staff can read all blog posts" on public.blog_posts
  for select using (public.is_staff(auth.uid()));

drop policy if exists "admins can create blog posts" on public.blog_posts;
create policy "staff can create blog posts" on public.blog_posts
  for insert with check (public.is_staff(auth.uid()));

drop policy if exists "admins can update blog posts" on public.blog_posts;
create policy "staff can update blog posts" on public.blog_posts
  for update using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));

drop policy if exists "admins can delete blog posts" on public.blog_posts;
create policy "staff can delete blog posts" on public.blog_posts
  for delete using (public.is_staff(auth.uid()));

-- ── 2. Storage: public "blog-images" bucket ─────────────────────────────
insert into storage.buckets (id, name, public)
values ('blog-images', 'blog-images', true)
on conflict (id) do nothing;

-- Object path convention enforced by the client: `<author_id>/<uuid>.<ext>`.
drop policy if exists "blog images are publicly readable" on storage.objects;
create policy "blog images are publicly readable" on storage.objects
  for select using (bucket_id = 'blog-images');

drop policy if exists "staff can upload blog images" on storage.objects;
create policy "staff can upload blog images" on storage.objects
  for insert with check (
    bucket_id = 'blog-images'
    and public.is_staff(auth.uid())
  );

drop policy if exists "staff can delete blog images" on storage.objects;
create policy "staff can delete blog images" on storage.objects
  for delete using (
    bucket_id = 'blog-images'
    and public.is_staff(auth.uid())
  );

notify pgrst, 'reload schema';
