import { neon } from '@neondatabase/serverless'
import { accountFromRequest } from './_lib/session.js'
import { mayWriteAs } from './_lib/validate.js'
import { checkRateLimit, clientIp, tooManyRequests } from './_lib/rateLimit.js'

/**
 * Vercel serverless function: store one piece of player feedback (a free-text
 * note plus a little context about where the player was). Mirrors runs.js:
 * needs the DATABASE_URL env var; without it the endpoint 503s and the client
 * surfaces a friendly error. Admins read it back through GET /api/stats
 * (recentFeedback), gated by ADMIN_TOKEN.
 *
 * Open to guests, so it is rate limited per IP, and feedback claiming a real
 * account must present a matching session token -- otherwise anyone could file
 * spam under another player's id. See issue 07.
 */

const sql = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null

// Feedback is typed by hand, so a handful per minute is already far more than a
// real person sends.
const RATE_LIMIT = 5
const RATE_WINDOW_MS = 60 * 1000

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

  const limit = await checkRateLimit(sql, {
    name: 'feedback', ip: clientIp(req), limit: RATE_LIMIT, windowMs: RATE_WINDOW_MS,
  })
  if (!limit.allowed) return tooManyRequests(res, RATE_WINDOW_MS)

  let body = req.body
  if (typeof body === 'string') {
    try { body = JSON.parse(body) } catch { body = null }
  }
  const message = typeof body?.message === 'string' ? body.message.trim() : ''
  if (!message) return res.status(400).json({ error: 'empty_message' })

  const accountId = typeof body?.accountId === 'string' && body.accountId ? body.accountId : 'guest'
  if (!mayWriteAs(accountId, accountFromRequest(req))) {
    return res.status(401).json({ error: 'account_not_authenticated' })
  }
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
