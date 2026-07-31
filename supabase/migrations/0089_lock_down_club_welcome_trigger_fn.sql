-- post_club_welcome_message is a trigger-only function (fires on room_members
-- insert). It should never be callable directly as an RPC — revoke from
-- anon/authenticated/public, same pattern as 0013's DM room hardening.
-- Postgres triggers can still invoke it regardless of these grants.
revoke execute on function public.post_club_welcome_message() from public, anon, authenticated;
