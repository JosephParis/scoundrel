import { ASCENSIONS, ASCENSION_MAX, getAscension, getAscensionEffects, isEnabled } from '../logic'

// Opening-visit picker. Lists levels 0..ASCENSION_MAX, with everything above
// `ceiling` shown as a locked preview so the player can see what they are
// climbing toward. Locks in once the player descends.
export function AscensionPickerPanel({ currentLevel = 0, ceiling = 0, onSelect }) {
  if (!isEnabled('ascensions')) return null
  const clampedCeiling = Math.min(ceiling, ASCENSION_MAX)
  return (
    <section className="panel p-5">
      <div className="text-center mb-4">
        <div className="text-[10px] uppercase tracking-[0.3em] text-slate-500">Choose difficulty</div>
        <h2 className="font-display text-rune text-lg mt-1">Ascension</h2>
        <p className="mt-2 text-[11px] text-slate-500 leading-snug max-w-md mx-auto">
          Each level layers one more nerf onto the run. Beat your current level to unlock the next.
        </p>
      </div>
      <div className="space-y-2">
        {Array.from({ length: ASCENSION_MAX + 1 }, (_, level) => {
          const locked = level > clampedCeiling
          const selected = currentLevel === level
          return (
            <AscensionRow
              key={level}
              level={level}
              selected={selected}
              locked={locked}
              onSelect={() => !locked && onSelect(level)}
            />
          )
        })}
      </div>
    </section>
  )
}

function AscensionRow({ level, selected, locked, onSelect }) {
  const asc = getAscension(level)
  const isBase = level === 0
  const title = isBase ? 'Base' : `Ascension ${level}: ${asc?.name || ''}`
  const description = isBase
    ? 'The full game with no extra nerfs.'
    : (asc?.description || '')
  return (
    <button
      onClick={onSelect}
      disabled={locked}
      className={`w-full text-left rounded-md border p-3 transition flex items-baseline gap-3 ${
        locked
          ? 'border-stone-800 bg-stone-950/40 text-slate-600 cursor-not-allowed'
          : selected
            ? 'border-rune bg-stone-800/60 shadow-[0_0_18px_-8px_rgba(251,191,36,0.6)]'
            : 'border-stone-700 bg-stone-900/40 hover:border-rune/60 hover:bg-stone-800/50'
      }`}
    >
      <span className={`font-mono text-[11px] w-12 shrink-0 ${
        locked ? 'text-slate-700' : selected ? 'text-rune' : 'text-slate-500'
      }`}>
        {isBase ? 'A0' : `A${level}`}
      </span>
      <span className="flex-1 min-w-0">
        <span className={`font-display text-sm block ${
          locked ? 'text-slate-600' : selected ? 'text-rune' : 'text-parchment'
        }`}>
          {locked ? '???' : title}
        </span>
        <span className={`text-[11.5px] block mt-0.5 leading-snug ${
          locked ? 'text-slate-700 italic' : 'text-slate-400'
        }`}>
          {locked ? 'Clear the previous level to unlock.' : description}
        </span>
      </span>
      {selected && !locked && (
        <span className="text-[9px] uppercase tracking-widest text-rune/80">Picked</span>
      )}
    </button>
  )
}

// Persistent rail chip. Hidden at A0 so we do not nag default-difficulty
// runs. At higher levels it shows the level number and name so the player
// remembers what they have stacked on themselves.
export function AscensionBadge({ level }) {
  if (!isEnabled('ascensions')) return null
  if (!level) return null
  const effects = getAscensionEffects(level)
  const top = getAscension(effects.level)
  return (
    <div className="panel p-3">
      <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">Ascension</div>
      <div className="text-rune font-display text-sm">
        A{effects.level}{top ? `: ${top.name}` : ''}
      </div>
      <div className="text-[11px] text-slate-500 leading-snug mt-1">
        {top?.description || 'Base game.'}
      </div>
    </div>
  )
}
