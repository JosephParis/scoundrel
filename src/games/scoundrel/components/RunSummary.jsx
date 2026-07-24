import { CardSuitFan } from './forge'
import { BoonName } from './boons'
import { BOONS } from '../logic'

// Presentational view of one stored run record. Reused by the end-of-run
// screen (OutcomeView) and the expanded row in the history modal. Mechanical
// copy only: no flavor in any static string.

const OUTCOME_LABEL = {
  victory: 'Victory',
  death: 'Died',
  retired: 'Retired',
}

const OUTCOME_COLOR = {
  victory: 'text-rune',
  death: 'text-blood',
  retired: 'text-slate-400',
}

function formatDuration(ms) {
  const total = Math.floor((ms || 0) / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  if (m <= 0) return `${s}s`
  return `${m}m ${s}s`
}

// Inline list with a rune separator between entries, e.g. "A ✦ B ✦ C".
function RuneList({ items }) {
  if (!items || items.length === 0) return null
  return (
    <p className="text-[13px] text-slate-300 leading-relaxed">
      {items.map((label, i) => (
        <span key={i}>
          {i > 0 && <span className="text-rune/50 mx-2 select-none">✦</span>}
          {label}
        </span>
      ))}
    </p>
  )
}

// Boon list with tooltips - looks up boons by name or id
function BoonList({ boons }) {
  if (!boons || boons.length === 0) return null
  return (
    <p className="text-[13px] text-slate-300 leading-relaxed">
      {boons.map((boon, i) => {
        // Support both {id: "..."} and {name: "..."} formats
        const boonId = boon.id || Object.keys(BOONS).find(id => BOONS[id].name === boon.name)
        return (
          <span key={i}>
            {i > 0 && <span className="text-rune/50 mx-2 select-none">✦</span>}
            {boonId ? <BoonName boonId={boonId} /> : boon.name}
          </span>
        )
      })}
    </p>
  )
}

export function Section({ title, children }) {
  return (
    <div>
      <div className="text-rune text-[10px] font-semibold uppercase tracking-[0.25em] mb-1.5">
        {title}
      </div>
      {children}
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <div className="flex flex-col">
      <span className="text-lg text-parchment leading-none">{value}</span>
      <span className="text-[10px] uppercase tracking-widest text-slate-500 mt-1">{label}</span>
    </div>
  )
}

// The run's final kit as a read-only card fan, in the same visual language
// as the in-game "Your kit" view. Exported so the end-of-run screen can place
// it in its own column instead of stacking it under the rest of the summary.
export function EndingKitSection({ deck }) {
  if (!deck || deck.length === 0) return null
  return (
    <Section title={`Ending kit · ${deck.length} cards`}>
      <CardSuitFan cards={deck} readOnly />
    </Section>
  )
}

export function RunSummary({ record, showDeck = true }) {
  if (!record) return null
  const {
    outcome, sigilsEarned, sigilTarget, mode, ascension, ascensionName,
    boons, endingDeck, themesFaced, bossesDefeated,
    roomsEntered, monstersSlain, durationMs,
  } = record

  const deck = endingDeck || []

  const modeItems = [
    mode?.name || 'Default',
    ...(ascension > 0
      ? [ascensionName ? `Ascension ${ascension}: ${ascensionName}` : `Ascension ${ascension}`]
      : []),
  ]

  return (
    <div className="space-y-5 text-left">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <span className={`font-display text-xl ${OUTCOME_COLOR[outcome] || 'text-parchment'}`}>
          {OUTCOME_LABEL[outcome] || outcome}
        </span>
        <span className="text-[11px] uppercase tracking-widest text-slate-500">
          {sigilsEarned} of {sigilTarget} sigils
        </span>
      </div>

      <Section title="Mode">
        <RuneList items={modeItems} />
      </Section>

      <div className="grid grid-cols-3 gap-3 py-3 border-y border-stone-800">
        <Stat label="Rooms" value={roomsEntered || 0} />
        <Stat label="Slain" value={monstersSlain || 0} />
        <Stat label="Time" value={formatDuration(durationMs)} />
      </div>

      {themesFaced?.length > 0 && (
        <Section title="Trials faced">
          <RuneList items={themesFaced.map(t => t.name)} />
        </Section>
      )}

      {boons?.length > 0 && (
        <Section title="Boons">
          <BoonList boons={boons} />
        </Section>
      )}

      {bossesDefeated?.length > 0 && (
        <Section title="Bosses defeated">
          <RuneList items={bossesDefeated.map(b => b.name)} />
        </Section>
      )}

      {showDeck && <EndingKitSection deck={deck} />}
    </div>
  )
}
