import { neon } from '@neondatabase/serverless'
import { ensureRunsTable, runKeyFor } from './_lib/runsTable.js'

/**
 * Vercel serverless function: persist finished-run records into Postgres (Neon)
 * for cross-player analytics. The browser mirrors runs here best-effort, so this
 * endpoint only needs to be correct and idempotent, not defensive about retries.
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
 * The full record blob is stored in a `record` jsonb column so the schema never
 * churns as records evolve (boons, upgrades, death context, ...). Analytics is
 * dev-only: query this table directly with SQL, e.g. winrate by boon pair via
 * jsonb_array_elements over record->'boons'.
 */

const sql = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null

function isValidRecord(record) {
  return record && typeof record === 'object' && record.startedAt && record.accountId
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

  let body = req.body
  if (typeof body === 'string') {
    try { body = JSON.parse(body) } catch { body = null }
  }
  // Normalize to an array: a batch resend posts many, a fresh run posts one.
  const records = (Array.isArray(body) ? body : [body]).filter(isValidRecord)
  if (records.length === 0) {
    return res.status(400).json({ error: 'invalid_record' })
  }

  try {
    await ensureRunsTable(sql)
    // Sequential inserts keep this simple; batches are small in practice (a
    // fresh run, or one device's short outage backlog) and each is a no-op when
    // the run is already stored.
    for (const record of records) await insertRun(record)
    return res.status(202).json({ ok: true, count: records.length })
  } catch {
    return res.status(500).json({ error: 'insert_failed' })
  }
}
