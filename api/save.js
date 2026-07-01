import { neon } from '@neondatabase/serverless'
import { accountFromRequest } from './_lib/session.js'
import { mergeProfiles } from './_lib/merge.js'

/**
 * Cross-device save sync. One row per account in a `profiles` table holds the
 * player's synced state (unlocked boons, ascension ceiling, tutorial flag, seen
 * specials, run history, and the in-progress run) as a single jsonb blob, so the
 * schema never churns as that state evolves.
 *
 *   GET  /api/save  -> { data }                pull the stored profile
 *   POST /api/save  { data } -> { data }        merge the client's snapshot into
 *                                               the stored one and return the union
 *
 * Both require a valid session token (Authorization: Bearer <token>) minted by
 * /api/auth; the account id comes from the token, never the body, so a client
 * can only ever touch its own row. Requires DATABASE_URL and SESSION_SECRET.
 *
 * POST is the workhorse: it read-merge-writes so any device converges on the
 * same result regardless of sync order (see mergeProfiles), which also folds a
 * player's guest progress into their account on first signed-in sync.
 */

const sql = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null

let ready = null
function ensureSchema() {
  if (!ready) {
    ready = sql`
      create table if not exists profiles (
        account_id text primary key,
        email      text,
        data       jsonb not null default '{}'::jsonb,
        updated_at timestamptz not null default now()
      )
    `
  }
  return ready
}

async function readProfile(accountId) {
  const rows = await sql`select data from profiles where account_id = ${accountId}`
  return rows[0]?.data ?? {}
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST')
    return res.status(405).json({ error: 'method_not_allowed' })
  }
  if (!sql) return res.status(503).json({ error: 'database_not_configured' })
  if (!process.env.SESSION_SECRET) return res.status(503).json({ error: 'auth_not_configured' })

  const account = accountFromRequest(req)
  if (!account?.sub) return res.status(401).json({ error: 'unauthorized' })

  try {
    await ensureSchema()

    if (req.method === 'GET') {
      return res.status(200).json({ data: await readProfile(account.sub) })
    }

    let body = req.body
    if (typeof body === 'string') {
      try { body = JSON.parse(body) } catch { body = null }
    }
    const incoming = body?.data
    if (!incoming || typeof incoming !== 'object') {
      return res.status(400).json({ error: 'invalid_payload' })
    }

    const merged = mergeProfiles(await readProfile(account.sub), incoming)
    await sql`
      insert into profiles (account_id, email, data, updated_at)
      values (${account.sub}, ${account.email ?? null}, ${JSON.stringify(merged)}::jsonb, now())
      on conflict (account_id) do update
        set data = excluded.data, email = excluded.email, updated_at = now()
    `
    return res.status(200).json({ data: merged })
  } catch {
    return res.status(500).json({ error: 'sync_failed' })
  }
}
