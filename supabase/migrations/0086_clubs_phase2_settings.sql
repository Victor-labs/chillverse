-- 0086_clubs_phase2_settings.sql
--
-- Phase 2 of the Clubs redesign: settings overhaul.
--   - description, welcome_message (editable, with default placeholder text),
--     awaiting_list_enabled, muted (club-wide "only president/VP can talk")
--   - room_members.muted_until — forward schema for the per-member 1h mute
--     coming in Phase 3; added now since it's a cheap, additive column and
--     Phase 3 will need it. No RPC/enforcement for it yet.
--   - promote_club_member: now allows up to 2 VPs (was 1, auto-demoting the
--     existing one) — no clubs have hit this path yet, safe to change.
--   - create_club: membership cap is now 60 for private clubs, 150 for public
--     (was a flat 50 for both).
--   - New RPCs: regenerate_club_code, transfer_club_ownership, clear_club_chat.
--   - RLS: messages INSERT now also blocks non-president/VP sends into a
--     muted club — extends the existing policy, doesn't touch DMs/global.

alter table public.chat_rooms
  add column if not exists description text,
  add column if not exists awaiting_list_enabled boolean not null default true,
  add column if not exists muted boolean not null default false,
  add column if not exists welcome_message text
    default 'Welcome {display_name} to {club_name}! You are member #{member_count}. I hope you enjoy your stay 🎉';

alter table public.room_members
  add column if not exists muted_until timestamptz;

-- ── create_club: privacy-based membership cap (60 private / 150 public) ──
create or replace function public.create_club(p_name text, p_is_private boolean default true)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_is_pro boolean;
  v_club_count int;
  v_room_id uuid;
  v_code text;
  v_tries int := 0;
  v_icon_key text;
  v_icons text[] := array['rocket','star','flame','crown','gamepad','music','heart','sparkles','trophy','moon'];
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if p_name is null or length(trim(p_name)) = 0 then raise exception 'club name required'; end if;
  if length(p_name) > 60 then raise exception 'club name too long'; end if;

  select coalesce(is_pro, false) and (pro_expires_at is null or pro_expires_at > now())
    into v_is_pro from public.profiles where id = v_uid;

  select count(*) into v_club_count
    from public.chat_rooms
    where type = 'club' and created_by = v_uid and archived_at is null;

  if v_club_count >= 2 and not v_is_pro then
    raise exception 'club_limit_reached';
  end if;

  v_icon_key := v_icons[1 + floor(random() * array_length(v_icons, 1))::int];

  loop
    v_code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
    exit when not exists (select 1 from public.chat_rooms where join_code = v_code);
    v_tries := v_tries + 1;
    if v_tries > 10 then raise exception 'could not generate a unique club code'; end if;
  end loop;

  insert into public.chat_rooms (type, name, created_by, is_private, icon_key, join_code, max_members)
    values ('club', trim(p_name), v_uid, p_is_private, v_icon_key, v_code, case when p_is_private then 60 else 150 end)
    returning id into v_room_id;

  insert into public.room_members (room_id, user_id, role) values (v_room_id, v_uid, 'president');

  return v_room_id;
end;
$function$;

-- ── update_club_settings: description, welcome message, mute, awaiting list ──
-- (signature is growing new params — CREATE OR REPLACE can't change a
-- signature, so drop the old one first)
drop function if exists public.update_club_settings(uuid, text, boolean);

create or replace function public.update_club_settings(
  p_room_id uuid,
  p_name text default null::text,
  p_is_private boolean default null::boolean,
  p_description text default null::text,
  p_welcome_message text default null::text,
  p_muted boolean default null::boolean,
  p_awaiting_list_enabled boolean default null::boolean
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if not exists (select 1 from public.room_members where room_id = p_room_id and user_id = v_uid and role = 'president') then
    raise exception 'only the president can change club settings';
  end if;
  if p_description is not null and length(p_description) > 300 then
    raise exception 'description too long';
  end if;

  update public.chat_rooms set
    name = coalesce(trim(p_name), name),
    is_private = coalesce(p_is_private, is_private),
    description = coalesce(p_description, description),
    welcome_message = coalesce(p_welcome_message, welcome_message),
    muted = coalesce(p_muted, muted),
    awaiting_list_enabled = coalesce(p_awaiting_list_enabled, awaiting_list_enabled)
  where id = p_room_id;
end;
$function$;

-- ── regenerate_club_code: kill + replace in one step, president only ──
create or replace function public.regenerate_club_code(p_room_id uuid)
returns text
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_code text;
  v_tries int := 0;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if not exists (select 1 from public.room_members where room_id = p_room_id and user_id = v_uid and role = 'president') then
    raise exception 'only the president can reset the invite code';
  end if;

  loop
    v_code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
    exit when not exists (select 1 from public.chat_rooms where join_code = v_code);
    v_tries := v_tries + 1;
    if v_tries > 10 then raise exception 'could not generate a unique club code'; end if;
  end loop;

  update public.chat_rooms set join_code = v_code where id = p_room_id;
  return v_code;
end;
$function$;

-- ── transfer_club_ownership: president -> an existing VP only ──
create or replace function public.transfer_club_ownership(p_room_id uuid, p_new_president_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_target_role text;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if not exists (select 1 from public.room_members where room_id = p_room_id and user_id = v_uid and role = 'president') then
    raise exception 'only the president can transfer ownership';
  end if;

  select role into v_target_role from public.room_members where room_id = p_room_id and user_id = p_new_president_id;
  if v_target_role is null then raise exception 'not a member of this club'; end if;
  if v_target_role <> 'vp' then raise exception 'ownership can only be transferred to a VP — promote them first'; end if;

  update public.room_members set role = 'vp' where room_id = p_room_id and user_id = v_uid;
  update public.room_members set role = 'president' where room_id = p_room_id and user_id = p_new_president_id;
  update public.chat_rooms set created_by = p_new_president_id where id = p_room_id;
end;
$function$;

-- ── clear_club_chat: hard delete every message in the room, president only ──
create or replace function public.clear_club_chat(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if not exists (select 1 from public.room_members where room_id = p_room_id and user_id = v_uid and role = 'president') then
    raise exception 'only the president can clear the club chat';
  end if;
  delete from public.messages where room_id = p_room_id;
  update public.chat_rooms set pinned_message_id = null where id = p_room_id;
end;
$function$;

-- ── promote_club_member: up to 2 VPs, no auto-demote ──
create or replace function public.promote_club_member(p_room_id uuid, p_user_id uuid, p_new_role text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_vp_count int;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if p_new_role not in ('member', 'vp') then raise exception 'invalid role'; end if;
  if not exists (select 1 from public.room_members where room_id = p_room_id and user_id = v_uid and role = 'president') then
    raise exception 'only the president can change roles';
  end if;
  if p_user_id = v_uid then raise exception 'cannot change your own role'; end if;
  if not exists (select 1 from public.room_members where room_id = p_room_id and user_id = p_user_id) then
    raise exception 'not a member of this club';
  end if;

  if p_new_role = 'vp' then
    select count(*) into v_vp_count from public.room_members where room_id = p_room_id and role = 'vp';
    if v_vp_count >= 2 then raise exception 'club_vp_limit_reached'; end if;
  end if;

  update public.room_members set role = p_new_role where room_id = p_room_id and user_id = p_user_id;
end;
$function$;

-- ── RLS: block non-president/VP sends into a muted club ──
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
  );
