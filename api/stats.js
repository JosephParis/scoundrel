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
 */

const sql = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null

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
    ] = await Promise.all([
      sql`
        select count(*) n,
               count(*) filter (where outcome = 'victory') wins,
               count(*) filter (where outcome = 'death') deaths,
               count(*) filter (where outcome = 'retired') retires
        from runs
      `,
      sql`
        select b->>'id' id, count(*) n,
               count(*) filter (where r.outcome = 'victory') wins
        from runs r, jsonb_array_elements(r.record->'boons') b
        group by 1 order by n desc
      `,
      sql`
        select b1->>'id' a, b2->>'id' b, count(*) n,
               count(*) filter (where r.outcome = 'victory') wins
        from runs r,
             jsonb_array_elements(r.record->'boons') b1,
             jsonb_array_elements(r.record->'boons') b2
        where b1->>'id' < b2->>'id'
        group by 1, 2 having count(*) >= 3 order by n desc limit 60
      `,
      sql`
        select t->>'id' id, count(*) n,
               count(*) filter (where r.outcome = 'victory') wins
        from runs r, jsonb_array_elements(r.record->'themesFaced') t
        group by 1 order by n desc
      `,
      sql`
        select c->>'inscribed' frame,
               count(distinct r.run_key) n,
               count(distinct r.run_key) filter (where r.outcome = 'victory') wins
        from runs r, jsonb_array_elements(r.record->'endingDeck') c
        where c->>'inscribed' is not null
        group by 1 order by n desc
      `,
      sql`
        select ascension, count(*) n,
               count(*) filter (where outcome = 'victory') wins
        from runs group by 1 order by ascension
      `,
      sql`
        select record->'death'->>'source' source, count(*) n
        from runs
        where outcome = 'death' and record->'death' is not null
        group by 1 order by n desc
      `,
      sql`
        select (record->'death'->>'descent')::int descent, count(*) n
        from runs
        where outcome = 'death' and record->'death'->>'descent' is not null
        group by 1 order by descent
      `,
      sql`
        select record->'death'->'card'->>'suit' suit,
               (record->'death'->'card'->>'rank')::int rank,
               record->'death'->'card'->>'boss' boss,
               count(*) n
        from runs
        where outcome = 'death' and record->'death'->'card' is not null
        group by 1, 2, 3 order by n desc limit 40
      `,
      sql`
        select boon, sum(picked) times_picked, count(*) times_offered
        from (
          select o.v boon, (o.v = (p->>'picked'))::int picked
          from runs r,
               jsonb_array_elements(r.record->'boonPicks') p,
               jsonb_array_elements_text(p->'offered') o(v)
        ) x
        group by boon order by times_offered desc
      `,
      sql`
        select e->>'type' type, count(*) n,
               count(*) filter (where (e->>'skipped')::boolean) skips
        from runs r, jsonb_array_elements(r.record->'forgeEdits') e
        group by 1 order by 1
      `,
    ])

    return res.status(200).json({
      generatedAt: Date.now(),
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
    })
  } catch {
    return res.status(500).json({ error: 'query_failed' })
  }
}
