-- supabase/migrations/0055_admin_currently_banned_filter.sql
-- ════════════════════════════════════════════════════════════════════════
-- Migration 0055 — "currently_banned" filter for admin_list_users
--
-- The Operations tab's "Currently banned" card (moderation.currently_banned)
-- uses a stricter predicate than the Overview tab's "Banned users" card
-- (overview.banned_users): it also excludes bans whose banned_until has
-- already passed. Reusing the plain `banned` filter from migration 0054
-- for this card would show a list whose count doesn't match the number
-- printed on it. Adding a second, distinct branch keeps every drill-down
-- honest against its own card.
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
     or (p_filter = 'currently_banned' and coalesce(um.is_banned, false) and (um.banned_until is null or um.banned_until > now()))
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
       or (p_filter = 'currently_banned' and coalesce(um.is_banned, false) and (um.banned_until is null or um.banned_until > now()))
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

notify pgrst, 'reload schema';
