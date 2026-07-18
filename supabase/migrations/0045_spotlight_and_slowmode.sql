-- supabase/migrations/0045_spotlight_and_slowmode.sql
-- ════════════════════════════════════════════════════════════════════════
-- Migration 0040 — Spotlight + Slow Mode (block 5 of the chat features spec)
--
-- Both are Global Chat only, Staff/Moderator/Admin only, and both are just
-- new columns on chat_rooms updated the same way pinned_message_id already
-- is (see pinMessage()/unpinMessage() in Chat.tsx) — so no new RPC is
-- needed here. Migration 0037's "members can update their room" policy
-- already requires is_staff(auth.uid()) for any update to a type='global'
-- row, which covers these new columns for free.
--
-- DESIGN NOTE, flagging for visibility rather than silently gold-plating:
-- that same policy still lets any member of a *DM* update arbitrary columns
-- on their own DM row (unchanged pre-existing behavior, not something this
-- migration touches) — so a client could technically write junk into
-- spotlight_message_id/slow_mode on their own DM's row. That's self-
-- inflicted only (no privilege over anyone else, and the UI never exposes
-- either feature for DMs), and matches this table's existing risk profile
-- from before this migration, so it isn't hardened further here.
-- ════════════════════════════════════════════════════════════════════════

alter table public.chat_rooms add column if not exists spotlight_message_id uuid references public.messages(id);
alter table public.chat_rooms add column if not exists spotlight_expires_at timestamptz;

alter table public.chat_rooms add column if not exists slow_mode boolean not null default false;
alter table public.chat_rooms add column if not exists slow_mode_seconds integer not null default 10;
alter table public.chat_rooms drop constraint if exists chat_rooms_slow_mode_seconds_check;
alter table public.chat_rooms add constraint chat_rooms_slow_mode_seconds_check check (slow_mode_seconds in (10, 20, 30));

-- Slow Mode enforcement — Staff/Moderator/Admin are exempt (they shouldn't
-- be throttled while actively moderating a room they just slowed down).
-- Rebuilds the messages insert policy from its current (0039) state, adding
-- one more AND clause.
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
    and (
      public.is_staff(auth.uid())
      or not exists (
        select 1 from public.chat_rooms cr
        where cr.id = messages.room_id
          and cr.slow_mode
          and exists (
            select 1 from public.messages m2
            where m2.room_id = messages.room_id
              and m2.sender_id = auth.uid()
              and m2.created_at > now() - (cr.slow_mode_seconds || ' seconds')::interval
          )
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

notify pgrst, 'reload schema';
