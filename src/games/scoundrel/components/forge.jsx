import { useState } from 'react'
import { createPortal } from 'react-dom'
import {
  UPGRADE_BONUS,
  rankLabel, INSCRIBED_FRAMES,
  SUIT_GLYPH, HEART, DIAMOND, CLUB, SPADE, WOUND, KEY, MAP, STONE, TORCH, isWound, isSkeletonKey, isMap, isWhetstone, isTorch,
} from '../logic'
import { ConfirmButton } from './atoms'
import { SuitIcon, cardBorderTone, suitIconTone } from './SuitIcon'
import { useCardLayout } from '../settings'

// -- Edit offer --------------------------------------------------------

// Each granted edit (Inscribe / Upgrade / Remove) is a "pick one of a few
// cards" screen in the same visual language as a room or a boon offer. The
// candidate cards live on game.forgeChoices; the active grant type and the
// batch progress come from game.forgeGrants / game.forgeGrantIndex.

const EDIT_META = {
  inscribe: {
    kind: 'Inscribe',
    title: 'Add a tool to your kit',
    blurb: 'Pick one to inscribe into your kit for the rest of the run.',
  },
  upgrade: {
    kind: 'Upgrade',
    title: 'Sharpen a kit card',
    blurb: `Pick one to raise its rank by ${UPGRADE_BONUS} (capped at 10).`,
  },
  remove: {
    kind: 'Remove',
    title: 'Thin the kit',
    blurb: 'Pick one to drop. Fewer, better tools come up more often.',
  },
}

export function EditOfferPanel({ game, onPick, onSkip }) {
  const grants = game.forgeGrants || []
  const idx = game.forgeGrantIndex || 0
  const type = grants[idx]
  const choices = game.forgeChoices || []
  const [selected, setSelected] = useState(null)
  const meta = EDIT_META[type] || EDIT_META.inscribe
  const selCard = choices.find(c => c.id === selected)

  return (
    <section className="panel panel-warm p-6">
      <div className="text-center mb-5">
        <div className="text-[10px] uppercase tracking-[0.3em] text-amber-200/70">
          The Forge · edit {idx + 1} of {grants.length}
        </div>
        <h2 className="font-display text-rune text-xl mt-1">{meta.title}</h2>
        <p className="text-[12px] text-slate-400 mt-1 max-w-md mx-auto">{meta.blurb}</p>
      </div>

      {choices.length === 0 ? (
        <div className="text-center text-[12px] text-slate-500 italic">
          Nothing to {type} right now. Step away.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 justify-items-center">
          {choices.map(c => (
            <EditChoiceCard
              key={c.id}
              card={c}
              mode={type}
              selected={selected === c.id}
              onPick={() => setSelected(c.id)}
            />
          ))}
        </div>
      )}

      <div className="flex justify-center items-center gap-3 mt-5 flex-wrap">
        <ConfirmButton
          onClick={() => selCard && onPick(selCard.id)}
          disabled={!selCard}
          label={selCard ? meta.kind : 'Pick a card above'}
        />
        <button
          onClick={onSkip}
          className="text-[11px] uppercase tracking-widest text-slate-500 hover:text-parchment transition px-3 py-2"
        >
          Skip this edit
        </button>
      </div>
    </section>
  )
}

function EditChoiceCard({ card, mode, selected, onPick }) {
  const red = card.suit === HEART || card.suit === DIAMOND
  const frame = card.inscribed ? INSCRIBED_FRAMES[card.inscribed] : null
  const neutral = isSkeletonKey(card) || isMap(card) || isWhetstone(card)
  const face = neutral ? SUIT_GLYPH[card.suit] : `${rankLabel(card.rank)}${SUIT_GLYPH[card.suit]}`
  const newRank = card.rank + UPGRADE_BONUS
  // Honor the same layout setting the room cards use: modern prints the
  // inscription's rules on the face, classic shows only the name (with the
  // effect on hover). Reading the store here keeps the picker in lockstep, so
  // toggling the setting mid-forge updates these cards immediately.
  const layout = useCardLayout()
  const showRules = layout === 'modern' && !!frame
  // Inscribed candidates explain their effect on hover/focus, the same way a
  // room card does, so picking what to add to the kit is an informed choice.
  const [anchor, setAnchor] = useState(null)
  const infoHandlers = frame
    ? {
        onMouseEnter: e => setAnchor(e.currentTarget.getBoundingClientRect()),
        onMouseLeave: () => setAnchor(null),
        onFocus: e => setAnchor(e.currentTarget.getBoundingClientRect()),
        onBlur: () => setAnchor(null),
      }
    : null

  return (
    <>
      <button
        onClick={onPick}
        {...infoHandlers}
        className={`relative w-full max-w-[150px] aspect-[2/3] rounded-lg border-2 card-face text-stone-900 p-2.5 flex flex-col text-left transition-all ${
          selected
            ? 'border-rune ring-2 ring-rune/60 -translate-y-1'
            : `${cardBorderTone(card)} hover:-translate-y-1 hover:shadow-lg`
        }`}
      >
        <div className={`text-xl font-bold leading-none ${red ? 'text-blood' : 'text-stone-900'}`}>
          {face}
        </div>
        <div className="flex-1 min-h-0 flex items-center justify-center py-1">
          <SuitIcon suit={card.suit} inscribed={card.inscribed} className={`w-[55%] h-auto ${suitIconTone(card)}`} />
        </div>
        <div className="text-center min-h-[28px] flex flex-col justify-center gap-0.5 leading-tight">
          {mode === 'upgrade' && (
            <span className="text-[11px] font-medium text-stone-800">
              +{UPGRADE_BONUS} → {rankLabel(newRank)}
            </span>
          )}
          {frame && (
            <span className="text-[9px] uppercase tracking-wider font-semibold text-stone-700">{frame.name}</span>
          )}
          {showRules && (
            <span className="text-[8.5px] leading-snug text-stone-500">{frame.description}</span>
          )}
          {mode === 'remove' && (
            <span className="text-[10px] uppercase tracking-wider text-red-800/80">drop</span>
          )}
        </div>
      </button>
      <FanCardInfo anchor={anchor} frame={frame} upgradeBonus={card.upgraded ? card.upgradeBonus : 0} />
    </>
  )
}

// -- Card suit fan -----------------------------------------------------

// Compact picker: cards group into one row per suit, sorted by rank,
// overlapping horizontally so only the top-left rank+suit corner of
// each prior card is exposed. Hover, focus, or selection lifts the
// card above its neighbors. Pass `readOnly` to render the fan for
// display only (no click handler, no selected state) — hover-lift
// still works so the player can peek at any card.
const SUIT_FAN_ORDER = [HEART, DIAMOND, CLUB, SPADE, WOUND, KEY, MAP, STONE, TORCH]

export function CardSuitFan({ cards, selected, onPick, readOnly = false }) {
  const bySuit = { [HEART]: [], [DIAMOND]: [], [CLUB]: [], [SPADE]: [], [WOUND]: [], [KEY]: [], [MAP]: [], [STONE]: [], [TORCH]: [] }
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

// Floating info card for a hovered/focused inscribed kit card, so the fan
// reads the way a room card does (where the inscription's effect is on the
// face). Portal'd to the body and fixed-positioned from the anchor rect so the
// fan's own overflow can't clip it. Anchored above the card unless it sits too
// near the top of the viewport, in which case it drops below.
function FanCardInfo({ anchor, frame, upgradeBonus }) {
  if (!anchor || !frame) return null
  const placeBelow = anchor.top < 150
  const style = {
    position: 'fixed',
    left: anchor.left + anchor.width / 2,
    top: placeBelow ? anchor.bottom + 8 : anchor.top - 8,
    transform: placeBelow ? 'translate(-50%, 0)' : 'translate(-50%, -100%)',
  }
  return createPortal(
    <div
      role="tooltip"
      style={style}
      className="pointer-events-none z-[60] w-52 rounded-md border-2 border-rune/60 bg-stone-950/95 p-2.5 text-center shadow-2xl"
    >
      <div className="font-display text-rune text-[13px] mb-1">{frame.name}</div>
      <div className="text-[11.5px] leading-snug text-slate-200">{frame.description}</div>
      {upgradeBonus ? (
        <div className="text-[10px] text-rune/80 mt-1.5">Sharpened +{upgradeBonus}</div>
      ) : null}
    </div>,
    document.body,
  )
}

function CardSuitFanRow({ suit, cards, selected, onPick, readOnly = false }) {
  // One hovered/focused inscribed card at a time across this row.
  const [info, setInfo] = useState(null) // { rect, frame, upgradeBonus }
  const isRed = suit === HEART || suit === DIAMOND
  const isWoundRow = suit === WOUND
  const isKeyRow = suit === KEY
  const isMapRow = suit === MAP
  const isStoneRow = suit === STONE
  const isTorchRow = suit === TORCH
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
            : isTorchRow
              ? 'text-orange-400'
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
          const cardIsTorch = isTorch(c)
          // Rank-0 inscriptions (Elixir of Life) show the bare glyph, no rank.
          const cardNoRank = !!c.inscribed && c.rank === 0
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
                    : cardIsTorch
                      ? 'text-orange-400'
                      : 'text-parchment'
          const baseClass = `card-fan-item relative aspect-[2/3] w-12 sm:w-14 shrink-0 rounded border-2 p-1 flex flex-col justify-between text-left ${
            isSelected
              ? 'border-rune bg-stone-700'
              : `${cardBorderTone(c)} bg-stone-900${readOnly ? '' : ' hover:bg-stone-800 hover:border-rune/60'}`
          }`
          const inner = (
            <>
              <div className={`text-xs sm:text-sm font-bold leading-none ${cardColorClass}`}>
                {(cardIsWound || cardIsKey || cardIsMap || cardIsStone || cardIsTorch || cardNoRank) ? SUIT_GLYPH[c.suit] : `${rankLabel(c.rank)}${SUIT_GLYPH[c.suit]}`}
              </div>
              {(c.upgraded || c.inscribed) && (
                <div className="flex flex-col items-end gap-0.5 leading-none">
                  {c.upgraded && (
                    <div className="text-[8px] text-rune uppercase tracking-wider">+{c.upgradeBonus}</div>
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
          // Inscribed cards reveal their effect on hover/focus, mirroring how a
          // room card carries that text. Plain/upgraded-only cards have nothing
          // extra to show, so they get no tooltip.
          const frame = c.inscribed ? INSCRIBED_FRAMES[c.inscribed] : null
          const infoHandlers = frame
            ? {
                onMouseEnter: e => setInfo({ rect: e.currentTarget.getBoundingClientRect(), frame, upgradeBonus: c.upgraded ? c.upgradeBonus : 0 }),
                onMouseLeave: () => setInfo(null),
                onFocus: e => setInfo({ rect: e.currentTarget.getBoundingClientRect(), frame, upgradeBonus: c.upgraded ? c.upgradeBonus : 0 }),
                onBlur: () => setInfo(null),
              }
            : null
          if (readOnly) {
            return (
              <div
                key={c.id}
                style={style}
                className={`${baseClass} ${frame ? 'cursor-help' : 'cursor-default'}`}
                tabIndex={frame ? 0 : undefined}
                {...infoHandlers}
              >
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
              {...infoHandlers}
            >
              {inner}
            </button>
          )
        })}
      </div>
      <FanCardInfo anchor={info?.rect} frame={info?.frame} upgradeBonus={info?.upgradeBonus} />
    </div>
  )
}
