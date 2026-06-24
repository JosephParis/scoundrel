import { useCallback, useEffect, useMemo, useState } from 'react'
import { BOONS } from '../games/scoundrel/boons'
import { getTheme } from '../games/scoundrel/themes'
import { getBoss } from '../games/scoundrel/bosses'
import { INSCRIBED_FRAMES, SUIT_GLYPH, rankLabel, getMode } from '../games/scoundrel/constants'

/**
 * Admin-only analytics dashboard (route: /admin). Reads pre-aggregated stats
 * from GET /api/stats, gated by an admin token the user pastes once and we
 * keep in localStorage. Everything here is read-only; the heavy lifting (the
 * SQL aggregation) happens server-side. Ids are mapped to display names with
 * the same tables the game uses.
 *
 * Only works against a deployed build (or `vercel dev`): plain `npm run dev`
 * has no /api route.
 */

const TOKEN_KEY = 'scoundrel:admin_token'
const num = v => Number(v || 0)
const pct = (wins, n) => (n > 0 ? `${Math.round((num(wins) / num(n)) * 100)}%` : '–')

const boonName = id => BOONS[id]?.name || id
const themeName = id => getTheme(id)?.name || id
const frameName = id => INSCRIBED_FRAMES[id]?.name || id
const modeName = id => getMode(id)?.name || id
const cardLabel = (suit, rank, boss) =>
  boss ? (getBoss(boss)?.name || boss) : `${rankLabel(num(rank))}${SUIT_GLYPH[suit] || suit || ''}`
const fmtDuration = (sec) => {
  const s = num(sec)
  if (s <= 0) return '–'
  const m = Math.floor(s / 60)
  return m > 0 ? `${m}m ${s % 60}s` : `${s}s`
}

// A winrate table: rows normalized to { label, n, wins }. Filtered by the
// shared min-sample threshold, then sorted by winrate (n as tie-break).
function WinrateTable({ title, rows, minN }) {
  const shown = useMemo(() => {
    return rows
      .filter(r => num(r.n) >= minN)
      .sort((a, b) => {
        const wa = num(a.wins) / Math.max(1, num(a.n))
        const wb = num(b.wins) / Math.max(1, num(b.n))
        return wb - wa || num(b.n) - num(a.n)
      })
  }, [rows, minN])

  return (
    <Section title={title} count={shown.length}>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-stone-400 border-b border-stone-700">
            <th className="py-1 pr-2 font-medium">Name</th>
            <th className="py-1 px-2 font-medium text-right">Runs</th>
            <th className="py-1 px-2 font-medium text-right">Wins</th>
            <th className="py-1 pl-2 font-medium text-right">Winrate</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((r, i) => (
            <tr key={i} className="border-b border-stone-800/60">
              <td className="py-1 pr-2">{r.label}</td>
              <td className="py-1 px-2 text-right tabular-nums text-stone-400">{num(r.n)}</td>
              <td className="py-1 px-2 text-right tabular-nums text-stone-400">{num(r.wins)}</td>
              <td className="py-1 pl-2 text-right tabular-nums text-amber-300">{pct(r.wins, r.n)}</td>
            </tr>
          ))}
          {shown.length === 0 && <EmptyRow cols={4} />}
        </tbody>
      </table>
    </Section>
  )
}

// A plain count table: rows normalized to { label, n }.
function CountTable({ title, rows, extra }) {
  return (
    <Section title={title} count={rows.length}>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-stone-400 border-b border-stone-700">
            <th className="py-1 pr-2 font-medium">{extra?.label || 'Name'}</th>
            <th className="py-1 pl-2 font-medium text-right">{extra?.col || 'Count'}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-stone-800/60">
              <td className="py-1 pr-2">{r.label}</td>
              <td className="py-1 pl-2 text-right tabular-nums text-amber-300">{r.value}</td>
            </tr>
          ))}
          {rows.length === 0 && <EmptyRow cols={2} />}
        </tbody>
      </table>
    </Section>
  )
}

function Section({ title, count, className = '', children }) {
  return (
    <section className={`rounded-lg border border-stone-700 bg-stone-900/60 p-4 ${className}`}>
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-stone-400">
        {title} {count != null && <span className="text-stone-600">({count})</span>}
      </h2>
      {children}
    </section>
  )
}

// Bespoke multi-column tables for the per-descent funnel and run-shape data,
// which don't fit the simple winrate/count shapes.
function DescentFunnel({ rows }) {
  return (
    <Section title="Per-descent funnel" count={rows.length} className="lg:col-span-2">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-stone-400 border-b border-stone-700">
            <th className="py-1 pr-2 font-medium">Descent</th>
            <th className="py-1 px-2 font-medium text-right">Entered</th>
            <th className="py-1 px-2 font-medium text-right">Cleared</th>
            <th className="py-1 px-2 font-medium text-right">Died</th>
            <th className="py-1 px-2 font-medium text-right">Retired</th>
            <th className="py-1 pl-2 font-medium text-right">Clear rate</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-stone-800/60">
              <td className="py-1 pr-2">Descent {num(r.descent)}</td>
              <td className="py-1 px-2 text-right tabular-nums text-stone-400">{num(r.entered)}</td>
              <td className="py-1 px-2 text-right tabular-nums text-stone-400">{num(r.cleared)}</td>
              <td className="py-1 px-2 text-right tabular-nums text-red-400">{num(r.died)}</td>
              <td className="py-1 px-2 text-right tabular-nums text-stone-500">{num(r.retired)}</td>
              <td className="py-1 pl-2 text-right tabular-nums text-amber-300">{pct(r.cleared, r.entered)}</td>
            </tr>
          ))}
          {rows.length === 0 && <EmptyRow cols={6} />}
        </tbody>
      </table>
    </Section>
  )
}

function RunShape({ rows }) {
  return (
    <Section title="Run shape by outcome" count={rows.length} className="lg:col-span-2">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-stone-400 border-b border-stone-700">
            <th className="py-1 pr-2 font-medium">Outcome</th>
            <th className="py-1 px-2 font-medium text-right">Runs</th>
            <th className="py-1 px-2 font-medium text-right">Kit edits</th>
            <th className="py-1 px-2 font-medium text-right">Boons</th>
            <th className="py-1 px-2 font-medium text-right">Inscribed</th>
            <th className="py-1 pl-2 font-medium text-right">Upgraded</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-stone-800/60">
              <td className="py-1 pr-2 capitalize">{r.outcome}</td>
              <td className="py-1 px-2 text-right tabular-nums text-stone-400">{num(r.n)}</td>
              <td className="py-1 px-2 text-right tabular-nums">{num(r.avg_kit_edits)}</td>
              <td className="py-1 px-2 text-right tabular-nums">{num(r.avg_boons)}</td>
              <td className="py-1 px-2 text-right tabular-nums">{num(r.avg_inscribed)}</td>
              <td className="py-1 pl-2 text-right tabular-nums">{num(r.avg_upgraded)}</td>
            </tr>
          ))}
          {rows.length === 0 && <EmptyRow cols={6} />}
        </tbody>
      </table>
    </Section>
  )
}

function EmptyRow({ cols }) {
  return (
    <tr>
      <td colSpan={cols} className="py-3 text-center text-stone-600">no data yet</td>
    </tr>
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

  const load = useCallback(async (t) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/stats', { headers: { Authorization: `Bearer ${t}` } })
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

  useEffect(() => {
    // Auto-load when a token is present (persisted on mount, or just submitted).
    // load() flips loading/error then awaits the fetch; firing it from an effect
    // is the intended data-sync use, and the synchronous setState is harmless.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (token) load(token)
  }, [token, load])

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
            <button onClick={() => load(token)} className="rounded border border-stone-700 px-3 py-1 hover:border-amber-500">
              {loading ? '…' : 'Refresh'}
            </button>
          </div>
        </header>

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
              }))}
            />
            <CountTable
              title="Forge edits by type"
              extra={{ label: 'Type', col: 'Skipped / total' }}
              rows={data.forgeByType.map(r => ({
                label: r.type,
                value: `${num(r.skips)} / ${num(r.n)} (${pct(r.skips, r.n)} skip)`,
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
              }))}
            />
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
