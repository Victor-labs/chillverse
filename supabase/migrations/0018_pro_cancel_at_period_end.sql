-- supabase/migrations/0018_pro_cancel_at_period_end.sql
--
-- Fixes the "phantom cancel button" discrepancy: Pro.tsx told players
-- "Cancel anytime from Settings" but no cancellation flow existed anywhere
-- in the app. This column backs the real one added in Settings.tsx, wired
-- to the new `cancel-premium` edge function.

alter table public.profiles
  add column if not exists pro_cancel_at_period_end boolean not null default false;

comment on column public.profiles.pro_cancel_at_period_end is
  'true once the user has cancelled their Paystack subscription; is_pro/pro_tier/pro_expires_at stay as-is so they keep access until pro_expires_at, but no renewal charge will happen after that.';
