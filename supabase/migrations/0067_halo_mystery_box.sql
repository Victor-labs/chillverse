-- 0067_halo_mystery_box.sql
-- Daily Mystery Box (plan §2, §4.1). Reward is rolled and granted entirely
-- server-side — same wallet/XP grant patterns as record_mission_progress
-- (migration 0053): direct UPDATE/UPSERT inside a SECURITY DEFINER
-- function, diamond_transactions ledger entry, no client write path to
-- user_wallets or profiles.xp.
--
-- SCOPING NOTE: the plan's weighted table includes a 2% "rare badge" tier.
-- No dedicated mystery-box badge exists in the badges catalog yet (checked
-- migrations 0026/0032/0033 — nothing thematically fitting), and inventing
-- a badge id here would either silently break `open_mystery_box()` or grant
-- a badge that doesn't render correctly client-side. That 2% has been
-- folded into the avatar-item tier below (now 10%) instead. Swap in a real
-- badge_id once one exists — the open_mystery_box() CASE below is the only
-- place that needs to change.

create table if not exists public.daily_mystery_box (
  user_id uuid not null references public.profiles(id) on delete cascade,
  box_date date not null default current_date,
  opened boolean not null default false,
  reward_type text check (reward_type in ('diamonds', 'xp', 'avatar_item', 'nothing')),
  reward_amount int,
  reward_ref text, -- mall_items.id (as text) when reward_type = 'avatar_item'
  opened_at timestamptz,
  primary key (user_id, box_date)
);

alter table public.daily_mystery_box enable row level security;

drop policy if exists "Players can read own mystery box" on public.daily_mystery_box;
create policy "Players can read own mystery box" on public.daily_mystery_box
  for select
  to authenticated
  using (auth.uid() = user_id);
-- No insert/update policy — writes happen only inside the two RPCs below.

-- ── get_or_create_daily_mystery_box() ────────────────────────────────────
-- Idempotent per user/UTC-day. Does NOT reveal or roll the reward — that
-- only happens in open_mystery_box(), on tap.
create or replace function public.get_or_create_daily_mystery_box()
returns table(box_date date, opened boolean, reward_type text, reward_amount int, reward_ref text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_today date := (now() at time zone 'utc')::date;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  insert into public.daily_mystery_box (user_id, box_date)
    values (v_uid, v_today)
    on conflict (user_id, box_date) do nothing;

  return query
    select dmb.box_date, dmb.opened, dmb.reward_type, dmb.reward_amount, dmb.reward_ref
    from public.daily_mystery_box dmb
    where dmb.user_id = v_uid and dmb.box_date = v_today;
end;
$$;

grant execute on function public.get_or_create_daily_mystery_box() to authenticated;

-- ── open_mystery_box() ───────────────────────────────────────────────────
-- The reward-granting call. Rolls once, grants immediately, records the
-- result so a second call the same day just errors instead of re-rolling.
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

  -- Weighted roll (plan §2, badge tier folded into avatar_item — see header):
  -- 45% small diamonds, 30% small XP, 15% nothing, 10% avatar item.
  if v_roll < 0.45 then
    v_reward_type := 'diamonds';
    v_reward_amount := 5 + floor(random() * 16)::int; -- 5-20
  elsif v_roll < 0.75 then
    v_reward_type := 'xp';
    v_reward_amount := 10 + floor(random() * 31)::int; -- 10-40
  elsif v_roll < 0.90 then
    v_reward_type := 'nothing';
    v_reward_amount := 0;
  else
    -- Free, active, non-pro-locked items only — a mystery box shouldn't
    -- hand out something a paying user would otherwise buy for real
    -- diamonds, and shouldn't require Pro to receive.
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
      -- No eligible mall item found — fall back rather than fail the open.
      v_reward_type := 'diamonds';
      v_reward_amount := 10;
    end if;
  end if;

  -- Grant it.
  if v_reward_type = 'diamonds' and v_reward_amount > 0 then
    insert into public.user_wallets (user_id, gem_balance)
      values (v_uid, v_reward_amount)
      on conflict (user_id) do update
        set gem_balance = public.user_wallets.gem_balance + excluded.gem_balance,
            updated_at = now();
    insert into public.diamond_transactions (user_id, reference, amount, description)
      values (v_uid, 'mystery_box:' || v_today, v_reward_amount, 'Daily Mystery Box reward');

  elsif v_reward_type = 'xp' and v_reward_amount > 0 then
    update public.profiles
      set xp = xp + least(v_reward_amount, 20000),
          level = floor((xp + least(v_reward_amount, 20000)) / 1000) + 1
      where id = v_uid;

  elsif v_reward_type = 'avatar_item' and v_item_id is not null then
    -- Mirrors Mall.tsx's purchase flow: increment quantity on an existing
    -- row, else insert fresh (user_inventory has no unique constraint on
    -- (user_id, item_id) to ON CONFLICT against).
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

grant execute on function public.open_mystery_box() to authenticated;
