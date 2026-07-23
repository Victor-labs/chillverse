-- 0069_halo_random_surprise.sql
-- Random Surprise Popup (plan §4.6). One flat diamond grant per user per
-- UTC day, triggered by a client-side randomized 30-60min timer
-- (useRandomSurprise.ts) while the tab is visible. The per-day cap lives
-- here in SQL, not on the client, so multiple tabs/reloads/timer drift
-- can't farm more than one grant a day.
--
-- No separate toast component needed: this function inserts the
-- notification itself (only on a real grant), and the existing realtime
-- toast pipeline from Group 1 (useNotificationToast.ts /
-- NotificationToastRenderer, 'halo' type) picks it up automatically.

create table if not exists public.random_surprise_claims (
  user_id uuid not null references public.profiles(id) on delete cascade,
  claim_date date not null default current_date,
  diamond_amount int not null,
  claimed_at timestamptz not null default now(),
  primary key (user_id, claim_date)
);

alter table public.random_surprise_claims enable row level security;

drop policy if exists "Players can read own random surprise claims" on public.random_surprise_claims;
create policy "Players can read own random surprise claims" on public.random_surprise_claims
  for select
  to authenticated
  using (auth.uid() = user_id);
-- No insert/update policy — writes happen only inside claim_random_surprise().

create or replace function public.claim_random_surprise()
returns table(already_claimed boolean, diamond_amount int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_today date := (now() at time zone 'utc')::date;
  v_existing record;
  v_amount int;
  v_line_text text;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select * into v_existing from public.random_surprise_claims
    where user_id = v_uid and claim_date = v_today;

  if found then
    return query select true, v_existing.diamond_amount;
    return;
  end if;

  v_amount := 10 + floor(random() * 16)::int; -- 10-25

  insert into public.random_surprise_claims (user_id, claim_date, diamond_amount)
    values (v_uid, v_today, v_amount)
    on conflict (user_id, claim_date) do nothing;

  if not found then
    -- Another request for this user raced us between the SELECT and this
    -- INSERT and won — re-read what it actually claimed rather than
    -- granting twice.
    select * into v_existing from public.random_surprise_claims
      where user_id = v_uid and claim_date = v_today;
    return query select true, v_existing.diamond_amount;
    return;
  end if;

  insert into public.user_wallets (user_id, gem_balance)
    values (v_uid, v_amount)
    on conflict (user_id) do update
      set gem_balance = public.user_wallets.gem_balance + excluded.gem_balance,
          updated_at = now();
  insert into public.diamond_transactions (user_id, reference, amount, description)
    values (v_uid, 'random_surprise:' || v_today, v_amount, 'Halo random surprise');

  select gnl.text into v_line_text from public.get_next_halo_line('random_surprise') as gnl;

  insert into public.notifications (user_id, type, title, body, icon)
    values (v_uid, 'halo', coalesce(v_line_text, 'Halo left you a surprise.'), '+' || v_amount || ' diamonds', 'sparkles');

  return query select false, v_amount;
end;
$$;

grant execute on function public.claim_random_surprise() to authenticated;
