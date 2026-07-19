import { neon } from '@neondatabase/serverless'
import { ensureRunsTable } from './_lib/runsTable.js'

/**
 * Weekly backfill: fold every signed-in account's stored run history into the
 * `runs` analytics table. Signed-in players' full history already lives in the
 * `profiles` save blob (api/save.js); this copies any run missing from `runs`
 * across, recovering mirror misses (offline at run-end, a dropped beacon, a
 * /api/runs outage window) for free. Guests who never sign in have no profile
 * row and are out of reach here; their client-side reconcile() sweep covers
 * them. When a guest signs in, migrateGuest folds their guest runs into the
 * account history, so this backfill picks those up on the next pass too.
 *
 * The whole job is one idempotent insert-select run entirely in Postgres: no
 * rows are shipped to the function, and on-conflict-do-nothing drops everything
 * already stored, so a weekly (or ad-hoc) run only ever writes genuine misses.
 *
 * Scheduled via the `crons` entry in vercel.json. Vercel attaches
 * `Authorization: Bearer <CRON_SECRET>` to scheduled invocations when the
 * CRON_SECRET env var is set, so we accept that token. We also accept
 * ADMIN_TOKEN (the same secret /api/stats uses) so the job can be triggered by
 * hand without a second value to manage; set CRON_SECRET in Vercel to the same
 * string as ADMIN_TOKEN and the weekly run authenticates with it. Requires
 * DATABASE_URL and at least one of ADMIN_TOKEN / CRON_SECRET.
 */

const sql = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null

function authorized(req) {
  // Either the admin token (reused to avoid a separate value) or CRON_SECRET,
  // the name Vercel's scheduler auto-attaches. Set CRON_SECRET to the same
  // string as ADMIN_TOKEN so the weekly run authenticates with it.
  const secrets = [process.env.ADMIN_TOKEN, process.env.CRON_SECRET].filter(Boolean)
  if (secrets.length === 0) return false
  const header = req.headers.authorization || ''
  const sent = header.startsWith('Bearer ') ? header.slice(7) : ''
  return sent.length > 0 && secrets.includes(sent)
}

export default async function handler(req, res) {
  if (!sql) return res.status(503).json({ error: 'database_not_configured' })
  if (!process.env.ADMIN_TOKEN && !process.env.CRON_SECRET) {
    return res.status(503).json({ error: 'cron_not_configured' })
  }
  if (!authorized(req)) return res.status(401).json({ error: 'unauthorized' })

  try {
    await ensureRunsTable(sql)
    // Explode each profile's history array into rows and upsert the ones not
    // already stored. The run_key expression mirrors runKeyFor() in
    // _lib/runsTable.js exactly (accountId:startedAt[:runSeed]); keep them in
    // step. Casts tolerate absent fields (missing key -> null -> null column).
    const rows = await sql`
      insert into runs (
        run_key, account_id, outcome, mode, ascension, sigils_earned,
        started_at, ended_at, duration_ms, game_version, dev, record
      )
      select
        (r->>'accountId') || ':' || (r->>'startedAt') ||
          case when r->>'runSeed' is not null then ':' || (r->>'runSeed') else '' end,
        r->>'accountId',
        r->>'outcome',
        r->'mode'->>'id',
        (r->>'ascension')::int,
        (r->>'sigilsEarned')::int,
        (r->>'startedAt')::bigint,
        (r->>'endedAt')::bigint,
        (r->>'durationMs')::bigint,
        r->>'gameVersion',
        coalesce((r->>'dev')::boolean, false),
        r
      from profiles p
      cross join lateral jsonb_array_elements(
        case when jsonb_typeof(p.data->'history') = 'array'
             then p.data->'history' else '[]'::jsonb end
      ) as r
      where r->>'accountId' is not null
        and r->>'startedAt' is not null
      on conflict (run_key) do nothing
      returning 1
    `
    return res.status(200).json({ ok: true, backfilled: rows.length })
  } catch {
    return res.status(500).json({ error: 'backfill_failed' })
  }
}
