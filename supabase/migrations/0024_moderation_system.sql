-- supabase/migrations/0024_moderation_system.sql
-- ════════════════════════════════════════════════════════════════════════
-- Migration 0024 — In-app moderator role system
--
-- Adds a real moderator/admin role, replacing the previous model where
-- content_reports were reviewed manually via the Supabase dashboard with
-- the service-role key (see 0017's header comment: "no separate admin RLS
-- role exists in this project"). This migration adds one.
--
-- DESIGN NOTE — why role/ban fields live in a NEW table (user_moderation)
-- instead of new columns on profiles: the existing "Users can update their
-- own profile" RLS policy on profiles is `using (auth.uid() = id)` with no
-- column-level restriction. Postgres RLS policies do not scope by column,
-- so adding role/is_banned columns directly to profiles would let any
-- signed-in user grant themselves admin or clear their own ban with a
-- plain client-side .update() call — RLS would not stop it. Keeping this
-- in a separate table with NO authenticated insert/update/delete policy
-- (writes only happen inside SECURITY DEFINER RPCs below) closes that off
-- without touching the existing profiles policies/grants at all.
-- ════════════════════════════════════════════════════════════════════════

-- ── 1. user_moderation ───────────────────────────────────────────────────
create table if not exists public.user_moderation (
  user_id      uuid primary key references public.profiles(id) on delete cascade,
  role         text not null default 'user' check (role in ('user', 'moderator', 'admin')),
  is_banned    boolean not null default false,
  banned_until timestamptz,              -- null + is_banned = permanent ban
  ban_reason   text,
  banned_by    uuid references public.profiles(id) on delete set null,
  banned_at    timestamptz,
  updated_at   timestamptz not null default now()
);

create index if not exists user_moderation_role_idx on public.user_moderation (role) where role <> 'user';
create index if not exists user_moderation_banned_idx on public.user_moderation (is_banned) where is_banned = true;

alter table public.user_moderation enable row level security;

-- Publicly readable: the client needs this to know "am I a moderator"
-- (show the panel link) and "is this user currently banned" (block login).
-- It reveals no more than a role label + ban status, same sensitivity as
-- the rest of profiles.
drop policy if exists "user_moderation is publicly readable" on public.user_moderation;
create policy "user_moderation is publicly readable" on public.user_moderation
  for select using (true);

-- Deliberately NO insert/update/delete policy for authenticated — every
-- write happens inside a SECURITY DEFINER function below (which, like
-- every other SECURITY DEFINER function in this project — see
-- handle_post_like_change, award_xp, etc. — runs with the defining role's
-- privileges and so isn't blocked by RLS), so every write is validated
-- against auth.uid() server-side and logged to moderation_log.

-- ── 2. Helper functions ──────────────────────────────────────────────────
create or replace function public.is_staff(p_user_id uuid)
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

create or replace function public.is_admin_role(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role = 'admin' from public.user_moderation where user_id = p_user_id),
    false
  );
$$;

create or replace function public.is_currently_banned(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select is_banned and (banned_until is null or banned_until > now())
       from public.user_moderation where user_id = p_user_id),
    false
  );
$$;

-- ── 3. moderation_log ────────────────────────────────────────────────────
create table if not exists public.moderation_log (
  id           uuid primary key default gen_random_uuid(),
  moderator_id uuid references public.profiles(id) on delete set null,
  action       text not null check (action in (
                 'ban', 'suspend', 'unban', 'set_role',
                 'delete_message', 'delete_post', 'delete_comment', 'review_report'
               )),
  target_type  text not null check (target_type in ('user', 'message', 'post', 'comment', 'report')),
  target_id    uuid,
  reason       text,
  metadata     jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);

create index if not exists moderation_log_target_idx on public.moderation_log (target_type, target_id);
create index if not exists moderation_log_moderator_idx on public.moderation_log (moderator_id, created_at desc);
create index if not exists moderation_log_created_idx on public.moderation_log (created_at desc);

alter table public.moderation_log enable row level security;

drop policy if exists "staff can view the moderation log" on public.moderation_log;
create policy "staff can view the moderation log" on public.moderation_log
  for select using (public.is_staff(auth.uid()));

-- No direct insert/update/delete policy — only written by the RPCs below.

-- ── 4. Moderator/admin action RPCs ───────────────────────────────────────

-- Ban (permanent, p_duration_hours null) or suspend (temporary) a user.
-- Moderators can action regular users; only admins can action other staff.
create or replace function public.mod_ban_user(p_target_id uuid, p_reason text, p_duration_hours integer default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_target_role text;
begin
  if v_caller is null or not public.is_staff(v_caller) then
    raise exception 'CV_MOD_FORBIDDEN: staff only';
  end if;

  if p_target_id = v_caller then
    raise exception 'CV_MOD_SELF: cannot ban yourself';
  end if;

  if not exists (select 1 from public.profiles where id = p_target_id) then
    raise exception 'CV_MOD_NOT_FOUND: user not found';
  end if;

  if p_reason is null or char_length(trim(p_reason)) = 0 then
    raise exception 'CV_MOD_REASON_REQUIRED: a reason is required';
  end if;

  select role into v_target_role from public.user_moderation where user_id = p_target_id;
  if coalesce(v_target_role, 'user') in ('moderator', 'admin') and not public.is_admin_role(v_caller) then
    raise exception 'CV_MOD_INSUFFICIENT: only admins can action staff members';
  end if;

  insert into public.user_moderation (user_id, is_banned, banned_until, ban_reason, banned_by, banned_at)
    values (
      p_target_id, true,
      case when p_duration_hours is null then null else now() + (p_duration_hours || ' hours')::interval end,
      trim(p_reason), v_caller, now()
    )
    on conflict (user_id) do update
      set is_banned    = true,
          banned_until = excluded.banned_until,
          ban_reason   = excluded.ban_reason,
          banned_by    = excluded.banned_by,
          banned_at    = excluded.banned_at,
          updated_at   = now();

  insert into public.moderation_log (moderator_id, action, target_type, target_id, reason, metadata)
    values (
      v_caller, case when p_duration_hours is null then 'ban' else 'suspend' end, 'user', p_target_id, trim(p_reason),
      jsonb_build_object('duration_hours', p_duration_hours)
    );
end;
$$;

create or replace function public.mod_unban_user(p_target_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
begin
  if v_caller is null or not public.is_staff(v_caller) then
    raise exception 'CV_MOD_FORBIDDEN: staff only';
  end if;

  update public.user_moderation
    set is_banned = false, banned_until = null, ban_reason = null, updated_at = now()
    where user_id = p_target_id;

  insert into public.moderation_log (moderator_id, action, target_type, target_id)
    values (v_caller, 'unban', 'user', p_target_id);
end;
$$;

-- Promote/demote a user's staff role. Admin-only.
create or replace function public.mod_set_role(p_target_id uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
begin
  if v_caller is null or not public.is_admin_role(v_caller) then
    raise exception 'CV_MOD_FORBIDDEN: admin only';
  end if;

  if p_role not in ('user', 'moderator', 'admin') then
    raise exception 'CV_MOD_BAD_ROLE: invalid role';
  end if;

  if p_target_id = v_caller and p_role <> 'admin' then
    raise exception 'CV_MOD_SELF_DEMOTE: cannot remove your own admin role here — have another admin do it';
  end if;

  if not exists (select 1 from public.profiles where id = p_target_id) then
    raise exception 'CV_MOD_NOT_FOUND: user not found';
  end if;

  insert into public.user_moderation (user_id, role)
    values (p_target_id, p_role)
    on conflict (user_id) do update set role = excluded.role, updated_at = now();

  insert into public.moderation_log (moderator_id, action, target_type, target_id, metadata)
    values (v_caller, 'set_role', 'user', p_target_id, jsonb_build_object('new_role', p_role));
end;
$$;

-- Soft-delete a chat message (same mechanism senders already use on
-- themselves via messages.deleted — see 0008).
create or replace function public.mod_delete_message(p_message_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
begin
  if v_caller is null or not public.is_staff(v_caller) then
    raise exception 'CV_MOD_FORBIDDEN: staff only';
  end if;

  update public.messages set deleted = true where id = p_message_id;
  if not found then
    raise exception 'CV_MOD_NOT_FOUND: message not found';
  end if;

  insert into public.moderation_log (moderator_id, action, target_type, target_id, reason)
    values (v_caller, 'delete_message', 'message', p_message_id, p_reason);
end;
$$;

-- Hard-delete a post (cascades to its comments/likes — see 0007). Snapshots
-- the body/author into the log since the row itself won't exist afterward.
create or replace function public.mod_delete_post(p_post_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_snapshot jsonb;
begin
  if v_caller is null or not public.is_staff(v_caller) then
    raise exception 'CV_MOD_FORBIDDEN: staff only';
  end if;

  select jsonb_build_object('author_id', author_id, 'body', body) into v_snapshot
    from public.posts where id = p_post_id;

  if v_snapshot is null then
    raise exception 'CV_MOD_NOT_FOUND: post not found';
  end if;

  delete from public.posts where id = p_post_id;

  insert into public.moderation_log (moderator_id, action, target_type, target_id, reason, metadata)
    values (v_caller, 'delete_post', 'post', p_post_id, p_reason, v_snapshot);
end;
$$;

-- Hard-delete a comment (existing handle_post_comment_change trigger from
-- 0007 keeps posts.comments_count in sync automatically on this delete).
create or replace function public.mod_delete_comment(p_comment_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_snapshot jsonb;
begin
  if v_caller is null or not public.is_staff(v_caller) then
    raise exception 'CV_MOD_FORBIDDEN: staff only';
  end if;

  select jsonb_build_object('post_id', post_id, 'author_id', author_id, 'body', body) into v_snapshot
    from public.comments where id = p_comment_id;

  if v_snapshot is null then
    raise exception 'CV_MOD_NOT_FOUND: comment not found';
  end if;

  delete from public.comments where id = p_comment_id;

  insert into public.moderation_log (moderator_id, action, target_type, target_id, reason, metadata)
    values (v_caller, 'delete_comment', 'comment', p_comment_id, p_reason, v_snapshot);
end;
$$;

-- Mark a content_reports row reviewed/actioned/dismissed.
create or replace function public.mod_review_report(p_report_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
begin
  if v_caller is null or not public.is_staff(v_caller) then
    raise exception 'CV_MOD_FORBIDDEN: staff only';
  end if;

  if p_status not in ('reviewed', 'actioned', 'dismissed') then
    raise exception 'CV_MOD_BAD_STATUS: invalid status';
  end if;

  update public.content_reports set status = p_status where id = p_report_id;
  if not found then
    raise exception 'CV_MOD_NOT_FOUND: report not found';
  end if;

  insert into public.moderation_log (moderator_id, action, target_type, target_id, metadata)
    values (v_caller, 'review_report', 'report', p_report_id, jsonb_build_object('status', p_status));
end;
$$;

-- Staff-only: fetch the underlying content a report points at (may be a
-- private DM message) so a moderator can review it without needing raw
-- service-role/dashboard SQL access. Every call is logged automatically
-- via the caller then invoking mod_review_report / mod_delete_* afterward;
-- the read itself isn't separately logged (mirrors: reading a support
-- ticket isn't logged either, only actions on it are).
create or replace function public.mod_get_report_context(p_report_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_report public.content_reports%rowtype;
  v_result jsonb;
begin
  if v_caller is null or not public.is_staff(v_caller) then
    raise exception 'CV_MOD_FORBIDDEN: staff only';
  end if;

  select * into v_report from public.content_reports where id = p_report_id;
  if not found then
    raise exception 'CV_MOD_NOT_FOUND: report not found';
  end if;

  if v_report.target_type = 'user' then
    select jsonb_build_object(
      'username', username, 'display_name', display_name
    ) into v_result from public.profiles where id = v_report.target_id;
  elsif v_report.target_type = 'message' then
    select jsonb_build_object(
      'content', m.content, 'deleted', m.deleted, 'sender_id', m.sender_id,
      'sender_username', p.username, 'created_at', m.created_at
    ) into v_result
    from public.messages m left join public.profiles p on p.id = m.sender_id
    where m.id = v_report.target_id;
  elsif v_report.target_type = 'post' then
    select jsonb_build_object(
      'body', body, 'author_id', author_id, 'created_at', created_at
    ) into v_result from public.posts where id = v_report.target_id;
  elsif v_report.target_type = 'comment' then
    select jsonb_build_object(
      'body', body, 'author_id', author_id, 'post_id', post_id, 'created_at', created_at
    ) into v_result from public.comments where id = v_report.target_id;
  end if;

  return coalesce(v_result, jsonb_build_object('note', 'target no longer exists'));
end;
$$;

-- ── 5. content_reports — let staff see every report, not just their own ──
drop policy if exists "staff can view all reports" on public.content_reports;
create policy "staff can view all reports" on public.content_reports
  for select using (public.is_staff(auth.uid()));

-- ── 6. Block banned users from posting, server-side ──────────────────────
-- Same idempotent drop+recreate as the rest of this project's migrations;
-- each policy below is identical to its original definition plus one
-- extra `and not public.is_currently_banned(auth.uid())` clause.

drop policy if exists "members can send messages" on public.messages;
create policy "members can send messages" on public.messages
  for insert with check (
    auth.uid() = sender_id
    and public.is_room_member(room_id)
    and not public.is_currently_banned(auth.uid())
    and not exists (
      select 1
      from public.room_members rm
      join public.chat_rooms cr on cr.id = rm.room_id
      join public.blocks b
        on (b.blocker_id = rm.user_id and b.blocked_id = auth.uid())
        or (b.blocker_id = auth.uid() and b.blocked_id = rm.user_id)
      where rm.room_id = messages.room_id
        and rm.user_id <> auth.uid()
        and cr.type = 'dm'
    )
  );

drop policy if exists "users can insert their own posts" on public.posts;
create policy "users can insert their own posts" on public.posts
  for insert with check (
    auth.uid() = author_id
    and author_type = 'user'
    and not public.is_currently_banned(auth.uid())
  );

drop policy if exists "users can comment on commentable posts" on public.comments;
create policy "users can comment on commentable posts" on public.comments
  for insert with check (
    auth.uid() = author_id
    and exists (select 1 from public.posts p where p.id = post_id and p.commentable = true)
    and not public.is_currently_banned(auth.uid())
  );

-- ── 7. Lock down EXECUTE the same way 0021/0022 did for every other RPC ──
revoke execute on function public.is_staff(uuid) from public;
revoke execute on function public.is_admin_role(uuid) from public;
revoke execute on function public.is_currently_banned(uuid) from public;
revoke execute on function public.mod_ban_user(uuid, text, integer) from public;
revoke execute on function public.mod_unban_user(uuid) from public;
revoke execute on function public.mod_set_role(uuid, text) from public;
revoke execute on function public.mod_delete_message(uuid, text) from public;
revoke execute on function public.mod_delete_post(uuid, text) from public;
revoke execute on function public.mod_delete_comment(uuid, text) from public;
revoke execute on function public.mod_review_report(uuid, text) from public;
revoke execute on function public.mod_get_report_context(uuid) from public;

grant execute on function public.is_staff(uuid) to authenticated;
grant execute on function public.is_admin_role(uuid) to authenticated;
grant execute on function public.is_currently_banned(uuid) to authenticated;
grant execute on function public.mod_ban_user(uuid, text, integer) to authenticated;
grant execute on function public.mod_unban_user(uuid) to authenticated;
grant execute on function public.mod_set_role(uuid, text) to authenticated;
grant execute on function public.mod_delete_message(uuid, text) to authenticated;
grant execute on function public.mod_delete_post(uuid, text) to authenticated;
grant execute on function public.mod_delete_comment(uuid, text) to authenticated;
grant execute on function public.mod_review_report(uuid, text) to authenticated;
grant execute on function public.mod_get_report_context(uuid) to authenticated;

notify pgrst, 'reload schema';
