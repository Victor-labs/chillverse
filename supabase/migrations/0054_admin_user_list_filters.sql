-- supabase/migrations/0054_admin_user_list_filters.sql
-- ════════════════════════════════════════════════════════════════════════
-- Migration 0054 — Category filters for admin_list_users
--
-- The Admin Dashboard's Overview stat cards (New 7d/30d, Active 7d, Pro
-- subscribers, Staff members, Banned users) were display-only — the
-- numbers weren't clickable into anything. Only "Total users" and
-- "Flagged balances" opened the AdminUserSearch drill-down, and only via
-- free-text search.
--
-- This adds an optional `p_filter` param to `admin_list_users` so any of
-- those categories can be listed directly, no typing required. Each
-- filter branch mirrors the exact predicate `admin_dashboard_stats` uses
-- for that same card, so the drill-down list's count always matches the
-- number printed on the card. `p_filter` combines with `p_search` (AND),
-- so a moderator can still narrow a filtered list by name if it's long.
-- ════════════════════════════════════════════════════════════════════════

create or replace function public.admin_list_users(
  p_page int default 1,
  p_page_size int default 25,
  p_search text default null,
  p_filter text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_offset int;
  v_page_size int;
  v_rows jsonb;
  v_total int;
begin
  if v_caller is null or not public.is_admin_role(v_caller) then
    raise exception 'CV_ADMIN_FORBIDDEN: admin only';
  end if;

  v_page_size := least(greatest(coalesce(p_page_size, 25), 1), 100);
  v_offset := greatest(coalesce(p_page, 1) - 1, 0) * v_page_size;

  select count(*) into v_total
  from public.profiles p
  join auth.users u on u.id = p.id
  left join public.user_moderation um on um.user_id = p.id
  where (
    p_search is null or p_search = ''
     or p.username ilike '%' || p_search || '%'
     or p.display_name ilike '%' || p_search || '%'
     or u.email ilike '%' || p_search || '%'
  )
  and (
    p_filter is null or p_filter = ''
     or (p_filter = 'new_7d' and p.created_at >= now() - interval '7 days')
     or (p_filter = 'new_30d' and p.created_at >= now() - interval '30 days')
     or (p_filter = 'active_7d' and p.last_seen_at >= now() - interval '7 days')
     or (p_filter = 'pro' and p.is_pro)
     or (p_filter = 'staff' and um.role in ('staff', 'moderator', 'admin'))
     or (p_filter = 'banned' and coalesce(um.is_banned, false))
  );

  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) into v_rows
  from (
    select
      p.id,
      p.username,
      p.display_name,
      u.email,
      p.avatar,
      coalesce(w.gem_balance, 0) as gem_balance,
      (coalesce(w.gem_balance, 0) > 3000) as balance_flagged,
      p.is_pro,
      p.pro_tier,
      um.role as staff_role,
      coalesce(um.is_banned, false) as is_banned,
      p.created_at,
      p.last_seen_at
    from public.profiles p
    join auth.users u on u.id = p.id
    left join public.user_wallets w on w.user_id = p.id
    left join public.user_moderation um on um.user_id = p.id
    where (
      p_search is null or p_search = ''
       or p.username ilike '%' || p_search || '%'
       or p.display_name ilike '%' || p_search || '%'
       or u.email ilike '%' || p_search || '%'
    )
    and (
      p_filter is null or p_filter = ''
       or (p_filter = 'new_7d' and p.created_at >= now() - interval '7 days')
       or (p_filter = 'new_30d' and p.created_at >= now() - interval '30 days')
       or (p_filter = 'active_7d' and p.last_seen_at >= now() - interval '7 days')
       or (p_filter = 'pro' and p.is_pro)
       or (p_filter = 'staff' and um.role in ('staff', 'moderator', 'admin'))
       or (p_filter = 'banned' and coalesce(um.is_banned, false))
    )
    order by p.created_at desc
    limit v_page_size
    offset v_offset
  ) t;

  return jsonb_build_object(
    'rows', v_rows,
    'total', v_total,
    'page', greatest(coalesce(p_page, 1), 1),
    'page_size', v_page_size
  );
end;
$$;

revoke execute on function public.admin_list_users(int, int, text, text) from public;
grant execute on function public.admin_list_users(int, int, text, text) to authenticated;

-- The 3-arg overload from migration 0034 is superseded by the 4-arg one
-- above; drop it so PostgREST doesn't have to disambiguate two overloads
-- with the same effective call shape from the client.
drop function if exists public.admin_list_users(int, int, text);

notify pgrst, 'reload schema';
