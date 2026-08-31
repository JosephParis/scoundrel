import { neon } from '@neondatabase/serverless'
import { ensureRunsTable } from './_lib/runsTable.js'
import { accountFromRequest } from './_lib/session.js'
import { mayWriteAs } from './_lib/validate.js'
import { checkRateLimit, clientIp, tooManyRequests } from './_lib/rateLimit.js'
import { isHandleAllowed } from '../src/games/scoundrel/handleDenylist.js'
import { sanitizeHandle } from '../src/games/scoundrel/handle.js'
import { resolveHandle } from './_lib/handles.js'

/**
 * POST /api/claim — put a name on a run that is already recorded.
 *
 * The victory screen lets a player name themselves at the moment they care
 * about it, which is after the run has been posted. /api/runs cannot serve
 * that: it is `on conflict (run_key) do nothing`, deliberately, so that a
 * device replaying its offline backlog can never overwrite a stored run. This
 * endpoint is the narrow exception — it changes `playerName` on one row and
 * touches nothing else. No outcome, no duration, no timestamps.
 *
 * ## Who is allowed to rename a run
 *
 * A signed-in run is protected the way every write is: the caller has to present
 * a session whose `sub` matches the row's `account_id` (issue 07).
 *
 * Guests have no session to present, and every guest shares `account_id
 * 'guest'`, so account identity proves nothing. What does is the run key
 * itself: it is `guest:<startedAt>:<runSeed>`, and `runSeed` is minted at run
 * start and stored only in that player's own record. Knowing the full key is
 * therefore evidence of having played the run. It is ~41 bits of Math.random
 * plus the exact starting millisecond — not a secret worth defending against an
 * offline attack, but this is a rate-limited endpoint and the prize is renaming
 * one leaderboard row.
 *
 * That is why a guest key **must** carry the seed segment. Legacy guest runs
 * predate `runSeed` and key on `guest:<startedAt>` alone, which is guessable, so
 * they are refused rather than left open to anyone who can iterate timestamps.
 *
 * ## Screened and taken names
 *
 * A name that fails the denylist is stored as null rather than rejected, which
 * matches /api/runs: the row stays, listed as Anonymous, and the response
 * reports the name that was actually applied so the client can show the truth
 * instead of what was asked for. Refusing outright would tell the author which
 * words to try next.
 *
 * A name already held by someone else is disambiguated the same way a posted
 * run's would be (api/_lib/handles.js), so renaming from the victory screen
 * cannot produce a duplicate row either. Again the response carries the name
 * that was actually stored, which is the whole reason it reports one.
 *
 * Requires DATABASE_URL. Without it the endpoint 503s and the client leaves the
 * run under whatever name it was posted with; play is never affected.
 */

const sql = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null

// Renaming is cheap to attempt and pointless to attempt often. Tighter than the
// run-posting limit, which has to tolerate a device flushing a backlog.
const RATE_LIMIT = 20
const RATE_WINDOW_MS = 60 * 1000

const GUEST_ID = 'guest'

/**
 * The account a run key belongs to, and whether the key proves ownership.
 *
 * Split out and exported for tests: the guest rule is the security-relevant
 * half of this endpoint and deserves to be asserted directly.
 *
 * @param {string} runKey - "<accountId>:<startedAt>[:<runSeed>]"
 * @returns {{accountId: string, proven: boolean}|null} null when unparseable
 */
export function parseRunKey(runKey) {
  if (typeof runKey !== 'string' || !runKey) return null
  const parts = runKey.split(':')
  if (parts.length < 2 || parts.length > 3) return null
  const [accountId, startedAt, runSeed] = parts
  if (!accountId || !/^[0-9]+$/.test(startedAt || '')) return null
  // A guest key is only self-authenticating with the seed segment present.
  const proven = accountId !== GUEST_ID || Boolean(runSeed)
  return { accountId, proven }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'method_not_allowed' })
  }
  if (!sql) return res.status(503).json({ error: 'database_not_configured' })

  const limit = await checkRateLimit(sql, {
    name: 'claim', ip: clientIp(req), limit: RATE_LIMIT, windowMs: RATE_WINDOW_MS,
  })
  if (!limit.allowed) return tooManyRequests(res, RATE_WINDOW_MS)

  const body = typeof req.body === 'string' ? safeParse(req.body) : req.body
  const parsed = parseRunKey(body?.runKey)
  if (!parsed) return res.status(400).json({ error: 'bad_run_key' })
  if (!parsed.proven) return res.status(403).json({ error: 'run_key_not_provable' })

  const account = accountFromRequest(req)
  if (!mayWriteAs(parsed.accountId, account)) {
    return res.status(401).json({ error: 'account_not_authenticated' })
  }

  // Sanitize before screening, so the denylist sees the same string the rest of
  // the system would store rather than the raw request body.
  const requested = sanitizeHandle(body?.playerName).trim()
  const screened = requested && isHandleAllowed(requested) ? requested : null

  // Whose claim this is, for the uniqueness registry. A signed-in run owns
  // names as its account; a guest owns them as the device that played it, which
  // it has to present because the run key does not carry it.
  const owner = parsed.accountId === GUEST_ID
    ? (typeof body?.deviceId === 'string' ? body.deviceId.trim() : '')
    : parsed.accountId
  const applied = await resolveHandle(sql, screened, owner)

  try {
    await ensureRunsTable(sql)
    // The account_id predicate is belt-and-braces: parseRunKey already told us
    // whose run this is, but scoping the update means a forged key that somehow
    // passed cannot touch a row belonging to someone else.
    const rows = await sql`
      update runs
         set record = jsonb_set(record, '{playerName}', ${JSON.stringify(applied)}::jsonb)
       where run_key = ${body.runKey}
         and account_id = ${parsed.accountId}
      returning run_key
    `
    if (rows.length === 0) return res.status(404).json({ error: 'run_not_found' })
    // `applied` rather than `requested`: the client shows what is on the board.
    return res.status(200).json({ ok: true, playerName: applied })
  } catch {
    return res.status(500).json({ error: 'claim_failed' })
  }
}

function safeParse(raw) {
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}
