-- 0073_halo_random_surprise_no_diamonds.sql
-- Random Surprise Popup was entirely diamond-based (its only mechanic) —
-- converts it to a flat XP grant instead. Column renamed rather than
-- dropped+recreated so the existing per-day claim history isn't lost.

alter table public.random_surprise_claims rename column diamond_amount to xp_amount;

drop function if exists public.claim_random_surprise();

create or replace function public.claim_random_surprise()
returns table(already_claimed boolean, xp_amount int)
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
    return query select true, v_existing.xp_amount;
    return;
  end if;

  v_amount := 15 + floor(random() * 21)::int; -- 15-35

  insert into public.random_surprise_claims (user_id, claim_date, xp_amount)
    values (v_uid, v_today, v_amount)
    on conflict (user_id, claim_date) do nothing;

  if not found then
    select * into v_existing from public.random_surprise_claims
      where user_id = v_uid and claim_date = v_today;
    return query select true, v_existing.xp_amount;
    return;
  end if;

  update public.profiles
    set xp = xp + least(v_amount, 20000),
        level = floor((xp + least(v_amount, 20000)) / 1000) + 1
    where id = v_uid;

  select gnl.text into v_line_text from public.get_next_halo_line('random_surprise') as gnl;

  insert into public.notifications (user_id, type, title, body, icon)
    values (v_uid, 'halo', coalesce(v_line_text, 'Halo left you a surprise.'), '+' || v_amount || ' XP', 'sparkles');

  return query select false, v_amount;
end;
$$;

grant execute on function public.claim_random_surprise() to authenticated;
