import { useMemo } from 'react'
import { LogPanel } from './atoms'
import { RunSummary, EndingKitSection } from './RunSummary'
import { buildRunRecord } from '../history'

// onBeginAgain wraps freshRun() in the root so this file doesn't
// depend on save/load details.
export function OutcomeView({ game, onBeginAgain }) {
  const won = game.phase === 'victory'
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
    <div className="flex flex-col items-center text-center animate-fade-in pt-2">
      <div className="space-y-3">
        <div className={`font-display text-4xl sm:text-5xl ${won ? 'text-rune' : 'text-blood'}`}>
          {headline}
        </div>
        <div className="rune-divider mx-auto max-w-xs text-[10px]">
          <span>✦</span>
        </div>
        <div className="text-[11px] text-slate-500 uppercase tracking-widest">
          {game.sigilsEarned} of {game.sigilTarget} sigils set
        </div>
      </div>

      <button
        onClick={onBeginAgain}
        className={`my-5 px-10 py-4 rounded-md font-display text-lg tracking-[0.2em] transition ${
          won
            ? 'bg-gradient-to-b from-amber-500 to-amber-700 hover:from-amber-400 hover:to-amber-600 text-stone-950 border border-amber-600/80 shadow-[0_0_24px_-6px_rgba(251,191,36,0.6)]'
            : 'bg-gradient-to-b from-red-700 to-red-900 hover:from-red-600 hover:to-red-800 text-parchment border border-red-800/80'
        }`}
      >
        {won ? 'ASCEND' : 'BEGIN AGAIN'}
      </button>

      <div className="w-full max-w-4xl grid gap-5 lg:grid-cols-2 items-start text-left">
        <div className="panel p-5 sm:p-6">
          <RunSummary record={record} showDeck={false} />
        </div>

        <div className="space-y-5">
          {deck.length > 0 && (
            <div className="panel p-5 sm:p-6">
              <EndingKitSection deck={deck} />
            </div>
          )}
          <LogPanel lines={game.log} collapsible />
        </div>
      </div>
    </div>
  )
}
