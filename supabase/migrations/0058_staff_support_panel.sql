-- supabase/migrations/0058_staff_support_panel.sql
-- ════════════════════════════════════════════════════════════════════════
-- Migration 0058 — Staff support panel
--
-- Gives the 'staff' role its own real scope (until now is_staff() treated
-- staff/moderator/admin identically — see 0027's header comment) and turns
-- support_tickets from a write-only inbox (only the author could read
-- their own row, no staff visibility at all) into a working queue:
--
--   • support_tickets gains assignment (claim), resolution, and escalation
--     columns. Escalation is the "send it to a moderator" handoff staff
--     use when a ticket needs mod/admin-level action (a ban, a refund
--     decision, etc.) — the ticket stays in the same row/thread, it just
--     changes which tier can act on it next.
--   • support_ticket_replies — the staff↔user reply thread. Previously a
--     ticket was a single message with no way to respond to the user.
--   • support_ticket_notes — internal, staff-only notes on a ticket
--     (never exposed to the ticket's author), for handoff context.
--   • is_staff_only(uuid) — true for role = 'staff' specifically, used to
--     restrict staff-tier actions (no ban/role changes, no closing an
--     escalated ticket) without touching what moderator/admin can do.
--   • RPCs mirroring the mod_* pattern in 0024/0027: staff_claim_ticket,
--     staff_reply_ticket, staff_add_ticket_note, staff_set_ticket_status,
--     staff_escalate_ticket, mod_deescalate_ticket. All SECURITY DEFINER,
--     all logged to moderation_log.
--
-- Depends on 0010 (support_tickets), 0024/0027 (user_moderation,
-- is_staff, moderation_log). Safe to re-run.
-- ════════════════════════════════════════════════════════════════════════

-- ── 1. New columns on support_tickets ───────────────────────────────────
alter table public.support_tickets
  add column if not exists assigned_to        uuid references public.profiles(id) on delete set null,
  add column if not exists claimed_at         timestamptz,
  add column if not exists escalated_to_mod   boolean not null default false,
  add column if not exists escalation_note    text,
  add column if not exists escalated_by       uuid references public.profiles(id) on delete set null,
  add column if not exists escalated_at       timestamptz,
  add column if not exists resolved_by        uuid references public.profiles(id) on delete set null,
  add column if not exists closed_at          timestamptz;

create index if not exists support_tickets_assigned_idx on public.support_tickets (assigned_to);
create index if not exists support_tickets_escalated_idx on public.support_tickets (escalated_to_mod) where escalated_to_mod = true;
create index if not exists support_tickets_status_idx on public.support_tickets (status, created_at desc);

-- ── 2. Staff-tier helper ────────────────────────────────────────────────
-- Distinguishes 'staff' specifically from 'moderator'/'admin'. is_staff()
-- (0027) stays as the "is at least staff" gate used for panel access;
-- this narrows down to "is exactly staff" for the handful of actions that
-- should be moderator/admin-only even though staff can see the panel.
create or replace function public.is_staff_only(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role = 'staff' from public.user_moderation where user_id = p_user_id),
    false
  );
$$;

-- ── 3. support_tickets RLS — add staff/mod/admin read + limited update ──
drop policy if exists "staff can view all tickets" on public.support_tickets;
create policy "staff can view all tickets" on public.support_tickets
  for select using (auth.uid() = user_id or public.is_staff(auth.uid()));

-- No general UPDATE policy for staff — every mutation goes through the
-- SECURITY DEFINER RPCs below so escalation/role rules are enforced
-- server-side instead of trusted to the client.

-- ── 4. support_ticket_replies ────────────────────────────────────────────
create table if not exists public.support_ticket_replies (
  id          uuid primary key default gen_random_uuid(),
  ticket_id   uuid not null references public.support_tickets(id) on delete cascade,
  author_id   uuid not null references public.profiles(id) on delete cascade,
  is_staff    boolean not null default false,
  body        text not null check (char_length(trim(body)) > 0),
  created_at  timestamptz not null default now()
);

create index if not exists support_ticket_replies_ticket_idx on public.support_ticket_replies (ticket_id, created_at asc);

alter table public.support_ticket_replies enable row level security;

drop policy if exists "ticket owner and staff can view replies" on public.support_ticket_replies;
create policy "ticket owner and staff can view replies" on public.support_ticket_replies
  for select using (
    public.is_staff(auth.uid())
    or exists (select 1 from public.support_tickets t where t.id = ticket_id and t.user_id = auth.uid())
  );

-- No direct insert policy — replies are written by submitSupportTicket's
-- companion RPCs below (staff_reply_ticket / user_reply_ticket) so the
-- is_staff flag can't be spoofed by the client.

-- ── 5. support_ticket_notes (staff-internal, never user-visible) ───────
create table if not exists public.support_ticket_notes (
  id          uuid primary key default gen_random_uuid(),
  ticket_id   uuid not null references public.support_tickets(id) on delete cascade,
  author_id   uuid not null references public.profiles(id) on delete cascade,
  body        text not null check (char_length(trim(body)) > 0),
  created_at  timestamptz not null default now()
);

create index if not exists support_ticket_notes_ticket_idx on public.support_ticket_notes (ticket_id, created_at asc);

alter table public.support_ticket_notes enable row level security;

drop policy if exists "staff can view ticket notes" on public.support_ticket_notes;
create policy "staff can view ticket notes" on public.support_ticket_notes
  for select using (public.is_staff(auth.uid()));

-- ── 6. Widen moderation_log whitelists ──────────────────────────────────
alter table public.moderation_log drop constraint if exists moderation_log_action_check;
alter table public.moderation_log add constraint moderation_log_action_check
  check (action = ANY (ARRAY[
    'ban', 'suspend', 'unban', 'set_role', 'delete_message', 'delete_post', 'delete_comment',
    'review_report', 'auto_hide', 'unhide', 'auto_violation', 'resolve_alert', 'set_verified',
    'set_badge_availability',
    'set_feature_flag', 'set_maintenance_mode', 'broadcast_notification', 'export_users', 'export_transactions',
    'ticket_claim', 'ticket_unclaim', 'ticket_reply', 'ticket_note', 'ticket_set_status',
    'ticket_escalate', 'ticket_deescalate'
  ]::text[]));

alter table public.moderation_log drop constraint if exists moderation_log_target_type_check;
alter table public.moderation_log add constraint moderation_log_target_type_check
  check (target_type = ANY (ARRAY[
    'user', 'message', 'post', 'comment', 'report', 'badge',
    'feature_flag', 'app_config', 'export', 'notification', 'support_ticket'
  ]::text[]));

-- ── 7. RPCs ───────────────────────────────────────────────────────────────

-- Claim an unassigned ticket. Any staff/mod/admin can claim; re-claiming
-- an already-assigned ticket requires being the current assignee or
-- mod/admin (so staff can't steal a colleague's ticket out from under them).
create or replace function public.staff_claim_ticket(p_ticket_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_current_assignee uuid;
begin
  if v_caller is null or not public.is_staff(v_caller) then
    raise exception 'CV_MOD_FORBIDDEN: staff only';
  end if;

  select assigned_to into v_current_assignee from public.support_tickets where id = p_ticket_id;
  if v_current_assignee is not null and v_current_assignee <> v_caller and not public.is_mod_or_admin(v_caller) then
    raise exception 'CV_MOD_FORBIDDEN: this ticket is already claimed';
  end if;

  update public.support_tickets
    set assigned_to = v_caller, claimed_at = now(), updated_at = now(),
        status = case when status = 'open' then 'in_progress' else status end
    where id = p_ticket_id;

  if not found then
    raise exception 'CV_MOD_NOT_FOUND: ticket not found';
  end if;

  insert into public.moderation_log (moderator_id, action, target_type, target_id)
    values (v_caller, 'ticket_claim', 'support_ticket', p_ticket_id);
end;
$$;

-- Release a ticket back to the unclaimed queue.
create or replace function public.staff_unclaim_ticket(p_ticket_id uuid)
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

  update public.support_tickets
    set assigned_to = null, claimed_at = null, updated_at = now()
    where id = p_ticket_id
      and (assigned_to = v_caller or public.is_mod_or_admin(v_caller));

  if not found then
    raise exception 'CV_MOD_FORBIDDEN: only the assigned staff member or a moderator can unclaim this';
  end if;

  insert into public.moderation_log (moderator_id, action, target_type, target_id)
    values (v_caller, 'ticket_unclaim', 'support_ticket', p_ticket_id);
end;
$$;

-- Reply to a ticket as staff. Auto-claims the ticket for the replier if
-- unassigned, and bumps status open -> in_progress.
create or replace function public.staff_reply_ticket(p_ticket_id uuid, p_body text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_reply_id uuid;
begin
  if v_caller is null or not public.is_staff(v_caller) then
    raise exception 'CV_MOD_FORBIDDEN: staff only';
  end if;

  if p_body is null or char_length(trim(p_body)) = 0 then
    raise exception 'CV_MOD_REASON_REQUIRED: a message is required';
  end if;

  if not exists (select 1 from public.support_tickets where id = p_ticket_id) then
    raise exception 'CV_MOD_NOT_FOUND: ticket not found';
  end if;

  insert into public.support_ticket_replies (ticket_id, author_id, is_staff, body)
    values (p_ticket_id, v_caller, true, trim(p_body))
    returning id into v_reply_id;

  update public.support_tickets
    set assigned_to = coalesce(assigned_to, v_caller),
        claimed_at = coalesce(claimed_at, now()),
        status = case when status = 'open' then 'in_progress' else status end,
        updated_at = now()
    where id = p_ticket_id;

  insert into public.moderation_log (moderator_id, action, target_type, target_id)
    values (v_caller, 'ticket_reply', 'support_ticket', p_ticket_id);

  return v_reply_id;
end;
$$;

-- Reply to your own ticket as the requesting user.
create or replace function public.user_reply_ticket(p_ticket_id uuid, p_body text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_reply_id uuid;
begin
  if v_caller is null then
    raise exception 'CV_MOD_FORBIDDEN: sign in required';
  end if;

  if p_body is null or char_length(trim(p_body)) = 0 then
    raise exception 'CV_MOD_REASON_REQUIRED: a message is required';
  end if;

  if not exists (select 1 from public.support_tickets where id = p_ticket_id and user_id = v_caller) then
    raise exception 'CV_MOD_NOT_FOUND: ticket not found';
  end if;

  insert into public.support_ticket_replies (ticket_id, author_id, is_staff, body)
    values (p_ticket_id, v_caller, false, trim(p_body))
    returning id into v_reply_id;

  -- A user replying to a resolved/closed ticket reopens it for staff attention.
  update public.support_tickets
    set status = case when status in ('resolved', 'closed') then 'open' else status end,
        updated_at = now()
    where id = p_ticket_id;

  return v_reply_id;
end;
$$;

-- Internal, staff-only note (never visible to the ticket's author).
create or replace function public.staff_add_ticket_note(p_ticket_id uuid, p_body text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_note_id uuid;
begin
  if v_caller is null or not public.is_staff(v_caller) then
    raise exception 'CV_MOD_FORBIDDEN: staff only';
  end if;

  if p_body is null or char_length(trim(p_body)) = 0 then
    raise exception 'CV_MOD_REASON_REQUIRED: a note body is required';
  end if;

  if not exists (select 1 from public.support_tickets where id = p_ticket_id) then
    raise exception 'CV_MOD_NOT_FOUND: ticket not found';
  end if;

  insert into public.support_ticket_notes (ticket_id, author_id, body)
    values (p_ticket_id, v_caller, trim(p_body))
    returning id into v_note_id;

  insert into public.moderation_log (moderator_id, action, target_type, target_id)
    values (v_caller, 'ticket_note', 'support_ticket', p_ticket_id);

  return v_note_id;
end;
$$;

-- Set ticket status. Staff can set in_progress/resolved/closed on their
-- own queue, but an escalated ticket can only have its status changed by
-- a moderator/admin — staff handed it off and shouldn't be able to
-- resolve/close it out from under the mod who now owns it.
create or replace function public.staff_set_ticket_status(p_ticket_id uuid, p_status text)
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

  if p_status not in ('open', 'in_progress', 'resolved', 'closed') then
    raise exception 'CV_MOD_BAD_STATUS: invalid status';
  end if;

  select escalated_to_mod into v_escalated from public.support_tickets where id = p_ticket_id;
  if v_escalated is null then
    raise exception 'CV_MOD_NOT_FOUND: ticket not found';
  end if;

  if v_escalated and public.is_staff_only(v_caller) then
    raise exception 'CV_MOD_INSUFFICIENT: this ticket is escalated — only a moderator can change its status';
  end if;

  update public.support_tickets
    set status = p_status,
        updated_at = now(),
        resolved_by = case when p_status = 'resolved' then v_caller else resolved_by end,
        closed_at = case when p_status = 'closed' then now() else closed_at end
    where id = p_ticket_id;

  insert into public.moderation_log (moderator_id, action, target_type, target_id, metadata)
    values (v_caller, 'ticket_set_status', 'support_ticket', p_ticket_id, jsonb_build_object('status', p_status));
end;
$$;

-- Escalate a ticket to the moderator queue. Requires a note so the mod
-- picking it up has context instead of a bare handoff. Available to
-- staff/mod/admin (a moderator may also want to escalate to another
-- moderator/admin for a decision above their own authority).
create or replace function public.staff_escalate_ticket(p_ticket_id uuid, p_note text)
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

  if not exists (select 1 from public.support_tickets where id = p_ticket_id) then
    raise exception 'CV_MOD_NOT_FOUND: ticket not found';
  end if;

  update public.support_tickets
    set escalated_to_mod = true,
        escalation_note = trim(p_note),
        escalated_by = v_caller,
        escalated_at = now(),
        priority = case when priority in ('low', 'normal') then 'high' else priority end,
        updated_at = now()
    where id = p_ticket_id;

  insert into public.moderation_log (moderator_id, action, target_type, target_id, reason)
    values (v_caller, 'ticket_escalate', 'support_ticket', p_ticket_id, trim(p_note));
end;
$$;

-- Send an escalated ticket back down to the general staff queue.
-- Moderator/admin only.
create or replace function public.mod_deescalate_ticket(p_ticket_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
begin
  if v_caller is null or not public.is_mod_or_admin(v_caller) then
    raise exception 'CV_MOD_FORBIDDEN: moderator role required';
  end if;

  update public.support_tickets
    set escalated_to_mod = false,
        updated_at = now()
    where id = p_ticket_id;

  if not found then
    raise exception 'CV_MOD_NOT_FOUND: ticket not found';
  end if;

  insert into public.moderation_log (moderator_id, action, target_type, target_id)
    values (v_caller, 'ticket_deescalate', 'support_ticket', p_ticket_id);
end;
$$;

grant execute on function public.staff_claim_ticket(uuid) to authenticated;
grant execute on function public.staff_unclaim_ticket(uuid) to authenticated;
grant execute on function public.staff_reply_ticket(uuid, text) to authenticated;
grant execute on function public.user_reply_ticket(uuid, text) to authenticated;
grant execute on function public.staff_add_ticket_note(uuid, text) to authenticated;
grant execute on function public.staff_set_ticket_status(uuid, text) to authenticated;
grant execute on function public.staff_escalate_ticket(uuid, text) to authenticated;
grant execute on function public.mod_deescalate_ticket(uuid) to authenticated;

notify pgrst, 'reload schema';
