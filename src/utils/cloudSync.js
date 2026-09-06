/**
 * Cross-device save sync for signed-in players.
 *
 * The server (/api/save) is the meeting point: it read-merge-writes one profile
 * blob per account, so this module's whole job is (1) snapshot the local
 * localStorage state into that blob shape, (2) POST it, and (3) apply the merged
 * result the server hands back. Because the server merge is convergent and
 * non-destructive for earned progress (see api/_lib/merge.js), calling syncNow
 * on mount, on login, and after changes is always safe and order-independent.
 *
 * Everything here is best-effort and silent: no session token, no network, or a
 * server error just leaves the player in local-only mode. Play is never blocked.
 *
 * Auth: signing in exchanges the Google credential for a long-lived session
 * token (via /api/auth) that is stored and sent as a Bearer on every sync. Guest
 * / dev-login players have no token and never sync; their local play is intact.
 *
 * The three profile-shaped functions below (snapshotLocalState, foldWithLocal,
 * applyCloudState) restate the same key list as mergeProfiles on the server.
 * All four move together; test/profileShape.test.js fails when they drift.
 *
 * Still a leaf as far as state goes: it imports assignedName/handle for the
 * two pure helpers that resolve a name, and never settings.js, which owns the
 * live singleton and would make this depend on React.
 *
 * These storage keys mirror the ones owned by index.jsx, seenSpecials.js and
 * historyStore.js. They are re-declared (not imported) to keep this a leaf
 * module, exactly as historyStore re-declares its own prefix; keep them in step.
 */

import { assignedNameFor, deviceSeed } from '../games/scoundrel/assignedName'
import { sanitizeHandle } from '../games/scoundrel/handle'

const TOKEN_KEY = 'scoundrel:session'
const SAVE_KEY = 'scoundrel:save'
const LIBRARY_KEY = 'scoundrel:boonLibrary'
const ASCENSION_KEY = 'scoundrel:ascensionUnlocked'
const TUTORIAL_KEY = 'scoundrel:tutorialCompleted'
const SEEN_SPECIALS_KEY = 'scoundrel:seenSpecials'
const HISTORY_PREFIX = 'scoundrel:history:'
const HANDLE_KEY = 'scoundrel:leaderboardHandle'
const ANONYMOUS_KEY = 'scoundrel:leaderboardAnonymous'
const NAME_SET_AT_KEY = 'scoundrel:leaderboardNameSetAt'

// Fired at window after a sync writes the name back, so the live settings
// singleton re-reads instead of serving the value it loaded at startup. Without
// it a device that adopted the account's name would keep POSTING its old one
// until the next reload -- the bug, still there, just quieter.
export const PROFILE_SYNCED_EVENT = 'sigil:profile-synced'

const AUTH_API = '/api/auth'
const SAVE_API = '/api/save'
// Coalesce the bursts of state changes a single turn produces into one POST.
const SYNC_DEBOUNCE_MS = 2500

// -- token ------------------------------------------------------------------

export function getSessionToken() {
  try { return localStorage.getItem(TOKEN_KEY) || null } catch { return null }
}
function setSessionToken(token) {
  try { localStorage.setItem(TOKEN_KEY, token) } catch { /* ignore */ }
}
export function clearSessionToken() {
  try { localStorage.removeItem(TOKEN_KEY) } catch { /* ignore */ }
}

// -- local storage read/write helpers --------------------------------------

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    const parsed = JSON.parse(raw)
    return parsed ?? fallback
  } catch {
    return fallback
  }
}
function writeJson(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* ignore */ }
}

/**
 * Gather the account-scoped local state into the profile-blob shape the server
 * merges. History is namespaced by account (matching historyStore); the rest of
 * the progression is stored under shared keys, so guest play folds naturally
 * into the account on the first signed-in sync.
 */
export function snapshotLocalState(accountId) {
  let ascensionUnlocked = 0
  try { ascensionUnlocked = Number.parseInt(localStorage.getItem(ASCENSION_KEY) || '0', 10) || 0 } catch { /* ignore */ }
  let tutorialCompleted = false
  try { tutorialCompleted = localStorage.getItem(TUTORIAL_KEY) === 'true' } catch { /* ignore */ }
  return {
    library: readJson(LIBRARY_KEY, []),
    ascensionUnlocked,
    tutorialCompleted,
    seenSpecials: readJson(SEEN_SPECIALS_KEY, []),
    history: readJson(HISTORY_PREFIX + accountId, []),
    // Verbatim wrapper { version, state, savedAt }; savedAt drives newest-wins.
    save: readJson(SAVE_KEY, null),
    ...localNameChoice(),
  }
}

/**
 * The name this device would publish under, as the three values that travel
 * together.
 *
 * The assigned name is resolved here rather than sent as a blank, so a player
 * who never opens Settings still gets ONE name across their devices: the first
 * device to sync promotes what it is already posting under, and the rest adopt
 * it. It carries `nameSetAt: 0`, which is what keeps it losing to any name
 * somebody actually typed.
 *
 * `scoundrel:deviceId` is read (through deviceSeed) and never sent. It is a
 * device id, not a player id: api/leaderboard.js partitions guests by it, so
 * two devices sharing one would collapse into a single ranked row and the
 * slower run would vanish from the board. test/profileShape.test.js asserts it
 * stays out of the payload.
 */
function localNameChoice() {
  let typed = ''
  let anonymous = false
  let nameSetAt = 0
  try {
    typed = sanitizeHandle(localStorage.getItem(HANDLE_KEY)).trim()
    anonymous = localStorage.getItem(ANONYMOUS_KEY) === '1'
    nameSetAt = Number.parseInt(localStorage.getItem(NAME_SET_AT_KEY) || '0', 10) || 0
  } catch { /* storage off: send the assigned name with no claim to it */ }
  return {
    leaderboardName: typed || assignedNameFor(deviceSeed()),
    anonymous,
    nameSetAt,
  }
}

/**
 * Client twin of newerName in api/_lib/merge.js -- same rule, restated because
 * the client cannot import from `api/`. Name, opt-out and stamp move as one
 * value; newest stamp wins; an equal stamp keeps `base`, so a device re-posting
 * what it already holds never displaces the account's name.
 * test/nameSync.test.js holds the two in agreement.
 */
function foldName(local, server) {
  const chose = c => (c.leaderboardName || '') !== '' || !!c.anonymous
  const norm = p => ({
    leaderboardName: typeof p?.leaderboardName === 'string' ? p.leaderboardName : '',
    anonymous: !!p?.anonymous,
    nameSetAt: Number(p?.nameSetAt) || 0,
  })
  const a = norm(server)
  const b = norm(local)
  // The server's value is the incumbent on this side too, so the tie-break
  // agrees with the server's and the pair converges.
  if (!chose(a)) return chose(b) ? b : a
  if (!chose(b)) return a
  return b.nameSetAt > a.nameSetAt ? b : a
}

// Merge key: accountId + startedAt, plus the stable per-run seed when present
// so two devices' guest runs sharing a startedAt millisecond stay distinct.
// Legacy runs lack a seed and keep the old accountId:startedAt key. Kept in
// step with serverKeyOf in historyStore.js, runKeyFor in api/_lib/runsTable.js
// and runKey in api/_lib/merge.js — test/dedupeKeys.test.js asserts all four
// agree on which records are the same run.
export function runMergeKey(record) {
  const base = `${record?.accountId ?? ''}:${record?.startedAt ?? ''}`
  return record?.runSeed ? `${base}:${record.runSeed}` : base
}

// Client-side twin of api/_lib/merge.js. The server already merged the snapshot
// this device sent, but time passed while the request was in flight: the player
// may have unlocked a boon, finished a run, or advanced the active save since.
// Re-folding the server result against a *fresh* local snapshot before we
// persist guarantees no mid-flight progress is lost to the write-back. Keep the
// rules here in step with the server's.
function foldWithLocal(accountId, server) {
  const local = snapshotLocalState(accountId)
  const union = (a, b) => Array.from(new Set([...(a || []), ...(b || [])]))
  const byKey = new Map()
  for (const r of (local.history || []).concat(server.history || [])) {
    if (!r || !(r.startedAt || r.accountId)) continue
    byKey.set(runMergeKey(r), r)
  }
  const history = Array.from(byKey.values())
    .sort((x, y) => (x.startedAt || 0) - (y.startedAt || 0))
    .slice(-200)
  const localAt = local.save?.savedAt || 0
  const serverAt = server.save?.savedAt || 0
  const save = serverAt >= localAt ? (server.save || local.save) : local.save
  return {
    library: union(local.library, server.library),
    ascensionUnlocked: Math.max(local.ascensionUnlocked || 0, server.ascensionUnlocked || 0),
    tutorialCompleted: !!local.tutorialCompleted || !!server.tutorialCompleted,
    seenSpecials: union(local.seenSpecials, server.seenSpecials),
    history,
    save: save || null,
    ...foldName(local, server),
  }
}

/**
 * Fold the server's merged profile back into local storage. The write-back is
 * re-merged against the current local state (foldWithLocal) so a change made
 * while the sync was in flight is never dropped, and the newest active save
 * always wins. Returns the final applied state so callers can reflect it into
 * React.
 */
export function applyCloudState(accountId, data) {
  if (!data || typeof data !== 'object') return null
  const final = foldWithLocal(accountId, data)
  writeJson(LIBRARY_KEY, final.library)
  try { localStorage.setItem(ASCENSION_KEY, String(final.ascensionUnlocked)) } catch { /* ignore */ }
  if (final.tutorialCompleted) {
    try { localStorage.setItem(TUTORIAL_KEY, 'true') } catch { /* ignore */ }
  }
  writeJson(SEEN_SPECIALS_KEY, final.seenSpecials)
  writeJson(HISTORY_PREFIX + accountId, final.history)
  // Only ever write a save that exists; a null must not wipe a local run.
  if (final.save && typeof final.save === 'object') writeJson(SAVE_KEY, final.save)
  writeNameChoice(final)
  return final
}

/**
 * Persist the account's name choice over this device's own.
 *
 * The server's stamp is copied verbatim -- adopting a name is not choosing one,
 * and re-stamping it with the local clock would let the adopting device win the
 * next round and the two would flap.
 */
function writeNameChoice(final) {
  try {
    if (final.leaderboardName) localStorage.setItem(HANDLE_KEY, final.leaderboardName)
    else localStorage.removeItem(HANDLE_KEY)
    if (final.anonymous) localStorage.setItem(ANONYMOUS_KEY, '1')
    else localStorage.removeItem(ANONYMOUS_KEY)
    localStorage.setItem(NAME_SET_AT_KEY, String(final.nameSetAt || 0))
  } catch { /* ignore */ }
  try {
    if (typeof window !== 'undefined' && window.dispatchEvent) {
      window.dispatchEvent(new CustomEvent(PROFILE_SYNCED_EVENT))
    }
  } catch { /* ignore */ }
}

// -- network ----------------------------------------------------------------

/**
 * Exchange a fresh Google credential (raw id_token) for a session token and
 * store it. Returns the verified user on success, or null when auth is not
 * configured / the network is down (caller falls back to local-only play).
 */
export async function exchangeCredential(credential) {
  if (!credential) return null
  try {
    const res = await fetch(AUTH_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential }),
    })
    if (!res.ok) return null
    const { token, user } = await res.json()
    if (!token) return null
    setSessionToken(token)
    return user || null
  } catch {
    return null
  }
}

let pendingTimer = null

/**
 * Push the local snapshot, merge server-side, and apply the result locally. The
 * single primitive used on mount, on login, and after changes. Returns the
 * merged data (already applied to local storage) or null when it could not sync.
 */
export async function syncNow(accountId, { keepalive = false } = {}) {
  const token = getSessionToken()
  if (!token || !accountId) return null
  try {
    const res = await fetch(SAVE_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ data: snapshotLocalState(accountId) }),
      keepalive,
    })
    if (res.status === 401) {
      // Session expired or secret rotated: drop it so the app reverts cleanly to
      // local-only until the next sign-in.
      clearSessionToken()
      return null
    }
    if (!res.ok) return null
    const { data } = await res.json()
    return applyCloudState(accountId, data)
  } catch {
    return null
  }
}

/** Debounced syncNow: collapses a turn's worth of state writes into one POST. */
export function scheduleSync(accountId) {
  if (!getSessionToken() || !accountId) return
  if (pendingTimer) clearTimeout(pendingTimer)
  pendingTimer = setTimeout(() => {
    pendingTimer = null
    syncNow(accountId)
  }, SYNC_DEBOUNCE_MS)
}

/** Flush any pending debounced sync immediately (e.g. on tab hide/unload). */
export function flushSync(accountId) {
  if (pendingTimer) {
    clearTimeout(pendingTimer)
    pendingTimer = null
  }
  return syncNow(accountId, { keepalive: true })
}
