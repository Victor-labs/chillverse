-- 0085_club_icon_random_lucide.sql
--
-- Simplifies club icons: no Mall items / uploaded images. Each club gets
-- one of 10 fixed lucide icon keys, assigned randomly at creation and
-- fixed for the life of the club (not user-editable). This replaces the
-- icon_mall_item_id approach from 0083/0084 before any club/icon data
-- existed live, so this is a clean swap, not a migration of real rows.

-- Drop the now-unused club-icons policies from 0084. (The bucket row itself
-- can't be removed via SQL — storage.protect_delete() blocks direct deletes;
-- it's left in place, empty and unreferenced, harmless either way.)
drop policy if exists "club icons are publicly readable" on storage.objects;
drop policy if exists "only staff can manage club icon assets" on storage.objects;

-- New column for the icon key; drop the old Mall-item reference.
alter table public.chat_rooms
  add column if not exists icon_key text;

alter table public.chat_rooms
  drop column if exists icon_mall_item_id;

-- create_club: no longer takes an icon param — picks randomly server-side
-- from a fixed 10-key set. Keep the frontend's key names in sync:
-- rocket, star, flame, crown, gamepad, music, heart, sparkles, trophy, moon
-- (see src/features/clubs/clubIcons.tsx).
-- create_club/update_club_settings are changing their parameter lists, and
-- list_public_clubs is changing its return type — all three need an
-- explicit DROP first (CREATE OR REPLACE can't change a signature).
drop function if exists public.create_club(text, boolean, uuid);
drop function if exists public.update_club_settings(uuid, text, boolean, uuid);
drop function if exists public.list_public_clubs();

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
    values ('club', trim(p_name), v_uid, p_is_private, v_icon_key, v_code, 50)
    returning id into v_room_id;

  insert into public.room_members (room_id, user_id, role) values (v_room_id, v_uid, 'president');

  return v_room_id;
end;
$function$;

-- update_club_settings: icon dropped, name/privacy only.
create or replace function public.update_club_settings(p_room_id uuid, p_name text default null::text, p_is_private boolean default null::boolean)
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

  update public.chat_rooms set
    name = coalesce(trim(p_name), name),
    is_private = coalesce(p_is_private, is_private)
  where id = p_room_id;
end;
$function$;

create or replace function public.list_public_clubs()
returns table(id uuid, name text, member_count bigint, icon_key text, created_at timestamptz)
language sql
security definer
set search_path to 'public'
as $function$
  select cr.id, cr.name, count(rm.user_id) as member_count, cr.icon_key, cr.created_at
  from public.chat_rooms cr
  left join public.room_members rm on rm.room_id = cr.id
  where cr.type = 'club' and cr.is_private = false and cr.archived_at is null
  group by cr.id
  order by cr.created_at desc
  limit 100;
$function$;
