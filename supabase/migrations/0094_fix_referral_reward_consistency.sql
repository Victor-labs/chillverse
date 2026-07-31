-- supabase/migrations/0094_fix_referral_reward_consistency.sql
-- ════════════════════════════════════════════════════════════════════════
-- Fixes two live bugs in handle_new_user()'s referral-crediting block
-- (introduced in migration 0093_signup_metadata_and_referral_on_signup.sql),
-- both confirmed against production (project gnobzfxtxrtcxfhhfjni):
--
-- 1. REWARD INCONSISTENT WITH THE REFER & EARN SCREEN: every completed
--    referral paid a flat +10 diamonds to BOTH the referrer and the new
--    signup (referral:<id> / referral:welcome), on top of the milestone
--    bonuses. The Refer & Earn page (src/features/referral/types.ts,
--    REFERRAL_MILESTONES / REFERRAL_MAX_TOTAL) only ever advertises the
--    tiered milestone rewards (5→+20, 10→+40, 15→+60, 20→+80, capped at
--    "MAX REWARD 200"). With the flat +10-per-referral also in play, a
--    referrer who brought in 20 friends actually earned up to 200
--    (milestones, see bug 2 below) + 200 (20 x 10 flat) = far more than
--    the "200" the UI promises, and every new signup got an unadvertised
--    +10 "welcome" bonus with no basis in that screen either. Fix: stop
--    granting the flat +10 to either party — diamonds are only earned by
--    the referrer, only via the milestone tiers already shown on-screen.
--
-- 2. MILESTONE PAYOUT MATH: referral_tier_reward(count) returns, per tier,
--    the INCREMENTAL bonus for reaching it (20/40/60/80 — see its comment
--    in types.ts: "5 → 20, 10 → +40 (60 total), 15 → +60 (120 total),
--    20 → +80 (200 total)"). The old code instead treated it as a
--    cumulative total and paid the *difference* between tiers
--    (v_reward - previous tier's raw reward), e.g. crossing from tier 5
--    to tier 10 paid 40 - 20 = 20 diamonds instead of the 40 shown next
--    to "10 friends" on the Refer & Earn screen. Every tier past the
--    first was underpaid this way. Fix: credit v_reward directly — it's
--    already the correct incremental amount for that milestone.
-- ════════════════════════════════════════════════════════════════════════

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_provider            text := new.raw_app_meta_data->>'provider';
  v_meta                jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_base_username       text;
  v_username            text;
  v_display_name        text;
  v_country             text;
  v_dob                 date;
  v_interests           text[];
  v_connected_platform  text;
  v_referral_code_input text;
  v_device_id           text;
  v_referrer_id         uuid;
  v_device_already_paid boolean := false;
  v_new_count           int;
  v_prev_tier_paid      int;
  v_tier                int;
  v_reward              int;
begin
  if v_provider = 'email' then
    v_base_username       := nullif(trim(v_meta->>'username'), '');
    v_display_name        := nullif(trim(v_meta->>'display_name'), '');
    v_country             := nullif(v_meta->>'country', '');
    v_connected_platform  := nullif(v_meta->>'connected_platform', '');
    v_referral_code_input := nullif(upper(trim(v_meta->>'referral_code')), '');
    v_device_id           := nullif(trim(v_meta->>'device_id'), '');

    if nullif(v_meta->>'dob', '') is not null then
      begin
        v_dob := (v_meta->>'dob')::date;
      exception when others then
        v_dob := null;
      end;
    end if;

    if v_meta ? 'interests' and jsonb_typeof(v_meta->'interests') = 'array' then
      select array_agg(x) into v_interests
      from jsonb_array_elements_text(v_meta->'interests') x;
    end if;
  elsif v_provider = 'google' then
    -- Import the real Google display name when available (matches the
    -- "Import your Google profile details" copy already shown at signup
    -- step 2). Username still gets the same safe auto-generated fallback
    -- as everyone else — Google doesn't provide a handle to use.
    v_display_name := nullif(trim(v_meta->>'full_name'), '');
    v_device_id     := nullif(trim(v_meta->>'device_id'), '');
  end if;

  v_base_username := coalesce(v_base_username, split_part(new.email, '@', 1), 'player');
  v_base_username := regexp_replace(v_base_username, '[^a-zA-Z0-9_\.]', '', 'g');
  if v_base_username = '' then
    v_base_username := 'player';
  end if;

  v_username := v_base_username;
  -- Guarantee uniqueness even when the entered/derived username collides
  -- with an existing player — retry with a random suffix until free.
  while exists (select 1 from public.profiles where username = v_username) loop
    v_username := v_base_username || '_' || substr(md5(random()::text), 1, 4);
  end loop;

  v_display_name := coalesce(v_display_name, v_base_username);

  insert into public.profiles (
    id, username, original_username, display_name, avatar,
    country, dob, interests, connected_platform, signup_device_id
  )
  values (
    new.id, v_username, v_username, v_display_name, 'rocket',
    v_country, v_dob, coalesce(v_interests, '{}'::text[]), v_connected_platform, v_device_id
  )
  on conflict (id) do nothing;

  -- ── Referral: link + credit immediately at account creation ──────────
  -- No flat per-referral diamond grant for either side (see header) —
  -- only referral_count / referral_completed bookkeeping here, plus the
  -- referrer's milestone payout when a new tier is crossed. Diamonds
  -- earned always match exactly what's shown on the Refer & Earn screen.
  if v_referral_code_input is not null then
    select id into v_referrer_id
      from public.profiles
      where referral_code = v_referral_code_input and id <> new.id;

    if v_referrer_id is not null then
      update public.profiles set referred_by = v_referrer_id
        where id = new.id and referred_by is null;

      if v_device_id is not null then
        select exists (
          select 1 from public.profiles
          where signup_device_id = v_device_id
            and id <> new.id
            and referral_completed = true
        ) into v_device_already_paid;
      end if;

      if not v_device_already_paid then
        update public.profiles set referral_completed = true where id = new.id;

        update public.profiles
          set referral_count = referral_count + 1
          where id = v_referrer_id
          returning referral_count, referral_tier_paid into v_new_count, v_prev_tier_paid;

        select tier, reward into v_tier, v_reward from public.referral_tier_reward(v_new_count);

        if v_tier is not null and v_tier > v_prev_tier_paid then
          -- v_reward is already the incremental bonus for this tier
          -- (20 / 40 / 60 / 80) — credit it directly, no subtraction.
          insert into public.user_wallets (user_id, gem_balance)
            values (v_referrer_id, v_reward)
            on conflict (user_id)
            do update set gem_balance = public.user_wallets.gem_balance + excluded.gem_balance,
                          updated_at = now();
          insert into public.diamond_transactions (user_id, reference, amount, description)
            values (v_referrer_id, 'referral_milestone:' || v_tier, v_reward, 'Referral milestone reached — tier ' || v_tier);

          update public.profiles set referral_tier_paid = v_tier where id = v_referrer_id;

          insert into public.notifications (user_id, type, title, body, icon, meta)
            values (v_referrer_id, 'referral_milestone', 'Referral milestone reached! 🎉',
              format('You''ve referred %s friends — +%s diamonds added.', v_new_count, v_reward), 'gem',
              jsonb_build_object('tier', v_tier, 'reward', v_reward));
        end if;

        insert into public.notifications (user_id, type, title, body, icon, meta)
          values (v_referrer_id, 'referral_completed', 'Your friend joined in!',
            'They just signed up using your referral code.', 'gem',
            jsonb_build_object('referred_user_id', new.id));
      end if;
    end if;
  end if;

  return new;
end;
$$;

notify pgrst, 'reload schema';
