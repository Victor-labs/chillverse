// src/lib/soundSettings.ts
// Shared "Game sound" preference used by Settings and by any game's SFX calls.
// Defaults to ON when the user has never touched the setting.

const STORAGE_KEY = 'chillverse:gameSoundEnabled'

export function isGameSoundEnabled(): boolean {
  if (typeof window === 'undefined') return true
  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (raw === null) return true // default: on
  return raw === 'true'
}

export function setGameSoundEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, enabled ? 'true' : 'false')
  window.dispatchEvent(new CustomEvent('chillverse:gameSoundChanged', { detail: enabled }))
}
