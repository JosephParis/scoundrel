import { MODES, DEFAULT_MODE, getMode, isEnabled } from '../logic'

const MODE_ORDER = ['default', 'hardcore', 'quiet']

// Opening-visit picker. Three mode cards; clicking one sets the run's mode.
// Only shown on the opening sanctuary visit (sigilsEarned === 0, post-tutorial).
// After the first descend the mode is locked, so this panel is gone.
export function ModePickerPanel({ currentMode, onSelect }) {
  if (!isEnabled('modes')) return null
  const selectedId = getMode(currentMode).id
  return (
    <section className="panel p-5">
      <div className="text-center mb-4">
        <div className="text-[10px] uppercase tracking-[0.3em] text-slate-500">Choose how to play</div>
        <h2 className="font-display text-rune text-lg mt-1">Run mode</h2>
        <p className="mt-2 text-[11px] text-slate-500 leading-snug max-w-md mx-auto">
          Locks in when you descend. You can change your pick until then.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {MODE_ORDER.map(id => {
          const mode = MODES[id]
          const selected = selectedId === id
          return (
            <button
              key={id}
              onClick={() => onSelect(id)}
              className={`text-left rounded-lg border p-4 transition-all duration-150 flex flex-col gap-2 ${
                selected
                  ? 'border-rune bg-stone-800/60 shadow-[0_0_18px_-8px_rgba(251,191,36,0.6)]'
                  : 'border-stone-700 bg-stone-900/40 hover:border-rune/60 hover:bg-stone-800/50'
              }`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className={`font-display text-base ${selected ? 'text-rune' : 'text-parchment'}`}>
                  {mode.name}
                </span>
                {selected && (
                  <span className="text-[9px] uppercase tracking-widest text-rune/80">Picked</span>
                )}
              </div>
              <div className="text-[12px] text-slate-400 leading-snug">{mode.description}</div>
            </button>
          )
        })}
      </div>
    </section>
  )
}

// Small persistent badge for the right rail. Hidden when running on the
// default mode so the UI does not nag players who are not in a mode.
export function ModeBadge({ modeId }) {
  if (!isEnabled('modes')) return null
  if (!modeId || modeId === DEFAULT_MODE) return null
  const mode = getMode(modeId)
  return (
    <div className="panel p-3">
      <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">Run mode</div>
      <div className="text-rune font-display text-sm">{mode.name}</div>
      <div className="text-[11px] text-slate-500 leading-snug mt-1">{mode.description}</div>
    </div>
  )
}
