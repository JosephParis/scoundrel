import { verifyGoogleCredential } from './_lib/google.js'
import { signSession } from './_lib/session.js'

/**
 * POST /api/auth: exchange a fresh Google ID token for a long-lived session
 * token. This is the only place a Google credential is trusted; every later
 * /api/save call authenticates with the returned session token instead, so the
 * expensive Google verification happens once per sign-in, not once per sync.
 *
 * Body: { credential: "<google id_token>" }
 * 200:  { token, user: { sub, email, name, picture } }
 *
 * Requires GOOGLE_CLIENT_ID and SESSION_SECRET in the environment. Without them
 * the endpoint 503s and the client stays in purely-local mode (play unaffected).
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'method_not_allowed' })
  }
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.SESSION_SECRET) {
    return res.status(503).json({ error: 'auth_not_configured' })
  }

  let body = req.body
  if (typeof body === 'string') {
    try { body = JSON.parse(body) } catch { body = null }
  }
  const credential = body?.credential
  if (!credential) return res.status(400).json({ error: 'missing_credential' })

  const user = await verifyGoogleCredential(credential)
  if (!user) return res.status(401).json({ error: 'invalid_credential' })

  const token = signSession({ sub: user.sub, email: user.email }, process.env.SESSION_SECRET)
  return res.status(200).json({ token, user })
}
