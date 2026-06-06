import { useMemo, useState } from 'react'
import {
  STRIKE_OFFERING_RANGE, HEFT_BONUS,
  getStrikeOptions, getTransmuteOptions, getHeftOptions, getInscribeOptions,
  suitColor, rankLabel,
  SUIT_GLYPH, HEART, DIAMOND, CLUB, SPADE, WOUND, KEY, MAP, STONE, isWound, isSkeletonKey, isMap, isWhetstone,
  isEnabled,
} from '../logic'
import { ConfirmButton } from './atoms'
import { cardBorderTone } from './SuitIcon'

// -- Forge prompt ------------------------------------------------------

export function ForgePromptPanel({ onStrike, onTransmute, onHeft, onInscribe, onSkip }) {
  const [selected, setSelected] = useState(null)
  const options = [
    {
      id: 'strike',
      name: 'Strike',
      description: `Remove a monster, then pick a weapon or potion at its rank or up to ${STRIKE_OFFERING_RANGE} below to also remove. Aces and Kings cannot be struck.`,
      open: onStrike,
    },
    {
      id: 'transmute',
      name: 'Transmute',
      description: "Change a card's suit. Rank is unchanged. Color is locked: hearts ↔ diamonds, clubs ↔ spades.",
      open: onTransmute,
    },
    {
      id: 'heft',
      name: 'Heft',
      description: `Raise a weapon or potion's rank by ${HEFT_BONUS}. Capped at rank 10.`,
      open: onHeft,
    },
    isEnabled('customCards') && {
      id: 'inscribe',
      name: 'Inscribe',
      description: 'Add a player-authored card to the deck: Lucky Coin, Cursed Idol, or Skeleton Key. Persists for the rest of the run.',
      open: onInscribe,
    },
  ].filter(Boolean)
  const selectedOption = options.find(o => o.id === selected)
  return (
    <section className="panel panel-warm p-6">
      <div className="text-center mb-5">
        <div className="text-[10px] uppercase tracking-[0.3em] text-amber-200/70">The Forge is open</div>
        <h2 className="font-display text-rune text-xl mt-1">The coals are still warm</h2>
        <p className="text-[12px] text-slate-400 mt-1 max-w-md mx-auto">
          Pick one. The edit is permanent for the rest of the run.
        </p>
      </div>
      <div className={`grid grid-cols-1 sm:grid-cols-2 ${options.length >= 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-4 justify-items-center`}>
        {options.map(o => (
          <ForgeOptionCard
            key={o.id}
            name={o.name}
            description={o.description}
            selected={selected === o.id}
            onPick={() => setSelected(o.id)}
          />
        ))}
      </div>
      <div className="flex justify-center items-center gap-3 mt-5 flex-wrap">
        <ConfirmButton
          onClick={() => selectedOption?.open()}
          disabled={!selectedOption}
          label={selectedOption ? `Open ${selectedOption.name}` : 'Pick an action above'}
        />
        <button
          onClick={onSkip}
          className="text-[11px] uppercase tracking-widest text-slate-500 hover:text-parchment transition px-3 py-2"
        >
          Step away
        </button>
      </div>
    </section>
  )
}

function ForgeOptionCard({ name, description, selected, onPick }) {
  return (
    <button
      onClick={onPick}
      className={`group aspect-[2/3] w-full max-w-[230px] text-left rounded-lg border bg-gradient-to-b p-5 hover:-translate-y-1 transition-all duration-200 shadow-md flex flex-col relative overflow-hidden ${
        selected
          ? 'border-rune from-stone-800 to-stone-900 shadow-[0_0_24px_-8px_rgba(251,191,36,0.6)]'
          : 'border-stone-700 from-stone-900 to-stone-950 hover:border-rune hover:from-stone-800 hover:to-stone-900 hover:shadow-[0_0_24px_-8px_rgba(251,191,36,0.5)]'
      }`}
    >
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-rune/40 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-rune/20 to-transparent" />
      <div className="font-display text-rune text-lg leading-tight">{name}</div>
      <div className="h-px bg-stone-700 my-3" />
      <div className="text-[13px] text-slate-200 leading-snug">{description}</div>
    </button>
  )
}

// -- Forge view shell --------------------------------------------------

function ForgeViewShell({ kindLabel, title, blurb, children, onCancel, cancelLabel, onConfirm, confirmLabel, canConfirm }) {
  return (
    <section className="panel panel-warm p-5">
      <div className="text-[10px] uppercase tracking-[0.3em] text-amber-200/70 mb-1">{kindLabel}</div>
      <h2 className="font-display text-rune text-lg mb-1">{title}</h2>
      <p className="text-[12px] text-slate-400 mb-4">{blurb}</p>
      {children}
      <div className="flex justify-center gap-3 mt-4 flex-wrap">
        <button
          onClick={onCancel}
          className="px-4 py-2 rounded-md bg-stone-800 hover:bg-stone-700 text-slate-300 text-sm border border-stone-700"
        >
          {cancelLabel}
        </button>
        {onConfirm && (
          <ConfirmButton
            onClick={onConfirm}
            disabled={!canConfirm}
            label={confirmLabel}
          />
        )}
      </div>
    </section>
  )
}

// -- Strike / Transmute / Heft -----------------------------------------

export function StrikeView({ game, onConfirm, onCancel }) {
  const { monsters, byRank } = useMemo(() => getStrikeOptions(game), [game])
  const [pickedMonster, setPickedMonster] = useState(null)
  const [pickedOffering, setPickedOffering] = useState(null)
  const offerings = pickedMonster
    ? Array.from({ length: STRIKE_OFFERING_RANGE + 1 }, (_, i) => byRank[pickedMonster.rank - i] || [])
        .flat()
    : []

  const lowest = pickedMonster ? Math.max(2, pickedMonster.rank - STRIKE_OFFERING_RANGE) : null

  const pickMonster = (c) => {
    setPickedMonster(c)
    setPickedOffering(null)
  }

  const confirmLabel = pickedMonster && pickedOffering
    ? `Strike ${rankLabel(pickedMonster.rank)}${SUIT_GLYPH[pickedMonster.suit]} with ${rankLabel(pickedOffering.rank)}${SUIT_GLYPH[pickedOffering.suit]}`
    : pickedMonster
      ? 'Pick an offering'
      : 'Pick a name'

  return (
    <ForgeViewShell
      kindLabel="Strike"
      title="Cast into the fire"
      blurb={`Pick a monster, then pick a weapon or potion at its rank or up to ${STRIKE_OFFERING_RANGE} below. Both are gone for good. Kings and Aces are too heavy to melt.`}
      onCancel={onCancel}
      cancelLabel="Step away"
      onConfirm={() => onConfirm(pickedMonster.id, pickedOffering.id)}
      canConfirm={!!(pickedMonster && pickedOffering)}
      confirmLabel={confirmLabel}
    >
      <div className="mb-4">
        <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-2">1. Name to bind</div>
        <CardSuitFan
          cards={monsters}
          selected={pickedMonster?.id}
          onPick={pickMonster}
        />
        {monsters.length === 0 && (
          <div className="text-[12px] text-slate-500 italic">No dead remain to bind.</div>
        )}
      </div>

      {pickedMonster && (
        <div>
          <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-2">
            2. Matched offering · rank {rankLabel(lowest)}–{rankLabel(pickedMonster.rank)}
          </div>
          {offerings.length > 0 ? (
            <CardSuitFan
              cards={offerings}
              selected={pickedOffering?.id}
              onPick={(o) => setPickedOffering(o)}
            />
          ) : (
            <div className="text-[12px] text-slate-500 italic">
              No weapon or potion of rank {rankLabel(lowest)}–{rankLabel(pickedMonster.rank)} remains. Pick another name.
            </div>
          )}
        </div>
      )}
    </ForgeViewShell>
  )
}

export function TransmuteView({ game, onConfirm, onCancel }) {
  const cards = useMemo(() => getTransmuteOptions(game), [game])
  const [picked, setPicked] = useState(null)
  const [pickedSuit, setPickedSuit] = useState(null)
  const suits = [HEART, DIAMOND, CLUB, SPADE]
  const allowedSuits = picked
    ? suits.filter(s => s !== picked.suit && suitColor(s) === suitColor(picked.suit))
    : []

  const pickCard = (c) => {
    setPicked(c)
    setPickedSuit(null)
  }

  const confirmLabel = picked && pickedSuit
    ? `Transmute ${rankLabel(picked.rank)}${SUIT_GLYPH[picked.suit]} → ${rankLabel(picked.rank)}${SUIT_GLYPH[pickedSuit]}`
    : picked
      ? 'Pick a new suit'
      : 'Pick a card'

  return (
    <ForgeViewShell
      kindLabel="Transmute"
      title="Reshape a card"
      blurb="The rank stays. Color is locked, so hearts swap with diamonds, clubs swap with spades. A spade can become a club, a potion can become a weapon."
      onCancel={onCancel}
      cancelLabel="Step away"
      onConfirm={() => onConfirm(picked.id, pickedSuit)}
      canConfirm={!!(picked && pickedSuit)}
      confirmLabel={confirmLabel}
    >
      <div className="mb-4">
        <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-2">1. Card to transmute</div>
        <CardSuitFan
          cards={cards}
          selected={picked?.id}
          onPick={pickCard}
        />
      </div>

      {picked && (
        <div>
          <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-2">
            2. New suit for {rankLabel(picked.rank)}{SUIT_GLYPH[picked.suit]}
          </div>
          <div className="flex gap-2 flex-wrap justify-center">
            {allowedSuits.map(s => {
              const isSelected = pickedSuit === s
              return (
                <button
                  key={s}
                  onClick={() => setPickedSuit(s)}
                  className={`px-4 py-2 rounded-md text-sm border transition ${
                    isSelected
                      ? 'bg-stone-700 border-rune text-parchment'
                      : 'bg-stone-800 hover:bg-stone-700 border-stone-700 text-slate-200'
                  }`}
                >
                  {SUIT_GLYPH[s]}: {rankLabel(picked.rank)} as a {suitName(s)}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </ForgeViewShell>
  )
}

export function HeftView({ game, onConfirm, onCancel }) {
  const cards = useMemo(() => getHeftOptions(game), [game])
  const [picked, setPicked] = useState(null)

  const newRank = picked ? Math.min(10, picked.rank + HEFT_BONUS) : null
  const confirmLabel = picked
    ? `Heft ${rankLabel(picked.rank)}${SUIT_GLYPH[picked.suit]} → ${rankLabel(newRank)}${SUIT_GLYPH[picked.suit]}`
    : 'Pick a card'

  return (
    <ForgeViewShell
      kindLabel="Heft"
      title="Add weight"
      blurb={`Pick a weapon or potion. Its rank rises by ${HEFT_BONUS}. Capped at rank 10.`}
      onCancel={onCancel}
      cancelLabel="Step away"
      onConfirm={() => onConfirm(picked.id)}
      canConfirm={!!picked}
      confirmLabel={confirmLabel}
    >
      <div>
        <CardSuitFan
          cards={cards}
          selected={picked?.id}
          onPick={(c) => setPicked(c)}
        />
        {cards.length === 0 && (
          <div className="text-[12px] text-slate-500 italic">
            No weapons or potions remain low enough to heft.
          </div>
        )}
      </div>
    </ForgeViewShell>
  )
}

function suitName(suit) {
  if (suit === HEART) return 'potion'
  if (suit === DIAMOND) return 'weapon'
  if (suit === CLUB) return 'club monster'
  return 'spade monster'
}

// -- Inscribe view -----------------------------------------------------

export function InscribeView({ game, onConfirm, onCancel }) {
  const frames = useMemo(() => getInscribeOptions(game), [game])
  const [pickedFrameId, setPickedFrameId] = useState(null)
  const pickedFrame = pickedFrameId ? frames.find(f => f.id === pickedFrameId) : null
  // Default each frame's rank to its minimum until the player picks
  // a different one. Stored per-frame so switching frames doesn't lose
  // your prior rank choice.
  const [rankByFrame, setRankByFrame] = useState({})

  const currentRank = pickedFrame
    ? (rankByFrame[pickedFrame.id] ?? pickedFrame.rankMin)
    : null
  const setCurrentRank = (rank) => {
    if (!pickedFrame) return
    setRankByFrame(prev => ({ ...prev, [pickedFrame.id]: rank }))
  }

  const hasRankPick = pickedFrame && pickedFrame.rankMax > pickedFrame.rankMin
  const canConfirm = !!pickedFrame
  const confirmLabel = pickedFrame
    ? `Inscribe ${pickedFrame.name}${hasRankPick ? ` (${rankLabel(currentRank)})` : ''}`
    : 'Pick a frame'

  return (
    <ForgeViewShell
      kindLabel="Inscribe"
      title="Set a new name in the deck"
      blurb="Pick a frame. Inscribed cards persist for the rest of the run."
      onCancel={onCancel}
      cancelLabel="Step away"
      onConfirm={() => onConfirm(pickedFrame.id, currentRank)}
      canConfirm={canConfirm}
      confirmLabel={confirmLabel}
    >
      <div className="space-y-3">
        {frames.length === 0 ? (
          <div className="text-[12px] text-slate-500 italic">
            No frames available right now. All one-per-run frames are already inscribed.
          </div>
        ) : (
          frames.map(frame => (
            <button
              key={frame.id}
              onClick={() => setPickedFrameId(frame.id)}
              className={`w-full text-left rounded-md border p-3 transition ${
                pickedFrameId === frame.id
                  ? 'border-rune bg-stone-800/60 shadow-[0_0_18px_-8px_rgba(251,191,36,0.6)]'
                  : 'border-stone-700 bg-stone-900/40 hover:border-rune/60 hover:bg-stone-800/50'
              }`}
            >
              <div className="flex items-baseline justify-between">
                <span className={`font-display text-base ${
                  pickedFrameId === frame.id ? 'text-rune' : 'text-parchment'
                }`}>
                  {frame.name}
                </span>
                {frame.rankMax > frame.rankMin && (
                  <span className="text-[10px] uppercase tracking-widest text-slate-500">
                    Rank {frame.rankMin}-{frame.rankMax}
                  </span>
                )}
              </div>
              <div className="text-[12px] text-slate-400 leading-snug mt-1">
                {frame.description}
              </div>
            </button>
          ))
        )}

        {hasRankPick && (
          <div className="border border-stone-700 rounded-md p-3 bg-stone-900/40">
            <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-2">
              Pick the rank
            </div>
            <div className="flex flex-wrap gap-2">
              {Array.from(
                { length: pickedFrame.rankMax - pickedFrame.rankMin + 1 },
                (_, i) => pickedFrame.rankMin + i
              ).map(r => (
                <button
                  key={r}
                  onClick={() => setCurrentRank(r)}
                  className={`w-10 h-10 rounded-md border font-mono text-sm transition ${
                    currentRank === r
                      ? 'border-rune bg-stone-700 text-rune'
                      : 'border-stone-700 bg-stone-900 text-parchment hover:border-rune/60'
                  }`}
                >
                  {rankLabel(r)}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </ForgeViewShell>
  )
}

// -- Card suit fan -----------------------------------------------------

// Compact picker: cards group into one row per suit, sorted by rank,
// overlapping horizontally so only the top-left rank+suit corner of
// each prior card is exposed. Hover, focus, or selection lifts the
// card above its neighbors. Pass `readOnly` to render the fan for
// display only (no click handler, no selected state) — hover-lift
// still works so the player can peek at any card.
const SUIT_FAN_ORDER = [HEART, DIAMOND, CLUB, SPADE, WOUND, KEY, MAP, STONE]

export function CardSuitFan({ cards, selected, onPick, readOnly = false }) {
  const bySuit = { [HEART]: [], [DIAMOND]: [], [CLUB]: [], [SPADE]: [], [WOUND]: [], [KEY]: [], [MAP]: [], [STONE]: [] }
  for (const c of cards) {
    if (bySuit[c.suit]) bySuit[c.suit].push(c)
  }
  for (const arr of Object.values(bySuit)) {
    arr.sort((a, b) => a.rank - b.rank)
  }
  const presentSuits = SUIT_FAN_ORDER.filter(s => bySuit[s].length > 0)
  if (presentSuits.length === 0) return null

  return (
    <div className="space-y-1.5">
      {presentSuits.map(suit => (
        <CardSuitFanRow
          key={suit}
          suit={suit}
          cards={bySuit[suit]}
          selected={selected}
          onPick={onPick}
          readOnly={readOnly}
        />
      ))}
    </div>
  )
}

function CardSuitFanRow({ suit, cards, selected, onPick, readOnly = false }) {
  const isRed = suit === HEART || suit === DIAMOND
  const isWoundRow = suit === WOUND
  const isKeyRow = suit === KEY
  const isMapRow = suit === MAP
  const isStoneRow = suit === STONE
  const suitColorClass = isRed
    ? 'text-blood'
    : isWoundRow
      ? 'text-red-700'
      : isKeyRow
        ? 'text-amber-300'
        : isMapRow
          ? 'text-sky-300'
          : isStoneRow
            ? 'text-slate-300'
            : 'text-parchment'
  return (
    <div className="flex items-start">
      <div className={`w-6 shrink-0 pt-3 text-center text-base leading-none ${suitColorClass}`}>
        {SUIT_GLYPH[suit]}
      </div>
      <div className="flex flex-1 pl-2 pt-2 pb-3 overflow-x-auto">
        {cards.map((c, i) => {
          const isSelected = !readOnly && selected === c.id
          const cardIsWound = isWound(c)
          const cardIsKey = isSkeletonKey(c)
          const cardIsMap = isMap(c)
          const cardIsStone = isWhetstone(c)
          const cardColorClass = isRed
            ? 'text-blood'
            : cardIsWound
              ? 'text-red-700'
              : cardIsKey
                ? 'text-amber-300'
                : cardIsMap
                  ? 'text-sky-300'
                  : cardIsStone
                    ? 'text-slate-300'
                    : 'text-parchment'
          const baseClass = `card-fan-item relative aspect-[2/3] w-12 sm:w-14 shrink-0 rounded border-2 p-1 flex flex-col justify-between text-left ${
            isSelected
              ? 'border-rune bg-stone-700'
              : `${cardBorderTone(c)} bg-stone-900${readOnly ? '' : ' hover:bg-stone-800 hover:border-rune/60'}`
          }`
          const inner = (
            <>
              <div className={`text-xs sm:text-sm font-bold leading-none ${cardColorClass}`}>
                {(cardIsWound || cardIsKey || cardIsMap || cardIsStone) ? SUIT_GLYPH[c.suit] : `${rankLabel(c.rank)}${SUIT_GLYPH[c.suit]}`}
              </div>
              {(c.transmuted || c.hefted || c.inscribed) && (
                <div className="flex flex-col items-end gap-0.5 leading-none">
                  {c.transmuted && (
                    <div className="text-[8px] text-rune uppercase tracking-wider">tm</div>
                  )}
                  {c.hefted && (
                    <div className="text-[8px] text-rune uppercase tracking-wider">+{c.heftBonus}</div>
                  )}
                  {c.inscribed && (
                    <div className="text-[8px] text-rune uppercase tracking-wider">in</div>
                  )}
                </div>
              )}
            </>
          )
          const style = {
            marginLeft: i === 0 ? 0 : '-1.6rem',
            '--fan-z': i + 1,
          }
          if (readOnly) {
            return (
              <div key={c.id} style={style} className={`${baseClass} cursor-default`}>
                {inner}
              </div>
            )
          }
          return (
            <button
              key={c.id}
              onClick={() => onPick(c)}
              data-selected={isSelected ? 'true' : undefined}
              style={style}
              className={baseClass}
            >
              {inner}
            </button>
          )
        })}
      </div>
    </div>
  )
}
