-- supabase/migrations/0093_signup_metadata_and_referral_on_signup.sql
-- ALREADY APPLIED to the live database via MCP (migration name
-- "signup_metadata_and_referral_on_signup"). Kept here so the repo mirrors
-- production.
-- ════════════════════════════════════════════════════════════════════════
-- Fixes two live bugs, confirmed against production data before writing
-- this migration:
--
-- 1. SIGNUP DATA LOSS: signUpWithEmail() never sent the entered username /
--    display name / country / interests / dob / platform to Supabase, so
--    they only ever got saved by a client-side upsertProfile() call *after*
--    signup — which only runs if a session already exists at that exact
--    moment. Any account created while email confirmation is required (or
--    where the tab was closed before the client call ran) permanently kept
--    the auto-generated email-prefix fallback username/display name
--    forever, which read as "the Gmail name" to users testing with Gmail
--    addresses. Fix: send this data as auth signUp() metadata so the DB
--    trigger can apply it immediately and reliably, independent of session
--    timing, tab, or device.
--
-- 2. REFERRALS NOT COUNTING: apply_referral_code() was only ever called
--    client-side after signup succeeded with a live session (same gap as
--    above), and the actual reward/count (complete_referral()) only fired
--    after the referred user's first completed game — so referrals were
--    both under-counted AND badly delayed. Separately, complete_referral()
--    granted diamonds via a plain UPDATE on user_wallets, which silently
--    grants nothing if the wallet row doesn't exist yet (confirmed no
--    auto-create trigger exists for user_wallets). Fix: apply + credit the
--    referral immediately at account-creation time in this same trigger,
--    using insert-or-update for the wallet grant, gated by a per-device
--    fraud check so one device can't farm multiple referral payouts.
-- ════════════════════════════════════════════════════════════════════════

alter table public.profiles
  add column if not exists signup_device_id text;

create index if not exists idx_profiles_signup_device_id
  on public.profiles (signup_device_id)
  where signup_device_id is not null;

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
  v_topup               int;
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

        insert into public.user_wallets (user_id, gem_balance)
          values (new.id, 10)
          on conflict (user_id)
          do update set gem_balance = public.user_wallets.gem_balance + excluded.gem_balance,
                        updated_at = now();
        insert into public.diamond_transactions (user_id, reference, amount, description)
          values (new.id, 'referral:welcome', 10, 'Referral bonus — welcome to Chillverse');

        insert into public.user_wallets (user_id, gem_balance)
          values (v_referrer_id, 10)
          on conflict (user_id)
          do update set gem_balance = public.user_wallets.gem_balance + excluded.gem_balance,
                        updated_at = now();
        insert into public.diamond_transactions (user_id, reference, amount, description)
          values (v_referrer_id, 'referral:' || new.id, 10, 'Referral bonus — a friend joined');

        update public.profiles
          set referral_count = referral_count + 1
          where id = v_referrer_id
          returning referral_count, referral_tier_paid into v_new_count, v_prev_tier_paid;

        select tier, reward into v_tier, v_reward from public.referral_tier_reward(v_new_count);

        if v_tier is not null and v_tier > v_prev_tier_paid then
          v_topup := v_reward - coalesce((select reward from public.referral_tier_reward(v_prev_tier_paid)), 0);

          insert into public.user_wallets (user_id, gem_balance)
            values (v_referrer_id, v_topup)
            on conflict (user_id)
            do update set gem_balance = public.user_wallets.gem_balance + excluded.gem_balance,
                          updated_at = now();
          insert into public.diamond_transactions (user_id, reference, amount, description)
            values (v_referrer_id, 'referral_milestone:' || v_tier, v_topup, 'Referral milestone reached — tier ' || v_tier);

          update public.profiles set referral_tier_paid = v_tier where id = v_referrer_id;

          insert into public.notifications (user_id, type, title, body, icon, meta)
            values (v_referrer_id, 'referral_milestone', 'Referral milestone reached! 🎉',
              format('You''ve referred %s friends — +%s diamonds added.', v_new_count, v_topup), 'gem',
              jsonb_build_object('tier', v_tier, 'reward', v_topup));
        end if;

        insert into public.notifications (user_id, type, title, body, icon, meta)
          values (v_referrer_id, 'referral_completed', 'Your friend joined in!',
            'They just signed up — you both earned 10 diamonds.', 'gem',
            jsonb_build_object('referred_user_id', new.id));
      end if;
    end if;
  end if;

  return new;
end;
$$;

notify pgrst, 'reload schema';
