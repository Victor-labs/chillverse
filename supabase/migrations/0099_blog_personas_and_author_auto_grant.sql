-- supabase/migrations/0099_blog_personas_and_author_auto_grant.sql
-- ════════════════════════════════════════════════════════════════════════
-- Migration 0099 — Blog authors: auto-grant real staff + house personas
--
-- Problem this fixes:
--   1. The author picker in BlogEditorModal only lists profiles with
--      can_author = true, which was only ever set for one founder account.
--      Every other staff/mod/admin writing a post doesn't show up in their
--      own author dropdown.
--   2. "Willam" and "Engineering Crew" are house bylines (bot/brand voice,
--      not a real staffer) and should NOT require a real Supabase Auth
--      signup. profiles.id is FK'd to auth.users.id, so anything living in
--      profiles needs a real account behind it — personas therefore get
--      their own table with no auth dependency at all.
--
-- Depends on 0024/0027 (user_moderation, is_staff/is_admin_role), 0051
-- (blog_posts). Safe to re-run.
-- ════════════════════════════════════════════════════════════════════════

-- ── 1. blog_personas — house/bot bylines, independent of auth.users ────
create table if not exists public.blog_personas (
  id           uuid primary key default gen_random_uuid(),
  username     text not null unique,
  display_name text not null,
  avatar       text,
  bio          text,
  created_at   timestamptz not null default now()
);

alter table public.blog_personas enable row level security;

drop policy if exists "blog personas are publicly readable" on public.blog_personas;
create policy "blog personas are publicly readable" on public.blog_personas
  for select using (true);

drop policy if exists "admins can manage blog personas" on public.blog_personas;
create policy "admins can manage blog personas" on public.blog_personas
  for all using (public.is_admin_role(auth.uid())) with check (public.is_admin_role(auth.uid()));

-- ── 2. blog_posts.persona_author_id — alternate byline source ──────────
alter table public.blog_posts
  add column if not exists persona_author_id uuid references public.blog_personas(id) on delete set null;

create index if not exists blog_posts_persona_author_idx on public.blog_posts (persona_author_id) where persona_author_id is not null;

-- Only one byline source at a time
alter table public.blog_posts drop constraint if exists blog_posts_single_author_source;
alter table public.blog_posts
  add constraint blog_posts_single_author_source
  check (author_id is null or persona_author_id is null);

-- ── 3. Auto-grant can_author on promotion to staff/moderator/admin ─────
create or replace function public.grant_can_author_on_staff_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role in ('staff', 'moderator', 'admin') then
    update public.profiles set can_author = true
      where id = new.user_id and can_author = false;
  end if;
  return new;
end;
$$;

drop trigger if exists grant_can_author_on_staff_role_trg on public.user_moderation;
create trigger grant_can_author_on_staff_role_trg
  after insert or update of role on public.user_moderation
  for each row execute procedure public.grant_can_author_on_staff_role();

-- ── 4. Backfill everyone already at staff tier ──────────────────────────
update public.profiles
  set can_author = true
  where can_author = false
    and id in (
      select user_id from public.user_moderation
      where role in ('staff', 'moderator', 'admin')
    );

-- ── 5. Seed the two house personas (no auth signup needed) ─────────────
insert into public.blog_personas (username, display_name, avatar, bio)
values
  ('willam', 'Willam',
   'https://gnobzfxtxrtcxfhhfjni.supabase.co/storage/v1/object/public/profile-pics/By%20owning%20avatar/Willam2.jpg',
   'Your personal guide around Chillverse.'),
  ('engineering_crew', 'Engineering Crew',
   'https://gnobzfxtxrtcxfhhfjni.supabase.co/storage/v1/object/public/profile-pics/By%20owning%20avatar/Engineering.jpg',
   'We make Chillverse.')
on conflict (username) do nothing;

notify pgrst, 'reload schema';
