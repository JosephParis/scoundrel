import { useMemo } from 'react'
import { LogPanel } from './atoms'
import { RunSummary, EndingKitSection } from './RunSummary'
import { buildRunRecord } from '../history'
import { useHandle } from '../settings'

// A victory with no leaderboard handle is listed as "Anonymous" rather than
// dropped. The run places, so this is no longer a warning that something was
// lost -- it just tells the player which row is theirs and what it would take
// to have their own name on it. Still worth saying at the one moment they care
// about it, and the fix is still one click. Deliberately not shown on death --
// only victories are ranked, so there is nothing to be credited for.
function LeaderboardNudge({ onOpenSettings }) {
  return (
    <p className="text-[12px] text-slate-400 -mt-1 short:-mt-2 mb-3 short:mb-2 sm:mb-4 max-w-md">
      This victory is listed as Anonymous: it carries no name.{' '}
      <button
        onClick={onOpenSettings}
        className="text-rune underline underline-offset-2 hover:text-amber-300 transition"
      >
        Set one in Settings
      </button>{' '}
      and the runs you finish from now on will be credited to it.
    </p>
  )
}

// onBeginAgain wraps freshRun() in the root so this file doesn't
// depend on save/load details.
export function OutcomeView({ game, onBeginAgain, onOpenSettings }) {
  const won = game.phase === 'victory'
  // Unconditional: `won &&` in front of the hook call would skip it on the
  // death screen and change hook order between the two outcomes.
  // Trailing space is legal mid-typing but nothing posts under it, so trim
  // before deciding whether this run carries a name.
  const handle = useHandle()
  const anonymous = won && !handle.trim()
  // Local view-only record; the persisted copy (with account id) is written
  // by the root's recording effect. User isn't needed for display.
  const record = useMemo(() => buildRunRecord(game, null), [game])
  const headline = won
    ? 'You are blinded by the light'
    : 'You fall in the dark.'
  const deck = record.endingDeck || []

  // Lay the summary out in two columns on desktop so the tall kit fan sits
  // beside the rest of the run details instead of stacking under it. This
  // keeps the "big web page" within the viewport without any internal scroll.
  // On narrow screens the columns stack and the page scrolls as usual.
  return (
    <div className="flex flex-col items-center text-center animate-fade-in pt-2 short:pt-0">
      <div className="space-y-2 short:space-y-1 sm:space-y-3">
        <div className={`font-display text-4xl sm:text-5xl ${won ? 'text-rune' : 'text-blood'}`}>
          {headline}
        </div>
        <div className="rune-divider mx-auto max-w-xs text-[10px] short:hidden">
          <span>✦</span>
        </div>
        {/* The summary panel below repeats this exact count, so on a short screen
            the duplicate is the cheapest line to drop. */}
        <div className="text-[11px] text-slate-500 uppercase tracking-widest short:hidden">
          {game.sigilsEarned} of {game.sigilTarget} sigils set
        </div>
      </div>

      <button
        onClick={onBeginAgain}
        className={`my-3 short:my-2 sm:my-5 px-10 py-3 short:py-2 sm:py-4 rounded-md font-display text-lg tracking-[0.2em] transition ${
          won
            ? 'bg-gradient-to-b from-amber-500 to-amber-700 hover:from-amber-400 hover:to-amber-600 text-stone-950 border border-amber-600/80 shadow-[0_0_24px_-6px_rgba(251,191,36,0.6)]'
            : 'bg-gradient-to-b from-red-700 to-red-900 hover:from-red-600 hover:to-red-800 text-parchment border border-red-800/80'
        }`}
      >
        {won ? 'ASCEND' : 'BEGIN AGAIN'}
      </button>

      {anonymous && <LeaderboardNudge onOpenSettings={onOpenSettings} />}

      <div className="w-full max-w-4xl grid grid-cols-[1.4fr_1fr] lg:grid-cols-2 gap-3 short:gap-2 sm:gap-5 items-start text-left">
        <div className="panel p-4 short:p-3 sm:p-6">
          <RunSummary record={record} showDeck={false} />
        </div>

        <div className="space-y-3 short:space-y-2 sm:space-y-5">
          {deck.length > 0 && (
            <div className="panel p-4 short:p-3 sm:p-6">
              <EndingKitSection deck={deck} />
            </div>
          )}
          <LogPanel lines={game.log} collapsible />
        </div>
      </div>
    </div>
  )
}
