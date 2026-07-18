-- Public aggregate of how many distinct users own each mall item.
-- Mirrors the existing wishlist_counts view: a plain view (not
-- security_invoker) so it aggregates across every user's inventory rows
-- regardless of the caller's own RLS visibility into user_inventory,
-- exposing only the count — never who owns what.
create or replace view public.item_owner_counts as
  select item_id, count(distinct user_id)::int as count
  from public.user_inventory
  group by item_id;

grant select on public.item_owner_counts to anon, authenticated;
