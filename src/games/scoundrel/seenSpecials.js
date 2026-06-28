// Tracks which special monster cards (bosses and traits) the player has already
// had explained to them, so the first-encounter intro popup fires exactly once
// per boss/trait across all runs. Boss ids (e.g. 'hollow_one') and trait ids
// ('armored' / 'warded' / 'relentless') share one namespace; they never collide.

const STORAGE_KEY = 'scoundrel:seenSpecials'

export function getSeenSpecials() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const arr = raw ? JSON.parse(raw) : []
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

export function markSpecialsSeen(ids) {
  if (!ids || ids.length === 0) return
  try {
    const merged = new Set(getSeenSpecials())
    for (const id of ids) merged.add(id)
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...merged]))
  } catch {
    // ignore storage failures (quota, disabled)
  }
}
