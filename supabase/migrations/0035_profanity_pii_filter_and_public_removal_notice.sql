-- supabase/migrations/0035_profanity_pii_filter_and_public_removal_notice.sql
-- ════════════════════════════════════════════════════════════════════════
-- Migration 0035 — Profanity + personal-info hard filter, real redaction,
-- and a visible "removed" placeholder for everyone (not just the author)
--
-- Two things changed from 0031/0030's behavior, both requested directly:
--
-- 1. NEW HARD CATEGORIES (instant hide + strike, same pipeline as hate
--    speech/threats/doxxing/etc from 0031):
--      - 'profanity': general swearing (fuck, bitch, shit, ...) — separate
--        from contains_blocked_language (0017), which is slurs only.
--      - 'personal_info_exposure': phone numbers (7+ digit run — same
--        pattern already accepted in 0029/0031), email addresses, and
--        common API-key/secret shapes (sk-…, AKIA…, ghp_…, "api_key=…",
--        "password=…", PEM private-key headers, etc). This used to only
--        be a soft auto-report (0029's digit-run branch); it's now a hard
--        removal since a leaked phone number or key sitting visible even
--        briefly defeats the point.
--    'kill'/'death' as bare words are deliberately NOT added here — see
--    the note at the bottom of this file for why.
--
-- 2. REAL DELETION, VISIBLE TO EVERYONE, NOT JUST THE AUTHOR:
--    Previously ALL hidden content (hard-violation or report-pending) was
--    invisible to everyone except the author and staff — other viewers
--    just saw the row vanish. That's still correct for report-pending
--    content (0030): it's unverified, could be a bad-faith report, so it
--    stays author+staff-only until a human decides.
--
--    For a confirmed hard violation it's different: this migration now
--    (a) overwrites content/body with a placeholder — the actual profane/
--        PII/threat text is gone from the live row, not just hidden by
--        RLS. It's not recoverable by inspecting network responses.
--    (b) preserves the original text ONLY in content_reports.details,
--        which stays staff-only (existing RLS), for moderation review.
--    (c) marks the row `violation = true` and relaxes SELECT so every
--        room member / reader gets the row — since content is now just a
--        placeholder, there's nothing left to leak. The client renders
--        "Message deleted by moderator" to everyone except the author,
--        who instead gets the Terms-and-Conditions notice (client-side
--        logic — see HiddenContentNotice.tsx).
-- ════════════════════════════════════════════════════════════════════════

-- ── 1. New columns: `violation` flags a confirmed hard removal (as
-- opposed to `hidden` alone, which also covers unverified report-pending
-- content from 0030 and should stay author+staff-only). ─────────────────
alter table public.messages add column if not exists violation boolean not null default false;
alter table public.posts    add column if not exists violation boolean not null default false;
alter table public.comments add column if not exists violation boolean not null default false;

-- ── 2. Soft tier narrows further: the bare 7+ digit run moves to the hard
-- tier below, so drop it here to avoid double-firing (one hard removal +
-- one redundant soft auto-report for the same message). ─────────────────
create or replace function public.flag_reason_for_content(input text)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when input ~* '\m(add me on|dm me on|message me on)\s*(whatsapp|snap(chat)?|telegram|kik|instagram|discord)\M'
      then 'Possible off-platform contact solicitation'
    else null
  end;
$$;

-- ── 3. Profanity + personal-info detectors ───────────────────────────
create or replace function public.contains_profanity(input text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select input ~* '\m(fuck(s|ing|ed|er|face|tard)?|mother\s*fucker|bitch(es|y)?|shit(ty|head)?|bullshit|assh?ole|dickhead|bastard|slut|whore|piss\s*off|cunt)\M';
$$;

create or replace function public.contains_personal_info(input text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select
    -- email address
    input ~* '[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}'
    -- phone number: same 7+ consecutive digit heuristic already used
    -- (and accepted as a reasonable false-positive tradeoff) in 0029/0031
    or input ~ '\d{7,}'
    -- common API key / secret / token shapes
    or input ~* '\m(sk-[a-zA-Z0-9]{10,}|pk_(live|test)_[a-zA-Z0-9]{10,}|AKIA[0-9A-Z]{12,}|ghp_[a-zA-Z0-9]{20,}|xox[baprs]-[a-zA-Z0-9-]{10,})\M'
    or input ~* '-----BEGIN [A-Z ]*PRIVATE KEY-----'
    -- "api_key: ...", "password=...", "secret: ..." style key/value leaks
    or input ~* '\m(api[_-]?key|secret|password|access[_-]?token)\s*[:=]\s*\S{6,}';
$$;

-- ── 4. Extend the hard-violation classifier (0031) with the two new
-- categories. Order matters only in that more specific categories above
-- (hate speech, threats, self-harm, doxxing, illegal activity, phishing)
-- still take priority if a message somehow matches more than one. ───────
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
    when public.contains_personal_info(input)
      then 'personal_info_exposure'
    when public.contains_profanity(input)
      then 'profanity'
    else null
  end;
$$;

-- ── 5. handle_hard_violation gets an extra p_original_content param so it
-- can save the real text into content_reports.details before the caller
-- scrubs the live row. Old 4-arg version is dropped since nothing else
-- should call it without an original-content snapshot going forward. ────
drop function if exists public.handle_hard_violation(uuid, text, text, uuid);

create or replace function public.handle_hard_violation(
  p_user_id uuid, p_category text, p_target_type text, p_target_id uuid, p_original_content text
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
            left('Automatically removed: ' || p_category || ' | original content: ' || p_original_content, 500),
            'actioned');

  insert into public.moderation_log (moderator_id, action, target_type, target_id, reason, metadata)
    values (null, 'auto_violation', p_target_type, p_target_id, p_category, jsonb_build_object('user_id', p_user_id));

  if p_user_id is null then
    return;
  end if;

  insert into public.strikes (user_id, category, target_type, target_id)
    values (p_user_id, p_category, p_target_type, p_target_id);

  select count(*) into v_strike_count from public.strikes where user_id = p_user_id;

  if v_strike_count = v_alert_threshold then
    insert into public.staff_alerts (user_id, strike_count)
      values (p_user_id, v_strike_count);
  end if;
end;
$$;

-- ── 6. Per-table triggers: redact the live row + mark violation=true so
-- RLS (step 7) can safely open it up to every reader. ────────────────────
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
      set hidden = true, violation = true,
          hidden_reason = 'Your message was taken down because it goes against our Terms and Conditions.',
          hidden_at = now(),
          content = '[message removed]'
      where id = new.id;
    perform public.handle_hard_violation(new.sender_id, v_category, 'message', new.id, new.content);
  end if;
  return new;
end;
$$;

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
      set hidden = true, violation = true,
          hidden_reason = 'Your post was taken down because it goes against our Terms and Conditions.',
          hidden_at = now(),
          body = '[post removed]'
      where id = new.id;
    perform public.handle_hard_violation(new.author_id, v_category, 'post', new.id, new.body);
  end if;
  return new;
end;
$$;

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
      set hidden = true, violation = true,
          hidden_reason = 'Your comment was taken down because it goes against our Terms and Conditions.',
          hidden_at = now(),
          body = '[comment removed]'
      where id = new.id;
    perform public.handle_hard_violation(new.author_id, v_category, 'comment', new.id, new.body);
  end if;
  return new;
end;
$$;

-- (triggers themselves already exist from 0031 pointing at these function
-- names via CREATE OR REPLACE FUNCTION above — no need to re-create them)

-- ── 7. RLS: a `violation = true` row is safe to show to everyone, since
-- its content/body column is now just a placeholder. Report-pending rows
-- (hidden = true, violation = false) stay author+staff-only, unchanged. ──
drop policy if exists "messages_select" on public.messages;
create policy "messages_select" on public.messages
  for select using (
    exists (select 1 from public.room_members rm where rm.room_id = messages.room_id and rm.user_id = auth.uid())
    and (not hidden or violation or sender_id = auth.uid() or public.is_staff(auth.uid()))
  );

drop policy if exists "posts are publicly readable" on public.posts;
create policy "posts are publicly readable" on public.posts
  for select using ((not hidden) or violation or author_id = auth.uid() or public.is_staff(auth.uid()));

drop policy if exists "comments are publicly readable" on public.comments;
create policy "comments are publicly readable" on public.comments
  for select using ((not hidden) or violation or author_id = auth.uid() or public.is_staff(auth.uid()));

-- ── 8. mod_get_report_context now also returns the report's own `details`
-- string, which is where the real original content lives post-redaction
-- (step 5). Staff still see exactly what was posted; it's just no longer
-- sitting live in the messages/posts/comments row itself. ───────────────
create or replace function public.mod_get_report_context(p_report_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_report public.content_reports%rowtype;
  v_result jsonb;
begin
  if v_caller is null or not public.is_staff(v_caller) then
    raise exception 'CV_MOD_FORBIDDEN: staff only';
  end if;

  select * into v_report from public.content_reports where id = p_report_id;
  if not found then
    raise exception 'CV_MOD_NOT_FOUND: report not found';
  end if;

  if v_report.target_type = 'user' then
    select jsonb_build_object(
      'username', username, 'display_name', display_name
    ) into v_result from public.profiles where id = v_report.target_id;
  elsif v_report.target_type = 'message' then
    select jsonb_build_object(
      'content', m.content, 'deleted', m.deleted, 'sender_id', m.sender_id,
      'sender_username', p.username, 'created_at', m.created_at
    ) into v_result
    from public.messages m left join public.profiles p on p.id = m.sender_id
    where m.id = v_report.target_id;
  elsif v_report.target_type = 'post' then
    select jsonb_build_object(
      'body', body, 'author_id', author_id, 'created_at', created_at
    ) into v_result from public.posts where id = v_report.target_id;
  elsif v_report.target_type = 'comment' then
    select jsonb_build_object(
      'body', body, 'author_id', author_id, 'post_id', post_id, 'created_at', created_at
    ) into v_result from public.comments where id = v_report.target_id;
  end if;

  v_result := coalesce(v_result, jsonb_build_object('note', 'target no longer exists'));
  v_result := v_result || jsonb_build_object('report_details', v_report.details);

  return v_result;
end;
$$;

revoke execute on function public.mod_get_report_context(uuid) from public;
grant execute on function public.mod_get_report_context(uuid) to authenticated;

alter table public.moderation_log drop constraint if exists moderation_log_action_check;
alter table public.moderation_log add constraint moderation_log_action_check check (action in (
  'ban', 'suspend', 'unban', 'set_role',
  'delete_message', 'delete_post', 'delete_comment', 'review_report',
  'auto_hide', 'unhide', 'auto_violation', 'resolve_alert'
));

notify pgrst, 'reload schema';

-- ════════════════════════════════════════════════════════════════════════
-- Why bare "kill" / "death" are NOT added as hard-block keywords:
--
-- This is a gaming/social app — "kill the boss", "that killed me 😭",
-- "death match", "I'm dead 💀" are extremely common, harmless chat. A
-- blanket match on the bare words would auto-delete a large share of
-- completely normal messages and give every user a strike toward a ban
-- for playing the game. The targeted patterns already in place (0031)
-- catch the actual dangerous cases with much better precision:
--   - direct 2nd-person threats: "i will kill you", "i know where you live"
--   - self-harm directed at someone else: "kill yourself", "kys", "go die"
-- If there's a specific phrase pattern getting through that you want
-- caught (e.g. a particular threat wording you're seeing in reports),
-- that's a precise regex addition here rather than the bare words —
-- happy to add it if you point to what you're seeing.
-- ════════════════════════════════════════════════════════════════════════
