-- supabase/migrations/0081_restrict_runner_up_elite_to_exact_rank_2.sql
-- ════════════════════════════════════════════════════════════════════════
-- Migration 0081 — Runner-Up Elite should mean rank 2, not "top 2"
--
-- recompute_leaderboard_rank_badges granted/retained 'runner_up_elite'
-- for anyone with rnk <= 2, which meant the #1 player quietly held it
-- alongside 'leaderboard_legend' — they just never got the "You're #2!"
-- notification for it. Since the badge is named Runner-Up Elite, that's
-- wrong: it should belong to exactly 2nd place. Both the grant and the
-- retention/removal logic are narrowed to rnk = 2.
--
-- Also includes a one-time cleanup deleting any existing runner_up_elite
-- grants held by non-rank-2 users (i.e. the current #1 player).
-- ════════════════════════════════════════════════════════════════════════

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
      and user_id not in (select id from public.leaderboard_eligible_ranks() where rnk = 2)
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

  -- Rank 2 exactly: grant badge (only if still available), notify.
  if public.badge_is_available('runner_up_elite') then
    for r in
      with newly_second as (
        insert into public.player_badges (user_id, badge_id)
        select id, 'runner_up_elite' from public.leaderboard_eligible_ranks() where rnk = 2
        on conflict (user_id, badge_id) do nothing
        returning user_id
      )
      select user_id from newly_second
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

-- One-time cleanup: strip runner_up_elite from anyone who isn't exactly rank 2
-- (this is what fixes the current #1 player's incorrect extra badge).
delete from public.player_badges
where badge_id = 'runner_up_elite'
  and user_id not in (select id from public.leaderboard_eligible_ranks() where rnk = 2);
