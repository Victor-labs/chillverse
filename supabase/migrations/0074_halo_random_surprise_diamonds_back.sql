-- 0074_halo_random_surprise_diamonds_back.sql
-- Random Surprise gets a proper weighted roll instead of a flat XP grant:
--   3%  diamonds (flat 15)
--   78% XP (15-35, same range as the XP-only version from 0073)
--   19% nothing
-- (97% non-diamond split 80/20 XP/nothing, per spec.)

alter table public.random_surprise_claims rename column xp_amount to reward_amount;
alter table public.random_surprise_claims
  add column if not exists reward_type text not null default 'xp'
    check (reward_type in ('diamonds', 'xp', 'nothing'));
alter table public.random_surprise_claims alter column reward_type drop default;

drop function if exists public.claim_random_surprise();

create or replace function public.claim_random_surprise()
returns table(already_claimed boolean, reward_type text, reward_amount int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_today date := (now() at time zone 'utc')::date;
  v_existing record;
  v_roll numeric;
  v_reward_type text;
  v_amount int := 0;
  v_line_text text;
  v_body text;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select * into v_existing from public.random_surprise_claims
    where user_id = v_uid and claim_date = v_today;

  if found then
    return query select true, v_existing.reward_type, v_existing.reward_amount;
    return;
  end if;

  v_roll := random();
  if v_roll < 0.03 then
    v_reward_type := 'diamonds';
    v_amount := 15;
  elsif v_roll < 0.806 then -- 0.03 + 0.97*0.80
    v_reward_type := 'xp';
    v_amount := 15 + floor(random() * 21)::int; -- 15-35
  else
    v_reward_type := 'nothing';
    v_amount := 0;
  end if;

  insert into public.random_surprise_claims (user_id, claim_date, reward_type, reward_amount)
    values (v_uid, v_today, v_reward_type, v_amount)
    on conflict (user_id, claim_date) do nothing;

  if not found then
    -- Raced with another request for this user — re-read what actually won
    -- rather than granting twice.
    select * into v_existing from public.random_surprise_claims
      where user_id = v_uid and claim_date = v_today;
    return query select true, v_existing.reward_type, v_existing.reward_amount;
    return;
  end if;

  if v_reward_type = 'diamonds' then
    insert into public.user_wallets (user_id, gem_balance)
      values (v_uid, v_amount)
      on conflict (user_id) do update
        set gem_balance = public.user_wallets.gem_balance + excluded.gem_balance,
            updated_at = now();
    insert into public.diamond_transactions (user_id, reference, amount, description)
      values (v_uid, 'random_surprise:' || v_today, v_amount, 'Halo random surprise');
    v_body := '+' || v_amount || ' diamonds';

  elsif v_reward_type = 'xp' then
    update public.profiles
      set xp = xp + least(v_amount, 20000),
          level = floor((xp + least(v_amount, 20000)) / 1000) + 1
      where id = v_uid;
    v_body := '+' || v_amount || ' XP';

  else
    v_body := '';
  end if;

  select gnl.text into v_line_text from public.get_next_halo_line('random_surprise') as gnl;

  insert into public.notifications (user_id, type, title, body, icon)
    values (v_uid, 'halo', coalesce(v_line_text, 'Halo left you a surprise.'), v_body, 'sparkles');

  return query select false, v_reward_type, v_amount;
end;
$$;

grant execute on function public.claim_random_surprise() to authenticated;
