-- 0090_club_awaiting_list.sql
--
-- Restores the migration file for "add members via chat" + the awaiting
-- list, which was already applied directly to the live database but never
-- landed in the repo's migration history (same situation as 0083/0088).
-- Written to exactly match what's live: every statement is idempotent
-- (IF NOT EXISTS / CREATE OR REPLACE), so re-running this against the live
-- DB is a safe no-op.
--
-- Two ways someone lands in a club now:
--   1. President/VP taps a person from "Add members" (recent DM partners)
--      -> instant join, no approval needed.
--   2. A regular member taps the same button, OR anyone joins a club that
--      has the awaiting-list toggle on (via browse or invite code)
--      -> lands in club_pending_members until a president/VP accepts.
--
-- Depends on 0083 (chat_rooms.type = 'club', room_members), 0086
-- (awaiting_list_enabled, welcome_message), 0089.

-- ── Schema: the pending queue ──────────────────────────────────────
create table if not exists public.club_pending_members (
  room_id     uuid not null references public.chat_rooms(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  invited_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  primary key (room_id, user_id)
);

create index if not exists club_pending_members_room_idx on public.club_pending_members (room_id);

alter table public.club_pending_members enable row level security;

-- Reads only — every write (insert/accept/reject) goes through the
-- SECURITY DEFINER RPCs below, same convention as chat_rooms/room_members.
drop policy if exists "president/vp read pending, self reads own row" on public.club_pending_members;
create policy "president/vp read pending, self reads own row" on public.club_pending_members
  for select using (
    user_id = auth.uid()
    or exists (
      select 1 from public.room_members rm
      where rm.room_id = club_pending_members.room_id and rm.user_id = auth.uid() and rm.role in ('president', 'vp')
    )
  );

-- ── list_recent_dm_partners: candidates for "Add members" ─────────
-- People the caller already has a DM thread with, excluding anyone already
-- a member of this club or already on its awaiting list. Ordered by most
-- recent message so the people you talk to most show up first.
create or replace function public.list_recent_dm_partners(p_room_id uuid, p_limit int default 20)
returns table(user_id uuid, username text, display_name text, avatar text, last_message_at timestamptz)
language sql
security definer
stable
set search_path = public
as $$
  select p.id, p.username, p.display_name, p.avatar, max(m.created_at) as last_message_at
  from public.room_members rm
  join public.chat_rooms cr on cr.id = rm.room_id and cr.type = 'dm'
  join public.room_members other on other.room_id = rm.room_id and other.user_id <> rm.user_id
  join public.profiles p on p.id = other.user_id
  left join public.messages m on m.room_id = rm.room_id
  where rm.user_id = auth.uid()
    and not exists (select 1 from public.room_members ex where ex.room_id = p_room_id and ex.user_id = other.user_id)
    and not exists (select 1 from public.club_pending_members pe where pe.room_id = p_room_id and pe.user_id = other.user_id)
  group by p.id, p.username, p.display_name, p.avatar
  order by last_message_at desc nulls last
  limit p_limit;
$$;

-- ── invite_or_add_club_member: the "Add members" tap ───────────────
-- President/VP -> instant join. Regular member -> awaiting list.
create or replace function public.invite_or_add_club_member(p_room_id uuid, p_user_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_uid uuid := auth.uid();
  v_my_role text;
  v_max_members int;
  v_member_count int;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  select role into v_my_role from public.room_members where room_id = p_room_id and user_id = v_uid;
  if v_my_role is null then raise exception 'not a member of this club'; end if;
  if p_user_id = v_uid then raise exception 'cannot invite yourself'; end if;
  if exists (select 1 from public.room_members where room_id = p_room_id and user_id = p_user_id) then
    raise exception 'already a member of this club';
  end if;

  if v_my_role in ('president', 'vp') then
    select max_members into v_max_members from public.chat_rooms where id = p_room_id;
    select count(*) into v_member_count from public.room_members where room_id = p_room_id;
    if v_member_count >= v_max_members then raise exception 'club is full'; end if;

    delete from public.club_pending_members where room_id = p_room_id and user_id = p_user_id;
    insert into public.room_members (room_id, user_id, role) values (p_room_id, p_user_id, 'member');
    return 'added';
  else
    insert into public.club_pending_members (room_id, user_id, invited_by)
      values (p_room_id, p_user_id, v_uid)
      on conflict (room_id, user_id) do nothing;
    return 'pending';
  end if;
end;
$function$;

-- ── list_club_pending_members: the awaiting-approval queue, president/vp only ──
create or replace function public.list_club_pending_members(p_room_id uuid)
returns table(user_id uuid, username text, display_name text, avatar text, invited_by uuid, created_at timestamptz)
language plpgsql
security definer
stable
set search_path = public
as $function$
begin
  if not exists (select 1 from public.room_members where room_id = p_room_id and user_id = auth.uid() and role in ('president', 'vp')) then
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

-- ── accept_club_pending_member / reject_club_pending_member: president/vp only ──
create or replace function public.accept_club_pending_member(p_room_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_max_members int;
  v_member_count int;
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

  delete from public.club_pending_members where room_id = p_room_id and user_id = p_user_id;
  insert into public.room_members (room_id, user_id, role) values (p_room_id, p_user_id, 'member');
end;
$function$;

create or replace function public.reject_club_pending_member(p_room_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $function$
begin
  if not exists (select 1 from public.room_members where room_id = p_room_id and user_id = auth.uid() and role in ('president', 'vp')) then
    raise exception 'not authorized';
  end if;
  delete from public.club_pending_members where room_id = p_room_id and user_id = p_user_id;
end;
$function$;

-- ── join_club: now awaiting-list aware, and reports back which happened ──
-- Return type changes uuid -> jsonb (room_id + status), so the client can
-- tell "you're in" apart from "you're on the list now" instead of assuming
-- every successful call means instant membership.
create or replace function public.join_club(p_room_id uuid default null::uuid, p_code text default null::text)
returns jsonb
language plpgsql
security definer
set search_path = public
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

  if v_room.is_private and p_code is null then raise exception 'this club is invite-only'; end if;

  if exists (select 1 from public.room_members where room_id = v_room.id and user_id = v_uid) then
    return jsonb_build_object('room_id', v_room.id, 'status', 'joined');
  end if;

  select count(*) into v_member_count from public.room_members where room_id = v_room.id;
  if v_member_count >= v_room.max_members then raise exception 'club is full'; end if;

  if v_room.awaiting_list_enabled then
    insert into public.club_pending_members (room_id, user_id, invited_by)
      values (v_room.id, v_uid, null)
      on conflict (room_id, user_id) do nothing;
    return jsonb_build_object('room_id', v_room.id, 'status', 'pending');
  end if;

  insert into public.room_members (room_id, user_id, role) values (v_room.id, v_uid, 'member');
  return jsonb_build_object('room_id', v_room.id, 'status', 'joined');
end;
$function$;

-- ── update_club_settings: welcome message + awaiting list are now president-or-VP ──
-- Everything else (name, privacy, description, mute) stays president-only.
drop function if exists public.update_club_settings(uuid, text, boolean, text, text, boolean, boolean);

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
set search_path = public
as $function$
declare
  v_uid uuid := auth.uid();
  v_my_role text;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  select role into v_my_role from public.room_members where room_id = p_room_id and user_id = v_uid;

  if (p_name is not null or p_is_private is not null or p_description is not null or p_muted is not null)
     and v_my_role <> 'president' then
    raise exception 'only the president can change club settings';
  end if;

  if (p_welcome_message is not null or p_awaiting_list_enabled is not null)
     and v_my_role not in ('president', 'vp') then
    raise exception 'only the president or vp can change this setting';
  end if;

  if v_my_role is null then raise exception 'not a member of this club'; end if;

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
