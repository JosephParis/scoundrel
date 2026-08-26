import {
  HEART, DIAMOND, SUIT_GLYPH, rankLabel,
  isMonster, isWeapon, isPotion, isTool, isWound, isSkeletonKey, isMap, isWhetstone, isTorch, isBoss,
  INSCRIBED_FRAMES, BOSSES, TRAITS,
} from '../logic'
import { formatFormula } from './atoms'
import { SuitIcon, TraitIcon, cardBorderTone, suitIconTone } from './SuitIcon'
import { HelperIcon } from './HelperIcon'
import { useCardLayout } from '../settings'

// The card face is chosen per the player's display setting (Settings modal):
//   'modern'  moves the art to the top, names the card below it, and prints
//             the rules text at the bottom of bosses/inscribed/trait cards so
//             they are self-explanatory without a hover.
//   'classic' is the original layout (art centered, name + category only,
//             rules on hover only).
// Both faces share the same outer shell, so the setting swaps every card.

// -- Shared preview line -----------------------------------------------

// The dynamic action preview ("take 7", "heal 4", "Skip the room", …). Shared
// by both faces so the combat/potion math lives in one place. Returns the
// inner spans; each face wraps them in its own container.
function CardPreview({
  card, monsterPreview, willUseWeapon, potionHeal, potionSour, potionStrength,
  potionSkip, isWoundCard, isKeyCard, isMapCard, isStoneCard, isTorchCard, footerKind,
}) {
  if (monsterPreview) {
    return (
      <>
        <span className="text-[12px] tracking-normal text-stone-800 font-medium flex items-center justify-center gap-1">
          <HelperIcon kind={willUseWeapon ? 'weapon' : 'bare'} />
          take {monsterPreview.value}{card.relentless ? ' ×2' : ''}
        </span>
        {monsterPreview.parts.length > 1 && (
          <span className="text-[10px] tracking-normal text-stone-500 leading-tight">
            ({formatFormula(monsterPreview.parts)})
          </span>
        )}
      </>
    )
  }
  if (potionHeal) {
    return (
      <>
        <span className="text-[12px] tracking-normal text-stone-800 font-medium flex items-center justify-center gap-1">
          <HelperIcon kind="heal" /> heal {potionHeal.value}
        </span>
        {potionHeal.parts.length > 0 && (
          <span className="text-[10px] tracking-normal text-stone-500 leading-tight">
            ({formatFormula(potionHeal.parts)})
          </span>
        )}
      </>
    )
  }
  if (potionSour) {
    return (
      <>
        <span className="text-[12px] tracking-normal text-stone-800 font-medium flex items-center justify-center gap-1">
          <HelperIcon kind="sour" /> take {potionSour.value}
        </span>
        {potionSour.parts.length > 0 && (
          <span className="text-[10px] tracking-normal text-stone-500 leading-tight">
            ({formatFormula(potionSour.parts)})
          </span>
        )}
      </>
    )
  }
  if (potionStrength) {
    return (
      <span className="text-[12px] tracking-normal text-stone-800 font-medium flex items-center justify-center gap-1">
        <HelperIcon kind="strength" /> strikes +{potionStrength.value}
      </span>
    )
  }
  if (potionSkip) {
    return <span className="text-[10px] uppercase tracking-[0.2em] text-stone-500">{potionSkip.note}</span>
  }
  if (isWoundCard) return <span className="text-[11px] tracking-normal text-stone-700 font-medium">Bind to clear</span>
  if (isKeyCard) return <span className="text-[11px] tracking-normal text-amber-800 font-medium">Skip the room</span>
  if (isMapCard) return <span className="text-[11px] tracking-normal text-sky-800 font-medium">Read the map</span>
  if (isStoneCard) return <span className="text-[11px] tracking-normal text-slate-700 font-medium">Hone the blade</span>
  if (isTorchCard) return <span className="text-[11px] tracking-normal text-orange-700 font-medium">Burn a foe</span>
  return <span className="text-[10px] uppercase tracking-[0.2em] text-stone-500">{footerKind}</span>
}

// -- Classic face (original layout) ------------------------------------

function ClassicFace({ f }) {
  const { card, red, wound, tool, noRank, obscured, shownRank } = f
  return (
    <>
      <div className={`text-2xl font-bold leading-none ${
        red ? 'text-blood' : wound ? 'text-red-900' : tool ? 'text-amber-600' : 'text-stone-900'
      }`}>
        {(wound || noRank || obscured) ? SUIT_GLYPH[card.suit] : `${rankLabel(shownRank)}${SUIT_GLYPH[card.suit]}`}
      </div>
      {/* max-h-full so the art letterboxes instead of spilling when the face
          gives up its lower strip to the bare-hands reserve. */}
      <div className="flex-1 min-h-0 flex items-center justify-center py-1">
        <SuitIcon suit={card.suit} inscribed={card.inscribed} boss={card.boss} className={`w-[62%] h-auto max-h-full ${suitIconTone(card)}`} />
      </div>
      {(f.boss ? f.bossDef : f.inscribed ? f.frame : null) && (
        <div className="-mt-2 text-center text-[12px] uppercase tracking-[0.12em] font-semibold leading-tight px-1 truncate text-stone-900">
          {f.boss ? f.bossDef.name : f.frame.name}
        </div>
      )}
      <div className="text-center flex flex-col gap-0.5 min-h-[34px] justify-center">
        <CardPreview {...f} />
      </div>
    </>
  )
}

// -- Modern face (art up, name below, rules at the bottom) --------------

function ModernFace({ f }) {
  const { card, red, wound, tool, noRank, obscured, shownRank, rules, hasBare } = f
  // Name shown under the art. Special cards use their proper name; everything
  // else shows its category so the face still says what it is.
  const name = f.boss ? f.bossDef.name : f.inscribed ? f.frame.name : f.kind
  // Scale the rules copy to its length: short blurbs grow to fill the space,
  // long ones shrink so they don't spill into the art. A bare-hands button
  // takes a strip off the bottom of the face, so drop a size when one is
  // present rather than letting the copy clip.
  const len = rules ? rules.length : 0
  const rulesSize = hasBare
    ? (len > 95 ? 'text-[9px]' : len > 65 ? 'text-[10px]' : 'text-[11px]')
    : (len > 130 ? 'text-[9.5px]' : len > 95 ? 'text-[10.5px]' : len > 65 ? 'text-[11.5px]' : 'text-[13px]')
  // The art is the one element on this face that carries no information the
  // player needs to make the choice, so it gives up the room instead of the
  // rules copy, which would otherwise clip mid-sentence.
  const artBox = hasBare ? 'mt-0.5 mb-0.5' : 'mt-3 mb-2'
  const artWidth = hasBare ? 'w-[30%]' : 'w-[54%]'
  return (
    <>
      <div className={`text-xl font-bold leading-none ${
        red ? 'text-blood' : wound ? 'text-red-900' : tool ? 'text-amber-600' : 'text-stone-900'
      }`}>
        {(wound || noRank || obscured) ? SUIT_GLYPH[card.suit] : `${rankLabel(shownRank)}${SUIT_GLYPH[card.suit]}`}
      </div>
      {/* Art sits below the rank glyph, sized to read as the centerpiece while
          still leaving the lower half for the rules text. */}
      <div className={`${artBox} flex items-center justify-center`}>
        <SuitIcon suit={card.suit} inscribed={card.inscribed} boss={card.boss} className={`${artWidth} h-auto ${suitIconTone(card)}`} />
      </div>
      {name && (
        <div className="text-center text-[12px] uppercase tracking-[0.1em] font-semibold leading-tight px-1 text-stone-900">
          {name}
        </div>
      )}
      {/* Rules + action preview fill the lower half, pinned to the bottom. */}
      <div className="flex-1 min-h-0 flex flex-col justify-end gap-1.5 pt-1.5">
        {rules && (
          <p className={`${rulesSize} leading-snug text-stone-600 text-center px-0.5 overflow-hidden`}>
            {rules}
          </p>
        )}
        <div className="text-center flex flex-col gap-0.5 border-t border-stone-900/10 pt-1.5">
          <CardPreview {...f} />
        </div>
      </div>
    </>
  )
}

// -- Card slot (shared shell) ------------------------------------------

export function CardSlot({ card, onClick, onBareHands, weaponDamage, bareDamage, potionPreview, reveal, recommended, tutorialTip, blocked, bareBlocked, bareRecommended, displayRank, dealIndex, forceBack, obscured }) {
  const layout = useCardLayout()
  // Slight per-slot delay so a refill of several cards cascades in.
  const dealStyle = dealIndex != null ? { animationDelay: `${dealIndex * 0.04}s` } : undefined
  if (!card) {
    return (
      <div className="aspect-[2/3] w-full max-w-[180px] short:max-w-[155px] sm:max-w-[220px] md:max-w-[240px] rounded-lg border border-dashed border-stone-800 bg-stone-900/30" />
    )
  }
  // Shrouded monsters (and any card while Blind, via forceBack) render
  // face-down like an Oath card: hidden, no preview, until the commit reveal.
  if ((card.faceDown || card.shrouded || forceBack) && !reveal) {
    return <FaceDownCardSlot onClick={blocked ? undefined : onClick} blocked={blocked} dealStyle={dealStyle} />
  }
  const red = card.suit === HEART || card.suit === DIAMOND
  const wound = isWound(card)
  // Not `key`: this ends up in the `f` bag that the faces are spread from, and
  // React treats a `key` property in a spread as the element's key rather than a
  // prop -- silently, apart from a console error on every single card render.
  const skeletonKey = isSkeletonKey(card)
  const map = isMap(card)
  const stone = isWhetstone(card)
  const torch = isTorch(card)
  const tool = isTool(card)
  const inscribed = !!card.inscribed
  // Rank-0 inscriptions (e.g. Elixir of Life) carry no meaningful rank, so the
  // face shows the bare suit glyph like the synthetic-suit tools do.
  const noRank = inscribed && card.rank === 0
  const boss = isBoss(card)
  const bossDef = boss ? BOSSES[card.boss] : null
  const traitLabel = card.armored ? 'armored'
    : card.relentless ? 'relentless'
    : card.warded ? 'warded'
    : card.shrouded ? 'shrouded'
    : card.vengeful ? 'vengeful'
    : card.swelling ? 'swelling'
    : card.cursed ? 'cursed'
    : null
  const frame = card.inscribed ? INSCRIBED_FRAMES[card.inscribed] : null
  const kind = bossDef
    ? bossDef.name
    : frame
      ? frame.name
      : isMonster(card)
        ? 'Monster'
        : isWeapon(card)
          ? 'Weapon'
          : isPotion(card)
            ? 'Potion'
            : wound
              ? 'Wound'
              : skeletonKey
                ? 'Skeleton Key'
                : ''
  // The mid-card label already names inscribed cards, so the small footer
  // shows the plain category instead of repeating the name (inscribed
  // weapons are the only inscribed cards that fall through to the footer).
  const footerKind = inscribed && !boss && isWeapon(card) ? 'Weapon' : kind
  // Devourer's printed rank is 3 but its live rank scales; DescentView
  // hands us the resolved value when needed. Anything else falls back to
  // the card's rank.
  const shownRank = displayRank != null ? displayRank : card.rank
  const monster = isMonster(card)
  const willUseWeapon = monster && weaponDamage !== null
  const monsterPreview = !monster ? null : willUseWeapon ? weaponDamage : bareDamage
  const potionHeal = potionPreview && potionPreview.mode === 'heal' ? potionPreview : null
  const potionSour = potionPreview && potionPreview.mode === 'damage' ? potionPreview : null
  const potionStrength = potionPreview && potionPreview.mode === 'strength' ? potionPreview : null
  const potionSkip = potionPreview && potionPreview.mode === 'skip' ? potionPreview : null

  // Rules copy printed on the modern face. Only bosses, inscribed cards, and
  // trait monsters carry any; plain weapons/monsters/potions have none, so
  // they keep the classic (big, centered art) face where the modern layout
  // would just leave a gap.
  const rules = boss
    ? bossDef.description
    : inscribed
      ? frame.description
      : (traitLabel && TRAITS[traitLabel] ? TRAITS[traitLabel].description : null)
  const useModern = layout === 'modern' && !!rules

  // When the lesson points at the bare-hands button AND the card-click
  // would actually swing (weapon usable), forbid the swing. If the
  // weapon is already locked out, clicking the card auto-bare-hands,
  // which is the same outcome as the button: don't grey it.
  const cardLockedForBare = !!bareRecommended && weaponDamage !== null
  // The card itself is the cued action (so it should glow + show the arrow)
  // whenever it's recommended AND it's the thing to click: a normal
  // recommendation, or a bare-hand recommendation on a locked monster where
  // there's no separate "Bare hands" button, so clicking the card bare-hands
  // it. When a bare-hands button IS present, that button carries the cue.
  const cardIsCue = recommended && (!bareRecommended || !onBareHands)
  const cardDisabled = reveal || blocked || cardLockedForBare
  const cardInteractive = reveal
    ? 'animate-card-reveal cursor-default ring-2 ring-rune/60'
    : (blocked || cardLockedForBare)
      ? 'cursor-not-allowed grayscale opacity-40'
      : 'hover:-translate-y-1 hover:shadow-[0_8px_24px_-6px_rgba(0,0,0,0.6)]'
  // Interactive cards rise on hover (the branch above). The info overlays are
  // anchored to the (non-rising) root, so they must rise in lockstep or the
  // lifted card peeks out above them. Match the lift only when the card lifts.
  const overlayLift = !reveal && !blocked && !cardLockedForBare ? 'group-hover:-translate-y-1' : ''

  // The bare-hands button floats over the card face, and what it floats over is
  // the action preview -- the other half of the same decision ("swing for 3" vs
  // "punch for 8"). Covering it hid the number the button is asking to be
  // compared against, so the face gives up a fixed strip at the bottom whenever
  // the button is drawn. BARE_RESERVE must stay >= the button's own height plus
  // its bottom offset, which is why the button is pinned to h-9 and its label
  // kept to one line rather than being allowed to size itself.
  const hasBare = !!onBareHands
  // h-9 (2.25rem) + bottom-3 (0.75rem) = 3rem of button. The rest is clearance,
  // and it is deliberately more than it looks like it needs: the preview line's
  // height comes from font metrics, so it grows a fraction when the display face
  // finishes loading. At 3.375rem that left ~6px of slack and a sub-pixel overlap
  // could still show up on a slow font load.
  const BARE_RESERVE = 'pb-[3.75rem]'

  // Everything the chosen face needs to draw itself. Spread into the face
  // components, so nothing in here may be called `key` or `ref` -- React would
  // consume it instead of passing it through. The card kinds are carried by the
  // isXCard aliases below, which is what the faces actually read.
  const f = {
    card, red, wound, map, stone, torch, tool, inscribed, noRank, boss, bossDef,
    traitLabel, frame, kind, footerKind, shownRank, willUseWeapon, monsterPreview,
    potionHeal, potionSour, potionStrength, potionSkip, obscured, rules, useModern, hasBare,
    isWoundCard: wound, isKeyCard: skeletonKey, isMapCard: map, isStoneCard: stone, isTorchCard: torch,
  }

  return (
    <div className="group relative w-full max-w-[180px] short:max-w-[155px] sm:max-w-[220px] md:max-w-[240px] flex flex-col animate-card-deal" style={dealStyle}>
      {cardIsCue && (
        <div
          className="absolute -top-7 left-1/2 -translate-x-1/2 z-20 text-rune text-2xl animate-bounce pointer-events-none drop-shadow-[0_0_6px_rgba(251,191,36,0.75)]"
          aria-hidden="true"
        >
          ▼
        </div>
      )}
      <button
        onClick={cardDisabled ? undefined : onClick}
        disabled={cardDisabled}
        className={`aspect-[2/3] rounded-lg border-2 ${cardBorderTone(card)} card-face ${boss ? 'is-boss' : ''} text-stone-900 p-3 ${hasBare ? BARE_RESERVE : ''} flex flex-col text-left transition-all ${cardInteractive} ${cardIsCue ? 'tutorial-recommended' : ''}`}
      >
        {f.useModern ? <ModernFace f={f} /> : <ClassicFace f={f} />}
      </button>
      {/* top-3/right-3 mirrors the button's p-3 so the icon lines up with
          the rank+suit in the top-left corner. */}
      {traitLabel && !boss && !inscribed && (
        <TraitIcon trait={traitLabel} className="absolute top-3 right-3 z-20 w-6 h-6 text-red-800" />
      )}
      {onBareHands && (
        <>
          {bareRecommended && (
            <div
              className="absolute top-[calc(100%-3rem)] left-1/2 -translate-x-1/2 z-30 text-rune text-2xl animate-bounce pointer-events-none drop-shadow-[0_0_6px_rgba(251,191,36,0.75)]"
              aria-hidden="true"
            >
              ▼
            </div>
          )}
          <button
            onClick={(blocked || bareBlocked) ? undefined : onBareHands}
            disabled={blocked || bareBlocked}
            className={`absolute bottom-3 left-3 right-3 h-9 z-20 px-1.5 rounded-md bg-stone-800/95 backdrop-blur-sm text-parchment font-medium border border-stone-700 transition text-center ${(blocked || bareBlocked) ? 'cursor-not-allowed opacity-40' : 'hover:bg-stone-700'} ${bareRecommended ? 'tutorial-recommended' : ''}`}
          >
            {/* One line, always: the reserve above is a fixed height, so a
                label that wrapped would grow the button back over the preview.
                Narrowest case is two columns at 320px. */}
            <span className="flex items-center justify-center gap-1 h-full whitespace-nowrap text-[10px] sm:text-xs">
              <HelperIcon kind="bare" /> Bare hands · take {bareDamage.value}
            </span>
          </button>
        </>
      )}
      {tutorialTip && (
        <div
          className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-[9999] w-72 rounded-lg bg-[#0f1116] p-3 text-[13px] leading-relaxed text-slate-200 text-left pointer-events-none shadow-2xl border border-rune/40"
          role="tooltip"
        >
          {tutorialTip}
        </div>
      )}
      {/* Boss effects are too long for the card face, so reveal them on hover
          as an overlay over the card itself. Hover lives on the root (group),
          not the inner button: a disabled <button> swallows hover on its own
          children, but the parent's :hover still fires. Overlaying the face
          (rather than a floating tooltip) avoids clipping at the top row and
          never covers the action buttons below. pointer-events-none keeps the
          card clickable through it. */}
      {boss && bossDef && (
        <div
          role="tooltip"
          className={`pointer-events-none absolute inset-x-0 top-0 aspect-[2/3] z-[9999] rounded-lg border-2 border-rune/60 bg-stone-950/95 p-3 flex flex-col items-center justify-center text-center opacity-0 group-hover:opacity-100 transition ${overlayLift}`}
        >
          <span className="font-display text-rune text-base mb-1.5">{bossDef.name}</span>
          <span className="text-[12.5px] leading-relaxed text-slate-200">{bossDef.description}</span>
        </div>
      )}
      {/* Same hover-overlay for monster traits, so the corner symbol is
          self-explanatory. Tinted red to match the trait icon. */}
      {traitLabel && !boss && !inscribed && TRAITS[traitLabel] && (
        <div
          role="tooltip"
          className={`pointer-events-none absolute inset-x-0 top-0 aspect-[2/3] z-[9999] rounded-lg border-2 border-red-700/60 bg-stone-950/95 p-3 flex flex-col items-center justify-center text-center opacity-0 group-hover:opacity-100 transition ${overlayLift}`}
        >
          <TraitIcon trait={traitLabel} className="w-7 h-7 text-red-400 mb-2" />
          <span className="font-display text-red-300 text-base mb-1.5">{TRAITS[traitLabel].name}</span>
          <span className="text-[12.5px] leading-relaxed text-slate-200">{TRAITS[traitLabel].description}</span>
        </div>
      )}
    </div>
  )
}

function FaceDownCardSlot({ onClick, blocked, dealStyle }) {
  return (
    <div className="w-full max-w-[180px] sm:max-w-[220px] md:max-w-[240px] flex flex-col animate-card-deal" style={dealStyle}>
      <button
        onClick={blocked ? undefined : onClick}
        disabled={!!blocked}
        className={`aspect-[2/3] rounded-lg border-2 border-stone-700 card-back bg-gradient-to-br from-stone-900 via-stone-950 to-black p-4 flex flex-col justify-between transition-all text-rune/60 ${blocked ? 'cursor-not-allowed grayscale opacity-40' : 'hover:-translate-y-1 hover:shadow-[0_8px_24px_-6px_rgba(0,0,0,0.6)] hover:border-rune/50'}`}
      >
        <div className="text-4xl leading-none font-display">?</div>
        <div className="text-xs uppercase tracking-[0.2em] text-slate-500 text-center">
          Face-down
        </div>
        <div className="text-5xl leading-none text-right text-rune/30">✦</div>
      </button>
      <div className="mt-2 text-[10px] text-slate-500 italic text-center leading-snug">
        Played sight-unseen.
      </div>
    </div>
  )
}
