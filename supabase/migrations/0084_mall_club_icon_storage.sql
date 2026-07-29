-- 0084_mall_club_icon_storage.sql
--
-- Storage bucket for `mall_items` rows with category = 'club_icon'
-- (referenced by chat_rooms.icon_mall_item_id via create_club /
-- update_club_settings — see 0083). This is infrastructure only: no
-- club_icon mall_items are seeded here, because doing so would mean
-- inserting image_url values that don't point at real uploaded assets.
-- Every existing cosmetic category (avatar_skin, banner, profile_pic)
-- uses real image files in its bucket — club icons should follow the
-- same pattern once the actual artwork is ready to upload, rather than
-- shipping placeholder rows with broken links.
--
-- Until then, create_club / update_club_settings both already accept
-- p_icon_mall_item_id = null just fine — clubs render a generated
-- gradient+initial icon in that case (see ClubsList.tsx / ClubChat.tsx),
-- the same fallback Avatar.tsx uses everywhere else in the app.

insert into storage.buckets (id, name, public)
values ('club-icons', 'club-icons', true)
on conflict (id) do nothing;

drop policy if exists "club icons are publicly readable" on storage.objects;
create policy "club icons are publicly readable"
  on storage.objects for select
  using (bucket_id = 'club-icons');

drop policy if exists "only staff can manage club icon assets" on storage.objects;
create policy "only staff can manage club icon assets"
  on storage.objects for all
  using (bucket_id = 'club-icons' and is_staff(auth.uid()))
  with check (bucket_id = 'club-icons' and is_staff(auth.uid()));
