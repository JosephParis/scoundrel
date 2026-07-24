import { WeaponPanel, ConditionsPanel, AfflictionBadges } from './cards'
import { LogPanel } from './atoms'
import { ModeBadge } from './modes'
import { AscensionBadge } from './ascensions'

export function KitModal({ open, onClose, game, theme }) {
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

        <h2 className="font-display text-rune text-2xl mb-1">Your kit</h2>
        <p className="text-[12px] text-slate-500 mb-4">
          Current status and equipment
        </p>

        <div className="space-y-4">
          <AfflictionBadges game={game} />
          <WeaponPanel game={game} />
          <ConditionsPanel game={game} theme={theme} />
          <AscensionBadge level={game.ascension} />
          <ModeBadge modeId={game.mode} />
          <LogPanel lines={game.log} />
        </div>
      </div>
    </div>
  )
}
