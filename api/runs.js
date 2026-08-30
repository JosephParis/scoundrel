import { neon } from '@neondatabase/serverless'
import { ensureRunsTable, runKeyFor } from './_lib/runsTable.js'
import { accountFromRequest } from './_lib/session.js'
import { parseRunBatch, mayWriteAs } from './_lib/validate.js'
import { checkRateLimit, clientIp, tooManyRequests } from './_lib/rateLimit.js'
import { isHandleAllowed } from '../src/games/scoundrel/handleDenylist.js'

/**
 * Vercel serverless function: persist finished-run records into Postgres (Neon)
 * for cross-player analytics. The browser mirrors runs here best-effort, so this
 * endpoint needs to be idempotent rather than defensive about retries.
 *
 * It is reachable by anyone, so it is defensive about *content*: rate limited per
 * IP, batch size capped, records checked for physical plausibility
 * (_lib/validate.js), and any record claiming a real account must present a
 * matching session token. Guest posts stay open. See issue 07.
 *
 * Accepts either one record or an array of them: a fresh run posts a single
 * record, and the client's reconcile() sweep re-posts the whole backlog of
 * unconfirmed runs as one batch (see historyStore.js). Every insert is
 * on-conflict-do-nothing on the run key, so re-sending a run already stored is a
 * harmless no-op; that idempotency is what makes the backlog resend cheap.
 *
 * Requires the DATABASE_URL env var (Neon connection string, sslmode=require)
 * in the Vercel project settings. Without it the endpoint 503s and the client
 * silently moves on; play is never affected.
 *
 * Handles are screened here as well as in the client (issue 08). A record whose
 * playerName fails the denylist is stored with the name removed rather than
 * rejected: the run is real analytics either way, and rejecting the POST would
 * lose it and tell the author which words to try next.
 *
 * Note what stripping the name now means. This was written when the board
 * listed only runs carrying a handle, so removing the name kept the run off the
 * public page entirely; b9ad068 changed that, and an unnamed row is now listed
 * as Anonymous. So a screened run still places — it just carries no name. That
 * is the intended outcome: the abusive string is what must never be published,
 * and the victory itself is not the offence. Taking the row off the board as
 * well is a moderator's decision, and api/moderation.js is where it is made.
 *
 * The full record blob is stored in a `record` jsonb column so the schema never
 * churns as records evolve (boons, upgrades, death context, ...). Analytics is
 * dev-only: query this table directly with SQL, e.g. winrate by boon pair via
 * jsonb_array_elements over record->'boons'.
 */

const sql = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null

// Generous next to real play -- a finished run posts once, and the reconcile()
// sweep posts one batch -- but far below what it takes to bulk-forge a
// leaderboard or skew an aggregation.
const RATE_LIMIT = 30
const RATE_WINDOW_MS = 60 * 1000

/**
 * Strip a handle that must not appear on the public board. Returns the record
 * unchanged when the handle is fine, so the common path allocates nothing.
 * Both the denormalized column and the stored blob are cleared, since
 * api/leaderboard.js reads the name out of the blob.
 */
export function scrubHandle(record) {
  const name = typeof record.playerName === 'string' ? record.playerName : ''
  if (!name.trim() || isHandleAllowed(name)) return record
  return { ...record, playerName: null }
}

async function insertRun(record) {
  await sql`
    insert into runs (
      run_key, account_id, outcome, mode, ascension, sigils_earned,
      started_at, ended_at, duration_ms, game_version, dev, record
    ) values (
      ${runKeyFor(record)}, ${record.accountId}, ${record.outcome},
      ${record.mode?.id ?? null}, ${record.ascension ?? null},
      ${record.sigilsEarned ?? null}, ${record.startedAt ?? null},
      ${record.endedAt ?? null}, ${record.durationMs ?? null},
      ${record.gameVersion ?? null}, ${record.dev === true}, ${JSON.stringify(record)}::jsonb
    )
    on conflict (run_key) do nothing
  `
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'method_not_allowed' })
  }
  if (!sql) return res.status(503).json({ error: 'database_not_configured' })

  const limit = await checkRateLimit(sql, {
    name: 'runs', ip: clientIp(req), limit: RATE_LIMIT, windowMs: RATE_WINDOW_MS,
  })
  if (!limit.allowed) return tooManyRequests(res, RATE_WINDOW_MS)

  let body = req.body
  if (typeof body === 'string') {
    try { body = JSON.parse(body) } catch { body = null }
  }
  // Normalize to an array: a batch resend posts many, a fresh run posts one.
  const parsed = parseRunBatch(body)
  if (!parsed.ok) return res.status(400).json({ error: parsed.reason })
  const { records } = parsed

  // Guests post freely -- there is no token to present and guest play is a
  // first-class path. A record claiming a real account has to prove it, the way
  // /api/save always has. Without this, anyone can post a victory under any
  // accountId and playerName, which is what made the leaderboard forgeable and
  // makes blocking an account (issue 08) meaningless.
  const account = accountFromRequest(req)
  if (!records.every(r => mayWriteAs(r.accountId, account))) {
    return res.status(401).json({ error: 'account_not_authenticated' })
  }

  try {
    await ensureRunsTable(sql)
    // Sequential inserts keep this simple; batches are small in practice (a
    // fresh run, or one device's short outage backlog) and each is a no-op when
    // the run is already stored.
    for (const record of records) await insertRun(scrubHandle(record))
    return res.status(202).json({ ok: true, count: records.length })
  } catch {
    return res.status(500).json({ error: 'insert_failed' })
  }
}
