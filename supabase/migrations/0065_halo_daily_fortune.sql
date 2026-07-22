-- 0065_halo_daily_fortune.sql
-- One fortune per user per UTC day, backed by the existing halo_lines
-- 'fortune' pool. Reuses get_next_halo_line() (from 0063) for the actual
-- random-unseen-pick logic instead of duplicating it — this function's job
-- is only the "once per day" idempotency on top of that.

create table if not exists public.daily_fortune (
  user_id uuid not null references public.profiles(id) on delete cascade,
  fortune_date date not null default current_date,
  line_id uuid not null references public.halo_lines(id),
  created_at timestamptz not null default now(),
  primary key (user_id, fortune_date)
);

alter table public.daily_fortune enable row level security;

drop policy if exists "Players can read own daily fortune" on public.daily_fortune;
create policy "Players can read own daily fortune" on public.daily_fortune
  for select
  to authenticated
  using (auth.uid() = user_id);
-- No insert/update policy — writes happen only inside
-- get_or_create_daily_fortune() below, never directly from the client.

create or replace function public.get_or_create_daily_fortune()
returns table(id uuid, text text, fortune_date date)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_today date := (now() at time zone 'utc')::date;
  v_line_id uuid;
  v_text text;
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  -- Already have today's fortune — return it as-is (idempotent).
  select df.line_id, hl.text into v_line_id, v_text
    from public.daily_fortune df
    join public.halo_lines hl on hl.id = df.line_id
    where df.user_id = v_user_id and df.fortune_date = v_today;

  if v_line_id is not null then
    return query select v_line_id, v_text, v_today;
    return;
  end if;

  -- First check of the day — pick a fresh one via the shared picker (this
  -- also records it in halo_line_history so tomorrow's pick, and any other
  -- 'fortune' moment, excludes it).
  select gnl.id, gnl.text into v_line_id, v_text
    from public.get_next_halo_line('fortune') as gnl;

  if v_line_id is null then
    -- No active fortune lines at all — nothing to record.
    return;
  end if;

  insert into public.daily_fortune (user_id, fortune_date, line_id)
    values (v_user_id, v_today, v_line_id)
    on conflict (user_id, fortune_date) do nothing;

  return query select v_line_id, v_text, v_today;
end;
$$;

grant execute on function public.get_or_create_daily_fortune() to authenticated;
