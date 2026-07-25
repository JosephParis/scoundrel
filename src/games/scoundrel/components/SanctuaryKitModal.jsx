import { LogPanel } from './atoms'
import { ModeBadge } from './modes'
import { AscensionBadge } from './ascensions'
import { RunStatePanel, DeckPeekButton } from './boons'
import { LibraryPanel } from './library'
import { BASE_MAX_HP } from '../logic'

export function SanctuaryKitModal({ open, onClose, game, onOpenDeck }) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-start sm:items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="panel max-w-md w-full max-h-[90vh] overflow-y-auto p-6 my-4 sm:my-auto relative shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 w-9 h-9 rounded-full bg-stone-800 hover:bg-stone-700 text-parchment text-xl leading-none flex items-center justify-center border border-stone-700"
          aria-label="Close kit"
        >
          ×
        </button>

        <h2 className="font-display text-rune text-2xl mb-1">Your progress</h2>
        <p className="text-[12px] text-slate-500 mb-4">
          Current run status and unlocks
        </p>

        <div className="space-y-4">
          <div className="panel p-3">
            <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">Lifeblood</div>
            <div className="font-mono text-parchment text-base">
              {game.maxHp || BASE_MAX_HP}<span className="text-slate-500 text-sm">/{game.maxHp || BASE_MAX_HP}</span>
              <span className="ml-2 text-[10px] uppercase tracking-widest text-rune/70">Rested</span>
            </div>
          </div>
          <AscensionBadge level={game.ascension} />
          <ModeBadge modeId={game.mode} />
          <RunStatePanel game={game} />
          <LibraryPanel unlockedBoons={game.unlockedBoons} />
          <DeckPeekButton
            game={game}
            onClick={() => {
              onClose()
              onOpenDeck()
            }}
          />
          <LogPanel lines={game.log} />
        </div>
      </div>
    </div>
  )
}
