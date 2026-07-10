import { neon } from '@neondatabase/serverless'

/**
 * Admin-only analytics endpoint. GET /api/stats returns pre-aggregated run
 * stats as JSON so the in-app dashboard never has to pull raw rows or learn
 * SQL. Aggregation runs in Postgres; payload stays small as data grows.
 *
 * Auth: a single shared secret in the ADMIN_TOKEN env var, sent as
 * `Authorization: Bearer <token>`. Set ADMIN_TOKEN in the Vercel project
 * settings (and locally for `vercel dev`). Without it the endpoint 503s.
 *
 * Counts come back from Postgres as strings (bigint); the client coerces with
 * Number(). Older records that predate a field (death, boonPicks, forgeEdits)
 * contribute no rows to those sections, which is the desired behavior.
 *
 * Optional ?versions=<v1,v2,...> scopes every stat to a set of balance versions
 * (see GAME_VERSION / VERSION_HISTORY). The dashboard computes the set from a
 * From/To range over the ordered version history and passes the explicit list,
 * so ordering lives client-side and the server never has to sort the labels.
 * Absent/empty = all versions (including legacy rows that predate stamping).
 * The response always includes `versionsAvailable` (every version present,
 * unfiltered) so the dashboard can build the picker, plus the `versions`
 * actually applied ([] = all).
 *
 * Runs that used the Dev overrides tool are test data and are excluded from
 * every aggregation by default. Pass ?includeDev=1 to fold them back in.
 */

const sql = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null

// Fold a non-empty array of scalars into a parameterized "$1, $2, ..." fragment
// for an IN list. Each value is a bound parameter (never inlined), so a
// caller-supplied version list is injection-safe. neon flattens these nested
// fragments recursively when the outer query executes.
function commaSeparated(values) {
  return values.reduce((acc, v, i) => (i === 0 ? sql`${v}` : sql`${acc}, ${v}`), null)
}

// AND a list of condition fragments into a `where ...` clause, dropping any
// null/false entries. Empty list yields an empty fragment (no where clause),
// so callers can compose optional filters without branching per combination.
function whereAnd(conds) {
  const active = conds.filter(Boolean)
  if (active.length === 0) return sql``
  return active.reduce((acc, c, i) => (i === 0 ? sql`where ${c}` : sql`${acc} and ${c}`), null)
}

function authorized(req) {
  const token = process.env.ADMIN_TOKEN
  if (!token) return false
  const header = req.headers.authorization || ''
  const sent = header.startsWith('Bearer ') ? header.slice(7) : ''
  return sent.length > 0 && sent === token
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'method_not_allowed' })
  }
  if (!sql) return res.status(503).json({ error: 'database_not_configured' })
  if (!process.env.ADMIN_TOKEN) return res.status(503).json({ error: 'admin_token_not_configured' })
  if (!authorized(req)) return res.status(401).json({ error: 'unauthorized' })

  // Optional ?versions=<v1,v2,...> filter. When absent/empty, every aggregation
  // sees the whole table (legacy null-version rows included). When set, `runs`
  // below is a subquery that pre-filters to that set of versions, so a single
  // fragment scopes every stat consistently. Values are always parameterized
  // (IN list), so a caller-supplied list is injection-safe even as it flows
  // into many queries.
  const versionsRaw = typeof req.query?.versions === 'string' ? req.query.versions : ''
  const versions = versionsRaw.split(',').map(s => s.trim()).filter(Boolean)

  // Dev-tool runs are test data and are hidden by default. `dev is not true`
  // keeps legacy rows (null dev, predating the column) as real runs. Pass
  // ?includeDev=1 to fold them back in for debugging the dashboard itself.
  const includeDev = req.query?.includeDev === '1' || req.query?.includeDev === 'true'
  const devCond = includeDev ? null : sql`dev is not true`
  const versionCond = versions.length === 0 ? null : sql`game_version in (${commaSeparated(versions)})`
  const runs = sql`(select * from runs ${whereAnd([versionCond, devCond])})`

  try {
    const [
      overview,
      winrateByBoon,
      winrateByBoonPair,
      winrateByTheme,
      winrateByInscription,
      winrateByAscension,
      deathBySource,
      deathByDescent,
      deathByKillingCard,
      boonPickRate,
      forgeByType,
      winrateByMode,
      durationByOutcome,
      runShapeByOutcome,
      descentFunnel,
      retireByPhase,
      themeSurvival,
      playerActivity,
      versionsAvailable,
    ] = await Promise.all([
      sql`
        select count(*) n,
               count(*) filter (where outcome = 'victory') wins,
               count(*) filter (where outcome = 'death') deaths,
               count(*) filter (where outcome = 'retired') retires
        from ${runs} r
      `,
      sql`
        select b->>'id' id, count(*) n,
               count(*) filter (where r.outcome = 'victory') wins
        from ${runs} r, jsonb_array_elements(r.record->'boons') b
        group by 1 order by n desc
      `,
      sql`
        select b1->>'id' a, b2->>'id' b, count(*) n,
               count(*) filter (where r.outcome = 'victory') wins
        from ${runs} r,
             jsonb_array_elements(r.record->'boons') b1,
             jsonb_array_elements(r.record->'boons') b2
        where b1->>'id' < b2->>'id'
        group by 1, 2 having count(*) >= 3 order by n desc limit 60
      `,
      sql`
        select t->>'id' id, count(*) n,
               count(*) filter (where r.outcome = 'victory') wins
        from ${runs} r, jsonb_array_elements(r.record->'themesFaced') t
        group by 1 order by n desc
      `,
      sql`
        select c->>'inscribed' frame,
               count(distinct r.run_key) n,
               count(distinct r.run_key) filter (where r.outcome = 'victory') wins
        from ${runs} r, jsonb_array_elements(r.record->'endingDeck') c
        where c->>'inscribed' is not null
        group by 1 order by n desc
      `,
      sql`
        select ascension, count(*) n,
               count(*) filter (where outcome = 'victory') wins
        from ${runs} r group by 1 order by ascension
      `,
      sql`
        select record->'death'->>'source' source, count(*) n
        from ${runs} r
        where outcome = 'death' and record->'death' is not null
        group by 1 order by n desc
      `,
      sql`
        select (record->'death'->>'descent')::int descent, count(*) n
        from ${runs} r
        where outcome = 'death' and record->'death'->>'descent' is not null
        group by 1 order by descent
      `,
      sql`
        select record->'death'->'card'->>'suit' suit,
               (record->'death'->'card'->>'rank')::int rank,
               record->'death'->'card'->>'boss' boss,
               count(*) n
        from ${runs} r
        where outcome = 'death' and record->'death'->'card' is not null
        group by 1, 2, 3 order by n desc limit 40
      `,
      sql`
        select boon, sum(picked) times_picked, count(*) times_offered
        from (
          select o.v boon, (o.v = (p->>'picked'))::int picked
          from ${runs} r,
               jsonb_array_elements(r.record->'boonPicks') p,
               jsonb_array_elements_text(p->'offered') o(v)
        ) x
        group by boon order by times_offered desc
      `,
      sql`
        select e->>'type' type, count(*) n,
               count(*) filter (where (e->>'skipped')::boolean) skips
        from ${runs} r, jsonb_array_elements(r.record->'forgeEdits') e
        group by 1 order by 1
      `,
      sql`
        select coalesce(mode, 'default') mode, count(*) n,
               count(*) filter (where outcome = 'victory') wins
        from ${runs} r group by 1 order by n desc
      `,
      sql`
        select outcome, count(*) n,
               round(avg(duration_ms) / 1000.0)::int avg_seconds
        from ${runs} r where duration_ms is not null group by 1 order by 1
      `,
      sql`
        select outcome, count(*) n,
               round(avg((record->>'kitEdits')::numeric), 1) avg_kit_edits,
               round(avg((record->>'boonCount')::numeric), 1) avg_boons,
               round(avg((record->>'inscribedCount')::numeric), 1) avg_inscribed,
               round(avg((record->>'upgradedCount')::numeric), 1) avg_upgraded
        from ${runs} r where record->>'kitEdits' is not null
        group by 1 order by 1
      `,
      sql`
        select (d->>'descent')::int descent,
               count(*) entered,
               count(*) filter (where d->>'outcome' = 'cleared') cleared,
               count(*) filter (where d->>'outcome' = 'died') died,
               count(*) filter (where d->>'outcome' = 'retired') retired
        from ${runs} r, jsonb_array_elements(r.record->'descents') d
        where d->>'descent' is not null
        group by 1 order by descent
      `,
      sql`
        select record->'retire'->>'phase' phase, count(*) n
        from ${runs} r
        where outcome = 'retired' and record->'retire' is not null
        group by 1 order by n desc
      `,
      sql`
        select th.v theme,
               count(*) faced,
               count(*) filter (where d->>'outcome' = 'cleared') cleared,
               count(*) filter (where d->>'outcome' = 'died') died,
               count(*) filter (where d->>'outcome' = 'retired') retired
        from ${runs} r,
             jsonb_array_elements(r.record->'descents') d,
             jsonb_array_elements_text(d->'themes') th(v)
        group by 1 order by faced desc
      `,
      sql`
        select account_id,
               count(*) n,
               count(*) filter (where outcome = 'victory') wins,
               max(ended_at) last_seen,
               min(started_at) first_seen,
               max(ascension) best_ascension
        from ${runs} r
        group by 1 order by last_seen desc nulls last limit 200
      `,
      // Version-unfiltered on purpose: this powers the version picker, so it
      // must list every version present regardless of the current selection.
      // Null covers legacy rows that predate version stamping. Dev runs are
      // still excluded (unless includeDev) so the picker mirrors the real data
      // the dashboard will actually show.
      sql`
        select game_version version, count(*) n, max(ended_at) last_seen
        from runs ${whereAnd([devCond])} group by 1 order by last_seen desc nulls last
      `,
    ])

    // Recent player feedback: free-text notes, newest first. Separate from the
    // run aggregations (different table, no version/dev scoping). The table is
    // created lazily by /api/feedback, so tolerate its absence before the first
    // note ever lands rather than 500 the whole dashboard.
    let recentFeedback = []
    try {
      recentFeedback = await sql`
        select id, account_id, kind, message, game_version, context, created_at
        from feedback order by created_at desc limit 100
      `
    } catch {
      recentFeedback = []
    }

    return res.status(200).json({
      generatedAt: Date.now(),
      versions,
      versionsAvailable,
      recentFeedback,
      overview: overview[0],
      winrateByBoon,
      winrateByBoonPair,
      winrateByTheme,
      winrateByInscription,
      winrateByAscension,
      deathBySource,
      deathByDescent,
      deathByKillingCard,
      boonPickRate,
      forgeByType,
      winrateByMode,
      durationByOutcome,
      runShapeByOutcome,
      descentFunnel,
      retireByPhase,
      themeSurvival,
      playerActivity,
    })
  } catch {
    return res.status(500).json({ error: 'query_failed' })
  }
}
