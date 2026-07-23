-- 0071_halo_mystery_box_no_diamonds.sql
-- Removes diamonds from the Daily Mystery Box reward pool per user
-- feedback — diamonds were never asked for. Redistributed weight across
-- two XP tiers (small + a rarer "jackpot" tier) instead of collapsing it
-- all into one XP bucket, so opening the box still feels variable.
--
-- New weights: 50% small XP, 20% big XP, 20% nothing, 10% avatar item
-- (previously: 45% diamonds, 30% XP, 15% nothing, 10% avatar item).

-- Drop 'diamonds' from the allowed reward_type values. NOT VALID skips
-- checking pre-existing rows — if any box was already opened with a
-- diamonds reward before this migration, it's left alone rather than
-- failing the migration.
alter table public.daily_mystery_box drop constraint if exists daily_mystery_box_reward_type_check;
alter table public.daily_mystery_box
  add constraint daily_mystery_box_reward_type_check
  check (reward_type in ('xp', 'avatar_item', 'nothing')) not valid;

create or replace function public.open_mystery_box()
returns table(reward_type text, reward_amount int, reward_ref text, line_text text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_today date := (now() at time zone 'utc')::date;
  v_row record;
  v_roll numeric := random();
  v_reward_type text;
  v_reward_amount int := 0;
  v_reward_ref text;
  v_item_id uuid;
  v_line_text text;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select * into v_row from public.daily_mystery_box
    where user_id = v_uid and box_date = v_today
    for update;

  if not found then
    raise exception 'no mystery box for today — call get_or_create_daily_mystery_box() first';
  end if;
  if v_row.opened then
    raise exception 'already opened today';
  end if;

  -- 50% small XP, 20% big XP, 20% nothing, 10% avatar item.
  if v_roll < 0.50 then
    v_reward_type := 'xp';
    v_reward_amount := 10 + floor(random() * 21)::int; -- 10-30
  elsif v_roll < 0.70 then
    v_reward_type := 'xp';
    v_reward_amount := 60 + floor(random() * 41)::int; -- 60-100 ("jackpot" tier)
  elsif v_roll < 0.90 then
    v_reward_type := 'nothing';
    v_reward_amount := 0;
  else
    select mi.id into v_item_id
      from public.mall_items mi
      where mi.is_active
        and not mi.is_pro_locked
        and (mi.price_gems is null or mi.price_gems <= 200)
      order by random()
      limit 1;

    if v_item_id is not null then
      v_reward_type := 'avatar_item';
      v_reward_ref := v_item_id::text;
    else
      -- No eligible mall item found — fall back to the small XP tier
      -- rather than fail the open.
      v_reward_type := 'xp';
      v_reward_amount := 15;
    end if;
  end if;

  if v_reward_type = 'xp' and v_reward_amount > 0 then
    update public.profiles
      set xp = xp + least(v_reward_amount, 20000),
          level = floor((xp + least(v_reward_amount, 20000)) / 1000) + 1
      where id = v_uid;

  elsif v_reward_type = 'avatar_item' and v_item_id is not null then
    update public.user_inventory
      set quantity = quantity + 1
      where user_id = v_uid and item_id = v_item_id;
    if not found then
      insert into public.user_inventory (user_id, item_id, is_equipped, quantity)
        values (v_uid, v_item_id, false, 1);
    end if;
  end if;

  update public.daily_mystery_box
    set opened = true, opened_at = now(),
        reward_type = v_reward_type, reward_amount = v_reward_amount, reward_ref = v_reward_ref
    where user_id = v_uid and box_date = v_today;

  select gnl.text into v_line_text
    from public.get_next_halo_line(
      case when v_reward_type = 'nothing' then 'mystery_box_empty' else 'mystery_box_win' end
    ) as gnl;

  return query select v_reward_type, v_reward_amount, v_reward_ref, v_line_text;
end;
$$;
