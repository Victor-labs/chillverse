// src/features/exploration/story/content/index.ts
//
// Merges every map's story content into the single STORY_CONTENT lookup
// Exploration.tsx reads from (mapId -> chamberId -> ChamberStory). Maps
// with no authored story simply have no key here — getCheckpoint() in
// Exploration.tsx already treats a missing entry as "no story content,"
// so adding a new region is just adding its import + spread below, no
// other change needed at the call site.

import type { ChamberStory } from '../types'
import { STORY_CONTENT as GREENFIELDS_STORY } from './map1'
import { STORY_CONTENT as CRYSTAL_LAKE_STORY } from './map2'

export const STORY_CONTENT: Record<number, Record<number, ChamberStory>> = {
  ...GREENFIELDS_STORY,
  ...CRYSTAL_LAKE_STORY,
}
