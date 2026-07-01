/**
 * Verify a Google Identity Services ID token (the raw `credential` string GIS
 * hands the browser on sign-in) server-side. This is the trust boundary for
 * cross-device saves: the client decodes the token cosmetically, but the server
 * must never take an account id on faith, or one player could read or overwrite
 * another's save just by POSTing a different id.
 *
 * Verification goes through Google's tokeninfo endpoint, which checks the
 * signature and expiry for us. We additionally require the audience to match our
 * own OAuth client and the email to be verified. This runs once per sign-in (not
 * per sync), so the extra network hop is not on any hot path.
 *
 * Requires GOOGLE_CLIENT_ID in the environment (the same value the client uses
 * as VITE_GOOGLE_CLIENT_ID).
 */

const TOKENINFO_URL = 'https://oauth2.googleapis.com/tokeninfo'

export async function verifyGoogleCredential(credential) {
  const clientId = process.env.GOOGLE_CLIENT_ID
  if (!clientId || !credential || typeof credential !== 'string') return null

  let data
  try {
    const res = await fetch(`${TOKENINFO_URL}?id_token=${encodeURIComponent(credential)}`)
    if (!res.ok) return null
    data = await res.json()
  } catch {
    return null
  }

  // aud must be our client; tokeninfo already enforced signature + exp. Google
  // returns email_verified as the string "true", so accept either form.
  if (data.aud !== clientId) return null
  if (data.email_verified !== true && data.email_verified !== 'true') return null
  if (!data.sub) return null

  return {
    sub: data.sub,
    email: data.email || null,
    name: data.name || data.email || null,
    picture: data.picture || null,
  }
}
