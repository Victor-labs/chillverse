-- 0087_club_member_mute.sql
--
-- Per-member 1-hour mute, requested alongside kick in the club info /
-- members view. Uses room_members.muted_until, added in 0086 but unused
-- until now. A VP can mute another VP (per spec); nobody can mute the
-- president. Auto-expires — no cron needed, the RLS check below just
-- compares muted_until to now().

create or replace function public.mute_club_member(p_room_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_my_role text;
  v_target_role text;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  select role into v_my_role from public.room_members where room_id = p_room_id and user_id = v_uid;
  if v_my_role not in ('president', 'vp') then raise exception 'not authorized'; end if;

  select role into v_target_role from public.room_members where room_id = p_room_id and user_id = p_user_id;
  if v_target_role is null then raise exception 'not a member of this club'; end if;
  if v_target_role = 'president' then raise exception 'cannot mute the president'; end if;

  update public.room_members set muted_until = now() + interval '1 hour'
    where room_id = p_room_id and user_id = p_user_id;
end;
$function$;

create or replace function public.unmute_club_member(p_room_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_my_role text;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  select role into v_my_role from public.room_members where room_id = p_room_id and user_id = v_uid;
  if v_my_role not in ('president', 'vp') then raise exception 'not authorized'; end if;

  update public.room_members set muted_until = null
    where room_id = p_room_id and user_id = p_user_id;
end;
$function$;

-- ── RLS: also block sends from a member whose own mute hasn't expired yet ──
drop policy if exists "members can send messages" on public.messages;
create policy "members can send messages" on public.messages
  for insert
  with check (
    (auth.uid() = sender_id) and is_room_member(room_id) and (not is_currently_banned(auth.uid()))
    and (type <> 'poll'::text)
    and ((type <> 'rank_tag'::text) or (is_staff(auth.uid()) and (exists (
      select 1 from chat_rooms cr where cr.id = messages.room_id and cr.type = 'global'::text
    ))))
    and (not (exists (
      select 1 from room_members rm join chat_rooms cr on cr.id = rm.room_id
        join blocks b on ((b.blocker_id = rm.user_id and b.blocked_id = auth.uid()) or (b.blocker_id = auth.uid() and b.blocked_id = rm.user_id))
      where rm.room_id = messages.room_id and rm.user_id <> auth.uid() and cr.type = 'dm'::text
    )))
    and (not (
      exists (select 1 from chat_rooms cr2 where cr2.id = messages.room_id and cr2.type = 'club'::text and cr2.muted = true)
      and not exists (select 1 from room_members rm2 where rm2.room_id = messages.room_id and rm2.user_id = auth.uid() and rm2.role in ('president','vp'))
    ))
    and (not exists (
      select 1 from room_members rm3 where rm3.room_id = messages.room_id and rm3.user_id = auth.uid()
        and rm3.muted_until is not null and rm3.muted_until > now()
    ))
  );
