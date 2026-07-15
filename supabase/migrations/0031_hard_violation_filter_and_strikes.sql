-- supabase/migrations/0031_hard_violation_filter_and_strikes.sql
-- ════════════════════════════════════════════════════════════════════════
-- Migration 0031 — Hard violation filter, strikes, and staff alerts
--
-- IMPORTANT DESIGN NOTES — read before touching this file again:
--
-- 1. WHAT THIS DOES vs. WHAT IT DOESN'T:
--    Text pattern matching is genuinely reliable for: slurs (already had
--    this, see contains_blocked_language from 0017), direct 2nd-person
--    threats, self-harm language directed AT someone else, doxxing intent
--    phrases, drug/weapon sale solicitation, and phishing/scam bait.
--    It is NOT reliable for "graphic violence" or "terrorism/extremism" as
--    open-ended categories — a keyword list either misses everything real
--    (attackers don't announce themselves in obvious words) or flags a
--    huge amount of normal chat in a gaming app ("let's kill the boss").
--    Those two stay human-judgment categories: caught via the reports
--    queue and staff review, not this filter. Building a keyword list for
--    them would give false confidence, not real protection.
--
-- 2. SELF-HARM: this ONLY matches language directed at someone else
--    ("kill yourself", "kys") — never a user's own disclosure ("I want to
--    kill myself", "I'm suicidal"). Auto-deleting someone's own cry for
--    help would be actively harmful, not protective. If Chillverse ever
--    wants to detect and respond to self-disclosed distress, that needs
--    to route to support resources, not this filter — a separate feature,
--    intentionally not built here.
--
-- 3. CSAM / sexual content involving minors: deliberately NOT handled by
--    a keyword/slang list in this migration. Two reasons: (a) compiling a
--    list of coded terms used to evade detection is itself something that
--    shouldn't be written into a shared codebase — it becomes a lookup
--    table for exactly the people trying to evade it, and it goes stale
--    immediately as terms rotate; (b) it isn't how this is actually
--    caught at real platforms — that's image/video hash-matching against
--    known-content databases (PhotoDNA, Thorn Safer, Google CSAI Match),
--    which only matters once Chillverse has an image/video upload surface
--    (it currently doesn't — checked: avatars are preset, only audio
--    voice notes are user-uploaded). Two concrete asks for you, separate
--    from this migration: (1) before shipping ANY user image/video
--    upload feature, integrate one of those hash-matching services first,
--    not after; (2) if a report or moderator review ever turns up actual
--    CSAM, US-based platforms have a LEGAL duty to report it to NCMEC's
--    CyberTipline — that's not a "ban or don't ban" board decision, it's
--    a mandatory report on top of whatever account action is taken.
--
-- 4. Existing hard-block behavior CHANGES here: 0017's slur filter used to
--    REJECT the insert outright (the row never existed, sender got a bare
--    error). This migration switches that to the same insert-then-hide
--    flow as every other hard category, per your spec: the row is
--    created, instantly hidden, sender sees a violation notice inline,
--    everyone else sees nothing (RLS), and it counts as a strike. The old
--    BEFORE INSERT reject-triggers are dropped in favor of this.
-- ════════════════════════════════════════════════════════════════════════

-- ── 1. Soft tier (0029) narrows to ONLY off-platform contact solicitation.
-- Self-harm-at-others and scam/phishing move to the hard tier below. ──
create or replace function public.flag_reason_for_content(input text)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when input ~ '\d{7,}'
      or input ~* '\m(add me on|dm me on|message me on)\s*(whatsapp|snap(chat)?|telegram|kik|instagram|discord)\M'
      then 'Possible off-platform contact solicitation'
    else null
  end;
$$;

-- ── 2. Hard tier: instant hide + strike ──────────────────────────────
create or replace function public.flag_hard_violation(input text)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when public.contains_blocked_language(input)
      then 'hate_speech'
    when input ~* '\m(i will kill you|i''ll kill you|i will hurt you|i''ll hurt you|i will beat you up|gonna kill you|i know where you live)\M'
      then 'threat_of_violence'
    when input ~* '\m(kill\s*yourself|kys|go die)\M'
      then 'self_harm_directed'
    when input ~* '\m((his|her|their) (home )?address is|i (found|have) (your|his|her|their) (address|phone number|ssn|social security))\M'
      then 'doxxing'
    when input ~* '\m(selling (weed|drugs|guns|firearms|cocaine|meth)|buy (weed|drugs|guns) (here|from me)|dm (me )?to buy (drugs|weed|guns))\M'
      then 'illegal_activity'
    when input ~* '\m(click here|free (robux|diamonds|gems|v-?bucks)|verify your account|claim your prize)\M'
      then 'phishing_scam'
    else null
  end;
$$;

-- ── 3. strikes ────────────────────────────────────────────────────────
create table if not exists public.strikes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  category    text not null,
  target_type text not null check (target_type in ('message', 'post', 'comment')),
  target_id   uuid not null,
  created_at  timestamptz not null default now()
);

create index if not exists strikes_user_idx on public.strikes (user_id, created_at desc);

alter table public.strikes enable row level security;
drop policy if exists "staff can view strikes" on public.strikes;
create policy "staff can view strikes" on public.strikes
  for select using (public.is_staff(auth.uid()));
-- No insert/update/delete policy — only written by the trigger below.

-- ── 4. staff_alerts — the "ping" when someone crosses the threshold ────
create table if not exists public.staff_alerts (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  strike_count int not null,
  resolved     boolean not null default false,
  resolved_by  uuid references public.profiles(id) on delete set null,
  resolved_at  timestamptz,
  created_at   timestamptz not null default now()
);

create index if not exists staff_alerts_unresolved_idx on public.staff_alerts (resolved, created_at desc) where not resolved;

alter table public.staff_alerts enable row level security;
drop policy if exists "staff can view alerts" on public.staff_alerts;
create policy "staff can view alerts" on public.staff_alerts
  for select using (public.is_staff(auth.uid()));
-- No insert/update/delete policy — written by the trigger and mod_resolve_alert() only.

alter table public.moderation_log drop constraint if exists moderation_log_action_check;
alter table public.moderation_log add constraint moderation_log_action_check check (action in (
  'ban', 'suspend', 'unban', 'set_role',
  'delete_message', 'delete_post', 'delete_comment', 'review_report',
  'auto_hide', 'unhide', 'auto_violation', 'resolve_alert'
));

create or replace function public.mod_resolve_alert(p_alert_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
begin
  if v_caller is null or not public.is_staff(v_caller) then
    raise exception 'CV_MOD_FORBIDDEN: staff only';
  end if;

  update public.staff_alerts
    set resolved = true, resolved_by = v_caller, resolved_at = now()
    where id = p_alert_id;

  if not found then
    raise exception 'CV_MOD_NOT_FOUND: alert not found';
  end if;

  insert into public.moderation_log (moderator_id, action, target_type, target_id)
    values (v_caller, 'resolve_alert', 'user', (select user_id from public.staff_alerts where id = p_alert_id));
end;
$$;

revoke execute on function public.mod_resolve_alert(uuid) from public;
grant execute on function public.mod_resolve_alert(uuid) to authenticated;

-- ── 5. The core per-table handler: hide + report + strike + maybe-alert ──
create or replace function public.handle_hard_violation(
  p_user_id uuid, p_category text, p_target_type text, p_target_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_strike_count int;
  v_alert_threshold constant int := 6;
begin
  insert into public.content_reports (reporter_id, target_type, target_id, reason, details, status)
    values (null, p_target_type, p_target_id, 'auto_flagged',
            'Automatically removed: ' || p_category, 'actioned');

  insert into public.moderation_log (moderator_id, action, target_type, target_id, reason, metadata)
    values (null, 'auto_violation', p_target_type, p_target_id, p_category, jsonb_build_object('user_id', p_user_id));

  -- Guard: system/admin-authored content (author_id can be null) still gets
  -- hidden and logged above, it just can't accrue a strike against nobody.
  if p_user_id is null then
    return;
  end if;

  insert into public.strikes (user_id, category, target_type, target_id)
    values (p_user_id, p_category, p_target_type, p_target_id);

  select count(*) into v_strike_count from public.strikes where user_id = p_user_id;

  -- Fire exactly once per threshold crossing, not on every strike after it.
  if v_strike_count = v_alert_threshold then
    insert into public.staff_alerts (user_id, strike_count)
      values (p_user_id, v_strike_count);
  end if;
end;
$$;

-- ── 6. Per-table triggers ─────────────────────────────────────────────
drop trigger if exists on_message_profanity_check on public.messages;
drop trigger if exists on_post_profanity_check on public.posts;
drop trigger if exists on_comment_profanity_check on public.comments;

create or replace function public.auto_hard_violation_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_category text := public.flag_hard_violation(new.content);
begin
  if v_category is not null then
    update public.messages
      set hidden = true, hidden_reason = 'This message goes against our Terms and Conditions and has been removed.', hidden_at = now()
      where id = new.id;
    perform public.handle_hard_violation(new.sender_id, v_category, 'message', new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists on_message_hard_violation on public.messages;
create trigger on_message_hard_violation
  after insert on public.messages
  for each row execute function public.auto_hard_violation_message();

create or replace function public.auto_hard_violation_post()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_category text := public.flag_hard_violation(new.body);
begin
  if v_category is not null then
    update public.posts
      set hidden = true, hidden_reason = 'This post goes against our Terms and Conditions and has been removed.', hidden_at = now()
      where id = new.id;
    perform public.handle_hard_violation(new.author_id, v_category, 'post', new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists on_post_hard_violation on public.posts;
create trigger on_post_hard_violation
  after insert on public.posts
  for each row execute function public.auto_hard_violation_post();

create or replace function public.auto_hard_violation_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_category text := public.flag_hard_violation(new.body);
begin
  if v_category is not null then
    update public.comments
      set hidden = true, hidden_reason = 'This comment goes against our Terms and Conditions and has been removed.', hidden_at = now()
      where id = new.id;
    perform public.handle_hard_violation(new.author_id, v_category, 'comment', new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists on_comment_hard_violation on public.comments;
create trigger on_comment_hard_violation
  after insert on public.comments
  for each row execute function public.auto_hard_violation_comment();

notify pgrst, 'reload schema';
