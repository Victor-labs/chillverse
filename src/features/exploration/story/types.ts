// src/features/exploration/story/types.ts
//
// Content shape for chamber checkpoint stories. Deliberately flat rather than
// a general node graph: every checkpoint in the brief is linear (intro ->
// pick one of three choices -> reveal -> transition), so a graph would be
// speculative flexibility we don't need yet.

export type StoryEffect =
  | { type: 'set_flag'; key: string; value?: string | number | boolean }
  | { type: 'xp_bonus'; amount: number }
  | { type: 'artifact_odds_delta'; value: number } // claim-stage only; consumed immediately by tryArtifactDrop
  | { type: 'grant_artifact'; artifactName: string } // must match a story_exclusive row in `artifacts`

export interface StoryChoiceOption {
  id: string
  label: string
  reveal: string[] // typewriter lines shown after this option is picked
  effects: StoryEffect[]
}

export interface StoryCheckpoint {
  intro: string[] // typewriter lines shown before the choice
  options: StoryChoiceOption[] // always exactly 3, per the design brief
  transition: string[] // typewriter lines shown after the reveal, before closing
}

export type CheckpointStage = 'start' | 'mid' | 'claim'

// chamberId -> stage -> checkpoint
export type ChamberStory = Record<CheckpointStage, StoryCheckpoint>

// mapId -> chamberId -> ChamberStory
export type MapStory = Record<number, ChamberStory>
