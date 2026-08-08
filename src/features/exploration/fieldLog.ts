// src/features/exploration/fieldLog.ts
//
// Replaces the old typewriter/choice story system. Entries are plain
// observations logged by the expedition as it moves — no narrator voice, no
// choices, no branching, and no gameplay effects.
//
// Deliberately stateless: which entries are visible is derived from elapsed
// run time against ENTRY_THRESHOLDS, so it survives refresh and navigation
// for free without a DB column, a migration, or a write path. A completed
// chamber shows all four.

/** Fraction of a run's duration at which each entry becomes visible. */
export const ENTRY_THRESHOLDS = [0.18, 0.42, 0.66, 0.92]

// mapId -> chamberId -> four entries, in the order they surface.
const ENTRIES: Record<number, Record<number, string[]>> = {
  1: {
    1: [
      'Gate stands open. No forcing marks on either side.',
      'Moss grows inward, toward the arch. Never away from it.',
      'Birdsong stops eight paces past the threshold.',
      'Boot print in the soil, facing in. No matching print facing out.',
    ],
    2: [
      'Thorns curve along the path rather than across it.',
      'Cut branches at shoulder height. The cuts are old and clean.',
      'Compass holds steady. The sun does not agree with it.',
      'Three stones stacked at the bend. Placed, not fallen.',
    ],
    3: [
      'Ground slopes down for two hundred paces, then levels.',
      'Standing water at the base with no channel feeding it.',
      'Altar stone is dry to the touch, ringed by wet earth.',
      'Offering bowl, empty, wiped clean. Recently.',
    ],
    4: [
      'Roots run above head height. This is walking under a forest, not through one.',
      'Chalk marks on the bark, faded. Someone counted turns here.',
      'The marks stop after the eleventh turn.',
      'Air grows warmer the deeper it goes. That is backwards.',
    ],
    5: [
      'The hollow is wider than the ridge containing it.',
      'No insects. First place in the region with none.',
      'Light comes off the floor, faintly, with no source.',
      'Something has been kept dry down here for a very long time.',
    ],
  },
  2: {
    1: [
      'Arch is warm at the base and cold at the crown.',
      'Ash across the ground with no burn scars beneath it.',
      'The lake reflects the arch. It does not reflect the sky.',
      'Heat rises in a straight column and stops at head height.',
    ],
    2: [
      'Hall runs longer than the outer wall allows.',
      'Floor is packed cinder, still soft. Nothing has crossed it in years.',
      'Sconces line both walls, unlit and unburnt.',
      'A door at the far end stands ajar with no room behind it.',
    ],
    3: [
      'Black glass underfoot, unbroken across the whole court.',
      'Reflections lag by roughly half a second.',
      'No tool marks. The surface was poured, not cut.',
      'Something moves in the reflection that is not in the court.',
    ],
    4: [
      'Keep is intact. Every window is sealed from the inside.',
      'Grey dust at even depth on every surface. No drifts.',
      'Stairs climb four floors. The exterior shows three.',
      'The top room is furnished and swept.',
    ],
    5: [
      'Vault door is open, and appears to have always been open.',
      'Air tastes of struck flint.',
      'Rows of empty shelving, dust-free, wiped down.',
      'One shelf is not empty.',
    ],
  },
  3: {
    1: [
      'Shore runs east with no tideline.',
      'Salt crust three fingers thick. Nothing has washed over it.',
      'Water is still, and has not moved in the time observed.',
      'A cut rope end, half-buried. The cut is fresh.',
    ],
    2: [
      'Kelp stands upright in still water. It should be lying flat.',
      'Channels between the stalks are evenly spaced, as if cut.',
      'Light dims with depth, then brightens again at the bottom.',
      'The maze has one route. It leads inward without branching.',
    ],
    3: [
      'Citadel is submerged to the second storey and dry inside.',
      'No silt on the floors. No waterline on the walls.',
      'Doors are barred from the inside. All of them.',
      'Something maintains this place.',
    ],
    4: [
      'The gate frames open water. Nothing structural holds it.',
      'Pressure does not change on the far side of the arch.',
      'Sound stops at the threshold, in both directions.',
      'The far side is lit. The near side is not.',
    ],
    5: [
      'Throne room floor is dry, forty fathoms down.',
      'Seat is worn smooth at the arms. Recently used.',
      'One entrance, no exit, no approach corridor.',
      'The chamber is warm.',
    ],
  },
  4: {
    1: [
      'Floor is solid. Nothing visible supports it.',
      'Cloud parts ahead of the path and closes behind it.',
      'No horizon in any direction.',
      'Footsteps return an echo two seconds late.',
    ],
    2: [
      'Corridor walls are open sky and cannot be reached.',
      'Star positions hold steady. None have moved.',
      'The corridor is straight, yet the far end does not align with the near end.',
      'The light source stays behind the traveller at all times.',
    ],
    3: [
      'Sanctum is a perfect sphere. The interior is measurable. The exterior is not.',
      'No sound carries, though instruments still register vibration.',
      'Objects set down remain exactly where placed.',
      'Something was stored here and taken away.',
    ],
    4: [
      'Pinnacle has no base. The ascent begins mid-air.',
      'Air thins on the way up, then thickens near the summit.',
      'Surface is warm and smooth, like handled stone.',
      'The summit is flat, and marked.',
    ],
    5: [
      'Nothing above. Confirmed by three separate readings.',
      'Every region is visible in full from here.',
      'There is a mark here matching the one at Mossy Gate.',
      'The route is a circle.',
    ],
  },
}

export function chamberEntries(mapId: number, chamberId: number): string[] {
  return ENTRIES[mapId]?.[chamberId] ?? []
}

/** How many of a chamber's entries are visible at `fraction` (0–1) elapsed. */
export function visibleCount(fraction: number): number {
  return ENTRY_THRESHOLDS.filter(t => fraction >= t).length
}
