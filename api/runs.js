import { neon } from '@neondatabase/serverless'

/**
 * Vercel serverless function: persist one finished-run record into Postgres
 * (Neon) for cross-player analytics. The browser mirrors every fresh local
 * appendRun here best-effort, so this endpoint only needs to be correct and
 * idempotent, not defensive about client retries.
 *
 * Requires the DATABASE_URL env var (Neon connection string, sslmode=require)
 * in the Vercel project settings. Without it the endpoint 503s and the client
 * silently moves on; play is never affected.
 *
 * The full buildRunRecord blob is stored in a `record` jsonb column so the
 * schema never churns as records evolve (boons, upgrades, death context, ...).
 * Analytics is dev-only: query this table directly with SQL, e.g. winrate by
 * boon pair via jsonb_array_elements over record->'boons'.
 */

const sql = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null

// Ensure the table exists once per warm instance. CREATE ... IF NOT EXISTS is
// idempotent and cheap; caching the promise keeps it off the hot path after
// the first call on a given lambda.
let ready = null
function ensureSchema() {
  if (!ready) {
    ready = sql`
      create table if not exists runs (
        run_key       text primary key,
        account_id    text not null,
        outcome       text not null,
        mode          text,
        ascension     integer,
        sigils_earned integer,
        started_at    bigint,
        ended_at      bigint,
        duration_ms   bigint,
        record        jsonb not null,
        created_at    timestamptz not null default now()
      )
    `
      // game_version was added after the table shipped; bring existing
      // deployments forward in place. Old rows keep a null version (they
      // predate stamping) and fall outside any specific-version filter.
      .then(() => sql`alter table runs add column if not exists game_version text`)
      // dev marks runs that used the Dev overrides tool (test data). Legacy
      // rows keep a null dev, which `dev is not true` reads as a real run.
      .then(() => sql`alter table runs add column if not exists dev boolean`)
      .then(() => Promise.all([
        sql`create index if not exists runs_outcome_idx on runs (outcome)`,
        sql`create index if not exists runs_account_idx on runs (account_id)`,
        sql`create index if not exists runs_ended_idx on runs (ended_at)`,
        sql`create index if not exists runs_version_idx on runs (game_version)`,
      ]))
  }
  return ready
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'method_not_allowed' })
  }
  if (!sql) return res.status(503).json({ error: 'database_not_configured' })

  let record = req.body
  if (typeof record === 'string') {
    try { record = JSON.parse(record) } catch { record = null }
  }
  if (!record || typeof record !== 'object' || !record.startedAt || !record.accountId) {
    return res.status(400).json({ error: 'invalid_record' })
  }

  // Stable per-run key: a re-posted finished run (effect re-fire, reload of a
  // finished save) collides here and is ignored, mirroring the client's own
  // dedupe. record.id carries a random suffix, so it is NOT used as the key.
  const runKey = `${record.accountId}:${record.startedAt}`

  try {
    await ensureSchema()
    await sql`
      insert into runs (
        run_key, account_id, outcome, mode, ascension, sigils_earned,
        started_at, ended_at, duration_ms, game_version, dev, record
      ) values (
        ${runKey}, ${record.accountId}, ${record.outcome},
        ${record.mode?.id ?? null}, ${record.ascension ?? null},
        ${record.sigilsEarned ?? null}, ${record.startedAt ?? null},
        ${record.endedAt ?? null}, ${record.durationMs ?? null},
        ${record.gameVersion ?? null}, ${record.dev === true}, ${JSON.stringify(record)}::jsonb
      )
      on conflict (run_key) do nothing
    `
    return res.status(202).json({ ok: true })
  } catch {
    return res.status(500).json({ error: 'insert_failed' })
  }
}
