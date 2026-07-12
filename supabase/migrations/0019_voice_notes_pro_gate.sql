-- supabase/migrations/0019_voice_notes_pro_gate.sql
--
-- Fixes discrepancy #1: voice notes were meant to sit behind the Pro
-- paywall, but nothing enforced it anywhere. Per product decision: Orbit
-- and Void both keep voice notes; Free loses them.
--
-- Client-side, Chat.tsx already hides the recorder and shows a lock icon
-- for non-Pro players — this trigger is the real enforcement, since the
-- client check can be bypassed by calling the Supabase client directly.

create or replace function public.enforce_voice_note_pro_gate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_pro boolean;
  v_expires timestamptz;
begin
  if new.type <> 'voice_note' then
    return new;
  end if;

  select is_pro, pro_expires_at into v_is_pro, v_expires
    from public.profiles
    where id = new.sender_id;

  if not coalesce(v_is_pro, false) or (v_expires is not null and v_expires <= now()) then
    raise exception 'CV_VOICE_NOTES_PRO_ONLY: voice notes require Chillverse Pro (Orbit or Void)';
  end if;

  return new;
end;
$$;

drop trigger if exists on_message_voice_note_pro_gate on public.messages;
create trigger on_message_voice_note_pro_gate
  before insert on public.messages
  for each row execute function public.enforce_voice_note_pro_gate();
