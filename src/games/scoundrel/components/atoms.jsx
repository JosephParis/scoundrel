/* eslint-disable react-refresh/only-export-components */
import { useState } from 'react'
import { formatFormula } from '../utils/formatHelpers'

export { formatFormula }

export function Formula({ parts, className }) {
  if (!parts || parts.length < 2) return null
  return (
    <span className={`text-[10px] text-slate-500 ${className || ''}`}>
      ({formatFormula(parts)})
    </span>
  )
}

export function ConfirmButton({ onClick, disabled, label }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="px-6 py-2.5 rounded-md text-sm font-medium border transition bg-rune text-stone-950 border-rune hover:bg-amber-300 disabled:bg-stone-800 disabled:text-slate-600 disabled:border-stone-700 disabled:cursor-not-allowed"
    >
      {label}
    </button>
  )
}

// Left-rail header used by both Sanctuary and Descent. Holds the
// phase title (large Cinzel), optional subtitle/children themes, and
// a status slot (HP bar in descent, "Rested" badge in sanctuary).
// On desktop it sticks below the top bar; on mobile it sits as a
// normal block at the top of the column flow.
export function PhaseRail({ title, subtitle, sigilsEarned, sigilTarget, celebrateSigil, onSigilCelebrated, children }) {
  const showSigils = typeof sigilsEarned === 'number' && typeof sigilTarget === 'number'
  return (
    <aside className="md:sticky md:top-20 md:self-start space-y-4">
      <div>
        <h1 className="font-display text-3xl md:text-4xl text-rune leading-tight">{title}</h1>
        {showSigils && (
          <SigilTracker
            count={sigilsEarned}
            target={sigilTarget}
            celebrate={celebrateSigil}
            onCelebrated={onSigilCelebrated}
          />
        )}
        {subtitle && (
          <p className="mt-2 text-[12px] text-slate-400 leading-snug">{subtitle}</p>
        )}
        <div className="rune-divider mt-3 text-rune/30 text-[10px]">
          <span>✦</span>
        </div>
      </div>
      {children}
    </aside>
  )
}

function SigilTracker({ count, target, celebrate, onCelebrated }) {
  return (
    <div className="mt-2 flex items-center gap-1.5">
      <span className="text-[10px] uppercase tracking-widest text-slate-500 mr-1">
        Sigils
      </span>
      <div className="flex items-center gap-1">
        {Array.from({ length: target }).map((_, i) => {
          const set = i < count
          // Flourish only the newest pip, and only when arriving with a
          // freshly earned sigil. Clears the root flag on animation end.
          const flourish = celebrate && set && i === count - 1
          return (
            <span
              key={i}
              onAnimationEnd={flourish ? onCelebrated : undefined}
              className={`${
                set
                  ? 'w-2.5 h-2.5 rotate-45 bg-rune shadow-[0_0_8px_rgba(251,191,36,0.7)]'
                  : 'w-2.5 h-2.5 rotate-45 border border-stone-600'
              } ${flourish ? 'animate-sigil-flourish' : ''}`}
              aria-label={set ? 'sigil set' : 'sigil empty'}
            />
          )
        })}
      </div>
    </div>
  )
}

// Right-rail sticky sidebar. Children stack vertically; the last
// child that is given `flex-1 min-h-0` (typically the LogPanel)
// fills remaining viewport height and scrolls internally.
export function SideRail({ children }) {
  return (
    <aside className="md:sticky md:top-20 md:self-start md:h-[calc(100vh-6rem)] flex flex-col gap-4 min-h-0">
      {children}
    </aside>
  )
}

// LogPanel: by default caps at max-h-48 (legacy block placement, e.g.
// outcome view). When placed in a flex sidebar, pass `flex-1 min-h-0`
// via className so it absorbs remaining height and scrolls internally.
// Pass `collapsible` to render a slim header by default that expands on
// click; used in sanctuary where the log isn't urgent.
export function LogPanel({ lines, className = '', collapsible = false }) {
  const [expanded, setExpanded] = useState(!collapsible)

  if (collapsible && !expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="panel p-3 short:p-2 w-full flex items-center justify-between text-left hover:border-rune/40 transition"
        aria-expanded="false"
      >
        <span className="text-[10px] uppercase tracking-widest text-slate-500">Log</span>
        <span className="text-[10px] text-slate-500">
          {lines.length} {lines.length === 1 ? 'entry' : 'entries'} · show
        </span>
      </button>
    )
  }

  const sizing = className || 'max-h-48'
  return (
    <div className={`panel p-4 overflow-y-auto ${sizing}`}>
      <div className="flex items-baseline justify-between mb-2">
        <div className="text-[10px] uppercase tracking-widest text-slate-500">Log</div>
        {collapsible && (
          <button
            onClick={() => setExpanded(false)}
            className="text-[10px] uppercase tracking-widest text-slate-500 hover:text-parchment transition"
            aria-expanded="true"
          >
            Hide
          </button>
        )}
      </div>
      <ul className="text-[12px] space-y-1 text-left">
        {lines.map((l, i) => (
          <li key={i} className="text-slate-400 leading-snug">{l}</li>
        ))}
      </ul>
    </div>
  )
}

export function DescendAction({ onDescend, disabled, reason }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <button
        onClick={onDescend}
        disabled={disabled}
        className={`w-full max-w-sm px-10 py-3 rounded-md font-display text-xl tracking-[0.2em] transition
          ${disabled
            ? 'bg-stone-800 text-stone-600 border border-stone-700 cursor-not-allowed'
            : 'bg-gradient-to-b from-red-700 to-red-900 text-parchment border border-red-800/80 hover:from-red-600 hover:to-red-800 rune-pulse'
          }`}
      >
        DESCEND
      </button>
      {disabled && reason && (
        <div className="text-[11px] text-slate-500 italic">{reason}</div>
      )}
    </div>
  )
}
