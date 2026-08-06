import { useEffect, useState } from 'react'
import { fetchLeaderboard } from '../../../utils/leaderboard'
import { getMode } from '../constants'
import { useHandle } from '../settings'

// The public fastest-victory board. Only wins are ranked, one entry per
// player, fastest first. Data comes from /api/leaderboard, which is absent in
// dev and on a deployment without a database, so the unavailable state is a
// normal outcome here rather than an error to shout about.

const BOARD_LIMIT = 25

// mm:ss, the conventional shape for a time to beat. Hours are rare but a long
// grind shouldn't render as "97:41", so they get their own segment.
function formatTime(ms) {
  const total = Math.max(0, Math.floor((ms || 0) / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const pad = n => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`
}

function formatDate(ms) {
  if (!ms) return ''
  try {
    return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  } catch {
    return ''
  }
}

// Medals for the podium, plain numerals below it.
const MEDAL = { 1: '✦', 2: '✦', 3: '✦' }
const MEDAL_COLOR = {
  1: 'text-amber-300',
  2: 'text-slate-300',
  3: 'text-amber-700',
}

function Row({ entry }) {
  const modeName = getMode(entry.mode)?.name
  return (
    <li
      className={`flex items-center gap-3 px-3 py-2.5 rounded-md border transition ${
        entry.you
          ? 'border-rune/50 bg-rune/5'
          : 'border-stone-800 hover:bg-stone-800/40'
      }`}
    >
      <span
        className={`font-display text-sm w-10 shrink-0 tabular-nums ${
          MEDAL_COLOR[entry.rank] || 'text-slate-500'
        }`}
      >
        {MEDAL[entry.rank] ? (
          <>
            <span aria-hidden="true">{MEDAL[entry.rank]}</span>
            <span className="ml-1">{entry.rank}</span>
          </>
        ) : (
          <>#{entry.rank}</>
        )}
      </span>
      <span className="min-w-0 flex-1">
        {/* The endpoint lists only runs carrying a handle, so playerName is
            always present here — there is no anonymous row to fall back to. */}
        <span className={`block text-sm truncate ${entry.you ? 'text-rune' : 'text-parchment'}`}>
          {entry.you ? 'You' : entry.playerName}
        </span>
        <span className="block text-[10px] text-slate-500 truncate">
          {formatDate(entry.endedAt)}
          {modeName && modeName !== 'Default' && ` ✦ ${modeName}`}
        </span>
      </span>
      {entry.ascension > 0 && (
        <span className="text-[11px] text-slate-500 shrink-0" title={`Ascension ${entry.ascension}`}>
          A{entry.ascension}
        </span>
      )}
      <span className="font-display text-base text-parchment shrink-0 tabular-nums">
        {formatTime(entry.durationMs)}
      </span>
    </li>
  )
}

// The shell owns nothing but the open flag, so the body below mounts fresh on
// every open. That means it starts in its own 'loading' state and refetches
// each time, without the effect having to reset state on the way in.
export function LeaderboardModal({ open, onClose, user }) {
  if (!open) return null
  return <LeaderboardBody onClose={onClose} user={user} />
}

function LeaderboardBody({ onClose, user }) {
  const [state, setState] = useState({ status: 'loading' })
  const handle = useHandle()

  // Refetch on mount and whenever the account changes: it decides which rows
  // come back marked as yours.
  useEffect(() => {
    const controller = new AbortController()
    fetchLeaderboard({
      accountId: user?.sub,
      limit: BOARD_LIMIT,
      signal: controller.signal,
    })
      .then(result => {
        if (controller.signal.aborted) return
        setState(result.ok
          ? { status: 'ready', data: result.data }
          : { status: 'error', reason: result.reason })
      })
      .catch(() => {
        // Aborted by the cleanup below; the modal is gone.
      })
    return () => controller.abort()
  }, [user])

  const data = state.status === 'ready' ? state.data : null
  // Their best run, shown pinned below the page when its rank fell outside it.
  const pinnedSelf = data && data.self && !data.selfInPage ? data.self : null

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-start sm:items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="panel max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 sm:p-8 my-4 sm:my-auto relative shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 w-9 h-9 rounded-full bg-stone-800 hover:bg-stone-700 text-parchment text-xl leading-none flex items-center justify-center border border-stone-700"
          aria-label="Close leaderboard"
        >
          ×
        </button>
        <h2 className="font-display text-rune text-2xl mb-1">Fastest descents</h2>
        <p className="text-[12px] text-slate-500 mb-4">
          Victories only, fastest first, one entry per player.
          {!handle.trim() && ' Your runs are not listed until you set a leaderboard name in Settings.'}
          {' '}Press <span className="font-mono text-slate-300">Esc</span> or click outside to close.
        </p>

        {state.status === 'loading' ? (
          <div className="py-12 text-center text-slate-500 text-sm">Loading…</div>
        ) : state.status === 'error' ? (
          <div className="py-12 text-center text-slate-500 text-sm">
            {state.reason === 'unavailable'
              ? 'The leaderboard is unavailable right now.'
              : 'Could not load the leaderboard.'}
          </div>
        ) : data.entries.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-sm">
            Nobody is listed yet. Set a leaderboard name, clear a run, and the
            first time is yours.
          </div>
        ) : (
          <>
            <ul className="space-y-1.5">
              {data.entries.map(entry => (
                <Row key={entry.rank} entry={entry} />
              ))}
            </ul>
            {pinnedSelf && (
              <>
                <div className="text-center text-slate-700 text-xs py-1.5 select-none">⋮</div>
                <ul>
                  <Row entry={pinnedSelf} />
                </ul>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
