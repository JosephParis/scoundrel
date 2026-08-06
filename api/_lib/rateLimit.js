// Fixed-window rate limiting for the open write endpoints (issue 07).
//
// Backed by Postgres rather than process memory on purpose: Vercel runs many
// short-lived instances, so an in-memory counter is bypassed by simply landing on
// a different one. One upsert per request is cheap next to the insert it guards.
//
// FAILS OPEN. If the limiter itself errors, the request is allowed. A limiter
// outage must not stop players' runs being recorded -- losing real data is worse
// than briefly accepting abuse, and this is protecting a hobby game's leaderboard
// rather than anything with real value behind it.

// Buckets are derived from the window, so they rotate on their own and old rows
// simply stop being read. A probabilistic sweep keeps the table from growing
// without needing a cron.
const SWEEP_PROBABILITY = 0.01

let ready = null
function ensureSchema(sql) {
  if (!ready) {
    ready = sql`
      create table if not exists rate_limits (
        bucket     text primary key,
        hits       integer not null default 0,
        expires_at timestamptz not null
      )
    `
  }
  return ready
}

/**
 * Best-effort client address. Vercel sets x-forwarded-for; the left-most entry is
 * the original client. Spoofable in principle, but the proxy overwrites it, so it
 * is trustworthy enough for coarse limiting.
 */
export function clientIp(req) {
  const fwd = req.headers?.['x-forwarded-for']
  if (typeof fwd === 'string' && fwd.trim()) return fwd.split(',')[0].trim()
  if (Array.isArray(fwd) && fwd.length) return String(fwd[0]).split(',')[0].trim()
  const real = req.headers?.['x-real-ip']
  if (typeof real === 'string' && real.trim()) return real.trim()
  return req.socket?.remoteAddress || 'unknown'
}

/**
 * The bucket key for a window. Pure, so the rotation logic is testable without a
 * database.
 */
export function bucketFor(name, ip, windowMs, now) {
  return `${name}:${ip}:${Math.floor(now / windowMs)}`
}

/**
 * Count this request and report whether it is within the limit.
 *
 * @returns {Promise<{allowed: boolean, hits: number|null}>} hits is null when the
 *   limiter could not run, which is also reported as allowed.
 */
export async function checkRateLimit(sql, { name, ip, limit, windowMs, now = Date.now() }) {
  if (!sql) return { allowed: true, hits: null }
  const bucket = bucketFor(name, ip, windowMs, now)
  // Expire one full window past this one, so a row outlives the window it counts.
  const expiresAt = new Date(now + windowMs * 2).toISOString()

  try {
    await ensureSchema(sql)
    const rows = await sql`
      insert into rate_limits (bucket, hits, expires_at)
      values (${bucket}, 1, ${expiresAt})
      on conflict (bucket) do update set hits = rate_limits.hits + 1
      returning hits
    `
    const hits = rows?.[0]?.hits ?? 0

    if (Math.random() < SWEEP_PROBABILITY) {
      // Detached: a slow sweep must not delay the response.
      sql`delete from rate_limits where expires_at < now()`.catch(() => {})
    }

    return { allowed: hits <= limit, hits }
  } catch {
    return { allowed: true, hits: null }
  }
}

/** Standard 429 with a Retry-After derived from the window. */
export function tooManyRequests(res, windowMs) {
  res.setHeader('Retry-After', String(Math.ceil(windowMs / 1000)))
  return res.status(429).json({ error: 'rate_limited' })
}
