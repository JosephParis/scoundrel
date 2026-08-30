/**
 * Moderation primitives shared by the admin endpoint and the public board
 * (issue 08). Files in api/ that start with `_` are helpers, never routes.
 *
 * Two things live here: the ADMIN_TOKEN bearer check, which was previously
 * inlined in api/stats.js and now has three callers, and the `blocked_accounts`
 * table that api/leaderboard.js subtracts when it ranks.
 *
 * A block hides, it does not delete. The player's save, profile and run rows
 * all stay exactly where they were -- their rows simply stop being published,
 * and unblocking puts them back. That is the property that makes it safe to
 * block first and ask later, which is the only speed a one-person moderation
 * team can actually work at.
 */

// Every guest shares this account id, so blocking it would empty the board for
// everyone. The endpoint refuses it rather than trusting the caller to notice.
export const GUEST_ID = 'guest'

/**
 * Shared-secret admin auth: `Authorization: Bearer <ADMIN_TOKEN>`. Returns
 * false when the env var is unset, so a deployment that forgot to configure it
 * fails closed rather than opening the delete endpoints to the world.
 */
export function adminAuthorized(req) {
  const token = process.env.ADMIN_TOKEN
  if (!token) return false
  const header = req.headers?.authorization || ''
  const sent = header.startsWith('Bearer ') ? header.slice(7) : ''
  return sent.length > 0 && sent === token
}

// Created on demand and cached per warm instance, like every other table here
// (see runsTable.js). The public board calls this too, so the very first
// leaderboard request on a fresh database creates it rather than 500ing on a
// missing relation.
let ready = null
export function ensureBlockedTable(sql) {
  if (!ready) {
    ready = sql`
      create table if not exists blocked_accounts (
        account_id text primary key,
        reason     text,
        created_at timestamptz not null default now()
      )
    `
  }
  return ready
}
