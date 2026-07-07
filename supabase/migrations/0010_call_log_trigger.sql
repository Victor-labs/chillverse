-- supabase/migrations/0010_call_log_trigger.sql
-- ════════════════════════════════════════════════════════════════════════
-- Migration 0010 — Call log messages
--
-- Migration 0009 added `messages.type = 'call_log'`, `messages.call_id`, and
-- the client already renders that message type (Chat.tsx), but nothing ever
-- wrote one — the calls table just went straight to 'missed'/'ended'/etc
-- with no trace left in the conversation. This adds the trigger that was
-- always meant to back that column: it fires once per call, exactly when
-- `calls.status` transitions into a terminal state, and inserts the
-- corresponding message — "Missed call", "Declined call", "Call canceled",
-- or "Voice/Video call" with its duration for a call that actually connected.
--
-- Runs as SECURITY DEFINER so it can insert into `messages` regardless of
-- which of the two parties' clients performed the status update — the same
-- reason `is_room_member()` and `set_reaction_room_id()` (migration 0008/0009)
-- are security definer. This guarantees exactly one log entry per call no
-- matter which side's browser is still open when it ends.
--
-- Depends on migrations 0008 (public.messages) and 0009 (public.calls,
-- messages.type/call_id/audio_duration_seconds). Safe to re-run.
-- ════════════════════════════════════════════════════════════════════════

create or replace function public.log_call_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_label      text;
  v_call_kind  text;
  v_duration   integer;
begin
  -- Only act on an actual status change, and only for terminal statuses —
  -- the 'accepted' transition (ringing -> accepted) is not logged, since the
  -- call hasn't produced an outcome yet.
  if new.status = old.status then
    return new;
  end if;
  if new.status not in ('declined', 'missed', 'ended', 'canceled') then
    return new;
  end if;

  v_call_kind := case new.type when 'video' then 'Video call' else 'Voice call' end;

  if new.started_at is not null and new.ended_at is not null then
    v_duration := greatest(0, extract(epoch from (new.ended_at - new.started_at))::integer);
  else
    v_duration := null;
  end if;

  v_label := case new.status
    when 'missed'   then 'Missed call'
    when 'declined' then 'Declined call'
    when 'canceled' then 'Call canceled'
    when 'ended'    then v_call_kind
    else 'Call'
  end;

  insert into public.messages (room_id, sender_id, content, type, call_id, audio_duration_seconds)
  values (new.room_id, new.caller_id, v_label, 'call_log', new.id, v_duration);

  return new;
end;
$$;

drop trigger if exists trg_log_call_message on public.calls;
create trigger trg_log_call_message
  after update on public.calls
  for each row execute function public.log_call_message();
