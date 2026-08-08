// src/features/exploration/explorationMaps.ts
//
// Map/chamber data, moved out of Exploration.tsx so RegionMap.tsx can read it
// without importing the page component. The only new fields versus the old
// inline array are `entry` and each chamber's `x`/`y` — the coordinates that
// turn the chamber list into an actual map.
//
// Coordinates are percentages of the rendered map canvas (0–100, origin
// top-left), NOT pixels, so they hold at any screen size. They're hand-placed
// to read as a meandering route rather than a straight line; they don't
// correspond to anything in the underlying artwork, so re-tuning one is just
// editing two numbers here.

export interface Chamber {
  id: number
  name: string
  baseTimeHours: number
  xpReward: number
  artifact: boolean
  /** Energy spent to send an expedition here. Rises with depth within a
   *  region and with region tier — see the ENERGY BUDGET note below. */
  energyCost: number
  /** Node position on the map canvas, % of width (0–100, left to right). */
  x: number
  /** Node position on the map canvas, % of height (0–100, top to bottom). */
  y: number
}

export interface ExplorationMap {
  id: number
  name: string
  tier: string
  xpRequired: number
  image: string
  artifactLocation: string   // matches artifacts.location in DB
  /** Where the traveller marker sits before any chamber is cleared, and the
   *  point the first leg of the route departs from. */
  entry: { x: number; y: number }
  chambers: Chamber[]
}

/** Live state of one chamber run, hydrated from exploration_chamber_runs. */
export interface ChamberState {
  status: 'idle' | 'running' | 'done'
  startedAt?: number      // ms timestamp
  durationMs?: number     // total ms for this run
  artifactFound?: boolean // only true if the artifact roll actually hit
}

export const MAX_ENERGY = 200

// ── ENERGY BUDGET ───────────────────────────────────────────────
// Every chamber used to cost the full 200 bar. Because chambers are also
// sequentially gated (chamber N+1 needs N cleared, and a region needs the
// previous region fully cleared), only one expedition can ever be live at
// once — so a full-bar price never limited *parallelism*, it only inserted
// dead time between runs. The map sat idle while the bar refilled.
//
// Costs are now per-chamber, rising with depth inside a region and with the
// region's tier. The intent: after a five-hour run completes you can usually
// start the next site straight away in the early regions, while the deepest
// Void sites still cost most of a bar and remain a real commitment.
//
// TUNING NOTE — the refill rate lives server-side in get_exploration_energy
// and isn't visible from the client, so these were set against the *shape*
// of the curve rather than a measured refill. If a full bar takes roughly as
// long to refill as a chamber takes to run, these land about right. If it's
// much slower, scale the whole table down proportionally.
//
// Totals per region: I 260 · II 365 · III 475 · IV 605 (was 1000 each).

// xpRequired values carry a flat +5% bump over their original figures
// (30000->31500, 90000->94500, 250000->262500) on top of the sequential
// full-completion gate in Exploration.tsx — the two gates are independent
// and both must pass to unlock a map.
export const MAPS: ExplorationMap[] = [
  {
    id: 1, name: 'Greenfields', tier: 'I', xpRequired: 0,
    artifactLocation: 'Greenfields',
    image: 'https://gnobzfxtxrtcxfhhfjni.supabase.co/storage/v1/object/public/Artefacts/Map/2f3de4d78ede24c46d7a8ecf5f67b9c0.webp.jpg',
    entry: { x: 6, y: 92 },
    chambers: [
      { id: 1, name: 'Mossy Gate',      baseTimeHours: 5, xpReward: 70,   artifact: false, energyCost:  30, x: 18, y: 82 },
      { id: 2, name: 'Thornwood Pass',  baseTimeHours: 5, xpReward: 110,  artifact: true, energyCost:  40, x: 33, y: 56 },
      { id: 3, name: 'Sunken Altar',    baseTimeHours: 5, xpReward: 180,  artifact: false, energyCost:  50, x: 59, y: 70 },
      { id: 4, name: 'Root Labyrinth',  baseTimeHours: 5, xpReward: 260,  artifact: true, energyCost:  60, x: 71, y: 42 },
      { id: 5, name: 'The Deep Hollow', baseTimeHours: 5, xpReward: 550,  artifact: true, energyCost:  80, x: 47, y: 19 },
    ],
  },
  {
    id: 2, name: 'Crystal Lake', tier: 'II', xpRequired: 31500,
    artifactLocation: 'Crystal Lake',
    image: 'https://gnobzfxtxrtcxfhhfjni.supabase.co/storage/v1/object/public/Artefacts/Map/45a3c9b17775c774156c9c924ed4a89e.webp.jpg',
    entry: { x: 5, y: 58 },
    chambers: [
      { id: 1, name: 'Ember Arch',      baseTimeHours: 5, xpReward: 400,  artifact: false, energyCost:  45, x: 16, y: 71 },
      { id: 2, name: 'Cinder Hall',     baseTimeHours: 5, xpReward: 650,  artifact: true, energyCost:  55, x: 33, y: 84 },
      { id: 3, name: 'Obsidian Court',  baseTimeHours: 5, xpReward: 900,  artifact: false, energyCost:  70, x: 53, y: 61 },
      { id: 4, name: 'The Ashen Keep',  baseTimeHours: 5, xpReward: 1200, artifact: false, energyCost:  85, x: 76, y: 68 },
      { id: 5, name: 'Pyroclast Vault', baseTimeHours: 5, xpReward: 2500, artifact: true, energyCost: 110, x: 64, y: 24 },
    ],
  },
  {
    id: 3, name: 'Under World', tier: 'III', xpRequired: 94500,
    artifactLocation: 'Under World',
    image: 'https://gnobzfxtxrtcxfhhfjni.supabase.co/storage/v1/object/public/Artefacts/Map/7c15d735d2aeb8fff833fdd949d5c4a3.jpg',
    entry: { x: 8, y: 94 },
    chambers: [
      { id: 1, name: 'Salt Shore',        baseTimeHours: 5, xpReward: 1200, artifact: false, energyCost:  60, x: 21, y: 85 },
      { id: 2, name: 'Kelp Maze',         baseTimeHours: 5, xpReward: 2000, artifact: true, energyCost:  75, x: 41, y: 69 },
      { id: 3, name: 'Drowned Citadel',   baseTimeHours: 5, xpReward: 3500, artifact: false, energyCost:  90, x: 25, y: 42 },
      { id: 4, name: 'Abyss Gate',        baseTimeHours: 5, xpReward: 6000, artifact: true, energyCost: 110, x: 57, y: 33 },
      { id: 5, name: 'The Sunken Throne', baseTimeHours: 5, xpReward: 9000, artifact: false, energyCost: 140, x: 79, y: 17 },
    ],
  },
  {
    id: 4, name: 'The Void', tier: 'IV', xpRequired: 262500,
    artifactLocation: 'The Void',
    image: 'https://gnobzfxtxrtcxfhhfjni.supabase.co/storage/v1/object/public/Artefacts/Map/ecaf76f4607a37f03cfaac5babbc2826.jpg',
    entry: { x: 10, y: 92 },
    chambers: [
      { id: 1, name: 'Cloud Vestibule', baseTimeHours: 5, xpReward: 3000,  artifact: false, energyCost:  80, x: 25, y: 79 },
      { id: 2, name: 'Star Corridor',   baseTimeHours: 5, xpReward: 5000,  artifact: true, energyCost:  95, x: 47, y: 73 },
      { id: 3, name: 'Void Sanctum',    baseTimeHours: 5, xpReward: 8000,  artifact: true, energyCost: 115, x: 37, y: 49 },
      { id: 4, name: 'Ether Pinnacle',  baseTimeHours: 5, xpReward: 11000, artifact: true, energyCost: 140, x: 63, y: 39 },
      { id: 5, name: 'The Apex',        baseTimeHours: 5, xpReward: 15000, artifact: true, energyCost: 175, x: 51, y: 15 },
    ],
  },
]

export const TIER_COLORS: Record<string, string> = {
  'I': '#3ecf8e', 'II': '#4f8ef7', 'III': '#9b6dff', 'IV': '#f5c542',
}

export function tierColor(tier: string) {
  return TIER_COLORS[tier] ?? '#9b6dff'
}

/** Cheapest and dearest site in a region, for the region-select card. */
export function energyRange(map: ExplorationMap): [number, number] {
  const costs = map.chambers.map(c => c.energyCost)
  return [Math.min(...costs), Math.max(...costs)]
}
