-- supabase/migrations/0030_auto_hide_reported_content.sql
-- ════════════════════════════════════════════════════════════════════════
-- Migration 0030 — Auto-hide content after enough reports
--
-- Once 3 DISTINCT people (not the same person reporting 3x — reporter_id
-- must be non-null and unique) report the same message/post/comment, it's
-- automatically hidden pending a moderator's look. "Hidden" here means:
--   - The author can still see it themselves, with a small notice.
--   - Nobody else can see it at all (it's not even a "content removed"
--     placeholder to them — the row is simply absent from what they get).
--   - Staff can still see everything, same as with the existing `hidden`
--     column on posts/comments.
--
-- posts/comments already had a `hidden` boolean with staff-aware RLS from
-- earlier work. This migration: (a) adds the same to messages, which
-- didn't have it, (b) adds hidden_reason/hidden_at everywhere, (c) adds
-- the "author can see their own hidden content" RLS bypass everywhere,
-- (d) adds the auto-hide trigger + a staff-only unhide RPC.
--
-- System-generated (word-filter) reports have reporter_id = null and are
-- deliberately excluded from the distinct-reporter count — auto-hide only
-- fires on real human corroboration, never off the word filter alone.
-- ════════════════════════════════════════════════════════════════════════

-- ── 1. Columns ────────────────────────────────────────────────────────
alter table public.messages add column if not exists hidden boolean not null default false;
alter table public.messages add column if not exists hidden_reason text;
alter table public.messages add column if not exists hidden_at timestamptz;

alter table public.posts add column if not exists hidden_reason text;
alter table public.posts add column if not exists hidden_at timestamptz;

alter table public.comments add column if not exists hidden_reason text;
alter table public.comments add column if not exists hidden_at timestamptz;

-- ── 2. Lock down who can flip `hidden` on messages ──────────────────────
-- messages currently has a blanket table-level UPDATE grant to
-- authenticated (the "messages_update" RLS policy lets a sender update
-- their own row with no column restriction). Without this, a sender could
-- just UPDATE their own hidden message back to hidden = false themselves
-- and defeat the whole feature. Narrow the grant to only the two columns
-- the client actually needs to self-update (confirmed against Chat.tsx:
-- audio_path after voice-note upload, deleted for self soft-delete).
revoke update on public.messages from authenticated;
grant update (audio_path, deleted) on public.messages to authenticated;

-- ── 3. RLS: let the author see their own hidden content ─────────────────
drop policy if exists "messages_select" on public.messages;
create policy "messages_select" on public.messages
  for select using (
    exists (select 1 from public.room_members rm where rm.room_id = messages.room_id and rm.user_id = auth.uid())
    and (not hidden or sender_id = auth.uid() or public.is_staff(auth.uid()))
  );

drop policy if exists "posts are publicly readable" on public.posts;
create policy "posts are publicly readable" on public.posts
  for select using ((not hidden) or author_id = auth.uid() or public.is_staff(auth.uid()));

drop policy if exists "comments are publicly readable" on public.comments;
create policy "comments are publicly readable" on public.comments
  for select using ((not hidden) or author_id = auth.uid() or public.is_staff(auth.uid()));

-- ── 4. moderation_log gets two new action types ──────────────────────
alter table public.moderation_log drop constraint if exists moderation_log_action_check;
alter table public.moderation_log add constraint moderation_log_action_check check (action in (
  'ban', 'suspend', 'unban', 'set_role',
  'delete_message', 'delete_post', 'delete_comment', 'review_report',
  'auto_hide', 'unhide'
));

-- ── 5. Auto-hide trigger ─────────────────────────────────────────────
create or replace function public.check_auto_hide_threshold()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_distinct_reporters int;
  v_threshold constant int := 3;
begin
  select count(distinct reporter_id) into v_distinct_reporters
    from public.content_reports
    where target_type = new.target_type
      and target_id = new.target_id
      and reporter_id is not null;

  if v_distinct_reporters < v_threshold then
    return new;
  end if;

  if new.target_type = 'message' then
    update public.messages
      set hidden = true, hidden_reason = 'Hidden pending review after multiple reports', hidden_at = now()
      where id = new.target_id and not hidden;
  elsif new.target_type = 'post' then
    update public.posts
      set hidden = true, hidden_reason = 'Hidden pending review after multiple reports', hidden_at = now()
      where id = new.target_id and not hidden;
  elsif new.target_type = 'comment' then
    update public.comments
      set hidden = true, hidden_reason = 'Hidden pending review after multiple reports', hidden_at = now()
      where id = new.target_id and not hidden;
  else
    return new;
  end if;

  if found then
    insert into public.moderation_log (moderator_id, action, target_type, target_id, reason, metadata)
      values (null, 'auto_hide', new.target_type, new.target_id,
              'Auto-hidden after ' || v_distinct_reporters || ' distinct reports',
              jsonb_build_object('distinct_reporters', v_distinct_reporters));
  end if;

  return new;
end;
$$;

drop trigger if exists on_content_report_auto_hide on public.content_reports;
create trigger on_content_report_auto_hide
  after insert on public.content_reports
  for each row execute function public.check_auto_hide_threshold();

-- ── 6. Staff-only manual unhide ──────────────────────────────────────
create or replace function public.mod_unhide_content(p_target_type text, p_target_id uuid)
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

  if p_target_type = 'message' then
    update public.messages set hidden = false, hidden_reason = null, hidden_at = null where id = p_target_id;
  elsif p_target_type = 'post' then
    update public.posts set hidden = false, hidden_reason = null, hidden_at = null where id = p_target_id;
  elsif p_target_type = 'comment' then
    update public.comments set hidden = false, hidden_reason = null, hidden_at = null where id = p_target_id;
  else
    raise exception 'CV_MOD_BAD_TARGET: cannot unhide this target type';
  end if;

  if not found then
    raise exception 'CV_MOD_NOT_FOUND: content not found';
  end if;

  insert into public.moderation_log (moderator_id, action, target_type, target_id)
    values (v_caller, 'unhide', p_target_type, p_target_id);
end;
$$;

revoke execute on function public.mod_unhide_content(text, uuid) from public;
grant execute on function public.mod_unhide_content(text, uuid) to authenticated;

notify pgrst, 'reload schema';
