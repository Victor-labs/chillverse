-- 0088_club_welcome_message.sql
--
-- Wires up chat_rooms.welcome_message (added in 0086, editable from Club
-- Settings, but never actually posted anywhere). Mirrors the pattern
-- 0010_call_log_trigger.sql already uses for call logs: a SECURITY DEFINER
-- trigger on the event that should produce the message, inserting a system
-- row that every member sees over Realtime like any other message — no
-- client-side "insert a message when you join" call needed (and no way for
-- a client to spoof one, since nothing else can insert type = 'system').
--
-- Fires once per new member row, and only for genuine joins (role =
-- 'member') — the president's own room_members row from create_club is
-- excluded, so a president never gets "welcomed" to a club they just made.
--
-- Depends on 0083 (chat_rooms.type = 'club', room_members), 0086
-- (chat_rooms.welcome_message), 0044 (messages.type check).

-- ── messages.type: add 'system' alongside the existing types ──
alter table public.messages drop constraint if exists messages_type_check;
alter table public.messages
  add constraint messages_type_check
  check (type in ('text', 'voice_note', 'call_log', 'rank_tag', 'poll', 'system'));

create or replace function public.post_club_welcome_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room        record;
  v_display_name text;
  v_member_count int;
  v_content     text;
begin
  -- Only actual joins post a welcome — create_club's own insert of the
  -- president row is role = 'president', so it's skipped here.
  if new.role <> 'member' then
    return new;
  end if;

  select id, name, type, welcome_message into v_room
    from public.chat_rooms where id = new.room_id;

  if v_room.id is null or v_room.type is distinct from 'club' then
    return new;
  end if;

  select coalesce(display_name, username) into v_display_name
    from public.profiles where id = new.user_id;

  select count(*) into v_member_count
    from public.room_members where room_id = new.room_id;

  v_content := coalesce(
    v_room.welcome_message,
    'Welcome {display_name} to {club_name}! You are member #{member_count}. I hope you enjoy your stay 🎉'
  );
  v_content := replace(v_content, '{display_name}', coalesce(v_display_name, 'someone'));
  v_content := replace(v_content, '{club_name}', v_room.name);
  v_content := replace(v_content, '{member_count}', v_member_count::text);

  -- sender_id null — same convention as any other system-authored row;
  -- the client renders type = 'system' as a centered notice, not a bubble.
  insert into public.messages (room_id, sender_id, content, type)
  values (new.room_id, null, v_content, 'system');

  return new;
end;
$$;

drop trigger if exists trg_post_club_welcome_message on public.room_members;
create trigger trg_post_club_welcome_message
  after insert on public.room_members
  for each row execute function public.post_club_welcome_message();

-- ── messages RLS: SELECT policy already scopes to is_room_member(room_id),
-- which covers system rows the same as any other — no policy change needed.
-- sender_id is nullable already (`references profiles(id) on delete set
-- null`), so no schema change needed there either.
