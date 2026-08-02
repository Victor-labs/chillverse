// src/shared/lib/staleChunkReload.ts
//
// Vite code-splits lazy-loaded routes into hashed chunk files
// (e.g. WeeklyMissions-TLFrGN31.js). Every deploy replaces those hashes and
// deletes the old files from the server. If a tab was already open before a
// deploy (or was idle in the background), it's still holding the old chunk
// map — the next navigation to a not-yet-loaded route tries to fetch a
// filename that no longer exists, and throws:
//   "Failed to fetch dynamically imported module: .../WeeklyMissions-xxx.js"
// This isn't a real crash — the fix is just to reload so the browser picks
// up the current build's chunk map. Vite itself emits a `vite:preloadError`
// window event for the modulepreload-link flavor of this failure; the
// React.lazy() flavor surfaces as a plain thrown Error caught by
// ErrorBoundary instead, so both call into this same helper.

const STORAGE_KEY = 'cv:stale-chunk-reload-at'
const RELOAD_COOLDOWN_MS = 10_000

const STALE_CHUNK_PATTERN =
  /failed to fetch dynamically imported module|error loading dynamically imported module|importing a module script failed/i

export function isStaleChunkError(message: string | null | undefined): boolean {
  return !!message && STALE_CHUNK_PATTERN.test(message)
}

/** Reloads the page once to pick up the current build. Guarded by a short
 *  cooldown so a genuinely offline device or down server doesn't loop.
 *  Returns true if a reload was triggered, false if the cooldown blocked it
 *  (meaning we already tried recently and the problem persists). */
export function reloadForStaleChunk(): boolean {
  if (typeof window === 'undefined') return false
  const last = Number(sessionStorage.getItem(STORAGE_KEY) || '0')
  const now = Date.now()
  if (now - last < RELOAD_COOLDOWN_MS) return false
  sessionStorage.setItem(STORAGE_KEY, String(now))
  window.location.reload()
  return true
}
