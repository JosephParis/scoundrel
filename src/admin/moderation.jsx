import { useCallback, useState } from 'react'
import { Section } from './tables'
import { shortId, fmtDuration, fmtDate } from './format'

/**
 * Moderation panel for /admin (issue 08). The board publishes text a player
 * typed, so this is the page where it comes back down.
 *
 * Two lists, both from /api/moderation with the same admin token the rest of
 * the dashboard uses:
 *
 * - **Published handles** — every run carrying a handle, newest first, so a new
 *   one is seen on arrival rather than after someone reports it. Each row can be
 *   deleted (that row only) or its account blocked (every row it has, and every
 *   row it posts later).
 * - **Blocked accounts** — the current blocklist, with unblock.
 *
 * Blocking is the recommended action and is presented first: it is reversible,
 * it covers the rows you have not seen yet, and it leaves the player's save
 * alone. Delete is for a single row that should not exist. Both ask before
 * acting, since neither is undone by a refresh.
 *
 * Loads on demand rather than with the dashboard: it is a second round-trip and
 * most sessions never need it.
 */

const BTN = 'rounded border px-2 py-0.5 text-[11px] transition-colors'

function RowActions({ row, busy, onBlock, onDelete }) {
  if (row.blocked) {
    return <span className="text-[11px] uppercase tracking-wide text-red-400">blocked</span>
  }
  // Every guest shares one account id, so there is no guest to block -- only
  // the individual row to delete. The endpoint refuses it too; not offering the
  // button is the half that explains why.
  const guest = row.accountId === 'guest'
  return (
    <span className="flex justify-end gap-1.5">
      {!guest && (
        <button
          disabled={busy}
          onClick={() => onBlock(row)}
          className={`${BTN} border-stone-700 text-stone-300 hover:border-amber-500 disabled:opacity-40`}
        >
          Block
        </button>
      )}
      <button
        disabled={busy}
        onClick={() => onDelete(row)}
        className={`${BTN} border-stone-700 text-red-300 hover:border-red-500 disabled:opacity-40`}
      >
        Delete
      </button>
    </span>
  )
}

export function ModerationPanel({ token }) {
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState([])
  const [blocked, setBlocked] = useState([])
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const call = useCallback(async (path, init = {}) => {
    const res = await fetch(`/api/moderation${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(body.error || `Request failed (${res.status}).`)
    return body
  }, [token])

  const load = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      const [rowsBody, blockedBody] = await Promise.all([call('?rows=1'), call('')])
      setRows(rowsBody.rows || [])
      setBlocked(blockedBody.blocked || [])
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }, [call])

  // Every action reloads rather than patching state locally: a block changes
  // the status of every other row the account owns, and getting that wrong on
  // screen is how you block someone twice and delete the wrong row.
  const act = useCallback(async (confirmText, run) => {
    if (!window.confirm(confirmText)) return
    setBusy(true)
    setError(null)
    try {
      await run()
      await load()
    } catch (e) {
      setError(e.message)
      setBusy(false)
    }
  }, [load])

  const blockAccount = row => act(
    `Block ${shortId(row.accountId)} ("${row.playerName}")?\n\nEvery run they have posted, and every run they post later, stops appearing on the board. Their save is untouched and this can be undone.`,
    () => {
      const reason = `handle: ${row.playerName}`
      return call('', { method: 'POST', body: JSON.stringify({ accountId: row.accountId, reason }) })
    },
  )

  const deleteRow = row => act(
    `Delete this run by "${row.playerName}"?\n\nThis removes the row permanently, including from your analytics. Blocking is reversible; this is not.`,
    () => call(`?runKey=${encodeURIComponent(row.runKey)}`, { method: 'DELETE' }),
  )

  const unblock = accountId => act(
    `Unblock ${shortId(accountId)}? Their runs go back on the board.`,
    () => call(`?accountId=${encodeURIComponent(accountId)}`, { method: 'DELETE' }),
  )

  if (!open) {
    return (
      <Section title="Moderation" className="lg:col-span-2">
        <button
          onClick={() => { setOpen(true); load() }}
          className="rounded border border-stone-700 px-3 py-1 text-sm hover:border-amber-500"
        >
          Open moderation
        </button>
      </Section>
    )
  }

  return (
    <Section title="Moderation" count={rows.length} className="lg:col-span-2">
      <div className="mb-2 flex items-center gap-3 text-xs text-stone-500">
        <button onClick={load} disabled={busy} className="rounded border border-stone-700 px-2 py-0.5 hover:border-amber-500 disabled:opacity-40">
          {busy ? 'Working…' : 'Refresh'}
        </button>
        <span>Blocking hides every row an account has. Deleting removes one row for good.</span>
      </div>

      {error && <p className="mb-2 text-sm text-red-400">{error}</p>}

      {blocked.length > 0 && (
        <div className="mb-4">
          <h4 className="mb-1 text-[11px] uppercase tracking-wide text-stone-500">
            Blocked accounts · {blocked.length}
          </h4>
          <ul className="space-y-1">
            {blocked.map(b => (
              <li key={b.accountId} className="flex items-center gap-2 text-xs">
                <span className="font-mono text-stone-400">{shortId(b.accountId)}</span>
                <span className="text-stone-500">{b.reason || '—'}</span>
                <button
                  disabled={busy}
                  onClick={() => unblock(b.accountId)}
                  className={`${BTN} ml-auto border-stone-700 text-stone-300 hover:border-amber-500 disabled:opacity-40`}
                >
                  Unblock
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {rows.length === 0 ? (
        <p className="py-2 text-sm text-stone-600">No handles have been published yet.</p>
      ) : (
        <table className="w-full text-left text-xs">
          <thead className="text-[11px] uppercase tracking-wide text-stone-500">
            <tr>
              <th className="py-1 pr-2">Handle</th>
              <th className="py-1 pr-2">Account</th>
              <th className="py-1 pr-2">Run</th>
              <th className="py-1 pr-2 text-right">When</th>
              <th className="py-1 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.runKey} className="border-t border-stone-800/70">
                <td className="py-1 pr-2 text-slate-200">{row.playerName}</td>
                <td className="py-1 pr-2 font-mono text-stone-500">{shortId(row.accountId)}</td>
                <td className="py-1 pr-2 text-stone-500">
                  {row.outcome}
                  {row.durationMs ? ` · ${fmtDuration(Math.round(row.durationMs / 1000))}` : ''}
                  {row.dev ? ' · dev' : ''}
                </td>
                <td className="py-1 pr-2 text-right tabular-nums text-stone-500">{fmtDate(row.endedAt)}</td>
                <td className="py-1 text-right">
                  <RowActions row={row} busy={busy} onBlock={blockAccount} onDelete={deleteRow} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Section>
  )
}
