-- supabase/migrations/0009_calls_and_voice_notes.sql
-- ════════════════════════════════════════════════════════════════════════
-- Migration 0009 — Voice/video calling + voice notes
--
-- Adds:
--   • public.calls              — one row per call attempt; drives the ringing
--                                  UI via realtime INSERT, and call state (accepted/
--                                  declined/ended/missed) via realtime UPDATE. The
--                                  actual WebRTC signaling (SDP/ICE) is NOT stored
--                                  here — it's exchanged ephemerally over a Realtime
--                                  Broadcast channel scoped to the call id, since it's
--                                  high-frequency and has no reason to be persisted.
--   • messages.type              — 'text' (default, existing behavior) | 'voice_note'
--     messages.audio_path        |  'call_log'
--     messages.audio_duration_seconds
--     messages.call_id           — links a 'call_log' message back to its calls row
--   • storage bucket "voice-notes" (private) + RLS scoped to room membership,
--     mirroring the same is_room_member() check messages/reactions already use.
--
-- Depends on migration 0008 (public.is_room_member, public.chat_rooms,
-- public.room_members, public.messages). Safe to re-run.
-- ════════════════════════════════════════════════════════════════════════

-- ── 1. calls ───────────────────────────────────────────────────────────
create table if not exists public.calls (
  id          uuid primary key default gen_random_uuid(),
  room_id     uuid not null references public.chat_rooms(id) on delete cascade,
  caller_id   uuid not null references public.profiles(id) on delete cascade,
  callee_id   uuid not null references public.profiles(id) on delete cascade,
  type        text not null check (type in ('audio', 'video')),
  status      text not null default 'ringing'
                check (status in ('ringing', 'accepted', 'declined', 'missed', 'ended', 'canceled')),
  started_at  timestamptz, -- set when status -> 'accepted'
  ended_at    timestamptz, -- set when status -> a terminal state
  created_at  timestamptz not null default now(),
  constraint calls_no_self_call check (caller_id <> callee_id)
);
create index if not exists calls_callee_idx on public.calls (callee_id, created_at desc);
create index if not exists calls_caller_idx on public.calls (caller_id, created_at desc);
create index if not exists calls_room_idx on public.calls (room_id, created_at desc);

alter table public.calls enable row level security;

drop policy if exists "calls visible to caller and callee" on public.calls;
create policy "calls visible to caller and callee" on public.calls
  for select using (auth.uid() = caller_id or auth.uid() = callee_id);

-- Only the caller can start a call, and only into a DM they're actually in with
-- the person they're calling — prevents dialing someone through a room you're
-- not a member of, or impersonating a call from another user.
drop policy if exists "caller can start a call" on public.calls;
create policy "caller can start a call" on public.calls
  for insert with check (
    auth.uid() = caller_id
    and public.is_room_member(room_id, auth.uid())
    and public.is_room_member(room_id, callee_id)
  );

-- Either party can update status (callee accepts/declines, either side ends).
drop policy if exists "caller or callee can update call state" on public.calls;
create policy "caller or callee can update call state" on public.calls
  for update using (auth.uid() = caller_id or auth.uid() = callee_id)
  with check (auth.uid() = caller_id or auth.uid() = callee_id);

do $$
begin
  alter publication supabase_realtime add table public.calls;
exception when duplicate_object then null;
end $$;

-- ── 2. messages: voice notes + call log entries ─────────────────────────
alter table public.messages
  add column if not exists type text not null default 'text'
    check (type in ('text', 'voice_note', 'call_log')),
  add column if not exists audio_path text,
  add column if not exists audio_duration_seconds integer,
  add column if not exists call_id uuid references public.calls(id) on delete set null;

create index if not exists messages_call_id_idx on public.messages (call_id) where call_id is not null;

-- ── 3. storage: voice-notes bucket ──────────────────────────────────────
-- Private bucket — playback goes through a short-lived signed URL generated
-- client-side (see voiceNoteStorage.ts), not a public link, consistent with
-- messages/reactions only being readable by room members.
insert into storage.buckets (id, name, public)
values ('voice-notes', 'voice-notes', false)
on conflict (id) do nothing;

-- Object path convention enforced by the client: `<room_id>/<message_id>.webm`.
-- storage.foldername(name) splits the path into an array of directory parts,
-- so (storage.foldername(name))[1] is the room_id segment.
drop policy if exists "voice notes visible to room members" on storage.objects;
create policy "voice notes visible to room members" on storage.objects
  for select using (
    bucket_id = 'voice-notes'
    and public.is_room_member((storage.foldername(name))[1]::uuid, auth.uid())
  );

drop policy if exists "room members can upload voice notes" on storage.objects;
create policy "room members can upload voice notes" on storage.objects
  for insert with check (
    bucket_id = 'voice-notes'
    and public.is_room_member((storage.foldername(name))[1]::uuid, auth.uid())
  );

drop policy if exists "senders can delete their own voice notes" on storage.objects;
create policy "senders can delete their own voice notes" on storage.objects
  for delete using (
    bucket_id = 'voice-notes'
    and owner = auth.uid()
  );
