-- supabase/migrations/0008_chat_and_social_schema.sql
-- ════════════════════════════════════════════════════════════════════════
-- Migration 0008 — Chat + social-graph schema (CRITICAL — previously missing)
--
-- src/features/chat/Chat.tsx (and several profile/post features) query
-- `chat_rooms`, `room_members`, `messages`, `message_reactions`, `blocks`,
-- and `follows` — none of which were ever defined in schema.sql or any
-- prior migration. On a fresh Supabase project the entire chat feature
-- throws on every query. This migration creates them from scratch with
-- production RLS (comments below explain why each policy exists).
--
-- Also adds:
--   • room_members.last_read_at   — powers real read receipts (sent/read ticks)
--   • profiles.last_seen_at       — "last seen" fallback when a DM partner is offline
--   • message_reactions.room_id   — denormalized so realtime reaction sync can
--                                    filter server-side by room instead of the
--                                    client silently receiving every reaction in
--                                    the database over the wire
--
-- Safe to re-run — every statement is idempotent (IF EXISTS / OR REPLACE /
-- DROP POLICY IF EXISTS / ON CONFLICT).
-- ════════════════════════════════════════════════════════════════════════

-- ── 1. follows ─────────────────────────────────────────────────────────
-- Used throughout the app (Profile, PlayerProfile, FollowButton, Composer,
-- posts.ts, achievements.ts, Chat.tsx) but never had a table definition.
create table if not exists public.follows (
  follower_id  uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (follower_id, following_id),
  constraint follows_no_self check (follower_id <> following_id)
);
create index if not exists follows_following_idx on public.follows (following_id);

alter table public.follows enable row level security;

drop policy if exists "follows are publicly readable" on public.follows;
create policy "follows are publicly readable" on public.follows
  for select using (true);

drop policy if exists "users manage their own follows" on public.follows;
create policy "users manage their own follows" on public.follows
  for all using (auth.uid() = follower_id) with check (auth.uid() = follower_id);

-- ── 2. blocks ──────────────────────────────────────────────────────────
create table if not exists public.blocks (
  blocker_id  uuid not null references public.profiles(id) on delete cascade,
  blocked_id  uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint blocks_no_self check (blocker_id <> blocked_id)
);

alter table public.blocks enable row level security;

-- A user needs to see rows where THEY are the blocked party too (Chat.tsx's DM
-- open-room check queries `blocked_id = auth.uid()` to detect "they blocked me").
drop policy if exists "users can see block rows involving them" on public.blocks;
create policy "users can see block rows involving them" on public.blocks
  for select using (auth.uid() = blocker_id or auth.uid() = blocked_id);

drop policy if exists "users manage blocks they issued" on public.blocks;
create policy "users manage blocks they issued" on public.blocks
  for insert with check (auth.uid() = blocker_id);

drop policy if exists "users can remove blocks they issued" on public.blocks;
create policy "users can remove blocks they issued" on public.blocks
  for delete using (auth.uid() = blocker_id);

-- ── 3. chat_rooms ──────────────────────────────────────────────────────
create table if not exists public.chat_rooms (
  id                 uuid primary key default gen_random_uuid(),
  type               text not null check (type in ('global', 'dm')),
  name               text,
  pinned_message_id  uuid,
  created_at         timestamptz not null default now()
);

-- Only one 'global' room should ever exist — ensureGlobalRoom() in Chat.tsx
-- already has client-side race handling, but this makes it impossible at
-- the database level regardless of client behavior.
create unique index if not exists chat_rooms_single_global_idx
  on public.chat_rooms ((type)) where type = 'global';

alter table public.chat_rooms enable row level security;

-- ── 4. room_members ────────────────────────────────────────────────────
create table if not exists public.room_members (
  room_id      uuid not null references public.chat_rooms(id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  pinned       boolean not null default false,
  cleared_at   timestamptz,
  hidden_at    timestamptz,
  last_read_at timestamptz not null default now(),
  joined_at    timestamptz not null default now(),
  primary key (room_id, user_id)
);
create index if not exists room_members_user_idx on public.room_members (user_id);
create index if not exists room_members_room_idx on public.room_members (room_id);

alter table public.room_members enable row level security;

-- Helper used by every policy below. A plain "select 1 from room_members
-- where room_id = ... and user_id = auth.uid()" INSIDE a room_members policy
-- would recurse infinitely; wrapping it in a SECURITY DEFINER function
-- breaks that recursion cleanly and is the standard Supabase pattern for
-- "is this user a member of this room" checks reused across tables.
create or replace function public.is_room_member(p_room_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.room_members
    where room_id = p_room_id and user_id = p_user_id
  );
$$;

-- chat_rooms policies (defined here since they depend on is_room_member) ──
drop policy if exists "chat_rooms visible to members" on public.chat_rooms;
create policy "chat_rooms visible to members" on public.chat_rooms
  for select using (type = 'global' or public.is_room_member(id, auth.uid()));

drop policy if exists "authenticated users can create rooms" on public.chat_rooms;
create policy "authenticated users can create rooms" on public.chat_rooms
  for insert with check (auth.uid() is not null);

-- Needed for: pin/unpin message (pinned_message_id), and nothing else — name/type
-- are never updated by the client.
drop policy if exists "members can update their room" on public.chat_rooms;
create policy "members can update their room" on public.chat_rooms
  for update using (public.is_room_member(id, auth.uid()));

-- room_members policies ──────────────────────────────────────────────
drop policy if exists "room_members visible to fellow members" on public.room_members;
create policy "room_members visible to fellow members" on public.room_members
  for select using (public.is_room_member(room_id, auth.uid()));

-- Two cases the client needs, both covered here:
--  (a) inserting YOUR OWN membership row (joining Global Chat, or the first
--      row of a brand-new DM you're creating) — always allowed.
--  (b) inserting a SECOND row for someone else into a DM you just created —
--      only allowed if the room is a 'dm' and you are already a member of
--      it (true immediately after case (a) ran for the same room).
drop policy if exists "users can join rooms or invite into a dm they made" on public.room_members;
create policy "users can join rooms or invite into a dm they made" on public.room_members
  for insert with check (
    auth.uid() = user_id
    or (
      exists (select 1 from public.chat_rooms r where r.id = room_id and r.type = 'dm')
      and public.is_room_member(room_id, auth.uid())
    )
  );

-- Covers pin/unpin-chat, clear-chat, delete-chat (hidden_at), and marking a
-- room as read (last_read_at) — all of which only ever touch your own row.
drop policy if exists "users manage their own membership row" on public.room_members;
create policy "users manage their own membership row" on public.room_members
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── 5. messages ────────────────────────────────────────────────────────
create table if not exists public.messages (
  id           uuid primary key default gen_random_uuid(),
  room_id      uuid not null references public.chat_rooms(id) on delete cascade,
  sender_id    uuid references public.profiles(id) on delete set null,
  content      text not null check (char_length(content) between 1 and 2000),
  reply_to_id  uuid references public.messages(id) on delete set null,
  deleted      boolean not null default false,
  created_at   timestamptz not null default now()
);
create index if not exists messages_room_created_idx on public.messages (room_id, created_at desc);

alter table public.messages enable row level security;

-- This is the policy that makes Realtime safe: postgres_changes payloads are
-- filtered through each connected client's SELECT policy, so without this,
-- EVERY authenticated client would receive EVERY message in the database
-- over the websocket the moment it's inserted — including private DM
-- content between two other users — regardless of what the UI chooses to
-- render. Restricting SELECT to room members closes that leak at the source.
drop policy if exists "messages visible to room members" on public.messages;
create policy "messages visible to room members" on public.messages
  for select using (public.is_room_member(room_id, auth.uid()));

-- Enforces blocking server-side (the client-side checks in Chat.tsx are UX
-- only and can be bypassed by anyone calling the API directly). Scoped to
-- 'dm' rooms specifically — Global Chat has every user as a member, so an
-- unscoped block check here would silently prevent you from posting to
-- Global Chat entirely the moment you'd blocked anyone, anywhere.
drop policy if exists "members can send messages" on public.messages;
create policy "members can send messages" on public.messages
  for insert with check (
    auth.uid() = sender_id
    and public.is_room_member(room_id, auth.uid())
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

-- Soft-delete only (deleteMsg() sets deleted = true, never issues a hard DELETE).
drop policy if exists "senders can edit their own messages" on public.messages;
create policy "senders can edit their own messages" on public.messages
  for update using (auth.uid() = sender_id) with check (auth.uid() = sender_id);

-- ── 6. message_reactions ───────────────────────────────────────────────
create table if not exists public.message_reactions (
  message_id  uuid not null references public.messages(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  room_id     uuid not null references public.chat_rooms(id) on delete cascade,
  emoji       text not null,
  created_at  timestamptz not null default now(),
  primary key (message_id, user_id)
);
create index if not exists message_reactions_room_idx on public.message_reactions (room_id);

-- room_id is denormalized purely so the client's realtime subscription can
-- filter with `room_id=eq.<id>` server-side instead of subscribing to every
-- reaction in the database and filtering client-side.
create or replace function public.set_reaction_room_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select room_id into new.room_id from public.messages where id = new.message_id;
  return new;
end;
$$;

drop trigger if exists trg_set_reaction_room_id on public.message_reactions;
create trigger trg_set_reaction_room_id
  before insert on public.message_reactions
  for each row execute function public.set_reaction_room_id();

alter table public.message_reactions enable row level security;

drop policy if exists "reactions visible to room members" on public.message_reactions;
create policy "reactions visible to room members" on public.message_reactions
  for select using (public.is_room_member(room_id, auth.uid()));

drop policy if exists "members can react" on public.message_reactions;
create policy "members can react" on public.message_reactions
  for insert with check (auth.uid() = user_id and public.is_room_member(room_id, auth.uid()));

drop policy if exists "users remove their own reactions" on public.message_reactions;
create policy "users remove their own reactions" on public.message_reactions
  for delete using (auth.uid() = user_id);

-- ── 7. presence: last-seen fallback for offline DM partners ────────────
alter table public.profiles
  add column if not exists last_seen_at timestamptz default now();

-- ── 8. Realtime — required for Chat.tsx's live message/reaction/pin/read sync ──
do $$
begin
  alter publication supabase_realtime add table public.messages;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.chat_rooms;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.message_reactions;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.room_members;
exception when duplicate_object then null;
end $$;
