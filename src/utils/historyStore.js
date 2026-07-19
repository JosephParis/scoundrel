/**
 * Run-history storage for Scoundrel.
 *
 * localStorage is the source of truth for in-app reads: records are stored
 * namespaced by account, capped, and every method is async so the seam is
 * backend-ready. Finished runs are additionally mirrored to a server table
 * (POST /api/runs) for cross-player analytics.
 *
 * The mirror is a confirmed-delivery queue, not fire-and-forget: appendRun
 * enqueues the record in a persisted `pending` list and reconcile() posts the
 * whole queue, clearing only what the server acknowledged. So a run whose post
 * is lost (offline, tab closed mid-flight, a /api/runs outage) simply stays
 * queued and is retried on the next reconcile (run end, app load, tab hide). A
 * weekly server cron backfills signed-in accounts from their save blob as a
 * backstop; between the two, a finished run reaches analytics unless it is only
 * ever played as a never-signed-in guest whose queue never drains. Everything
 * here is best-effort and production-only: a failed or absent endpoint never
 * blocks or breaks play, and dev (no /api) skips the mirror entirely. Game/UI
 * code only ever touches the `historyStore` singleton and the methods below.
 *
 * Account id is the Google `sub` claim, or 'guest' when signed out. On first
 * login the caller invokes migrateGuest() to fold the guest bucket into the
 * account so a player's pre-login runs are not orphaned.
 */

const KEY_PREFIX = 'scoundrel:history:'
const GUEST_ID = 'guest'
// Records awaiting confirmed delivery to /api/runs. Global (not per-account):
// each record carries its own accountId, so guest and account runs share one
// queue that drains regardless of who is signed in.
const PENDING_KEY = 'scoundrel:history:pending'
const RUNS_API = '/api/runs'
// Keep storage bounded so a heavy player never trips the localStorage quota.
// Oldest runs fall off the end first.
const MAX_RUNS = 200

function keyFor(accountId) {
  return KEY_PREFIX + (accountId || GUEST_ID)
}

// Stable identity for a finished run, used to dedupe re-records of the same run
// without conflating two different runs that share a startedAt millisecond (two
// devices' guest runs). runSeed is minted once at run start; legacy runs lack it
// and fall back to the old startedAt-only key, preserving their behavior.
function runKeyOf(record) {
  return record.runSeed ? `${record.startedAt}:${record.runSeed}` : `${record.startedAt}`
}

function readRaw(accountId) {
  try {
    const raw = localStorage.getItem(keyFor(accountId))
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeRaw(accountId, records) {
  try {
    const trimmed = records.slice(-MAX_RUNS)
    localStorage.setItem(keyFor(accountId), JSON.stringify(trimmed))
    return trimmed
  } catch {
    // Quota exceeded or storage disabled. Silently skip, same as saveGame.
    return records
  }
}

// Server-side identity for a record, matching runKeyFor in api/_lib/runsTable.js
// (accountId:startedAt[:runSeed]). Used to dedupe the pending queue and to drop
// exactly the records a reconcile confirmed. Includes accountId because the
// queue is global across guest/account records.
function serverKeyOf(record) {
  const base = `${record.accountId ?? ''}:${record.startedAt ?? ''}`
  return record.runSeed ? `${base}:${record.runSeed}` : base
}

function readPending() {
  try {
    const raw = localStorage.getItem(PENDING_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writePending(records) {
  try {
    // Bound the queue like the history buckets so a long offline streak can't
    // grow it without limit; oldest unconfirmed runs fall off first.
    localStorage.setItem(PENDING_KEY, JSON.stringify(records.slice(-MAX_RUNS)))
  } catch {
    // Quota exceeded or storage disabled; skip, same as writeRaw.
  }
}

// Enqueue a record for confirmed delivery. Idempotent per run key so a re-fire
// or reload never queues the same run twice. Production-only, like the mirror.
function queuePending(record) {
  if (!import.meta.env.PROD) return
  const pending = readPending()
  const key = serverKeyOf(record)
  if (pending.some(r => serverKeyOf(r) === key)) return
  writePending(pending.concat(record))
}

class LocalHistoryStore {
  /** Returns records newest-first. */
  async listRuns(accountId) {
    return readRaw(accountId).slice().reverse()
  }

  /**
   * Appends one finished-run record. Idempotent per run: a record whose
   * startedAt already exists is skipped, so re-recording the same finished
   * run (effect re-fire, reloading a finished save, dev strict-mode double
   * invoke) never produces a duplicate. Returns the stored (newest-first) list.
   */
  async appendRun(accountId, record) {
    const existing = readRaw(accountId)
    if (record.startedAt && existing.some(r => runKeyOf(r) === runKeyOf(record))) {
      return existing.slice().reverse()
    }
    const next = writeRaw(accountId, existing.concat(record))
    // Enqueue only fresh appends (after the dedupe above) and flush now with
    // keepalive so the post survives the navigation that often follows a run
    // ending. Anything the flush can't confirm stays queued for the next
    // reconcile. Fire-and-forget: analytics delivery never blocks play.
    queuePending(record)
    this.reconcile({ keepalive: true })
    return next.slice().reverse()
  }

  /**
   * Post the pending queue to /api/runs and drop what the server acknowledged.
   * Safe to call anytime (run end, app load, tab hide): a no-op when the queue
   * is empty or in dev, one batched request otherwise, and idempotent server-
   * side so re-sending an already-stored run costs only a dropped insert. Only
   * records confirmed by this response are cleared, so a run appended mid-flight
   * stays queued. Never throws; a failed post just leaves the queue for later.
   */
  async reconcile({ keepalive = false } = {}) {
    if (!import.meta.env.PROD) return
    const pending = readPending()
    if (pending.length === 0) return
    const sentKeys = new Set(pending.map(serverKeyOf))
    try {
      const res = await fetch(RUNS_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pending),
        keepalive,
      })
      if (!res.ok) return
      // Re-read before writing: an append during the request must not be lost.
      writePending(readPending().filter(r => !sentKeys.has(serverKeyOf(r))))
    } catch {
      // Leave the queue intact; the next reconcile retries it.
    }
  }

  async clearRuns(accountId) {
    try {
      localStorage.removeItem(keyFor(accountId))
    } catch {
      // ignore
    }
  }

  /**
   * Fold guest runs into the given account, then clear the guest bucket.
   * No-op when there is nothing to migrate or the account is the guest itself.
   */
  async migrateGuest(accountId) {
    if (!accountId || accountId === GUEST_ID) return
    const guestRuns = readRaw(GUEST_ID)
    if (guestRuns.length === 0) return
    const merged = readRaw(accountId).concat(guestRuns)
    // Sort by start time so the merged history reads chronologically.
    merged.sort((a, b) => (a.startedAt || 0) - (b.startedAt || 0))
    writeRaw(accountId, merged)
    await this.clearRuns(GUEST_ID)
  }
}

export const historyStore = new LocalHistoryStore()
export { GUEST_ID }
