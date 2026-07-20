-- supabase/migrations/0052_blog_authors.sql
-- ════════════════════════════════════════════════════════════════════════
-- Migration 0052 — Founder/Dev diary voice
--
-- Adds two flags to profiles so blog posts can show a real named author
-- instead of a generic "Chillverse Team":
--   • can_author  — eligible to appear in the admin post editor's author
--                    picker. blog_posts.author_id already exists (0051);
--                    this just gates *which* profiles are choosable.
--   • is_founder  — renders a "Founder" badge next to the byline. Separate
--                    from can_author since not every author is the founder.
--
-- Both are set/changed by admins only — never by the profile owner — via
-- the same protect-column trigger pattern as 0025's original_username
-- freeze, since profiles' existing "users can update their own row" RLS
-- policy would otherwise let anyone self-grant authorship.
-- ════════════════════════════════════════════════════════════════════════

alter table public.profiles
  add column if not exists can_author boolean not null default false,
  add column if not exists is_founder boolean not null default false;

create or replace function public.protect_author_flags()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'UPDATE' and not public.is_admin_role(auth.uid()) then
    new.can_author := old.can_author;
    new.is_founder := old.is_founder;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_author_flags_trg on public.profiles;
create trigger protect_author_flags_trg
  before update on public.profiles
  for each row execute procedure public.protect_author_flags();

-- Best-effort: flag the founder account referenced in the seeded
-- "A founder's note on what's next" post, if it already exists. No-op
-- (and harmless) if that username isn't present yet.
update public.profiles
  set can_author = true, is_founder = true
  where lower(username) = 'victor_vk';

notify pgrst, 'reload schema';
