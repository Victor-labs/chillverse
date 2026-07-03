// src/lib/level.ts
/**
 * Game-balance constants for the leveling system.
 *
 * The `profiles` table only stores total `xp` and the derived `level` —
 * there's no "xp needed for next level" column, so that curve is defined
 * here as a single, easy-to-tune source of truth.
 */
// TODO: tune leveling curve — placeholder flat value until real game-balance data exists.
export const XP_PER_LEVEL = 1000

/** Progress within the current level, derived from total XP. */
export function getXpProgress(xp: number): { current: number; max: number } {
  return { current: xp % XP_PER_LEVEL, max: XP_PER_LEVEL }
}
