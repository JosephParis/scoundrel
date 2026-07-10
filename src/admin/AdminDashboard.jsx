import { useCallback, useEffect, useMemo, useState } from 'react'
import { GAME_VERSION, VERSION_HISTORY } from '../games/scoundrel/constants'
import { num, pct, boonName, themeName, frameName, modeName, cardLabel, fmtDuration } from './format'
import { WinrateTable, CountTable, DescentFunnel, ThemeSurvival, PlayerTable, RunShape } from './tables'
import { FeedbackPanel } from './feedback'

/**
 * Admin-only analytics dashboard (route: /admin). Reads pre-aggregated stats
 * from GET /api/stats, gated by an admin token the user pastes once and we
 * keep in localStorage. Everything here is read-only; the heavy lifting (the
 * SQL aggregation) happens server-side. Display helpers live in ./format and
 * the sortable stat tables in ./tables.
 *
 * Only works against a deployed build (or `vercel dev`): plain `npm run dev`
 * has no /api route.
 */

const TOKEN_KEY = 'scoundrel:admin_token'

// Version range filter: two bounds (From / To) over the ordered version list,
// so admins can scope to a single version, "everything from X on" (set From),
// "everything up to X" (set To), or any band in between. `ordered` carries the
// canonical sort order; the parent turns the bounds into the explicit version
// list the API filters on. Per-version run counts come from the server's
// unfiltered census so the menu is stable regardless of the active range. An
// untouched full range means all versions (legacy rows included); the live
// build's GAME_VERSION is flagged. Hidden until there's more than one version
// to range over, since a lone version has nothing to narrow.
function VersionRange({ range, onChange, ordered, rows }) {
  const countOf = useMemo(() => {
    const m = new Map()
    for (const r of rows) if (r.version != null) m.set(r.version, num(r.n))
    return m
  }, [rows])

  if (ordered.length < 2) return null
  const label = v => `${v}${v === GAME_VERSION ? ' (current)' : ''} · ${countOf.get(v) || 0}`
  const fromV = range.from || ordered[0]
  const toV = range.to || ordered[ordered.length - 1]
  const selectClass = 'rounded border border-stone-700 bg-stone-900 px-2 py-1 outline-none focus:border-amber-500'

  return (
    <div className="flex items-center gap-2 text-stone-400">
      <span>versions</span>
      <select value={fromV} onChange={e => onChange({ ...range, from: e.target.value })} className={selectClass}>
        {ordered.map(v => <option key={v} value={v}>{label(v)}</option>)}
      </select>
      <span className="text-stone-600">→</span>
      <select value={toV} onChange={e => onChange({ ...range, to: e.target.value })} className={selectClass}>
        {ordered.map(v => <option key={v} value={v}>{label(v)}</option>)}
      </select>
      {(range.from || range.to) && (
        <button
          onClick={() => onChange({ from: '', to: '' })}
          className="rounded border border-stone-700 px-2 py-1 text-xs hover:border-amber-500"
          title="Reset to all versions"
        >
          all
        </button>
      )}
    </div>
  )
}

function TokenGate({ onSubmit, error }) {
  const [value, setValue] = useState('')
  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-950 text-stone-200">
      <form
        onSubmit={e => { e.preventDefault(); onSubmit(value.trim()) }}
        className="w-80 rounded-lg border border-stone-700 bg-stone-900 p-6"
      >
        <h1 className="mb-4 text-lg font-semibold">Admin stats</h1>
        <input
          type="password"
          autoFocus
          value={value}
          onChange={e => setValue(e.target.value)}
          placeholder="Admin token"
          className="w-full rounded border border-stone-700 bg-stone-950 px-3 py-2 text-sm outline-none focus:border-amber-500"
        />
        {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          className="mt-4 w-full rounded bg-amber-600 px-3 py-2 text-sm font-medium text-stone-950 hover:bg-amber-500"
        >
          View
        </button>
      </form>
    </div>
  )
}

export default function AdminDashboard() {
  const [token, setToken] = useState(() => {
    try { return localStorage.getItem(TOKEN_KEY) || '' } catch { return '' }
  })
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [minN, setMinN] = useState(1)
  // Empty bounds = open (oldest / newest). A narrowed From/To range scopes every
  // stat to that band of balance versions server-side (see /api/stats ?versions).
  const [range, setRange] = useState({ from: '', to: '' })

  const load = useCallback(async (t, versionsCsv) => {
    setLoading(true)
    setError(null)
    try {
      const url = versionsCsv ? `/api/stats?versions=${encodeURIComponent(versionsCsv)}` : '/api/stats'
      const res = await fetch(url, { headers: { Authorization: `Bearer ${t}` } })
      if (res.status === 401) {
        setError('Invalid token.')
        setData(null)
        try { localStorage.removeItem(TOKEN_KEY) } catch { /* ignore */ }
        setToken('')
        return
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(body.error || `Request failed (${res.status}).`)
        return
      }
      setData(await res.json())
    } catch {
      setError('Could not reach /api/stats. Are you on a deployed build?')
    } finally {
      setLoading(false)
    }
  }, [])

  // Versions present in the data, sorted by the canonical VERSION_HISTORY order
  // (the labels don't sort reliably on their own). Any present version missing
  // from VERSION_HISTORY is appended so it stays selectable. Legacy null-version
  // rows are excluded here: a range is over known versions only.
  const ordered = useMemo(() => {
    const present = (data?.versionsAvailable || [])
      .filter(r => r.version != null)
      .map(r => r.version)
    const set = new Set(present)
    const known = VERSION_HISTORY.filter(v => set.has(v))
    const extra = present.filter(v => !VERSION_HISTORY.includes(v))
    return [...known, ...extra]
  }, [data])

  // The From/To range resolved into the explicit version list sent to the API.
  // Open bounds fall back to the extremes; an untouched full range returns '',
  // which means "all versions" server-side (and includes legacy rows).
  const versionsParam = useMemo(() => {
    if (ordered.length === 0) return ''
    const fromV = range.from || ordered[0]
    const toV = range.to || ordered[ordered.length - 1]
    let fi = ordered.indexOf(fromV); if (fi < 0) fi = 0
    let ti = ordered.indexOf(toV); if (ti < 0) ti = ordered.length - 1
    if (fi > ti) [fi, ti] = [ti, fi]
    if (fi === 0 && ti === ordered.length - 1) return ''
    return ordered.slice(fi, ti + 1).join(',')
  }, [ordered, range])

  useEffect(() => {
    // Auto-load when a token is present (persisted on mount, or just submitted),
    // and re-load whenever the version range changes. load() flips loading/error
    // then awaits the fetch; firing it from an effect is the intended data-sync
    // use, and the synchronous setState is harmless.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (token) load(token, versionsParam)
  }, [token, versionsParam, load])

  const submitToken = useCallback((t) => {
    if (!t) return
    try { localStorage.setItem(TOKEN_KEY, t) } catch { /* ignore */ }
    setToken(t)
  }, [])

  if (!token) return <TokenGate onSubmit={submitToken} error={error} />

  const o = data?.overview
  return (
    <div className="min-h-screen bg-stone-950 text-stone-200">
      <div className="mx-auto max-w-5xl p-6">
        <header className="mb-6 flex items-center justify-between gap-4">
          <h1 className="text-xl font-semibold">Scoundrel — run analytics</h1>
          <div className="flex items-center gap-3 text-sm">
            <VersionRange
              range={range}
              onChange={setRange}
              ordered={ordered}
              rows={data?.versionsAvailable || []}
            />
            <label className="flex items-center gap-2 text-stone-400">
              min runs
              <input
                type="number"
                min={1}
                value={minN}
                onChange={e => setMinN(Math.max(1, Number(e.target.value) || 1))}
                className="w-16 rounded border border-stone-700 bg-stone-900 px-2 py-1 text-right outline-none focus:border-amber-500"
              />
            </label>
            <button onClick={() => load(token, versionsParam)} className="rounded border border-stone-700 px-3 py-1 hover:border-amber-500">
              {loading ? '…' : 'Refresh'}
            </button>
          </div>
        </header>

        {versionsParam && (
          <p className="-mt-3 mb-4 text-xs text-amber-300/80">
            Scoped to versions <span className="font-mono">{versionsParam.split(',').join(', ')}</span>. Every stat below covers only this range (legacy unversioned runs excluded).
          </p>
        )}

        {error && <p className="mb-4 rounded border border-red-900 bg-red-950/40 px-3 py-2 text-sm text-red-300">{error}</p>}

        {o && (
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Runs" value={num(o.n)} />
            <Stat label="Winrate" value={pct(o.wins, o.n)} accent />
            <Stat label="Deaths" value={num(o.deaths)} />
            <Stat label="Retires" value={num(o.retires)} />
          </div>
        )}

        {data && (
          <div className="grid gap-4 lg:grid-cols-2">
            <FeedbackPanel rows={data.recentFeedback || []} />
            <PlayerTable rows={data.playerActivity || []} minN={minN} />
            <WinrateTable
              title="Winrate by boon"
              minN={minN}
              rows={data.winrateByBoon.map(r => ({ label: boonName(r.id), n: r.n, wins: r.wins }))}
            />
            <WinrateTable
              title="Winrate by boon pair"
              minN={minN}
              rows={data.winrateByBoonPair.map(r => ({ label: `${boonName(r.a)} + ${boonName(r.b)}`, n: r.n, wins: r.wins }))}
            />
            <WinrateTable
              title="Winrate by theme"
              minN={minN}
              rows={data.winrateByTheme.map(r => ({ label: themeName(r.id), n: r.n, wins: r.wins }))}
            />
            <WinrateTable
              title="Winrate by inscription"
              minN={minN}
              rows={data.winrateByInscription.map(r => ({ label: frameName(r.frame), n: r.n, wins: r.wins }))}
            />
            <WinrateTable
              title="Winrate by ascension"
              minN={minN}
              rows={data.winrateByAscension.map(r => ({ label: `Ascension ${num(r.ascension)}`, n: r.n, wins: r.wins }))}
            />
            <CountTable
              title="Deaths by source"
              rows={data.deathBySource.map(r => ({ label: r.source || 'unknown', value: num(r.n) }))}
            />
            <CountTable
              title="Deaths by descent reached"
              rows={data.deathByDescent.map(r => ({ label: `Descent ${num(r.descent)}`, value: num(r.n) }))}
            />
            <CountTable
              title="Deaths by killing card"
              rows={data.deathByKillingCard.map(r => ({ label: cardLabel(r.suit, r.rank, r.boss), value: num(r.n) }))}
            />
            <CountTable
              title="Boon pick rate"
              extra={{ label: 'Boon', col: 'Picked / offered' }}
              rows={data.boonPickRate.map(r => ({
                label: boonName(r.boon),
                value: `${num(r.times_picked)} / ${num(r.times_offered)} (${pct(r.times_picked, r.times_offered)})`,
                sortVal: num(r.times_picked) / Math.max(1, num(r.times_offered)),
              }))}
            />
            <CountTable
              title="Forge edits by type"
              extra={{ label: 'Type', col: 'Skipped / total' }}
              rows={data.forgeByType.map(r => ({
                label: r.type,
                value: `${num(r.skips)} / ${num(r.n)} (${pct(r.skips, r.n)} skip)`,
                sortVal: num(r.skips) / Math.max(1, num(r.n)),
              }))}
            />
            <WinrateTable
              title="Winrate by mode"
              minN={minN}
              rows={(data.winrateByMode || []).map(r => ({ label: modeName(r.mode), n: r.n, wins: r.wins }))}
            />
            <CountTable
              title="Retires by phase"
              extra={{ label: 'Quit from', col: 'Count' }}
              rows={(data.retireByPhase || []).map(r => ({
                label: r.phase === 'descent' ? 'Mid-descent' : 'Sanctuary',
                value: num(r.n),
              }))}
            />
            <CountTable
              title="Avg run length by outcome"
              extra={{ label: 'Outcome', col: 'Avg time · runs' }}
              rows={(data.durationByOutcome || []).map(r => ({
                label: r.outcome,
                value: `${fmtDuration(r.avg_seconds)} · ${num(r.n)}`,
                sortVal: num(r.avg_seconds),
              }))}
            />
            <ThemeSurvival rows={data.themeSurvival || []} minN={minN} />
            <DescentFunnel rows={data.descentFunnel || []} />
            <RunShape rows={data.runShapeByOutcome || []} />
          </div>
        )}
      </div>
    </div>
  )
}

function Stat({ label, value, accent }) {
  return (
    <div className="rounded-lg border border-stone-700 bg-stone-900/60 p-3">
      <div className="text-xs uppercase tracking-wider text-stone-500">{label}</div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${accent ? 'text-amber-300' : 'text-stone-100'}`}>{value}</div>
    </div>
  )
}
