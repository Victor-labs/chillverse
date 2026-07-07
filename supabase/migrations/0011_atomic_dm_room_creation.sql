-- supabase/migrations/0011_atomic_dm_room_creation.sql
-- ════════════════════════════════════════════════════════════════════════
-- Migration 0011 — Fixes "can't start a new DM with someone I've never
-- chatted with before" by replacing a fragile client-side flow with one
-- atomic, security-definer RPC.
--
-- THE BUG:
-- startDmWith() in Chat.tsx used to (1) insert the caller's own room_members
-- row, then (2) insert the OTHER person's room_members row as a second,
-- separate request. Step 2 depended on migration 0008's room_members INSERT
-- policy correctly seeing step 1's row as already committed via
-- is_room_member() before allowing step 2 to add someone else. Any hiccup in
-- that ordering — and there was no hard guarantee against one, since these
-- were two independent HTTP requests with only a client-side `await` between
-- them, not one transaction — left the OTHER person never actually added to
-- the room. From the room creator's side, everything looked fine (their own
-- membership succeeded, the optimistic UI opened the conversation); the
-- other person's client would just never see it, since their own
-- `room_members`/`messages` SELECT policies require them to actually be a
-- member. That reproduces exactly as reported: DMs with existing contacts
-- (whose shared room already exists) kept working, brand-new DMs silently
-- didn't reach the other person.
--
-- THE FIX:
-- One SECURITY DEFINER function does the existence-check AND both inserts
-- in a single transaction, so there is no multi-request window for one side
-- to succeed without the other. The old permissive "insert someone else into
-- a dm you're already in" branch of the room_members INSERT policy is
-- removed — nothing needs it anymore, since this function does that step
-- with elevated privilege instead of relying on the client's own RLS grant.
-- ════════════════════════════════════════════════════════════════════════

create or replace function public.get_or_create_dm_room(p_other_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room_id uuid;
begin
  if p_other_user_id is null then
    raise exception 'p_other_user_id is required';
  end if;
  if p_other_user_id = auth.uid() then
    raise exception 'Cannot start a DM with yourself';
  end if;
  if not exists (select 1 from public.profiles where id = p_other_user_id) then
    raise exception 'Target user does not exist';
  end if;

  -- Does a DM room already exist with exactly this other person?
  select rm1.room_id into v_room_id
  from public.room_members rm1
  join public.room_members rm2 on rm2.room_id = rm1.room_id
  join public.chat_rooms cr on cr.id = rm1.room_id
  where rm1.user_id = auth.uid()
    and rm2.user_id = p_other_user_id
    and cr.type = 'dm'
  limit 1;

  if v_room_id is not null then
    -- Re-opening an existing DM: if I'd previously "deleted" (hidden) it,
    -- un-hide it now that I'm actively re-entering the conversation — same
    -- behavior the old client-side code had for this case.
    update public.room_members set hidden_at = null
      where room_id = v_room_id and user_id = auth.uid();
    return v_room_id;
  end if;

  -- No existing DM — create the room and add both members atomically.
  insert into public.chat_rooms (type) values ('dm') returning id into v_room_id;
  insert into public.room_members (room_id, user_id) values (v_room_id, auth.uid());
  insert into public.room_members (room_id, user_id) values (v_room_id, p_other_user_id);

  return v_room_id;
end;
$$;

grant execute on function public.get_or_create_dm_room(uuid) to authenticated;

-- The client no longer needs to insert a second person's room_members row
-- directly — get_or_create_dm_room() does that with elevated privilege.
-- Tightening this removes the exact mechanism that was failing: a user can
-- now only ever insert their OWN membership row via the direct table API.
drop policy if exists "users can join rooms or invite into a dm they made" on public.room_members;
drop policy if exists "users can join a room for themselves" on public.room_members;
create policy "users can join a room for themselves" on public.room_members
  for insert with check (auth.uid() = user_id);
