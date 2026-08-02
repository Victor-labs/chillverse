-- supabase/migrations/0097_flash_sale_cms.sql
-- ════════════════════════════════════════════════════════════════════════
-- Migration 0097 — Flash Sale CMS
--
-- Lets admins run two independent, self-repeating flash sale schedules
-- from the Ops console instead of the hardcoded FLASH_PACKS array in
-- BuyDiamonds.tsx:
--
--   • weekly_special — recurs every week on a chosen weekday (default
--     Friday), open for a short window (default 18:00–22:00 Africa/Lagos).
--   • monthly_mega    — recurs on the LAST SATURDAY of every month,
--     computed automatically (no date to maintain), open all day.
--
-- If both would be live at once, monthly_mega always wins — the RPC below
-- checks monthly_mega first and only falls through to weekly_special if
-- it isn't currently active, so a Friday that lands on/after the last
-- Saturday's window never shows a competing weekly sale.
--
-- Two tables:
--   • public.flash_sale_rules — one singleton row per `type`, holds the
--     schedule (day_of_week for weekly, start/end time-of-day for both)
--     and display copy. Admin-only read/write via RLS.
--   • public.flash_sale_items — the discounted diamond bundles under each
--     rule (diamonds, original price, discount %). Sale price is always
--     derived (original_price_cents * (1 - discount_pct/100)) rather than
--     stored, so editing the discount is the only thing admins need to do.
--
-- public.get_active_flash_sale() is the single public-facing read path:
-- a SECURITY DEFINER RPC that figures out which rule (if any) is live
-- right now in Africa/Lagos time and returns it pre-joined with its
-- items — the client never has to reimplement "which Saturday" or
-- "which sale wins" logic itself.
--
-- Depends on migration 0024 (is_admin_role). Safe to re-run.
-- ════════════════════════════════════════════════════════════════════════

-- ── 1. flash_sale_rules ──────────────────────────────────────────────────
create table if not exists public.flash_sale_rules (
  type          text primary key check (type in ('weekly_special', 'monthly_mega')),
  enabled       boolean not null default true,
  -- 0=Sunday..6=Saturday, Postgres extract(dow) convention. Only meaningful
  -- for weekly_special — monthly_mega's day is always computed (last Saturday).
  day_of_week   smallint check (day_of_week between 0 and 6),
  start_time    time not null default '00:00:00',
  end_time      time not null default '23:59:59',
  title         text not null,
  subtitle      text,
  updated_at    timestamptz not null default now()
);

create or replace function public.set_flash_sale_rules_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists flash_sale_rules_set_updated_at on public.flash_sale_rules;
create trigger flash_sale_rules_set_updated_at
  before update on public.flash_sale_rules
  for each row execute function public.set_flash_sale_rules_updated_at();

alter table public.flash_sale_rules enable row level security;

drop policy if exists "admins can read flash sale rules" on public.flash_sale_rules;
create policy "admins can read flash sale rules" on public.flash_sale_rules
  for select using (public.is_admin_role(auth.uid()));

drop policy if exists "admins can update flash sale rules" on public.flash_sale_rules;
create policy "admins can update flash sale rules" on public.flash_sale_rules
  for update using (public.is_admin_role(auth.uid())) with check (public.is_admin_role(auth.uid()));

-- No insert/delete policy on purpose — the two rows are singletons seeded
-- below; admins edit them in place, they never create/remove a `type`.

-- ── 2. flash_sale_items ──────────────────────────────────────────────────
create table if not exists public.flash_sale_items (
  id                    uuid primary key default gen_random_uuid(),
  rule_type             text not null references public.flash_sale_rules(type) on delete cascade,
  diamonds              integer not null check (diamonds > 0),
  original_price_cents  integer not null check (original_price_cents > 0),
  discount_pct          numeric(5,2) not null default 0 check (discount_pct >= 0 and discount_pct <= 95),
  sort_order            integer not null default 0,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists flash_sale_items_rule_type_idx on public.flash_sale_items (rule_type, sort_order);

create or replace function public.set_flash_sale_items_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists flash_sale_items_set_updated_at on public.flash_sale_items;
create trigger flash_sale_items_set_updated_at
  before update on public.flash_sale_items
  for each row execute function public.set_flash_sale_items_updated_at();

alter table public.flash_sale_items enable row level security;

drop policy if exists "admins can read flash sale items" on public.flash_sale_items;
create policy "admins can read flash sale items" on public.flash_sale_items
  for select using (public.is_admin_role(auth.uid()));

drop policy if exists "admins can insert flash sale items" on public.flash_sale_items;
create policy "admins can insert flash sale items" on public.flash_sale_items
  for insert with check (public.is_admin_role(auth.uid()));

drop policy if exists "admins can update flash sale items" on public.flash_sale_items;
create policy "admins can update flash sale items" on public.flash_sale_items
  for update using (public.is_admin_role(auth.uid())) with check (public.is_admin_role(auth.uid()));

drop policy if exists "admins can delete flash sale items" on public.flash_sale_items;
create policy "admins can delete flash sale items" on public.flash_sale_items
  for delete using (public.is_admin_role(auth.uid()));

-- ── 3. Seed the two singleton rules (idempotent) ─────────────────────────
insert into public.flash_sale_rules (type, enabled, day_of_week, start_time, end_time, title, subtitle)
values
  ('weekly_special', true, 5, '18:00:00', '22:00:00', 'Friday Special', 'This week''s deals — a few hours only'),
  ('monthly_mega',   true, null, '00:00:00', '23:59:59', 'Monthly Mega Sale', 'Our biggest discount of the month — today only')
on conflict (type) do nothing;

-- Seed starter items only if each rule has none yet, so re-running this
-- migration never duplicates rows an admin has already edited.
insert into public.flash_sale_items (rule_type, diamonds, original_price_cents, discount_pct, sort_order)
select * from (values
  ('weekly_special', 250,  130000, 38::numeric, 0),
  ('weekly_special', 450,  220000, 32::numeric, 1)
) as seed(rule_type, diamonds, original_price_cents, discount_pct, sort_order)
where not exists (select 1 from public.flash_sale_items where rule_type = 'weekly_special');

insert into public.flash_sale_items (rule_type, diamonds, original_price_cents, discount_pct, sort_order)
select * from (values
  ('monthly_mega', 310,  300000, 50::numeric, 0),
  ('monthly_mega', 520,  480000, 50::numeric, 1),
  ('monthly_mega', 1040, 860000, 50::numeric, 2)
) as seed(rule_type, diamonds, original_price_cents, discount_pct, sort_order)
where not exists (select 1 from public.flash_sale_items where rule_type = 'monthly_mega');

-- ── 4. get_active_flash_sale() — the single public read path ────────────
-- Figures out which rule (if either) is live right now in Africa/Lagos
-- time and returns it pre-joined with its items and derived sale prices.
-- monthly_mega is checked first and always wins on an overlap, per the
-- admin's schedule design — weekly_special is only considered if
-- monthly_mega isn't currently active.
create or replace function public.get_active_flash_sale()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_local      timestamp := now() at time zone 'Africa/Lagos';
  v_date       date := v_local::date;
  v_time       time := v_local::time;
  v_dow        int := extract(dow from v_local)::int;
  v_last_sat   date;
  v_monthly    public.flash_sale_rules%rowtype;
  v_weekly     public.flash_sale_rules%rowtype;
  v_items      jsonb;
begin
  -- Last Saturday of the current month, Africa/Lagos-local.
  v_last_sat := (date_trunc('month', v_date) + interval '1 month' - interval '1 day')::date;
  while extract(dow from v_last_sat) <> 6 loop
    v_last_sat := v_last_sat - 1;
  end loop;

  select * into v_monthly from public.flash_sale_rules where type = 'monthly_mega';
  if found and v_monthly.enabled and v_date = v_last_sat
     and v_time between v_monthly.start_time and v_monthly.end_time then
    select coalesce(jsonb_agg(jsonb_build_object(
             'id', id,
             'diamonds', diamonds,
             'original_price_cents', original_price_cents,
             'discount_pct', discount_pct,
             'sale_price_cents', round(original_price_cents * (1 - discount_pct / 100.0))
           ) order by sort_order), '[]'::jsonb)
      into v_items
      from public.flash_sale_items
      where rule_type = 'monthly_mega';

    return jsonb_build_object(
      'type', 'monthly_mega',
      'title', v_monthly.title,
      'subtitle', v_monthly.subtitle,
      'ends_at', ((v_date::text || ' ' || v_monthly.end_time::text)::timestamp at time zone 'Africa/Lagos'),
      'items', v_items
    );
  end if;

  select * into v_weekly from public.flash_sale_rules where type = 'weekly_special';
  if found and v_weekly.enabled and v_dow = v_weekly.day_of_week
     and v_time between v_weekly.start_time and v_weekly.end_time then
    select coalesce(jsonb_agg(jsonb_build_object(
             'id', id,
             'diamonds', diamonds,
             'original_price_cents', original_price_cents,
             'discount_pct', discount_pct,
             'sale_price_cents', round(original_price_cents * (1 - discount_pct / 100.0))
           ) order by sort_order), '[]'::jsonb)
      into v_items
      from public.flash_sale_items
      where rule_type = 'weekly_special';

    return jsonb_build_object(
      'type', 'weekly_special',
      'title', v_weekly.title,
      'subtitle', v_weekly.subtitle,
      'ends_at', ((v_date::text || ' ' || v_weekly.end_time::text)::timestamp at time zone 'Africa/Lagos'),
      'items', v_items
    );
  end if;

  return null;
end;
$$;

revoke execute on function public.get_active_flash_sale() from public;
grant execute on function public.get_active_flash_sale() to authenticated;

-- ── 5. Admin CMS read/write RPCs ─────────────────────────────────────────
-- The Ops console CMS needs BOTH rules (regardless of whether either is
-- currently active) plus their items in one call, so admins can edit a
-- sale that isn't live right now.
create or replace function public.admin_get_flash_sale_rules()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'type', r.type,
    'enabled', r.enabled,
    'day_of_week', r.day_of_week,
    'start_time', r.start_time,
    'end_time', r.end_time,
    'title', r.title,
    'subtitle', r.subtitle,
    'updated_at', r.updated_at,
    'items', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', i.id,
        'diamonds', i.diamonds,
        'original_price_cents', i.original_price_cents,
        'discount_pct', i.discount_pct,
        'sort_order', i.sort_order
      ) order by i.sort_order), '[]'::jsonb)
      from public.flash_sale_items i
      where i.rule_type = r.type
    )
  ) order by r.type), '[]'::jsonb)
  from public.flash_sale_rules r
  where public.is_admin_role(auth.uid());
$$;

revoke execute on function public.admin_get_flash_sale_rules() from public;
grant execute on function public.admin_get_flash_sale_rules() to authenticated;

-- Saves a rule's schedule/copy and fully replaces its item list in one
-- transaction (delete-then-insert is simplest and safe here — items have
-- no history/FK pointing at them from elsewhere).
create or replace function public.admin_save_flash_sale_rule(
  p_type text,
  p_enabled boolean,
  p_day_of_week smallint,
  p_start_time time,
  p_end_time time,
  p_title text,
  p_subtitle text,
  p_items jsonb -- array of {diamonds, original_price_cents, discount_pct, sort_order}
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item jsonb;
begin
  if not public.is_admin_role(auth.uid()) then
    raise exception 'CV_ADMIN_FORBIDDEN: admin role required';
  end if;

  if p_type not in ('weekly_special', 'monthly_mega') then
    raise exception 'CV_ADMIN_VALIDATION: unknown flash sale type';
  end if;

  if p_title is null or length(trim(p_title)) = 0 then
    raise exception 'CV_ADMIN_VALIDATION: title is required';
  end if;

  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'CV_ADMIN_VALIDATION: at least one item is required';
  end if;

  update public.flash_sale_rules
     set enabled = p_enabled,
         day_of_week = p_day_of_week,
         start_time = p_start_time,
         end_time = p_end_time,
         title = trim(p_title),
         subtitle = p_subtitle
   where type = p_type;

  if not found then
    raise exception 'CV_ADMIN_NOT_FOUND: flash sale rule not found';
  end if;

  delete from public.flash_sale_items where rule_type = p_type;

  for v_item in select * from jsonb_array_elements(p_items) loop
    if coalesce((v_item->>'diamonds')::int, 0) <= 0 then
      raise exception 'CV_ADMIN_VALIDATION: diamonds must be greater than 0';
    end if;
    if coalesce((v_item->>'original_price_cents')::int, 0) <= 0 then
      raise exception 'CV_ADMIN_VALIDATION: original price must be greater than 0';
    end if;
    if (v_item->>'discount_pct')::numeric < 0 or (v_item->>'discount_pct')::numeric > 95 then
      raise exception 'CV_ADMIN_VALIDATION: discount must be between 0 and 95%%';
    end if;

    insert into public.flash_sale_items (rule_type, diamonds, original_price_cents, discount_pct, sort_order)
    values (
      p_type,
      (v_item->>'diamonds')::int,
      (v_item->>'original_price_cents')::int,
      (v_item->>'discount_pct')::numeric,
      coalesce((v_item->>'sort_order')::int, 0)
    );
  end loop;
end;
$$;

revoke execute on function public.admin_save_flash_sale_rule(text, boolean, smallint, time, time, text, text, jsonb) from public;
grant execute on function public.admin_save_flash_sale_rule(text, boolean, smallint, time, time, text, text, jsonb) to authenticated;

notify pgrst, 'reload schema';
