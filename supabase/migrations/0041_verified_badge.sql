-- supabase/migrations/0041_verified_badge.sql
-- ════════════════════════════════════════════════════════════════════════
-- Migration 0036 — Verified badge (block 1 of the chat features spec)
--
-- Adds an `is_verified` flag, independent of the staff role ladder
-- (user/staff/moderator/admin) — a Verified user is still `role = 'user'`
-- in user_moderation; Verified only unlocks poll creation (migration
-- 0038). Grantable by Moderator OR Admin (not plain Staff).
--
-- Lives on user_moderation, not profiles, for the same reason role/ban
-- fields do (see 0024's design note): profiles' "update own profile" RLS
-- policy has no column-level restriction, so a flag on profiles could be
-- set by the user themselves via a plain client .update() call.
-- user_moderation has no authenticated insert/update policy at all — every
-- write happens inside a SECURITY DEFINER RPC — so this closes that off
-- for free.
--
-- moderation_log_action_check currently (as of 0035) allows: 'ban',
-- 'suspend', 'unban', 'set_role', 'delete_message', 'delete_post',
-- 'delete_comment', 'review_report', 'auto_hide', 'unhide',
-- 'auto_violation', 'resolve_alert'. This adds 'set_verified' to that
-- exact list rather than replacing it.
-- ════════════════════════════════════════════════════════════════════════

-- 1. New column.
alter table public.user_moderation
  add column if not exists is_verified boolean not null default false;

-- 2. Moderator-or-admin check — separate from is_staff() (which also
--    includes plain 'staff') and is_admin_role() (admin-only), since
--    granting Verified is meant to sit between those two.
create or replace function public.is_mod_or_admin(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role in ('moderator', 'admin') from public.user_moderation where user_id = p_user_id),
    false
  );
$$;

-- 3. Widen moderation_log's action check to allow logging this action.
alter table public.moderation_log drop constraint if exists moderation_log_action_check;
alter table public.moderation_log
  add constraint moderation_log_action_check check (action in (
    'ban', 'suspend', 'unban', 'set_role',
    'delete_message', 'delete_post', 'delete_comment', 'review_report',
    'auto_hide', 'unhide', 'auto_violation', 'resolve_alert',
    'set_verified'
  ));

-- 4. Grant/revoke Verified.
create or replace function public.mod_set_verified(p_target_id uuid, p_verified boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
begin
  if v_caller is null or not public.is_mod_or_admin(v_caller) then
    raise exception 'CV_MOD_FORBIDDEN: moderator or admin role required';
  end if;

  if not exists (select 1 from public.profiles where id = p_target_id) then
    raise exception 'CV_MOD_NOT_FOUND: user not found';
  end if;

  insert into public.user_moderation (user_id, is_verified)
    values (p_target_id, p_verified)
    on conflict (user_id) do update set is_verified = excluded.is_verified, updated_at = now();

  insert into public.moderation_log (moderator_id, action, target_type, target_id, metadata)
    values (v_caller, 'set_verified', 'user', p_target_id, jsonb_build_object('is_verified', p_verified));
end;
$$;

revoke execute on function public.is_mod_or_admin(uuid) from public;
revoke execute on function public.mod_set_verified(uuid, boolean) from public;

grant execute on function public.is_mod_or_admin(uuid) to authenticated;
grant execute on function public.mod_set_verified(uuid, boolean) to authenticated;

notify pgrst, 'reload schema';
