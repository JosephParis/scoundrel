import { useCallback, useMemo, useState } from 'react'
import { num, pct, themeName, shortId, fmtDate } from './format'
import { bandForTheme, bandVerdict, BAND_TOLERANCE, VERDICT_MIN_DECISIVE } from './bands'

/**
 * Sortable stat tables for the admin dashboard. Every table is built from
 * `DataTable` + a column spec, so each column header is clickable to sort.
 *
 * A column is:
 *   { key, label, align?: 'left'|'right',
 *     render: row => node,                 // cell contents
 *     sort?:  row => number|string,        // value to sort by (omit = not sortable)
 *     cellClass?: string | (row => string) // extra <td> classes }
 *
 * Clicking a sortable header cycles descending → ascending → off (back to the
 * incoming row order, which is whatever the server ordered by). One column at a
 * time; a table can seed a default via `defaultSort`.
 */

// Sort state is { key, dir } with dir 'asc' | 'desc' | null. The toggle cycles a
// column desc → asc → off, and jumps straight to desc when a new column is hit.
function useSort(initial) {
  const [sort, setSort] = useState(initial || { key: null, dir: null })
  const toggle = useCallback((key) => {
    setSort(s => {
      if (s.key !== key) return { key, dir: 'desc' }
      if (s.dir === 'desc') return { key, dir: 'asc' }
      if (s.dir === 'asc') return { key: null, dir: null }
      return { key, dir: 'desc' }
    })
  }, [])
  return [sort, toggle]
}

// Numbers sort numerically; anything else compares as a string with natural
// ("numeric") ordering so e.g. "Descent 2" sorts before "Descent 10". Stable
// Array.prototype.sort keeps ties in their incoming (server) order.
function applySort(rows, sort, columns) {
  if (!sort?.key || !sort?.dir) return rows
  const col = columns.find(c => c.key === sort.key)
  if (!col?.sort) return rows
  const sign = sort.dir === 'asc' ? 1 : -1
  return [...rows].sort((a, b) => {
    const va = col.sort(a)
    const vb = col.sort(b)
    if (typeof va === 'number' && typeof vb === 'number') return sign * (va - vb)
    return sign * String(va).localeCompare(String(vb), undefined, { numeric: true })
  })
}

const padFor = (i, len) => (i === 0 ? 'pr-2' : i === len - 1 ? 'pl-2' : 'px-2')
const alignFor = col => (col.align === 'right' ? 'text-right' : 'text-left')
const cellClassOf = (col, row) =>
  typeof col.cellClass === 'function' ? col.cellClass(row) : (col.cellClass || '')

function SortTh({ col, index, count, sort, onSort }) {
  const sortable = !!col.sort
  const active = sort.key === col.key
  const arrow = active ? (sort.dir === 'asc' ? '↑' : '↓') : ''
  return (
    <th
      onClick={sortable ? () => onSort(col.key) : undefined}
      aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
      title={sortable ? 'Click to sort' : undefined}
      className={`py-1 ${padFor(index, count)} font-medium ${alignFor(col)} ${
        sortable ? 'cursor-pointer select-none hover:text-stone-200' : ''
      }`}
    >
      {col.label}
      {active && <span className="ml-0.5 text-amber-300">{arrow}</span>}
    </th>
  )
}

export function DataTable({ title, className, columns, rows, defaultSort, footer }) {
  const [sort, toggle] = useSort(defaultSort)
  const shown = useMemo(() => applySort(rows, sort, columns), [rows, sort, columns])
  return (
    <Section title={title} count={rows.length} className={className}>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-stone-400 border-b border-stone-700">
            {columns.map((c, i) => (
              <SortTh key={c.key} col={c} index={i} count={columns.length} sort={sort} onSort={toggle} />
            ))}
          </tr>
        </thead>
        <tbody>
          {shown.map((r, i) => (
            <tr key={i} className="border-b border-stone-800/60">
              {columns.map((c, ci) => (
                <td key={c.key} className={`py-1 ${padFor(ci, columns.length)} ${alignFor(c)} ${cellClassOf(c, r)}`}>
                  {c.render(r)}
                </td>
              ))}
            </tr>
          ))}
          {shown.length === 0 && <EmptyRow cols={columns.length} />}
        </tbody>
      </table>
      {footer}
    </Section>
  )
}

export function Section({ title, count, className = '', children }) {
  return (
    <section className={`rounded-lg border border-stone-700 bg-stone-900/60 p-4 ${className}`}>
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-stone-400">
        {title} {count != null && <span className="text-stone-600">({count})</span>}
      </h2>
      {children}
    </section>
  )
}

export function EmptyRow({ cols }) {
  return (
    <tr>
      <td colSpan={cols} className="py-3 text-center text-stone-600">no data yet</td>
    </tr>
  )
}

// -- Column specs ------------------------------------------------------
// Static specs live at module scope; specs that close over name mappers are
// built inside their component.

const WINRATE_COLUMNS = [
  { key: 'label', label: 'Name', sort: r => String(r.label).toLowerCase(), render: r => r.label },
  { key: 'n', label: 'Runs', align: 'right', sort: r => num(r.n), render: r => num(r.n), cellClass: 'tabular-nums text-stone-400' },
  { key: 'wins', label: 'Wins', align: 'right', sort: r => num(r.wins), render: r => num(r.wins), cellClass: 'tabular-nums text-stone-400' },
  { key: 'winrate', label: 'Winrate', align: 'right', sort: r => num(r.wins) / Math.max(1, num(r.n)), render: r => pct(r.wins, r.n), cellClass: 'tabular-nums text-amber-300' },
]

const DESCENT_COLUMNS = [
  { key: 'descent', label: 'Descent', sort: r => num(r.descent), render: r => `Descent ${num(r.descent)}` },
  { key: 'entered', label: 'Entered', align: 'right', sort: r => num(r.entered), render: r => num(r.entered), cellClass: 'tabular-nums text-stone-400' },
  { key: 'cleared', label: 'Cleared', align: 'right', sort: r => num(r.cleared), render: r => num(r.cleared), cellClass: 'tabular-nums text-stone-400' },
  { key: 'died', label: 'Died', align: 'right', sort: r => num(r.died), render: r => num(r.died), cellClass: 'tabular-nums text-red-400' },
  { key: 'retired', label: 'Retired', align: 'right', sort: r => num(r.retired), render: r => num(r.retired), cellClass: 'tabular-nums text-stone-500' },
  { key: 'rate', label: 'Clear rate', align: 'right', sort: r => num(r.cleared) / Math.max(1, num(r.entered)), render: r => pct(r.cleared, r.entered), cellClass: 'tabular-nums text-amber-300' },
]

const RUNSHAPE_COLUMNS = [
  { key: 'outcome', label: 'Outcome', sort: r => String(r.outcome), render: r => r.outcome, cellClass: 'capitalize' },
  { key: 'n', label: 'Runs', align: 'right', sort: r => num(r.n), render: r => num(r.n), cellClass: 'tabular-nums text-stone-400' },
  { key: 'kit', label: 'Kit edits', align: 'right', sort: r => num(r.avg_kit_edits), render: r => num(r.avg_kit_edits), cellClass: 'tabular-nums' },
  { key: 'boons', label: 'Boons', align: 'right', sort: r => num(r.avg_boons), render: r => num(r.avg_boons), cellClass: 'tabular-nums' },
  { key: 'inscribed', label: 'Inscribed', align: 'right', sort: r => num(r.avg_inscribed), render: r => num(r.avg_inscribed), cellClass: 'tabular-nums' },
  { key: 'upgraded', label: 'Upgraded', align: 'right', sort: r => num(r.avg_upgraded), render: r => num(r.avg_upgraded), cellClass: 'tabular-nums' },
]

// -- Table components --------------------------------------------------

// Winrate table: rows are { label, n, wins }, filtered by the shared min-sample
// threshold. Defaults to winrate descending; every column is sortable.
export function WinrateTable({ title, rows, minN }) {
  const filtered = useMemo(() => rows.filter(r => num(r.n) >= minN), [rows, minN])
  return <DataTable title={title} columns={WINRATE_COLUMNS} rows={filtered} defaultSort={{ key: 'winrate', dir: 'desc' }} />
}

// Plain count table: rows are { label, value }. When the displayed value is a
// composed string (e.g. "3 / 10 (30%)"), pass a numeric `sortVal` per row so the
// value column still sorts meaningfully; otherwise the value coerces to a number.
export function CountTable({ title, rows, extra }) {
  const columns = useMemo(() => [
    { key: 'label', label: extra?.label || 'Name', sort: r => String(r.label).toLowerCase(), render: r => r.label },
    { key: 'value', label: extra?.col || 'Count', align: 'right', sort: r => (r.sortVal != null ? r.sortVal : num(r.value)), render: r => r.value, cellClass: 'tabular-nums text-amber-300' },
  ], [extra])
  return <DataTable title={title} columns={columns} rows={rows} />
}

// Per-descent funnel. Defaults to descent order; sortable to surface the
// deadliest depth by deaths or the worst clear rate.
export function DescentFunnel({ rows }) {
  return <DataTable title="Per-descent funnel" className="lg:col-span-2" columns={DESCENT_COLUMNS} rows={rows} defaultSort={{ key: 'descent', dir: 'asc' }} />
}

// Beat rate as a 0-100 number: survival among decisive outcomes (clear vs
// death), the metric WINRATE_TARGETS' tier bands are set against. Null when a
// theme has no decisive outcomes yet.
const beatPct = r => {
  const decisive = num(r.cleared) + num(r.died)
  return decisive > 0 ? (num(r.cleared) / decisive) * 100 : null
}

// Verdict → text colour. 'ok' (in band) reads as well-tuned, not a warning.
const VERDICT_TEXT = { punishing: 'text-red-400', soft: 'text-sky-400', ok: 'text-emerald-400' }
const VERDICT_TAG = { punishing: 'too hard', soft: 'too soft' }

// Chance of beating a theme: clear vs death when the theme was actually faced.
// Beat rate excludes retires (a voluntary quit isn't the theme winning). The
// beat cell is tinted against the theme's tier survival band (WINRATE_TARGETS)
// so out-of-band themes surface at a glance; a Target column shows the band.
export function ThemeSurvival({ rows, minN }) {
  const filtered = useMemo(() => rows.filter(r => num(r.faced) >= minN), [rows, minN])
  const columns = useMemo(() => [
    { key: 'theme', label: 'Theme', sort: r => themeName(r.theme).toLowerCase(), render: r => themeName(r.theme) },
    { key: 'faced', label: 'Faced', align: 'right', sort: r => num(r.faced), render: r => num(r.faced), cellClass: 'tabular-nums text-stone-400' },
    { key: 'cleared', label: 'Cleared', align: 'right', sort: r => num(r.cleared), render: r => num(r.cleared), cellClass: 'tabular-nums text-stone-400' },
    { key: 'died', label: 'Died', align: 'right', sort: r => num(r.died), render: r => num(r.died), cellClass: 'tabular-nums text-red-400' },
    { key: 'retired', label: 'Retired', align: 'right', sort: r => num(r.retired), render: r => num(r.retired), cellClass: 'tabular-nums text-stone-500' },
    {
      key: 'target', label: 'Target', align: 'right',
      sort: r => { const b = bandForTheme(r.theme); return b ? b.low : -1 },
      render: r => { const b = bandForTheme(r.theme); return b ? `${b.label} ${b.low}-${b.high}%` : '—' },
      cellClass: 'tabular-nums text-stone-500',
    },
    {
      key: 'beat', label: 'Beat rate', align: 'right',
      sort: r => beatPct(r) ?? -1,
      render: r => {
        const decisive = num(r.cleared) + num(r.died)
        const verdict = bandVerdict(bandForTheme(r.theme), beatPct(r), decisive)
        const tag = verdict && VERDICT_TAG[verdict]
        return (
          <>
            {pct(r.cleared, decisive)}
            {tag && <span className="ml-1 text-[10px] uppercase tracking-wide opacity-80">{tag}</span>}
          </>
        )
      },
      cellClass: r => {
        const decisive = num(r.cleared) + num(r.died)
        const verdict = bandVerdict(bandForTheme(r.theme), beatPct(r), decisive)
        return `tabular-nums ${verdict ? VERDICT_TEXT[verdict] : 'text-amber-300'}`
      },
    },
  ], [])
  const legend = (
    <p className="mt-2 text-[11px] leading-snug text-stone-500">
      Beat rate tinted against the tier's survival target (WINRATE_TARGETS):{' '}
      <span className="text-emerald-400">in band</span>,{' '}
      <span className="text-red-400">too hard</span>,{' '}
      <span className="text-sky-400">too soft</span>. Needs ≥{VERDICT_MIN_DECISIVE} decisive
      runs to flag, with ±{BAND_TOLERANCE}pt slack. Assumes Ascension 0, default mode.
    </p>
  )
  return <DataTable title="Theme survival (chance of beating)" className="lg:col-span-2" columns={columns} rows={filtered} defaultSort={{ key: 'beat', dir: 'desc' }} footer={legend} />
}

// Per-player activity. Guest runs are conflated into one row (a total, not a
// person), so that row is de-emphasized. Respects the min-runs filter.
export function PlayerTable({ rows, minN }) {
  const filtered = useMemo(() => rows.filter(r => num(r.n) >= minN), [rows, minN])
  const columns = useMemo(() => [
    { key: 'player', label: 'Player', sort: r => String(r.account_id), render: r => shortId(r.account_id), cellClass: r => `font-mono text-xs ${r.account_id === 'guest' ? 'text-stone-500 italic' : ''}` },
    { key: 'n', label: 'Runs', align: 'right', sort: r => num(r.n), render: r => num(r.n), cellClass: 'tabular-nums text-stone-400' },
    { key: 'wins', label: 'Wins', align: 'right', sort: r => num(r.wins), render: r => num(r.wins), cellClass: 'tabular-nums text-stone-400' },
    { key: 'winrate', label: 'Winrate', align: 'right', sort: r => num(r.wins) / Math.max(1, num(r.n)), render: r => pct(r.wins, r.n), cellClass: 'tabular-nums text-amber-300' },
    { key: 'best', label: 'Best asc', align: 'right', sort: r => num(r.best_ascension), render: r => num(r.best_ascension), cellClass: 'tabular-nums text-stone-400' },
    { key: 'seen', label: 'Last seen', align: 'right', sort: r => num(r.last_seen), render: r => fmtDate(r.last_seen), cellClass: 'tabular-nums text-stone-500' },
  ], [])
  return <DataTable title="Players" className="lg:col-span-2" columns={columns} rows={filtered} defaultSort={{ key: 'seen', dir: 'desc' }} />
}

export function RunShape({ rows }) {
  return <DataTable title="Run shape by outcome" className="lg:col-span-2" columns={RUNSHAPE_COLUMNS} rows={rows} />
}
