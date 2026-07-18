-- supabase/migrations/0042_restrict_pin_to_staff_in_global.sql
-- ════════════════════════════════════════════════════════════════════════
-- Migration 0037 — Restrict Global Chat message pinning to Staff/Mod/Admin
--
-- Pinning a message updates chat_rooms.pinned_message_id. The existing
-- "members can update their room" policy lets ANY room member update it —
-- fine for DMs (unchanged here), but Global Chat has every user as a
-- member, so today anyone can pin/unpin there. This narrows updates on
-- Global Chat rows to Staff/Moderator/Admin; DM rows are untouched.
--
-- Checked against every client call site that updates chat_rooms (the
-- pin/unpin functions in Chat.tsx are the only ones as of this migration)
-- — nothing else writes to this table from the client, so this doesn't
-- affect any other flow. Migrations 0040 (Spotlight/Slow Mode) will add
-- two more staff-only chat_rooms columns and rely on this exact policy.
-- ════════════════════════════════════════════════════════════════════════

drop policy if exists "members can update their room" on public.chat_rooms;
create policy "members can update their room" on public.chat_rooms
  for update using (
    public.is_room_member(id, auth.uid())
    and (type <> 'global' or public.is_staff(auth.uid()))
  );

notify pgrst, 'reload schema';
