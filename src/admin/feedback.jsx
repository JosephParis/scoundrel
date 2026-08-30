import { useState } from 'react'
import { Section } from './tables'
import { shortId, themeName, modeName } from './format'

// Recent player feedback: newest-first free-text notes with the run context
// each was sent from. Shown at the top of the dashboard so it's the first
// thing read during a test. Collapsed to a handful until expanded.
//
// Each note can be deleted (issue 08): the form is open to guests and rate
// limited per IP, which stops a flood but not a determined one, and spam left
// in place buries the real notes this panel exists to surface. Deleting reloads
// the dashboard rather than dropping the row locally, so what is on screen is
// what is in the table.

const KIND_TONE = {
  bug: 'text-red-300 border-red-800/60',
  idea: 'text-sky-300 border-sky-800/60',
  praise: 'text-emerald-300 border-emerald-800/60',
  other: 'text-stone-300 border-stone-700',
}

function fmtWhen(ts) {
  const t = new Date(ts).getTime()
  if (!t) return ''
  const days = Math.floor((Date.now() - t) / 86400000)
  if (days <= 0) return 'today'
  return days === 1 ? '1d ago' : `${days}d ago`
}

// One-line summary of where the player was when they wrote the note.
function contextLine(ctx) {
  if (!ctx) return null
  const parts = []
  if (ctx.tutorial) parts.push('tutorial')
  else if (ctx.phase) parts.push(ctx.phase)
  if (ctx.descent) parts.push(`descent ${ctx.descent}`)
  if (ctx.theme) parts.push(themeName(ctx.theme))
  if (ctx.mode && ctx.mode !== 'default') parts.push(modeName(ctx.mode))
  if (ctx.ascension) parts.push(`A${ctx.ascension}`)
  return parts.join(' · ')
}

function FeedbackItem({ f, onDelete }) {
  const line = contextLine(f.context)
  return (
    <li className="rounded-md border border-stone-700 bg-stone-900/40 p-3">
      <div className="mb-1.5 flex flex-wrap items-center gap-2 text-[11px] text-stone-500">
        {f.kind && (
          <span className={`rounded border px-1.5 py-0.5 text-[10px] uppercase tracking-wide ${KIND_TONE[f.kind] || KIND_TONE.other}`}>
            {f.kind}
          </span>
        )}
        {f.game_version && <span className="font-mono">{f.game_version}</span>}
        <span className="font-mono">{shortId(f.account_id)}</span>
        <span className="ml-auto">{fmtWhen(f.created_at)}</span>
        {onDelete && (
          <button
            onClick={() => onDelete(f)}
            title="Delete this note"
            className="rounded border border-stone-700 px-1.5 text-[11px] leading-4 text-stone-500 hover:border-red-500 hover:text-red-300"
          >
            ×
          </button>
        )}
      </div>
      <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-slate-200">{f.message}</p>
      {line && <div className="mt-1.5 text-[11px] text-stone-500">{line}</div>}
    </li>
  )
}

export function FeedbackPanel({ rows, token, onDeleted }) {
  const [expanded, setExpanded] = useState(false)
  const [error, setError] = useState(null)
  const shown = expanded ? rows : rows.slice(0, 8)

  // Only offered when the panel was given a token to spend; without one the
  // endpoint would 401 and the button would be a lie.
  const onDelete = token
    ? async f => {
      if (!window.confirm('Delete this note? It does not come back.')) return
      setError(null)
      try {
        const res = await fetch(`/api/moderation?feedbackId=${encodeURIComponent(f.id)}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body.error || `Request failed (${res.status}).`)
        }
        onDeleted?.()
      } catch (e) {
        setError(e.message)
      }
    }
    : null
  return (
    <Section title="Player feedback" count={rows.length} className="lg:col-span-2">
      {error && <p className="mb-2 text-sm text-red-400">{error}</p>}
      {rows.length === 0 ? (
        <p className="py-2 text-sm text-stone-600">No feedback yet.</p>
      ) : (
        <ul className="space-y-2">
          {shown.map(f => <FeedbackItem key={f.id} f={f} onDelete={onDelete} />)}
        </ul>
      )}
      {rows.length > 8 && (
        <button
          onClick={() => setExpanded(e => !e)}
          className="mt-2 text-xs text-amber-300 hover:underline"
        >
          {expanded ? 'Show less' : `Show all ${rows.length}`}
        </button>
      )}
    </Section>
  )
}
