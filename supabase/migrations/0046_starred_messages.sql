-- supabase/migrations/0046_starred_messages.sql
-- ════════════════════════════════════════════════════════════════════════
-- Migration 0041 — Starred messages (block 8 of the chat features spec)
--
-- Private, per-user bookmark list. Works across Global Chat and every DM.
-- Nobody but the starring user can ever see their own starred_messages
-- rows — no staff exception, no notification, nothing moderation-related.
-- A plain "for all using (auth.uid() = user_id)" policy is sufficient
-- (unlike polls/rank tags, there's no cross-user visibility rule to get
-- right here, so a client-side insert/delete is fine — no RPC needed).
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.starred_messages (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  message_id uuid not null references public.messages(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, message_id)
);
create index if not exists starred_messages_user_idx on public.starred_messages (user_id, created_at desc);

alter table public.starred_messages enable row level security;

drop policy if exists "starred messages are private to the starrer" on public.starred_messages;
create policy "starred messages are private to the starrer" on public.starred_messages
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

notify pgrst, 'reload schema';
