-- 0083_clubs_schema_and_rpcs.sql
--
-- Restores the migration file for the Clubs feature, which was already
-- applied directly to the live database but never landed in the repo's
-- migration history. Written to exactly match what's live: every
-- statement is idempotent (IF NOT EXISTS / CREATE OR REPLACE / DROP+CREATE
-- for policies), so re-running this against the live DB is a safe no-op.
--
-- Clubs are `chat_rooms` with type = 'club'. Membership + role (member /
-- vp / president) lives on `room_members`. All writes to club settings
-- go through the RPCs below — direct table updates are blocked by RLS
-- for this room type (see the chat_rooms update policy at the bottom).

-- ── Schema ──────────────────────────────────────────────────────────

alter table public.chat_rooms
  add column if not exists is_private        boolean not null default true,
  add column if not exists max_members        integer not null default 50,
  add column if not exists icon_mall_item_id  uuid,
  add column if not exists join_code          text,
  add column if not exists archived_at        timestamptz,
  add column if not exists grace_started_at   timestamptz;

create unique index if not exists chat_rooms_join_code_key
  on public.chat_rooms (join_code) where join_code is not null;

alter table public.room_members
  add column if not exists role text not null default 'member';

-- ── RPCs ────────────────────────────────────────────────────────────

create or replace function public.create_club(p_name text, p_is_private boolean default true, p_icon_mall_item_id uuid default null::uuid)
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

  if p_icon_mall_item_id is not null and not exists (
    select 1 from public.mall_items where id = p_icon_mall_item_id and category = 'club_icon'
  ) then
    raise exception 'invalid club icon';
  end if;

  loop
    v_code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
    exit when not exists (select 1 from public.chat_rooms where join_code = v_code);
    v_tries := v_tries + 1;
    if v_tries > 10 then raise exception 'could not generate a unique club code'; end if;
  end loop;

  insert into public.chat_rooms (type, name, created_by, is_private, icon_mall_item_id, join_code, max_members)
    values ('club', trim(p_name), v_uid, p_is_private, p_icon_mall_item_id, v_code, 50)
    returning id into v_room_id;

  insert into public.room_members (room_id, user_id, role) values (v_room_id, v_uid, 'president');

  return v_room_id;
end;
$function$;

create or replace function public.join_club(p_room_id uuid default null::uuid, p_code text default null::text)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_room record;
  v_member_count int;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if p_room_id is null and p_code is null then raise exception 'room id or code required'; end if;

  select * into v_room from public.chat_rooms
    where type = 'club' and archived_at is null
      and (id = p_room_id or join_code = upper(p_code));
  if not found then raise exception 'club not found'; end if;

  -- A private club requires the code specifically (not just knowing the id
  -- some other way, e.g. from an old link) — a public club can be joined
  -- by id (from the browse list) or by code, either works.
  if v_room.is_private and p_code is null then raise exception 'this club is invite-only'; end if;

  if exists (select 1 from public.room_members where room_id = v_room.id and user_id = v_uid) then
    return v_room.id; -- already a member, no-op
  end if;

  select count(*) into v_member_count from public.room_members where room_id = v_room.id;
  if v_member_count >= v_room.max_members then raise exception 'club is full'; end if;

  insert into public.room_members (room_id, user_id, role) values (v_room.id, v_uid, 'member');
  return v_room.id;
end;
$function$;

create or replace function public.leave_club(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_my_role text;
  v_vp_id uuid;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;

  select role into v_my_role from public.room_members where room_id = p_room_id and user_id = v_uid;
  if v_my_role is null then raise exception 'not a member'; end if;

  if v_my_role = 'president' then
    select user_id into v_vp_id from public.room_members where room_id = p_room_id and role = 'vp' limit 1;
    if v_vp_id is null then
      raise exception 'promote a VP or delete the club before leaving';
    end if;
    update public.room_members set role = 'president' where room_id = p_room_id and user_id = v_vp_id;
    update public.chat_rooms set created_by = v_vp_id where id = p_room_id;
  end if;

  delete from public.room_members where room_id = p_room_id and user_id = v_uid;
end;
$function$;

create or replace function public.delete_club(p_room_id uuid)
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
    raise exception 'only the president can delete this club';
  end if;
  delete from public.chat_rooms where id = p_room_id; -- cascades room_members/messages/etc
end;
$function$;

create or replace function public.promote_club_member(p_room_id uuid, p_user_id uuid, p_new_role text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
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

  -- Only one VP at a time — demote any existing VP first when promoting a new one.
  if p_new_role = 'vp' then
    update public.room_members set role = 'member' where room_id = p_room_id and role = 'vp';
  end if;

  update public.room_members set role = p_new_role where room_id = p_room_id and user_id = p_user_id;
end;
$function$;

create or replace function public.remove_club_member(p_room_id uuid, p_user_id uuid)
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
  if v_target_role = 'president' then raise exception 'cannot remove the president'; end if;
  if v_target_role = 'vp' and v_my_role <> 'president' then raise exception 'only the president can remove the vp'; end if;

  delete from public.room_members where room_id = p_room_id and user_id = p_user_id;
end;
$function$;

create or replace function public.update_club_settings(p_room_id uuid, p_name text default null::text, p_is_private boolean default null::boolean, p_icon_mall_item_id uuid default null::uuid)
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
  if p_icon_mall_item_id is not null and not exists (
    select 1 from public.mall_items where id = p_icon_mall_item_id and category = 'club_icon'
  ) then
    raise exception 'invalid club icon';
  end if;

  update public.chat_rooms set
    name = coalesce(trim(p_name), name),
    is_private = coalesce(p_is_private, is_private),
    icon_mall_item_id = coalesce(p_icon_mall_item_id, icon_mall_item_id)
  where id = p_room_id;
end;
$function$;

create or replace function public.club_pin_message(p_room_id uuid, p_message_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if not exists (select 1 from public.room_members where room_id = p_room_id and user_id = v_uid and role in ('president','vp')) then
    raise exception 'only the president or vp can pin messages';
  end if;
  update public.chat_rooms set pinned_message_id = p_message_id where id = p_room_id;
end;
$function$;

create or replace function public.club_unpin_message(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if not exists (select 1 from public.room_members where room_id = p_room_id and user_id = v_uid and role in ('president','vp')) then
    raise exception 'only the president or vp can unpin messages';
  end if;
  update public.chat_rooms set pinned_message_id = null where id = p_room_id;
end;
$function$;

create or replace function public.club_delete_message(p_message_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_room_id uuid;
  v_my_role text;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;

  select room_id into v_room_id from public.messages where id = p_message_id;
  if v_room_id is null then raise exception 'message not found'; end if;

  select role into v_my_role from public.room_members where room_id = v_room_id and user_id = v_uid;
  if v_my_role not in ('president', 'vp') then raise exception 'not authorized'; end if;

  update public.messages
    set deleted = true, hidden_reason = case when v_my_role = 'president' then 'deleted_by_president' else 'deleted_by_vp' end
    where id = p_message_id;
end;
$function$;

create or replace function public.list_public_clubs()
returns table(id uuid, name text, member_count bigint, icon_mall_item_id uuid, created_at timestamptz)
language sql
security definer
set search_path to 'public'
as $function$
  select cr.id, cr.name, count(rm.user_id) as member_count, cr.icon_mall_item_id, cr.created_at
  from public.chat_rooms cr
  left join public.room_members rm on rm.room_id = cr.id
  where cr.type = 'club' and cr.is_private = false and cr.archived_at is null
  group by cr.id
  order by cr.created_at desc
  limit 100;
$function$;

-- ── Grace-period scheduler (non-Pro presidents over the 2-club limit) ─
-- lapse → notify + start 24h clock → archive → 7 days → delete.
-- Auto-clears grace/archive the moment the president is Pro-active again.

create or replace function public.run_club_subscription_checks()
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  r record;
  v_over record;
begin
  -- ── Recovery: president is Pro-active again — clear any in-flight grace/archive ──
  for r in
    select distinct cr.created_by
    from public.chat_rooms cr
    join public.profiles p on p.id = cr.created_by
    where cr.type = 'club' and (cr.grace_started_at is not null or cr.archived_at is not null)
      and coalesce(p.is_pro, false) and (p.pro_expires_at is null or p.pro_expires_at > now())
  loop
    update public.chat_rooms
      set grace_started_at = null, archived_at = null
      where type = 'club' and created_by = r.created_by;
  end loop;

  -- ── Step 1: newly-over-limit, non-Pro presidents — notify + start the clock ──
  for v_over in
    select cr.id as room_id, cr.name, cr.created_by
    from public.chat_rooms cr
    join public.profiles p on p.id = cr.created_by
    where cr.type = 'club' and cr.archived_at is null and cr.grace_started_at is null
      and not (coalesce(p.is_pro, false) and (p.pro_expires_at is null or p.pro_expires_at > now()))
      and cr.id not in (
        select id from (
          select id, row_number() over (partition by created_by order by created_at asc) as rn
          from public.chat_rooms where type = 'club' and archived_at is null
        ) ranked where rn <= 2
      )
  loop
    update public.chat_rooms set grace_started_at = now() where id = v_over.room_id;
    insert into public.notifications (user_id, type, title, body, icon, meta)
      values (
        v_over.created_by, 'club_grace_warning',
        'Club will be archived soon',
        '"' || v_over.name || '" will be archived in 24 hours unless you renew your subscription.',
        'flag', jsonb_build_object('room_id', v_over.room_id)
      );
    -- In-app + push both covered by the single notifications insert, same
    -- pipeline as every other notification here (DB trigger -> push).
  end loop;

  -- ── Step 2: 24h past grace start, still lapsed, not yet archived ──
  update public.chat_rooms cr
    set archived_at = now()
    from public.profiles p
    where cr.type = 'club' and cr.created_by = p.id
      and cr.grace_started_at is not null and cr.grace_started_at < now() - interval '24 hours'
      and cr.archived_at is null
      and not (coalesce(p.is_pro, false) and (p.pro_expires_at is null or p.pro_expires_at > now()));

  -- ── Step 3: 7 days archived, still lapsed -> delete ──
  delete from public.chat_rooms cr
    using public.profiles p
    where cr.type = 'club' and cr.created_by = p.id
      and cr.archived_at is not null and cr.archived_at < now() - interval '7 days'
      and not (coalesce(p.is_pro, false) and (p.pro_expires_at is null or p.pro_expires_at > now()));
end;
$function$;

select cron.schedule(
  'club-subscription-checks',
  '*/30 * * * *',
  $$ select public.run_club_subscription_checks(); $$
);

-- ── RLS ─────────────────────────────────────────────────────────────
-- Reads/inserts for chat_rooms, room_members, and messages already flow
-- through the generic is_room_member() policies and cover 'club' rooms
-- for free. The one gap clubs opened up: without this, any member could
-- UPDATE their club's chat_rooms row directly (rename it, flip privacy,
-- clear archived_at, etc) bypassing every RPC check above. This closes
-- that for 'club' (and 'global') rooms — those types must go through
-- their RPCs; everything else (dm, group) is unaffected.

drop policy if exists "members can update their room" on public.chat_rooms;
create policy "members can update their room" on public.chat_rooms
  for update
  using (
    is_room_member(id)
    and (type <> all (array['global'::text, 'club'::text]) or is_staff(auth.uid()))
  );
