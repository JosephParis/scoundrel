/**
 * Client for the public fastest-victory board (GET /api/leaderboard).
 *
 * Read-only and best-effort, like the rest of the server seam: there is no
 * /api in `vite dev`, and a deployment without DATABASE_URL 503s, so every
 * failure resolves to a plain error object the modal can render instead of
 * throwing. Nothing here can affect a run.
 */

const LEADERBOARD_API = '/api/leaderboard'

/**
 * Fetch the board.
 * @param {object} opts
 * @param {string} [opts.accountId] - the viewer's account id, so the server can
 *   mark their own rows and report their rank. 'guest' is not sent: it
 *   identifies no one in particular.
 * @param {number} [opts.limit] - rows to request (server caps at 100).
 * @param {AbortSignal} [opts.signal] - abort when the modal closes.
 * @returns {Promise<{ok: true, data: object} | {ok: false, reason: string}>}
 */
export async function fetchLeaderboard({ accountId, limit, signal } = {}) {
  const params = new URLSearchParams()
  if (accountId && accountId !== 'guest') params.set('me', accountId)
  if (limit) params.set('limit', String(limit))
  const query = params.toString()

  try {
    const res = await fetch(query ? `${LEADERBOARD_API}?${query}` : LEADERBOARD_API, { signal })
    if (!res.ok) {
      // 503 is the expected "not wired up here" answer; anything else is a bug
      // on the server side, but either way the board simply can't be shown.
      return { ok: false, reason: res.status === 503 ? 'unavailable' : 'failed' }
    }
    const data = await res.json()
    if (!data || !Array.isArray(data.entries)) return { ok: false, reason: 'failed' }
    return { ok: true, data }
  } catch (err) {
    if (err?.name === 'AbortError') throw err
    // Offline, or no /api at all (dev server).
    return { ok: false, reason: 'unavailable' }
  }
}
