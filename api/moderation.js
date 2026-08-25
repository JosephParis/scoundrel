import { neon } from '@neondatabase/serverless'
import { ensureRunsTable } from './_lib/runsTable.js'
import { adminAuthorized, ensureBlockedTable, GUEST_ID } from './_lib/moderation.js'

/**
 * Admin-only moderation endpoint (issue 08). The leaderboard publishes text a
 * player typed, so there has to be a way to take it down that is not a manual
 * SQL session against production at midnight.
 *
 *   GET    /api/moderation                 list blocked accounts
 *   GET    /api/moderation?rows=1          list recently published handles
 *   POST   /api/moderation                 block one: { accountId, reason? }
 *   DELETE /api/moderation?accountId=<id>  unblock one
 *   DELETE /api/moderation?runKey=<key>    delete one leaderboard row
 *   DELETE /api/moderation?feedbackId=<n>  delete one feedback note
 *
 * Auth is the same shared secret as /api/stats: `Authorization: Bearer
 * <ADMIN_TOKEN>`. Without the env var every method 503s, so a deployment that
 * has not configured it exposes nothing.
 *
 * Everything mutating is one route rather than spread across the public
 * endpoints on purpose: the admin surface is small enough to read in one sitting
 * and grep for in a log, and none of it shares a file with a path that
 * unauthenticated callers can reach. The issue proposed DELETE /api/runs/:runKey
 * instead; the tradeoff is a slightly less RESTful URL against not putting an
 * admin branch inside the open write endpoint.
 *
 * Blocking hides, deleting does not come back. Prefer the block: it is
 * reversible, it covers every row the account has and every row it will post,
 * and it leaves the player's own save alone. Delete is for the single forged
 * row that should never have been on the board.
 */

const sql = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null

const MAX_REASON = 500

function firstString(value) {
  if (typeof value === 'string') return value.trim()
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0].trim()
  return ''
}

async function listBlocked(res) {
  const rows = await sql`
    select account_id, reason, created_at
    from blocked_accounts order by created_at desc
  `
  return res.status(200).json({
    blocked: rows.map(r => ({
      accountId: r.account_id,
      reason: r.reason || null,
      createdAt: r.created_at,
    })),
  })
}

// Everything a run has published, newest first, so the admin sees a new handle
// on arrival rather than having to already know it exists. Deliberately not the
// ranked board: an abusive handle is worth removing whether or not it placed.
// The run key is exposed here and nowhere else -- it is what a delete needs, and
// this route is the only one that requires the admin token to read a run.
const ROWS_LIMIT = 200

async function listRows(res) {
  const rows = await sql`
    select r.run_key, r.account_id, btrim(r.record->>'playerName') player_name,
           r.outcome, r.duration_ms, r.ended_at, r.game_version, r.dev,
           (bl.account_id is not null) blocked
    from runs r
    left join blocked_accounts bl on bl.account_id = r.account_id
    where btrim(coalesce(r.record->>'playerName', '')) <> ''
    order by r.ended_at desc nulls last
    limit ${ROWS_LIMIT}
  `
  return res.status(200).json({
    rows: rows.map(r => ({
      runKey: r.run_key,
      accountId: r.account_id,
      playerName: r.player_name,
      outcome: r.outcome,
      durationMs: r.duration_ms === null ? null : Number(r.duration_ms),
      endedAt: r.ended_at === null ? null : Number(r.ended_at),
      gameVersion: r.game_version || null,
      dev: r.dev === true,
      blocked: r.blocked === true,
    })),
  })
}

async function block(req, res) {
  let body = req.body
  if (typeof body === 'string') {
    try { body = JSON.parse(body) } catch { body = null }
  }
  const accountId = firstString(body?.accountId)
  if (!accountId) return res.status(400).json({ error: 'account_id_required' })
  // Every guest run carries this id, so blocking it would take the whole guest
  // half of the board down in one request. Delete the individual rows instead.
  if (accountId === GUEST_ID) return res.status(400).json({ error: 'cannot_block_guest' })

  const reason = firstString(body?.reason).slice(0, MAX_REASON) || null
  // Re-blocking an already-blocked account updates the note rather than
  // erroring: the admin's second thought about why is worth keeping.
  await sql`
    insert into blocked_accounts (account_id, reason) values (${accountId}, ${reason})
    on conflict (account_id) do update set reason = excluded.reason
  `
  return res.status(200).json({ ok: true, accountId, blocked: true })
}

async function unblock(res, accountId) {
  const rows = await sql`
    delete from blocked_accounts where account_id = ${accountId} returning account_id
  `
  return res.status(200).json({ ok: true, accountId, blocked: false, found: rows.length > 0 })
}

async function deleteRun(res, runKey) {
  const rows = await sql`delete from runs where run_key = ${runKey} returning run_key`
  if (rows.length === 0) return res.status(404).json({ error: 'run_not_found' })
  return res.status(200).json({ ok: true, runKey })
}

async function deleteFeedback(res, rawId) {
  // The id is a bigserial; anything else is a caller error, not a 500.
  if (!/^[0-9]+$/.test(rawId)) return res.status(400).json({ error: 'bad_feedback_id' })
  const rows = await sql`delete from feedback where id = ${rawId} returning id`
  if (rows.length === 0) return res.status(404).json({ error: 'feedback_not_found' })
  return res.status(200).json({ ok: true, feedbackId: Number(rows[0].id) })
}

export default async function handler(req, res) {
  const method = req.method
  if (method !== 'GET' && method !== 'POST' && method !== 'DELETE') {
    res.setHeader('Allow', 'GET, POST, DELETE')
    return res.status(405).json({ error: 'method_not_allowed' })
  }
  if (!sql) return res.status(503).json({ error: 'database_not_configured' })
  if (!process.env.ADMIN_TOKEN) return res.status(503).json({ error: 'admin_token_not_configured' })
  if (!adminAuthorized(req)) return res.status(401).json({ error: 'unauthorized' })

  // Never cached, never revalidated: an admin acting on a moderation report has
  // to see the state they just changed.
  res.setHeader('Cache-Control', 'no-store')

  try {
    await ensureBlockedTable(sql)
    if (method === 'GET') {
      if (req.query?.rows === '1' || req.query?.rows === 'true') {
        await ensureRunsTable(sql)
        return await listRows(res)
      }
      return await listBlocked(res)
    }
    if (method === 'POST') return await block(req, res)

    const accountId = firstString(req.query?.accountId)
    const runKey = firstString(req.query?.runKey)
    const feedbackId = firstString(req.query?.feedbackId)
    if (accountId) return await unblock(res, accountId)
    if (runKey) {
      await ensureRunsTable(sql)
      return await deleteRun(res, runKey)
    }
    if (feedbackId) return await deleteFeedback(res, feedbackId)
    return res.status(400).json({ error: 'nothing_to_delete' })
  } catch {
    return res.status(500).json({ error: 'moderation_failed' })
  }
}
