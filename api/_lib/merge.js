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
 * The player's leaderboard name is the exception that is not earned progress:
 * it is a single evolving choice, so it is newest-wins by nameSetAt (see
 * newerName). Syncing it is what stops one account being a different person on
 * every device. The device id it is stored beside is deliberately NOT synced --
 * api/leaderboard.js partitions guests by it.
 *
 * The shape is a WHITELIST, deliberately: this blob is written to a jsonb
 * column from a client, so passing unknown keys through would let a device
 * store arbitrary data in the row. The cost is that a new profile field has to
 * be added in four places -- here, and snapshotLocalState / foldWithLocal /
 * applyCloudState in src/utils/cloudSync.js -- and missing one loses the field
 * silently. test/profileShape.test.js holds all four in agreement and fails,
 * naming the files, when they drift. Add the field there too.
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
// the same run if its account, start and per-run seed match, regardless of the
// random record id. runSeed is minted once at run start and folded in when
// present, so two devices' guest runs that happen to share a startedAt
// millisecond stay distinct instead of collapsing into one and losing a run.
// Legacy records predate the seed and keep the old accountId:startedAt key.
// Kept in step with runKeyFor (api/_lib/runsTable.js), serverKeyOf
// (src/utils/historyStore.js) and runMergeKey (src/utils/cloudSync.js) —
// test/dedupeKeys.test.js asserts all four agree.
export function runKey(record) {
  const base = `${record?.accountId ?? ''}:${record?.startedAt ?? ''}`
  return record?.runSeed ? `${base}:${record.runSeed}` : base
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

/**
 * The leaderboard name, the opt-out and their timestamp move as ONE value.
 *
 * Splitting them would let a device's `anonymous: true` land beside another
 * device's name and publish a player who asked not to be named. So the three
 * are picked together, newest stamp wins, exactly as `save` is picked whole.
 *
 * `nameSetAt` is 0 for a name nobody chose -- the one this device was assigned
 * on first launch. An assigned name is still promoted to the account when the
 * account has nothing (which is what gives a player who never opens Settings
 * one name across their devices), but it always loses to a name someone
 * actually typed, whenever that was.
 *
 * Ties keep `base`, the value already stored. That is what makes this
 * convergent rather than merely deterministic: a device re-posting an
 * equal-stamped value never displaces the incumbent, so two devices syncing in
 * either order settle on the same name instead of flapping.
 *
 * Kept in step with foldWithLocal in src/utils/cloudSync.js --
 * test/nameSync.test.js asserts both halves agree.
 */
export function newerName(base, incoming) {
  const a = nameChoice(base)
  const b = nameChoice(incoming)
  if (!chose(a)) return chose(b) ? b : a
  if (!chose(b)) return a
  return b.nameSetAt > a.nameSetAt ? b : a
}

function nameChoice(p) {
  const raw = p?.leaderboardName
  return {
    leaderboardName: typeof raw === 'string' ? raw.slice(0, 64) : '',
    anonymous: !!p?.anonymous,
    nameSetAt: Number(p?.nameSetAt) || 0,
  }
}

// An explicit "don't list a name" is a choice even though it carries no name,
// and must beat a device that has never been told anything.
function chose(c) {
  return c.leaderboardName !== '' || c.anonymous
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
    ...newerName(a, b),
  }
}
