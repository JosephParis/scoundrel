import crypto from 'node:crypto'

/**
 * Minimal HS256 JWT sign/verify built on node:crypto so cross-device saves can
 * carry a long-lived, server-signed session without pulling in a JWT dependency.
 *
 * The flow: /api/auth verifies a fresh Google ID token once (expensive, network)
 * and mints one of these session tokens (cheap, HMAC-only) that the client then
 * presents on every /api/save call. Google ID tokens expire in an hour; these
 * outlive them so a signed-in player keeps syncing for weeks without re-auth.
 *
 * Requires SESSION_SECRET (any long random string) in the environment. Files in
 * api/ that start with `_` are treated as helpers by Vercel, never as routes.
 */

// Session lifetime. Long on purpose: a game session should survive across days
// of play. Rotated the moment the player signs in again (a new Google token).
const TTL_SECONDS = 60 * 60 * 24 * 60 // 60 days

function b64url(input) {
  return Buffer.from(input).toString('base64url')
}

export function signSession(payload, secret) {
  const now = Math.floor(Date.now() / 1000)
  const header = { alg: 'HS256', typ: 'JWT' }
  const body = { ...payload, iat: now, exp: now + TTL_SECONDS }
  const data = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(body))}`
  const sig = crypto.createHmac('sha256', secret).update(data).digest('base64url')
  return `${data}.${sig}`
}

// Returns the decoded payload, or null for any malformed/tampered/expired token.
// The signature check is timing-safe; expiry is enforced against exp.
export function verifySession(token, secret) {
  if (typeof token !== 'string') return null
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [header, payload, sig] = parts
  const data = `${header}.${payload}`
  const expected = crypto.createHmac('sha256', secret).update(data).digest('base64url')
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null
  let body
  try {
    body = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
  } catch {
    return null
  }
  if (typeof body.exp === 'number' && Math.floor(Date.now() / 1000) > body.exp) return null
  return body
}

// Pull and verify the session from an Authorization: Bearer <token> header.
// Returns the account payload ({ sub, email }) or null when unauthenticated.
export function accountFromRequest(req) {
  const secret = process.env.SESSION_SECRET
  if (!secret) return null
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  if (!token) return null
  return verifySession(token, secret)
}
