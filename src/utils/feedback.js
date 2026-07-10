import { GAME_VERSION } from '../games/scoundrel/constants'

const FEEDBACK_API = '/api/feedback'

// Feedback categories offered in the modal. Kept in sync with KINDS in
// api/feedback.js; anything else is stored as null.
export const FEEDBACK_KINDS = [
  { id: 'bug', label: 'Bug' },
  { id: 'idea', label: 'Idea' },
  { id: 'praise', label: 'Praise' },
  { id: 'other', label: 'Other' },
]

/**
 * Submit one piece of player feedback. Unlike run mirroring (fire-and-forget),
 * this is a real awaited request so the modal can confirm success or surface a
 * failure. The live GAME_VERSION is stamped on so admins can scope feedback to
 * a build. In dev there is no /api route, so short-circuit to a console log and
 * resolve, letting the modal flow be exercised without a backend.
 */
export async function submitFeedback({ message, kind, context, accountId }) {
  const payload = { message, kind, context, accountId, gameVersion: GAME_VERSION }
  if (!import.meta.env.PROD) {
    console.log('[feedback] dev build, not sent:', payload)
    return
  }
  const res = await fetch(FEEDBACK_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `Request failed (${res.status})`)
  }
}
