-- supabase/migrations/0034_admin_user_drilldown.sql
-- ════════════════════════════════════════════════════════════════════════
-- Migration 0034 — Admin user drill-down (list + detail)
--
-- Backs the "shell opens into another shell" pattern on the Admin
-- Dashboard: clicking the Total Users stat opens a paginated, searchable
-- user list (admin_list_users), and clicking a row in that list opens a
-- full detail view for one user (admin_get_user_detail) — balances,
-- role/ban status, and a suspicious-balance flag (> 3000 diamonds).
--
-- Both are SECURITY DEFINER + is_admin_role()-gated, same pattern as
-- admin_dashboard_stats() in migration 0029: the client never gets a new
-- SELECT policy onto auth.users, user_wallets, or wallet_transactions —
-- these functions read them server-side and return only what an admin is
-- allowed to see.
-- ════════════════════════════════════════════════════════════════════════

-- 1. Paginated / searchable user list ─────────────────────────────────
create or replace function public.admin_list_users(
  p_page int default 1,
  p_page_size int default 25,
  p_search text default null
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
  where p_search is null or p_search = ''
     or p.username ilike '%' || p_search || '%'
     or p.display_name ilike '%' || p_search || '%'
     or u.email ilike '%' || p_search || '%';

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
    where p_search is null or p_search = ''
       or p.username ilike '%' || p_search || '%'
       or p.display_name ilike '%' || p_search || '%'
       or u.email ilike '%' || p_search || '%'
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

revoke execute on function public.admin_list_users(int, int, text) from public;
grant execute on function public.admin_list_users(int, int, text) to authenticated;

-- 2. Single-user detail (individual balance breakdown) ────────────────
create or replace function public.admin_get_user_detail(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_result jsonb;
begin
  if v_caller is null or not public.is_admin_role(v_caller) then
    raise exception 'CV_ADMIN_FORBIDDEN: admin only';
  end if;

  select jsonb_build_object(
    'id', p.id,
    'username', p.username,
    'display_name', p.display_name,
    'email', u.email,
    'avatar', p.avatar,
    'country', p.country,
    'bio', p.bio,
    'xp', p.xp,
    'level', p.level,
    'streak', p.streak,
    'is_pro', p.is_pro,
    'pro_tier', p.pro_tier,
    'pro_expires_at', p.pro_expires_at,
    'staff_role', um.role,
    'is_banned', coalesce(um.is_banned, false),
    'banned_until', um.banned_until,
    'ban_reason', um.ban_reason,
    'created_at', p.created_at,
    'last_login_at', p.last_login_at,
    'last_seen_at', p.last_seen_at,
    'referral_count', p.referral_count,
    'wallet', jsonb_build_object(
      'gem_balance', coalesce(w.gem_balance, 0),
      'balance_flagged', (coalesce(w.gem_balance, 0) > 3000),
      'total_purchased', (select coalesce(sum(amount), 0) from public.diamond_transactions where user_id = p.id and amount > 0),
      'total_earned_ledger', (select coalesce(sum(amount), 0) from public.wallet_transactions where user_id = p.id and amount > 0),
      'total_spent_ledger', (select coalesce(sum(-amount), 0) from public.wallet_transactions where user_id = p.id and amount < 0)
    ),
    'recent_wallet_activity', (
      select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) from (
        select type, label, amount, created_at
        from public.wallet_transactions
        where user_id = p.id
        order by created_at desc
        limit 15
      ) t
    )
  ) into v_result
  from public.profiles p
  join auth.users u on u.id = p.id
  left join public.user_wallets w on w.user_id = p.id
  left join public.user_moderation um on um.user_id = p.id
  where p.id = p_user_id;

  if v_result is null then
    raise exception 'CV_USER_NOT_FOUND: no such user';
  end if;

  return v_result;
end;
$$;

revoke execute on function public.admin_get_user_detail(uuid) from public;
grant execute on function public.admin_get_user_detail(uuid) to authenticated;

-- 3. Surface the anomaly count on the main dashboard overview ─────────
-- Redefines admin_dashboard_stats() (same signature, migration 0029) to
-- add overview.flagged_balance_count so a suspicious cluster of >3000-
-- diamond wallets is visible without opening the Users drill-down.
create or replace function public.admin_dashboard_stats()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_result jsonb;
begin
  if v_caller is null or not public.is_admin_role(v_caller) then
    raise exception 'CV_ADMIN_FORBIDDEN: admin only';
  end if;

  select jsonb_build_object(
    'generated_at', now(),

    'overview', jsonb_build_object(
      'total_users', (select count(*) from public.profiles),
      'new_users_7d', (select count(*) from public.profiles where created_at >= now() - interval '7 days'),
      'new_users_30d', (select count(*) from public.profiles where created_at >= now() - interval '30 days'),
      'active_today', (select count(*) from public.profiles where last_active_date = current_date),
      'active_7d', (select count(*) from public.profiles where last_seen_at >= now() - interval '7 days'),
      'pro_subscribers', (select count(*) from public.profiles where is_pro),
      'pro_orbit', (select count(*) from public.profiles where is_pro and pro_tier = 'orbit'),
      'pro_void', (select count(*) from public.profiles where is_pro and pro_tier = 'void'),
      'staff_count', (select count(*) from public.user_moderation where role in ('staff', 'moderator', 'admin')),
      'banned_users', (select count(*) from public.user_moderation where is_banned)
    ),

    'economy', jsonb_build_object(
      'diamonds_in_circulation', (select coalesce(sum(gem_balance), 0) from public.user_wallets),
      'diamonds_credited_30d', (select coalesce(sum(amount), 0) from public.diamond_transactions where amount > 0 and created_at >= now() - interval '30 days'),
      'purchase_tx_30d', (select count(*) from public.diamond_transactions where created_at >= now() - interval '30 days'),
      'flagged_balance_count', (select count(*) from public.user_wallets where gem_balance > 3000),
      'top_mall_items', (
        select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) from (
          select mi.name, mi.category, count(*) as owners
          from public.user_inventory ui
          join public.mall_items mi on mi.id = ui.item_id
          group by mi.id, mi.name, mi.category
          order by count(*) desc
          limit 8
        ) t
      )
    ),

    'games', jsonb_build_object(
      'total_sessions', (select count(*) from public.game_sessions),
      'sessions_7d', (select count(*) from public.game_sessions where played_at >= now() - interval '7 days'),
      'top_games', (
        select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) from (
          select game, count(*) as sessions
          from public.game_sessions
          where played_at >= now() - interval '30 days'
          group by game
          order by count(*) desc
          limit 8
        ) t
      )
    ),

    'multiplayer', jsonb_build_object(
      'active_rooms', (select count(*) from public.rooms where status in ('waiting', 'in_progress')),
      'rooms_7d', (select count(*) from public.rooms where created_at >= now() - interval '7 days'),
      'top_multiplayer_games', (
        select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) from (
          select game_id, count(*) as rooms
          from public.rooms
          where created_at >= now() - interval '30 days'
          group by game_id
          order by count(*) desc
          limit 8
        ) t
      )
    ),

    'halo_ai', jsonb_build_object(
      'questions_7d', (select coalesce(sum(question_count), 0) from public.halo_ai_usage where usage_date >= current_date - 7),
      'questions_30d', (select coalesce(sum(question_count), 0) from public.halo_ai_usage where usage_date >= current_date - 30),
      'active_users_7d', (select count(distinct player_id) from public.halo_ai_usage where usage_date >= current_date - 7),
      'provider_split_30d', (
        select coalesce(jsonb_object_agg(provider, uses), '{}'::jsonb) from (
          select unnest(providers_used) as provider, count(*) as uses
          from public.halo_ai_logs
          where created_at >= now() - interval '30 days'
          group by provider
        ) t
      )
    ),

    'moderation', jsonb_build_object(
      'open_reports', (select count(*) from public.content_reports where status = 'open'),
      'actions_7d', (select count(*) from public.moderation_log where created_at >= now() - interval '7 days'),
      'currently_banned', (select count(*) from public.user_moderation where is_banned and (banned_until is null or banned_until > now()))
    ),

    'support', jsonb_build_object(
      'open_tickets', (select count(*) from public.support_tickets where status not in ('closed', 'resolved')),
      'tickets_7d', (select count(*) from public.support_tickets where created_at >= now() - interval '7 days')
    )
  ) into v_result;

  return v_result;
end;
$$;

notify pgrst, 'reload schema';
