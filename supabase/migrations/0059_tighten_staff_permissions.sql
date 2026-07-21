-- supabase/migrations/0059_tighten_staff_permissions.sql
-- ════════════════════════════════════════════════════════════════════════
-- Migration 0059 — Tighten 'staff' to support-work-only
--
-- Until now is_staff() (0027) treated staff/moderator/admin identically for
-- every mod_* action — a plain 'staff' account could ban, suspend, and
-- hard-delete content exactly like a moderator. This migration narrows
-- that: 'staff' keeps full read access to the panel (alerts, reports,
-- users, the support ticket queue from 0058) and can still do everything
-- that's genuinely support work — claim/reply to tickets, dismiss a
-- report or alert that's a clear false positive, view content — but any
-- action with real teeth now requires 'moderator'/'admin':
--
--   • mod_ban_user, mod_delete_message, mod_delete_post, mod_delete_comment
--     now gate on is_mod_or_admin() (0041) instead of is_staff() (0027).
--   • mod_review_report can still be called by staff for 'reviewed' /
--     'dismissed', but setting a report to 'actioned' (which only ever
--     follows a successful delete) now also requires is_mod_or_admin() —
--     a server-side backstop, since the client already won't reach that
--     path once delete itself is mod/admin-gated above.
--   • mod_resolve_alert (0031) is unchanged for a non-escalated alert
--     (dismissing a false-positive strike alert is still staff-level
--     triage), but once an alert has been escalated (new below), only a
--     moderator/admin can resolve it — mirrors 0058's is_staff_only()
--     gate on an escalated support ticket's status.
--
-- New escalation paths, so staff has something to do with a report/alert
-- instead of banning/deleting themselves:
--
--   • staff_alerts gains escalated/escalation_note/escalated_by/escalated_at
--     (same shape as support_tickets' escalation columns from 0058) and a
--     new mod_escalate_alert(alert_id, note) RPC, staff-callable.
--   • content_reports gains the same four columns and a new
--     mod_escalate_report(report_id, note) RPC, staff-callable.
--
-- Depends on 0024 (is_staff, mod_ban_user, mod_delete_*), 0027 (staff
-- role), 0031 (staff_alerts, mod_resolve_alert), 0041 (is_mod_or_admin),
-- 0058 (is_staff_only, moderation_log whitelist widening pattern). Safe
-- to re-run.
-- ════════════════════════════════════════════════════════════════════════

-- ── 1. Ban/suspend now requires moderator or admin ──────────────────────
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
  if v_caller is null or not public.is_mod_or_admin(v_caller) then
    raise exception 'CV_MOD_FORBIDDEN: moderator or admin role required';
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
  if coalesce(v_target_role, 'user') in ('staff', 'moderator', 'admin') and not public.is_admin_role(v_caller) then
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

-- ── 2. Content deletion now requires moderator or admin ─────────────────
create or replace function public.mod_delete_message(p_message_id uuid, p_reason text default null)
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

  update public.messages set deleted = true where id = p_message_id;
  if not found then
    raise exception 'CV_MOD_NOT_FOUND: message not found';
  end if;

  insert into public.moderation_log (moderator_id, action, target_type, target_id, reason)
    values (v_caller, 'delete_message', 'message', p_message_id, p_reason);
end;
$$;

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
  if v_caller is null or not public.is_mod_or_admin(v_caller) then
    raise exception 'CV_MOD_FORBIDDEN: moderator or admin role required';
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
  if v_caller is null or not public.is_mod_or_admin(v_caller) then
    raise exception 'CV_MOD_FORBIDDEN: moderator or admin role required';
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

-- ── 3. Reviewing a report to 'actioned' also requires moderator/admin ───
-- ('reviewed'/'dismissed' stay staff-level triage — the read/flag part of
-- the Reports tab; 'actioned' only ever follows a delete, which is
-- mod/admin-gated above, so this is a server-side backstop for that path.)
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

  if p_status = 'actioned' and not public.is_mod_or_admin(v_caller) then
    raise exception 'CV_MOD_INSUFFICIENT: only a moderator can action a report';
  end if;

  update public.content_reports set status = p_status where id = p_report_id;
  if not found then
    raise exception 'CV_MOD_NOT_FOUND: report not found';
  end if;

  insert into public.moderation_log (moderator_id, action, target_type, target_id, metadata)
    values (v_caller, 'review_report', 'report', p_report_id, jsonb_build_object('status', p_status));
end;
$$;

-- ── 4. staff_alerts escalation ───────────────────────────────────────────
alter table public.staff_alerts
  add column if not exists escalated      boolean not null default false,
  add column if not exists escalation_note text,
  add column if not exists escalated_by   uuid references public.profiles(id) on delete set null,
  add column if not exists escalated_at   timestamptz;

-- Resolving (dismissing) a strike alert stays staff-level UNLESS it's
-- already been escalated — once staff hands it to a moderator, only a
-- moderator/admin can close it out (same shape as 0058's
-- staff_set_ticket_status gate on an escalated ticket).
create or replace function public.mod_resolve_alert(p_alert_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_escalated boolean;
begin
  if v_caller is null or not public.is_staff(v_caller) then
    raise exception 'CV_MOD_FORBIDDEN: staff only';
  end if;

  select escalated into v_escalated from public.staff_alerts where id = p_alert_id;
  if v_escalated is null then
    raise exception 'CV_MOD_NOT_FOUND: alert not found';
  end if;

  if v_escalated and public.is_staff_only(v_caller) then
    raise exception 'CV_MOD_INSUFFICIENT: this alert is escalated — only a moderator can resolve it';
  end if;

  update public.staff_alerts
    set resolved = true, resolved_by = v_caller, resolved_at = now()
    where id = p_alert_id;

  insert into public.moderation_log (moderator_id, action, target_type, target_id)
    values (v_caller, 'resolve_alert', 'user', (select user_id from public.staff_alerts where id = p_alert_id));
end;
$$;

-- Staff-callable: hand a strike alert to a moderator instead of banning it
-- themselves. Requires a note so the moderator picking it up has context.
create or replace function public.mod_escalate_alert(p_alert_id uuid, p_note text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_user_id uuid;
begin
  if v_caller is null or not public.is_staff(v_caller) then
    raise exception 'CV_MOD_FORBIDDEN: staff only';
  end if;

  if p_note is null or char_length(trim(p_note)) = 0 then
    raise exception 'CV_MOD_REASON_REQUIRED: an escalation note is required';
  end if;

  select user_id into v_user_id from public.staff_alerts where id = p_alert_id;
  if v_user_id is null then
    raise exception 'CV_MOD_NOT_FOUND: alert not found';
  end if;

  update public.staff_alerts
    set escalated = true, escalation_note = trim(p_note), escalated_by = v_caller, escalated_at = now()
    where id = p_alert_id;

  insert into public.moderation_log (moderator_id, action, target_type, target_id, reason)
    values (v_caller, 'escalate_alert', 'user', v_user_id, trim(p_note));
end;
$$;

-- ── 5. content_reports escalation ────────────────────────────────────────
alter table public.content_reports
  add column if not exists escalated_to_mod boolean not null default false,
  add column if not exists escalation_note  text,
  add column if not exists escalated_by     uuid references public.profiles(id) on delete set null,
  add column if not exists escalated_at     timestamptz;

-- Staff-callable: flag a report up to a moderator instead of deleting/
-- banning themselves. Requires a note, same reasoning as the alert path.
create or replace function public.mod_escalate_report(p_report_id uuid, p_note text)
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

  if p_note is null or char_length(trim(p_note)) = 0 then
    raise exception 'CV_MOD_REASON_REQUIRED: an escalation note is required';
  end if;

  if not exists (select 1 from public.content_reports where id = p_report_id) then
    raise exception 'CV_MOD_NOT_FOUND: report not found';
  end if;

  update public.content_reports
    set escalated_to_mod = true, escalation_note = trim(p_note), escalated_by = v_caller, escalated_at = now(),
        status = case when status = 'open' then 'reviewed' else status end
    where id = p_report_id;

  insert into public.moderation_log (moderator_id, action, target_type, target_id, reason)
    values (v_caller, 'escalate_report', 'report', p_report_id, trim(p_note));
end;
$$;

-- ── 6. Widen moderation_log's action whitelist for the two new actions ──
alter table public.moderation_log drop constraint if exists moderation_log_action_check;
alter table public.moderation_log add constraint moderation_log_action_check
  check (action = ANY (ARRAY[
    'ban', 'suspend', 'unban', 'set_role', 'delete_message', 'delete_post', 'delete_comment',
    'review_report', 'auto_hide', 'unhide', 'auto_violation', 'resolve_alert', 'set_verified',
    'set_badge_availability',
    'set_feature_flag', 'set_maintenance_mode', 'broadcast_notification', 'export_users', 'export_transactions',
    'ticket_claim', 'ticket_unclaim', 'ticket_reply', 'ticket_note', 'ticket_set_status',
    'ticket_escalate', 'ticket_deescalate', 'escalate_alert', 'escalate_report'
  ]::text[]));

-- ── 7. Lock down EXECUTE the same way every RPC in this project is ──────
revoke execute on function public.mod_escalate_alert(uuid, text) from public;
revoke execute on function public.mod_escalate_report(uuid, text) from public;

grant execute on function public.mod_escalate_alert(uuid, text) to authenticated;
grant execute on function public.mod_escalate_report(uuid, text) to authenticated;

notify pgrst, 'reload schema';
