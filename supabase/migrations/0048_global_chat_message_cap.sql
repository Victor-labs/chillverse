-- supabase/migrations/0048_global_chat_message_cap.sql
-- ════════════════════════════════════════════════════════════════════════
-- Migration 0048 — Global Chat 100-message cap
--
-- Global Chat only ever keeps its most recent 100 messages. Every time a
-- new message lands in the global room, this trigger deletes whatever
-- fell out of that window — a real DELETE, not the soft `deleted = true`
-- flag used elsewhere, so the row (and its storage, if a voice note) is
-- actually gone rather than just hidden. DMs are untouched; they keep
-- full history.
--
-- Runs as SECURITY DEFINER for the same reason migration 0010's
-- log_call_message() does — it needs to write regardless of whose insert
-- fired it.
--
-- spotlight_message_id (migration 0045) is a real FK to messages(id) with
-- no ON DELETE clause (default RESTRICT), so a pruned message that's
-- currently spotlighted/pinned would block the DELETE below with a FK
-- violation if left alone — this clears both fields on chat_rooms first,
-- for exactly the rows about to be pruned, before deleting them.
--
-- starred_messages (migration 0046) already cascades on message delete,
-- and starring is DM-only client-side (see Chat.tsx toggleStar), so no
-- global-room message is ever expected to be starred in the first place.
--
-- Depends on migrations 0008 (public.messages, public.chat_rooms) and
-- 0045 (spotlight_message_id). Safe to re-run.
-- ════════════════════════════════════════════════════════════════════════

create or replace function public.trim_global_chat_messages()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_global  boolean;
  v_prune_ids  uuid[];
begin
  select exists(
    select 1 from public.chat_rooms where id = new.room_id and type = 'global'
  ) into v_is_global;

  if not v_is_global then
    return new;
  end if;

  -- Everything in this room outside the 100 most recent, by created_at.
  select array_agg(id) into v_prune_ids
  from public.messages
  where room_id = new.room_id
    and id not in (
      select id from public.messages
      where room_id = new.room_id
      order by created_at desc
      limit 100
    );

  if v_prune_ids is null or array_length(v_prune_ids, 1) = 0 then
    return new; -- room hasn't hit 100 yet — nothing to prune
  end if;

  update public.chat_rooms
  set pinned_message_id    = case when pinned_message_id    = any(v_prune_ids) then null else pinned_message_id end,
      spotlight_message_id = case when spotlight_message_id = any(v_prune_ids) then null else spotlight_message_id end,
      spotlight_expires_at = case when spotlight_message_id = any(v_prune_ids) then null else spotlight_expires_at end
  where id = new.room_id
    and (pinned_message_id = any(v_prune_ids) or spotlight_message_id = any(v_prune_ids));

  delete from public.messages where id = any(v_prune_ids);

  return new;
end;
$$;

drop trigger if exists trg_trim_global_chat_messages on public.messages;
create trigger trg_trim_global_chat_messages
  after insert on public.messages
  for each row execute function public.trim_global_chat_messages();
