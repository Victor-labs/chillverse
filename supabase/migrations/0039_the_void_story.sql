-- supabase/migrations/0039_the_void_story.sql
--
-- Adds The Void's two story-exclusive artifacts. No schema or function
-- changes — apply_story_checkpoint, exploration_chamber_runs.story_state,
-- and user_story_flags are already map-agnostic (keyed by map_id, not
-- hardcoded to any prior region), so map 4's story content
-- (src/features/exploration/story/content/map4.ts) works against
-- 0036_exploration_story.sql as-is. This migration only needs to seed
-- the two rows that content's `grant_artifact` effects target — both on
-- chamber 5's (The Apex) claim stage, the only claim stage in this map
-- that grants (chambers 2-4 carry artifact_odds_delta only).
--
-- xp_bonus / artifact_odds_delta values used in map4.ts stay within the
-- same ceiling as map1.ts/map2.ts/map3.ts (30 XP / 0.20 odds), so the
-- bounds documented in 0036 remain accurate without changes there.
--
-- REMAINING TODO — same as 0036/0037/0038: the two rows below reuse the
-- The Void map splash image as a placeholder media_url, per the
-- established fallback for this project; swap in real starlight-shard/
-- kept-sky artifact artwork before this ships.

insert into public.artifacts (id, name, location, reward_xp, tier, media_url, media_type, story_exclusive)
values
  ('vo_iris_starlight_shard', 'Iri''s Starlight Shard', 'The Void', 8000, 'mythic',
    'https://gnobzfxtxrtcxfhhfjni.supabase.co/storage/v1/object/public/Artefacts/Map/ecaf76f4607a37f03cfaac5babbc2826.jpg',
    'image', true),
  ('vo_iris_kept_sky', 'Iri''s Kept Sky', 'The Void', 8000, 'mythic',
    'https://gnobzfxtxrtcxfhhfjni.supabase.co/storage/v1/object/public/Artefacts/Map/ecaf76f4607a37f03cfaac5babbc2826.jpg',
    'image', true)
on conflict (id) do nothing;
