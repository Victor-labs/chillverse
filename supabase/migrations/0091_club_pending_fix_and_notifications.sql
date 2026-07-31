-- 0091_club_pending_fix_and_notifications.sql
--
-- Two fixes:
--
-- 1. list_club_pending_members threw "column reference 'user_id' is
--    ambiguous". Its RETURNS TABLE(user_id uuid, ...) makes `user_id` a
--    plpgsql variable in scope for the whole function body — the
--    authorization check's `user_id = auth.uid()` was unqualified, so
--    Postgres couldn't tell that from the room_members.user_id column.
--    (accept/reject_club_pending_member don't have this bug — they RETURN
--    void, so they never got a `user_id` variable in the first place.)
--    This is why the awaiting-list section never appeared: the fetch
--    always errored, so `pending` stayed an empty array.
--
-- 2. Notifications for the two moments in the "add members" flow that
--    didn't have one: being added (instant or pending), and a pending
--    invite getting accepted.

create or replace function public.list_club_pending_members(p_room_id uuid)
returns table(user_id uuid, username text, display_name text, avatar text, invited_by uuid, created_at timestamptz)
language plpgsql
security definer
stable
set search_path to 'public'
as $function$
begin
  if not exists (
    select 1 from public.room_members rm
    where rm.room_id = p_room_id and rm.user_id = auth.uid() and rm.role in ('president', 'vp')
  ) then
    raise exception 'not authorized';
  end if;
  return query
    select p.id, p.username, p.display_name, p.avatar, pe.invited_by, pe.created_at
    from public.club_pending_members pe
    join public.profiles p on p.id = pe.user_id
    where pe.room_id = p_room_id
    order by pe.created_at asc;
end;
$function$;

create or replace function public.invite_or_add_club_member(p_room_id uuid, p_user_id uuid)
returns text
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_my_role text;
  v_max_members int;
  v_member_count int;
  v_my_name text;
  v_club_name text;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  select role into v_my_role from public.room_members where room_id = p_room_id and user_id = v_uid;
  if v_my_role is null then raise exception 'not a member of this club'; end if;
  if p_user_id = v_uid then raise exception 'cannot invite yourself'; end if;
  if exists (select 1 from public.room_members where room_id = p_room_id and user_id = p_user_id) then
    raise exception 'already a member of this club';
  end if;

  select coalesce(display_name, username) into v_my_name from public.profiles where id = v_uid;
  select name into v_club_name from public.chat_rooms where id = p_room_id;

  if v_my_role in ('president', 'vp') then
    select max_members into v_max_members from public.chat_rooms where id = p_room_id;
    select count(*) into v_member_count from public.room_members where room_id = p_room_id;
    if v_member_count >= v_max_members then raise exception 'club is full'; end if;

    delete from public.club_pending_members where room_id = p_room_id and user_id = p_user_id;
    insert into public.room_members (room_id, user_id, role) values (p_room_id, p_user_id, 'member');

    insert into public.notifications (user_id, type, title, body, icon, meta)
      values (
        p_user_id, 'club_added',
        v_my_name || ' added you to ' || v_club_name,
        'You''re in — say hi!',
        'users', jsonb_build_object('room_id', p_room_id)
      );
    return 'added';
  else
    insert into public.club_pending_members (room_id, user_id, invited_by)
      values (p_room_id, p_user_id, v_uid)
      on conflict (room_id, user_id) do nothing;

    insert into public.notifications (user_id, type, title, body, icon, meta)
      values (
        p_user_id, 'club_invite_pending',
        v_my_name || ' added you to ' || v_club_name,
        'Approval pending from the president or a VP.',
        'clock', jsonb_build_object('room_id', p_room_id)
      );
    return 'pending';
  end if;
end;
$function$;

create or replace function public.accept_club_pending_member(p_room_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_max_members int;
  v_member_count int;
  v_club_name text;
begin
  if not exists (select 1 from public.room_members where room_id = p_room_id and user_id = auth.uid() and role in ('president', 'vp')) then
    raise exception 'not authorized';
  end if;
  if not exists (select 1 from public.club_pending_members where room_id = p_room_id and user_id = p_user_id) then
    raise exception 'not on the awaiting list';
  end if;

  select max_members into v_max_members from public.chat_rooms where id = p_room_id;
  select count(*) into v_member_count from public.room_members where room_id = p_room_id;
  if v_member_count >= v_max_members then raise exception 'club is full'; end if;

  select name into v_club_name from public.chat_rooms where id = p_room_id;

  delete from public.club_pending_members where room_id = p_room_id and user_id = p_user_id;
  insert into public.room_members (room_id, user_id, role) values (p_room_id, p_user_id, 'member');

  insert into public.notifications (user_id, type, title, body, icon, meta)
    values (
      p_user_id, 'club_invite_accepted',
      'You''re in!',
      'Your invite to ' || v_club_name || ' club has been accepted.',
      'check', jsonb_build_object('room_id', p_room_id)
    );
end;
$function$;
