import { neon } from '@neondatabase/serverless'

/**
 * Vercel serverless function: store one piece of player feedback (a free-text
 * note plus a little context about where the player was). Mirrors runs.js:
 * needs the DATABASE_URL env var; without it the endpoint 503s and the client
 * surfaces a friendly error. Admins read it back through GET /api/stats
 * (recentFeedback), gated by ADMIN_TOKEN.
 */

const sql = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null

// Create the table once per warm instance (idempotent, cheap). id is a serial
// so callers never supply one; context is a free jsonb blob (phase, sigils,
// mode, ...) that can evolve without a schema change.
let ready = null
function ensureSchema() {
  if (!ready) {
    ready = sql`
      create table if not exists feedback (
        id           bigserial primary key,
        account_id   text not null,
        kind         text,
        message      text not null,
        game_version text,
        context      jsonb,
        created_at   timestamptz not null default now()
      )
    `.then(() => sql`create index if not exists feedback_created_idx on feedback (created_at)`)
  }
  return ready
}

const MAX_MESSAGE = 4000
const KINDS = ['bug', 'idea', 'praise', 'other']

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
  const message = typeof body?.message === 'string' ? body.message.trim() : ''
  if (!message) return res.status(400).json({ error: 'empty_message' })

  const accountId = typeof body?.accountId === 'string' && body.accountId ? body.accountId : 'guest'
  const kind = KINDS.includes(body?.kind) ? body.kind : null
  const gameVersion = typeof body?.gameVersion === 'string' ? body.gameVersion : null
  const context = body?.context && typeof body.context === 'object' ? body.context : null
  const trimmed = message.slice(0, MAX_MESSAGE)

  try {
    await ensureSchema()
    await sql`
      insert into feedback (account_id, kind, message, game_version, context)
      values (
        ${accountId}, ${kind}, ${trimmed}, ${gameVersion},
        ${context ? JSON.stringify(context) : null}::jsonb
      )
    `
    return res.status(202).json({ ok: true })
  } catch {
    return res.status(500).json({ error: 'insert_failed' })
  }
}
