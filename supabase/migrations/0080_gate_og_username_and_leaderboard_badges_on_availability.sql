-- supabase/migrations/0080_gate_og_username_and_leaderboard_badges_on_availability.sql
-- ════════════════════════════════════════════════════════════════════════
-- Migration 0080 — Close the badge-availability leak on two paths that
-- bypassed it entirely
--
-- 0053 gated every branch of check_and_award_auto_badges and all of
-- grant_manual_badge behind badge_is_available(). But two other
-- functions insert into player_badges directly and were never touched:
--   - grant_og_username_badge(): a trigger that unconditionally grants
--     'og_username'.
--   - recompute_leaderboard_rank_badges(): a scheduled job that
--     unconditionally grants 'leaderboard_legend' and 'runner_up_elite'.
-- Result: marking any of those three badges unavailable in the
-- moderation panel had no effect — they kept being awarded through
-- these paths. Fix: gate both behind badge_is_available(), same pattern
-- as 0053.
-- ════════════════════════════════════════════════════════════════════════

create or replace function public.grant_og_username_badge()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.badge_is_available('og_username') then
    insert into public.player_badges (user_id, badge_id) values (new.id, 'og_username')
      on conflict (user_id, badge_id) do nothing;
  end if;
  return new;
end;
$$;

create or replace function public.recompute_leaderboard_rank_badges()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r      record;
  v_name text;
begin
  with removed as (
    delete from public.player_badges
    where badge_id = 'leaderboard_legend'
      and user_id not in (select id from public.leaderboard_eligible_ranks() where rnk = 1)
    returning user_id
  )
  insert into public.notifications (user_id, type, title, body, icon)
  select user_id, 'rank_down', 'Dethroned!',
         'Someone overtook you — you''re no longer #1 on the leaderboard. Keep climbing to reclaim Leaderboard Legend.',
         'crown'
  from removed;

  with removed as (
    delete from public.player_badges
    where badge_id = 'runner_up_elite'
      and user_id not in (select id from public.leaderboard_eligible_ranks() where rnk <= 2)
    returning user_id
  )
  insert into public.notifications (user_id, type, title, body, icon)
  select user_id, 'rank_down', 'Bumped from the Top 2',
         'You''ve dropped out of the top 2 on the leaderboard. Climb back up to reclaim Runner-Up Elite.',
         'crown'
  from removed;

  -- Rank 1: grant badge (only if still available), notify newly-crowned player + followers.
  if public.badge_is_available('leaderboard_legend') then
    for r in
      with newly_first as (
        insert into public.player_badges (user_id, badge_id)
        select id, 'leaderboard_legend' from public.leaderboard_eligible_ranks() where rnk = 1
        on conflict (user_id, badge_id) do nothing
        returning user_id
      )
      select user_id from newly_first
    loop
      select coalesce(display_name, username) into v_name from public.profiles where id = r.user_id;

      begin
        perform public.insert_notification(
          r.user_id, 'rank_up', 'You''re #1!',
          'You reached the top of the leaderboard.', 'crown', '{}'::jsonb
        );

        perform public.insert_notification(
          f.follower_id, 'followed_rank_up',
          v_name || ' reached #1 on the leaderboard!',
          'Check out their profile.', 'crown',
          jsonb_build_object('user_id', r.user_id)
        )
        from public.follows f
        join public.profiles p on p.id = r.user_id
        where f.following_id = r.user_id and p.show_game_progression = true;
      exception when others then
        raise warning 'recompute_leaderboard_rank_badges: rank-1 notify failed for user %: %', r.user_id, sqlerrm;
      end;
    end loop;
  end if;

  -- Rank 2 exactly (not <=2, so the #1 player doesn't get a second notification).
  if public.badge_is_available('runner_up_elite') then
    for r in
      with newly_second as (
        insert into public.player_badges (user_id, badge_id)
        select id, 'runner_up_elite' from public.leaderboard_eligible_ranks() where rnk <= 2
        on conflict (user_id, badge_id) do nothing
        returning user_id
      )
      select ns.user_id
      from newly_second ns
      join public.leaderboard_eligible_ranks() ler on ler.id = ns.user_id
      where ler.rnk = 2
    loop
      select coalesce(display_name, username) into v_name from public.profiles where id = r.user_id;

      begin
        perform public.insert_notification(
          r.user_id, 'rank_up', 'You''re #2!',
          'You reached the top 2 on the leaderboard.', 'crown', '{}'::jsonb
        );

        perform public.insert_notification(
          f.follower_id, 'followed_rank_up',
          v_name || ' reached #2 on the leaderboard!',
          'Check out their profile.', 'crown',
          jsonb_build_object('user_id', r.user_id)
        )
        from public.follows f
        join public.profiles p on p.id = r.user_id
        where f.following_id = r.user_id and p.show_game_progression = true;
      exception when others then
        raise warning 'recompute_leaderboard_rank_badges: rank-2 notify failed for user %: %', r.user_id, sqlerrm;
      end;
    end loop;
  end if;
end;
$$;
