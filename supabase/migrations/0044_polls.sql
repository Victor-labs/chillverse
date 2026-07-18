-- supabase/migrations/0044_polls.sql
-- ════════════════════════════════════════════════════════════════════════
-- Migration 0039 — Polls (block 4 of the chat features spec)
--
-- Global Chat only (not DMs). Creatable by Verified users (max 48h) and
-- Staff/Moderator/Admin (max 168h/7 days) — no one else. Single- or
-- multi-choice, creator's choice. Optional "hide results" toggle: while on
-- and the poll is still open, regular voters only ever see their own
-- vote via RLS (poll_votes rows besides their own are invisible to them);
-- Staff/Moderator/Admin can always see everything, and results become
-- visible to everyone once the poll closes.
--
-- Every mutation (create/vote/end) goes through a SECURITY DEFINER RPC,
-- not a client-side table insert — so polls/poll_options/poll_votes get
-- SELECT-only RLS policies below and no insert/update/delete policy at
-- all, avoiding validation logic duplicated between RLS and the RPCs.
-- ════════════════════════════════════════════════════════════════════════

-- 1. Schema.
create table if not exists public.polls (
  id            uuid primary key default gen_random_uuid(),
  room_id       uuid not null references public.chat_rooms(id) on delete cascade,
  creator_id    uuid not null references public.profiles(id),
  question      text not null check (length(question) between 1 and 300),
  vote_mode     text not null check (vote_mode in ('single', 'multi')),
  hide_results  boolean not null default false,
  closes_at     timestamptz not null,
  closed_at     timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists polls_room_idx on public.polls (room_id);

create table if not exists public.poll_options (
  id       uuid primary key default gen_random_uuid(),
  poll_id  uuid not null references public.polls(id) on delete cascade,
  label    text not null check (length(label) between 1 and 80),
  position smallint not null
);
create index if not exists poll_options_poll_idx on public.poll_options (poll_id);

-- room_id is denormalized here (rather than joined through polls) purely so
-- the client can filter this table's realtime subscription by room, the
-- same convention message_reactions already uses (see 0008).
create table if not exists public.poll_votes (
  poll_id    uuid not null references public.polls(id) on delete cascade,
  option_id  uuid not null references public.poll_options(id) on delete cascade,
  user_id    uuid not null references public.profiles(id),
  room_id    uuid not null references public.chat_rooms(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (poll_id, option_id, user_id)
);
create index if not exists poll_votes_poll_idx on public.poll_votes (poll_id);
create index if not exists poll_votes_user_idx on public.poll_votes (user_id);

alter table public.messages add column if not exists poll_id uuid references public.polls(id);

alter table public.messages drop constraint if exists messages_type_check;
alter table public.messages
  add constraint messages_type_check check (type in ('text', 'voice_note', 'call_log', 'rank_tag', 'poll'));

-- 2. messages RLS — a plain client insert can never create a poll message
--    (type = 'poll' is always rejected here); create_poll() below is the
--    only path, and it bypasses RLS as a SECURITY DEFINER function. This
--    rebuilds the policy from its current (0038) state, adding one clause.
drop policy if exists "members can send messages" on public.messages;
create policy "members can send messages" on public.messages
  for insert with check (
    auth.uid() = sender_id
    and public.is_room_member(room_id, auth.uid())
    and not public.is_currently_banned(auth.uid())
    and type <> 'poll'
    and (
      type <> 'rank_tag'
      or (
        public.is_staff(auth.uid())
        and exists (select 1 from public.chat_rooms cr where cr.id = messages.room_id and cr.type = 'global')
      )
    )
    and not exists (
      select 1
      from public.room_members rm
      join public.chat_rooms cr on cr.id = rm.room_id
      join public.blocks b
        on (b.blocker_id = rm.user_id and b.blocked_id = auth.uid())
        or (b.blocker_id = auth.uid() and b.blocked_id = rm.user_id)
      where rm.room_id = messages.room_id
        and rm.user_id <> auth.uid()
        and cr.type = 'dm'
    )
  );

-- 3. RLS — read-only for clients; every write happens in the RPCs below.
alter table public.polls enable row level security;
alter table public.poll_options enable row level security;
alter table public.poll_votes enable row level security;

drop policy if exists "polls visible to room members" on public.polls;
create policy "polls visible to room members" on public.polls
  for select using (public.is_room_member(room_id, auth.uid()));

drop policy if exists "poll options visible to room members" on public.poll_options;
create policy "poll options visible to room members" on public.poll_options
  for select using (
    exists (select 1 from public.polls p where p.id = poll_options.poll_id and public.is_room_member(p.room_id, auth.uid()))
  );

-- Own vote always visible (so the UI can show "you voted for X"); everyone's
-- votes visible once results aren't hidden or the poll has closed; Staff/
-- Moderator/Admin can always see everyone's, even mid-poll with hide_results on.
drop policy if exists "poll votes visible per hide_results rule" on public.poll_votes;
create policy "poll votes visible per hide_results rule" on public.poll_votes
  for select using (
    public.is_room_member(room_id, auth.uid())
    and (
      user_id = auth.uid()
      or public.is_staff(auth.uid())
      or exists (select 1 from public.polls p where p.id = poll_votes.poll_id and (not p.hide_results or p.closed_at is not null))
    )
  );

-- 4. create_poll() — validates eligibility + duration cap by role, then
--    inserts poll + options + the poll's own chat message in one
--    transaction. Returns the new message's id (the client re-fetches the
--    poll/options/message by that id, same shape as a normal send).
create or replace function public.create_poll(
  p_room_id uuid, p_question text, p_options text[], p_vote_mode text,
  p_duration_hours integer, p_hide_results boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_is_staff boolean;
  v_is_verified boolean;
  v_max_hours integer;
  v_poll_id uuid;
  v_message_id uuid;
  v_option text;
  v_pos smallint := 0;
  v_option_count integer := coalesce(array_length(p_options, 1), 0);
begin
  if v_caller is null then
    raise exception 'CV_MOD_FORBIDDEN: not authenticated';
  end if;

  select coalesce(role in ('staff', 'moderator', 'admin'), false), coalesce(is_verified, false)
    into v_is_staff, v_is_verified
    from public.user_moderation where user_id = v_caller;
  v_is_staff := coalesce(v_is_staff, false);
  v_is_verified := coalesce(v_is_verified, false);

  if not v_is_staff and not v_is_verified then
    raise exception 'CV_MOD_FORBIDDEN: polls require Verified status or Staff/Moderator/Admin';
  end if;

  if not exists (select 1 from public.chat_rooms where id = p_room_id and type = 'global') then
    raise exception 'CV_MOD_BAD_ROLE: polls can only be created in Global Chat';
  end if;

  v_max_hours := case when v_is_staff then 168 else 48 end;
  if p_duration_hours < 24 or p_duration_hours > v_max_hours then
    raise exception 'CV_MOD_BAD_ROLE: duration must be between 24 and % hours for your role', v_max_hours;
  end if;

  if p_vote_mode not in ('single', 'multi') then
    raise exception 'CV_MOD_BAD_ROLE: invalid vote mode';
  end if;

  if v_option_count < 2 or v_option_count > 10 then
    raise exception 'CV_MOD_BAD_ROLE: a poll needs between 2 and 10 options';
  end if;

  insert into public.polls (room_id, creator_id, question, vote_mode, hide_results, closes_at)
    values (p_room_id, v_caller, trim(p_question), p_vote_mode, coalesce(p_hide_results, false), now() + (p_duration_hours || ' hours')::interval)
    returning id into v_poll_id;

  foreach v_option in array p_options loop
    insert into public.poll_options (poll_id, label, position) values (v_poll_id, trim(v_option), v_pos);
    v_pos := v_pos + 1;
  end loop;

  -- Insert last: any content-safety trigger on messages fires on this
  -- insert same as any normal message, and any exception here rolls back
  -- the poll + options above too, since this whole function runs in one
  -- transaction. As of 0031, violating content is inserted-then-hidden
  -- rather than rejected, so this will normally still succeed either way.
  insert into public.messages (room_id, sender_id, content, type, poll_id)
    values (p_room_id, v_caller, trim(p_question), 'poll', v_poll_id)
    returning id into v_message_id;

  return v_message_id;
end;
$$;

-- 5. vote_poll() — replaces the caller's prior vote(s) for this poll with
--    the new selection, which handles both single- and multi-choice with
--    one code path (single just always submits exactly one option id).
create or replace function public.vote_poll(p_poll_id uuid, p_option_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_room_id uuid;
  v_vote_mode text;
  v_closes_at timestamptz;
  v_closed_at timestamptz;
  v_option_count integer := coalesce(array_length(p_option_ids, 1), 0);
  v_valid_count integer;
begin
  if v_caller is null then
    raise exception 'CV_MOD_FORBIDDEN: not authenticated';
  end if;

  select room_id, vote_mode, closes_at, closed_at into v_room_id, v_vote_mode, v_closes_at, v_closed_at
    from public.polls where id = p_poll_id;
  if v_room_id is null then
    raise exception 'CV_MOD_NOT_FOUND: poll not found';
  end if;

  if not public.is_room_member(v_room_id, v_caller) then
    raise exception 'CV_MOD_FORBIDDEN: not a member of this room';
  end if;

  if v_closed_at is not null or now() > v_closes_at then
    raise exception 'CV_MOD_BAD_ROLE: this poll has closed';
  end if;

  if v_option_count = 0 then
    raise exception 'CV_MOD_BAD_ROLE: pick at least one option';
  end if;

  if v_vote_mode = 'single' and v_option_count > 1 then
    raise exception 'CV_MOD_BAD_ROLE: this poll only allows one choice';
  end if;

  select count(*) into v_valid_count from public.poll_options where poll_id = p_poll_id and id = any(p_option_ids);
  if v_valid_count <> v_option_count then
    raise exception 'CV_MOD_NOT_FOUND: invalid option for this poll';
  end if;

  delete from public.poll_votes where poll_id = p_poll_id and user_id = v_caller;
  insert into public.poll_votes (poll_id, option_id, user_id, room_id)
    select p_poll_id, oid, v_caller, v_room_id from unnest(p_option_ids) as oid;
end;
$$;

-- 6. end_poll() — poll creator, or any Staff/Moderator/Admin, can close a
--    poll early. Idempotent (closed_at only set the first time).
create or replace function public.end_poll(p_poll_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_creator uuid;
begin
  if v_caller is null then
    raise exception 'CV_MOD_FORBIDDEN: not authenticated';
  end if;

  select creator_id into v_creator from public.polls where id = p_poll_id;
  if v_creator is null then
    raise exception 'CV_MOD_NOT_FOUND: poll not found';
  end if;

  if v_creator <> v_caller and not public.is_staff(v_caller) then
    raise exception 'CV_MOD_FORBIDDEN: only the poll creator or staff can end this poll';
  end if;

  update public.polls set closed_at = now() where id = p_poll_id and closed_at is null;
end;
$$;

revoke execute on function public.create_poll(uuid, text, text[], text, integer, boolean) from public;
revoke execute on function public.vote_poll(uuid, uuid[]) from public;
revoke execute on function public.end_poll(uuid) from public;

grant execute on function public.create_poll(uuid, text, text[], text, integer, boolean) to authenticated;
grant execute on function public.vote_poll(uuid, uuid[]) to authenticated;
grant execute on function public.end_poll(uuid) to authenticated;

-- 7. Realtime — live vote-count updates and closed/live status changes.
do $$
begin
  alter publication supabase_realtime add table public.poll_votes;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.polls;
exception when duplicate_object then null;
end $$;

notify pgrst, 'reload schema';
