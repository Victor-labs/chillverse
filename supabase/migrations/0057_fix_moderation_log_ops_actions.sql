-- supabase/migrations/0057_fix_moderation_log_ops_actions.sql
-- ════════════════════════════════════════════════════════════════════════
-- Migration 0057 — Fixes for the Ops console actions added in 0056.
--
-- Two bugs, both from not checking moderation_log's actual schema closely
-- enough before writing the inserts in 0056:
--
-- 1. moderation_log.target_id is `uuid`, not `text`. admin_set_feature_flag
--    tried to insert a flag key like 'game:uno' into it, and
--    admin_set_maintenance tried to insert the literal string '1'
--    (app_config's row id). Both raised a cast error. Fix: pass NULL for
--    target_id on these (there's no natural uuid target for a feature
--    flag or a singleton config row) and keep the real identifier in
--    metadata — the same fix already correctly applied to
--    mod_set_badge_availability in migration 0053.
--
-- 2. moderation_log.action and .target_type both have CHECK constraints
--    that whitelist known values. The five new action names from 0056
--    (set_feature_flag, set_maintenance_mode, broadcast_notification,
--    export_users, export_transactions) and four new target_type values
--    (feature_flag, app_config, export, notification) were never added
--    to those whitelists, so every insert using them was rejected.
-- ════════════════════════════════════════════════════════════════════════

-- 1. Widen the action whitelist ──────────────────────────────────────────
alter table public.moderation_log drop constraint if exists moderation_log_action_check;
alter table public.moderation_log add constraint moderation_log_action_check
  check (action = ANY (ARRAY[
    'ban', 'suspend', 'unban', 'set_role', 'delete_message', 'delete_post', 'delete_comment',
    'review_report', 'auto_hide', 'unhide', 'auto_violation', 'resolve_alert', 'set_verified',
    'set_badge_availability',
    'set_feature_flag', 'set_maintenance_mode', 'broadcast_notification', 'export_users', 'export_transactions'
  ]::text[]));

-- 2. Widen the target_type whitelist ─────────────────────────────────────
alter table public.moderation_log drop constraint if exists moderation_log_target_type_check;
alter table public.moderation_log add constraint moderation_log_target_type_check
  check (target_type = ANY (ARRAY[
    'user', 'message', 'post', 'comment', 'report', 'badge',
    'feature_flag', 'app_config', 'export', 'notification'
  ]::text[]));

-- 3. Fix admin_set_feature_flag's target_id cast ─────────────────────────
create or replace function public.admin_set_feature_flag(p_key text, p_enabled boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
begin
  if v_caller is null or not public.is_admin_role(v_caller) then
    raise exception 'CV_ADMIN_FORBIDDEN: admin only';
  end if;

  if not exists (select 1 from public.feature_flags where key = p_key) then
    raise exception 'CV_ADMIN_NOT_FOUND: flag not found';
  end if;

  update public.feature_flags
    set enabled = p_enabled, updated_at = now(), updated_by = v_caller
    where key = p_key;

  insert into public.moderation_log (moderator_id, action, target_type, target_id, metadata)
    values (v_caller, 'set_feature_flag', 'feature_flag', null, jsonb_build_object('key', p_key, 'enabled', p_enabled));
end;
$$;

-- 4. Fix admin_set_maintenance's target_id cast ──────────────────────────
create or replace function public.admin_set_maintenance(
  p_enabled boolean,
  p_message text default null,
  p_scheduled_for timestamptz default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
begin
  if v_caller is null or not public.is_admin_role(v_caller) then
    raise exception 'CV_ADMIN_FORBIDDEN: admin only';
  end if;

  update public.app_config set
    maintenance_enabled = p_enabled,
    maintenance_message = coalesce(nullif(trim(p_message), ''), maintenance_message),
    maintenance_scheduled_for = p_scheduled_for,
    updated_at = now(),
    updated_by = v_caller
  where id = 1;

  insert into public.moderation_log (moderator_id, action, target_type, target_id, metadata)
    values (v_caller, 'set_maintenance_mode', 'app_config', null, jsonb_build_object('enabled', p_enabled, 'scheduled_for', p_scheduled_for));
end;
$$;

notify pgrst, 'reload schema';
