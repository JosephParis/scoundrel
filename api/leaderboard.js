import { neon } from '@neondatabase/serverless'
import { ensureRunsTable } from './_lib/runsTable.js'

/**
 * GET /api/leaderboard — the public fastest-victory board.
 *
 * Unlike /api/stats this endpoint is unauthenticated: every player sees it, so
 * it returns only what the board renders and never the raw run blob. In
 * particular `account_id` (the Google `sub` claim) is used for grouping and for
 * marking the caller's own rows, then stripped from the response; the only
 * identity that leaves here is `playerName`, the already-abbreviated name the
 * client stamped onto the record ("Alex R."), or null for a guest run.
 *
 * Only victories qualify — a fast death is not an achievement — and only one
 * row per account, so a quick player can't fill the whole board. Guest runs all
 * share account_id 'guest', so they are grouped per run instead of collapsing
 * into a single anonymous entry.
 *
 * Query params:
 *   limit=<n>       rows to return (default 25, max 100)
 *   me=<accountId>  the caller's own account; marks their rows `you: true` and
 *                   adds `self` (their best run and its rank) even when that
 *                   rank falls outside the returned page. Ignored for guests,
 *                   whose account id identifies no one in particular.
 *   version=<v>     scope the board to one balance version (see GAME_VERSION).
 *                   Absent = all versions.
 *
 * Requires DATABASE_URL. Without it the endpoint 503s and the client shows the
 * board as unavailable; play is never affected.
 *
 * Note that durations are computed client-side (wall clock between run start
 * and run end, minus pauses) and are therefore self-reported. The floor below
 * rejects the obviously impossible, but this board is a friendly ranking, not
 * an anti-cheat system.
 */

const sql = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null

const DEFAULT_LIMIT = 25
const MAX_LIMIT = 100
const GUEST_ID = 'guest'
// Reject sub-second clears: those are clock skew or a broken record, not play.
const MIN_DURATION_MS = 1000

function parseLimit(raw) {
  const n = Number.parseInt(raw, 10)
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_LIMIT
  return Math.min(n, MAX_LIMIT)
}

// One row per player, their fastest qualifying victory, ranked. Guests are
// partitioned by run_key so they compete as individual runs rather than
// collapsing to one shared 'guest' entry. Kept as a single fragment so the
// board query and the caller's-own-rank query rank against the same population.
function rankedBest(versionCond) {
  return sql`(
    select account_id, ascension, sigils_earned, duration_ms, ended_at, mode,
           game_version, record->>'playerName' player_name,
           row_number() over (order by duration_ms asc, ended_at asc) rank
    from (
      select r.*, row_number() over (
               partition by case when r.account_id = ${GUEST_ID} then r.run_key else r.account_id end
               order by r.duration_ms asc, r.ended_at asc
             ) player_rn
      from runs r
      where r.outcome = 'victory'
        and r.dev is not true
        and r.duration_ms >= ${MIN_DURATION_MS}
        ${versionCond}
    ) per_player
    where player_rn = 1
  )`
}

// Shape a DB row for the wire: numbers coerced out of bigint strings, and
// account_id dropped so no caller ever learns another player's account id.
function toEntry(row, me) {
  return {
    rank: Number(row.rank),
    playerName: row.player_name || null,
    ascension: row.ascension === null ? 0 : Number(row.ascension),
    sigilsEarned: row.sigils_earned === null ? null : Number(row.sigils_earned),
    durationMs: Number(row.duration_ms),
    endedAt: row.ended_at === null ? null : Number(row.ended_at),
    mode: row.mode || 'default',
    gameVersion: row.game_version || null,
    you: Boolean(me) && row.account_id === me,
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'method_not_allowed' })
  }
  if (!sql) return res.status(503).json({ error: 'database_not_configured' })

  const limit = parseLimit(req.query?.limit)
  const version = typeof req.query?.version === 'string' ? req.query.version.trim() : ''
  const versionCond = version ? sql`and r.game_version = ${version}` : sql``
  // A guest id identifies no one in particular, so it can't mark "your" rows.
  const meRaw = typeof req.query?.me === 'string' ? req.query.me.trim() : ''
  const me = meRaw && meRaw !== GUEST_ID ? meRaw : ''

  try {
    // Idempotent and cached per warm instance (see runsTable.js). Keeps the
    // board working on a deployment where no run has been mirrored yet, rather
    // than 500ing on a missing table.
    await ensureRunsTable(sql)
    const ranked = rankedBest(versionCond)
    const [rows, selfRows] = await Promise.all([
      sql`select * from ${ranked} b order by rank asc limit ${limit}`,
      // The caller's own best, fetched separately so their rank still shows
      // when it sits past the returned page. Skipped entirely for guests.
      me
        ? sql`select * from ${ranked} b where b.account_id = ${me} limit 1`
        : Promise.resolve([]),
    ])

    const entries = rows.map(row => toEntry(row, me))
    const self = selfRows.length > 0 ? toEntry(selfRows[0], me) : null

    // Public and identical for everyone but the `me` marking, so let the CDN
    // absorb the traffic. Short TTL keeps a fresh record visible quickly.
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300')
    return res.status(200).json({
      generatedAt: Date.now(),
      version: version || null,
      limit,
      entries,
      // Present but outside the page? The client renders it as a pinned row.
      self,
      selfInPage: Boolean(self) && entries.some(e => e.rank === self.rank),
    })
  } catch {
    return res.status(500).json({ error: 'query_failed' })
  }
}
