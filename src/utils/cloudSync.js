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
 * These storage keys mirror the ones owned by index.jsx, seenSpecials.js and
 * historyStore.js. They are re-declared (not imported) to keep this a leaf
 * module, exactly as historyStore re-declares its own prefix; keep them in step.
 */

const TOKEN_KEY = 'scoundrel:session'
const SAVE_KEY = 'scoundrel:save'
const LIBRARY_KEY = 'scoundrel:boonLibrary'
const ASCENSION_KEY = 'scoundrel:ascensionUnlocked'
const TUTORIAL_KEY = 'scoundrel:tutorialCompleted'
const SEEN_SPECIALS_KEY = 'scoundrel:seenSpecials'
const HISTORY_PREFIX = 'scoundrel:history:'

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
  }
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
    if (r && (r.startedAt || r.accountId)) byKey.set(`${r.accountId ?? ''}:${r.startedAt ?? ''}`, r)
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
  return final
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
