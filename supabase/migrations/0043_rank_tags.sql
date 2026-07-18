-- supabase/migrations/0043_rank_tags.sql
-- ════════════════════════════════════════════════════════════════════════
-- Migration 0038 — Rank Tags (block 3 of the chat features spec)
--
-- Lets Staff/Moderator/Admin tag one of the 8 broad rank groups (Rookie,
-- Bronze, Silver, Gold, Platinum, Diamond, Legend, OG — see RANK_GROUPS in
-- src/features/profile/ranks.ts) in Global Chat or a Post. Every user
-- currently in that group gets notified. Global Chat + Posts only, never
-- DMs — enforced below.
--
-- messages.type and posts.post_kind both already exist (migrations 0009,
-- 0007/0028) — this widens their check constraints to add 'rank_tag'
-- rather than adding a parallel column, and adds one new nullable
-- rank_tag_group column to each.
--
-- NOTE on rebuilding the messages insert policy: as of migration 0024 it
-- reads `public.is_room_member(room_id)` — a single-argument call, but
-- is_room_member only exists as a two-argument function
-- (is_room_member(p_room_id, p_user_id), defined in 0008, still its only
-- definition as of this migration). That one-argument call cannot resolve
-- and looks like a latent bug unrelated to this feature. Since this
-- migration has to rebuild that whole policy anyway (to add the rank_tag
-- clause), it corrects that call to the real two-argument signature rather
-- than propagating it — flagging this here since it wasn't something this
-- migration set out to fix.
--
-- KNOWN DUPLICATION, FLAGGING FOR VISIBILITY: xp_in_rank_group() below
-- hardcodes the same XP breakpoints as RANK_TIERS in ranks.ts, since SQL
-- can't import that TS file. If ranks.ts's xpRequired values ever change,
-- this function must be updated to match by hand or notify_rank_tag() will
-- fan out to the wrong set of users.
-- ════════════════════════════════════════════════════════════════════════

-- 1. messages — widen type, add rank_tag_group.
alter table public.messages drop constraint if exists messages_type_check;
alter table public.messages
  add constraint messages_type_check check (type in ('text', 'voice_note', 'call_log', 'rank_tag'));

alter table public.messages add column if not exists rank_tag_group text;
alter table public.messages drop constraint if exists messages_rank_tag_group_check;
alter table public.messages add constraint messages_rank_tag_group_check
  check (rank_tag_group is null or rank_tag_group in
    ('rookie', 'bronze', 'silver', 'gold', 'platinum', 'diamond', 'legend', 'og'));

-- 2. messages RLS — a rank_tag message requires Staff/Mod/Admin AND the
--    room being Global Chat. Everything else here matches the current
--    (0024) policy, banned-user check included, with the is_room_member
--    call corrected to two arguments (see header note).
drop policy if exists "members can send messages" on public.messages;
create policy "members can send messages" on public.messages
  for insert with check (
    auth.uid() = sender_id
    and public.is_room_member(room_id, auth.uid())
    and not public.is_currently_banned(auth.uid())
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

-- 3. posts — widen post_kind, add rank_tag_group. No RLS change needed:
--    the existing "staff can insert staff posts" policy (0028) already
--    requires is_staff(auth.uid()) + author_type in ('admin','system') for
--    every staff post, rank-tag posts included.
alter table public.posts drop constraint if exists posts_post_kind_check;
alter table public.posts add constraint posts_post_kind_check
  check (post_kind in ('general', 'announcement', 'feature_update', 'rank_tag'));

alter table public.posts add column if not exists rank_tag_group text;
alter table public.posts drop constraint if exists posts_rank_tag_group_check;
alter table public.posts add constraint posts_rank_tag_group_check
  check (rank_tag_group is null or rank_tag_group in
    ('rookie', 'bronze', 'silver', 'gold', 'platinum', 'diamond', 'legend', 'og'));

-- 4. xp_in_rank_group() — must mirror ranks.ts's RANK_TIERS xpRequired
--    breakpoints (see header note above).
create or replace function public.xp_in_rank_group(p_xp integer, p_group text)
returns boolean
language sql
immutable
as $$
  select case p_group
    when 'rookie'   then p_xp >= 0      and p_xp < 1500
    when 'bronze'   then p_xp >= 1500   and p_xp < 15000
    when 'silver'   then p_xp >= 15000  and p_xp < 63000
    when 'gold'     then p_xp >= 63000  and p_xp < 165000
    when 'platinum' then p_xp >= 165000 and p_xp < 345000
    when 'diamond'  then p_xp >= 345000 and p_xp < 675000
    when 'legend'   then p_xp >= 675000 and p_xp < 900000
    when 'og'       then p_xp >= 900000
    else false
  end;
$$;

-- 5. notify_rank_tag() — one bulk INSERT for every matching user, not a
--    client-side loop (a popular rank group could be thousands of rows).
--    Caller must already be Staff/Mod/Admin; re-checked here rather than
--    trusting the RLS insert that already happened, since this also fires
--    for Post rank-tags which have no room-based check to lean on.
create or replace function public.notify_rank_tag(
  p_rank_group text, p_sender_id uuid, p_message_id uuid default null, p_post_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or auth.uid() <> p_sender_id or not public.is_staff(p_sender_id) then
    raise exception 'CV_MOD_FORBIDDEN: staff only';
  end if;

  if p_rank_group not in ('rookie', 'bronze', 'silver', 'gold', 'platinum', 'diamond', 'legend', 'og') then
    raise exception 'CV_MOD_BAD_ROLE: invalid rank group';
  end if;

  insert into public.notifications (user_id, type, title, body, icon, meta)
  select
    p.id,
    'rank_tag',
    initcap(p_rank_group) || ' rank tagged',
    case when p_message_id is not null then 'Tagged in Global Chat' else 'Tagged in a post' end,
    'megaphone',
    jsonb_build_object('rank_group', p_rank_group, 'sender_id', p_sender_id, 'message_id', p_message_id, 'post_id', p_post_id)
  from public.profiles p
  where public.xp_in_rank_group(p.xp, p_rank_group)
    and p.id <> p_sender_id;
end;
$$;

revoke execute on function public.xp_in_rank_group(integer, text) from public;
revoke execute on function public.notify_rank_tag(text, uuid, uuid, uuid) from public;

grant execute on function public.xp_in_rank_group(integer, text) to authenticated;
grant execute on function public.notify_rank_tag(text, uuid, uuid, uuid) to authenticated;

notify pgrst, 'reload schema';
