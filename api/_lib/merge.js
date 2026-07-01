/**
 * Pure, convergent merge of two save profiles. Both cross-device sync and the
 * guest->account fold reduce to the same operation: fold an incoming snapshot
 * into whatever the server already holds and return the union.
 *
 * The merge is deliberately non-destructive for everything a player earns, so
 * two devices syncing in any order converge on the same result and neither can
 * lose unlocks:
 *   - library / seenSpecials : set union (unlocks only ever accumulate)
 *   - ascensionUnlocked       : max (the ladder never walks backward)
 *   - tutorialCompleted       : logical OR (once done, always done)
 *   - history                 : union keyed by run, newest kept, capped
 *
 * The one field that cannot merge is the in-progress run save, since it is a
 * single evolving object. That is last-write-wins by savedAt (the wall-clock of
 * the last local write), matching the "newest device wins the active run"
 * behavior. A device with no local run sends save:null and never clobbers.
 */

// Mirror of MAX_RUNS in src/utils/historyStore.js: bound stored history so a
// heavy player's profile blob stays small. Oldest runs fall off first.
const MAX_HISTORY = 200

function asArray(v) {
  return Array.isArray(v) ? v : []
}

function union(a, b) {
  return Array.from(new Set([...asArray(a), ...asArray(b)]))
}

// Stable per-run identity, mirroring the client and /api/runs dedupe: a run is
// the same run if its account+start match, regardless of the random record id.
function runKey(record) {
  return `${record?.accountId ?? ''}:${record?.startedAt ?? ''}`
}

function mergeHistory(a, b) {
  const byKey = new Map()
  for (const rec of asArray(a).concat(asArray(b))) {
    if (rec && (rec.startedAt || rec.accountId)) byKey.set(runKey(rec), rec)
  }
  return Array.from(byKey.values())
    .sort((x, y) => (x.startedAt || 0) - (y.startedAt || 0))
    .slice(-MAX_HISTORY)
}

// Keep the save with the larger savedAt. A missing save loses to a present one;
// two missing saves stay missing.
function newerSave(a, b) {
  if (!a) return b || null
  if (!b) return a
  return (b.savedAt || 0) > (a.savedAt || 0) ? b : a
}

export function mergeProfiles(base, incoming) {
  const a = base || {}
  const b = incoming || {}
  return {
    library: union(a.library, b.library),
    ascensionUnlocked: Math.max(Number(a.ascensionUnlocked) || 0, Number(b.ascensionUnlocked) || 0),
    tutorialCompleted: !!a.tutorialCompleted || !!b.tutorialCompleted,
    seenSpecials: union(a.seenSpecials, b.seenSpecials),
    history: mergeHistory(a.history, b.history),
    save: newerSave(a.save, b.save),
  }
}
