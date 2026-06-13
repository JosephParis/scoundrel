/**
 * Run-history storage for Scoundrel.
 *
 * The app is currently client-only: this stores finished-run records in
 * localStorage, namespaced by account. Every method is async (Promise-based)
 * so a real backend (Firestore, Supabase, a serverless API) can replace
 * LocalHistoryStore later without changing a single call site. Game/UI code
 * only ever touches the `historyStore` singleton and the four methods below.
 *
 * Account id is the Google `sub` claim, or 'guest' when signed out. On first
 * login the caller invokes migrateGuest() to fold the guest bucket into the
 * account so a player's pre-login runs are not orphaned.
 */

const KEY_PREFIX = 'scoundrel:history:'
const GUEST_ID = 'guest'
// Keep storage bounded so a heavy player never trips the localStorage quota.
// Oldest runs fall off the end first.
const MAX_RUNS = 200

function keyFor(accountId) {
  return KEY_PREFIX + (accountId || GUEST_ID)
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
    if (record.startedAt && existing.some(r => r.startedAt === record.startedAt)) {
      return existing.slice().reverse()
    }
    const next = writeRaw(accountId, existing.concat(record))
    return next.slice().reverse()
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
