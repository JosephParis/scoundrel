import { createPortal } from 'react-dom'
import {
  HEART, DIAMOND, SPADE, WOUND, SUIT_GLYPH, rankLabel,
  BOSSES, BOSS_IDS, INSCRIBED_FRAMES, INSCRIBED_FRAME_IDS,
  TRAITS, TRAIT_IDS,
} from '../logic'
import { SuitIcon, TraitIcon, cardBorderTone, suitIconTone } from './SuitIcon'

// Catalogue of every special card the run can produce: bosses (shuffled
// into the descent deck) and forge inscriptions (added at sanctuary).
// Always shows the full set, even if the player has not yet enabled the
// related flag, so the reference works as a "what's in the deck" guide.
export function CardLibraryModal({ open, onClose }) {
  if (!open) return null

  return createPortal((
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-start sm:items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="panel max-w-3xl w-full p-6 my-4 sm:my-auto relative shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 w-9 h-9 rounded-full bg-stone-800 hover:bg-stone-700 text-parchment text-xl leading-none flex items-center justify-center border border-stone-700"
          aria-label="Close card library"
        >
          ×
        </button>
        <div className="mb-5">
          <div className="text-[10px] uppercase tracking-[0.3em] text-slate-500">The catalogue</div>
          <h2 className="font-display text-rune text-2xl mt-1">Special cards</h2>
        </div>

        <div className="max-h-[65vh] overflow-y-auto pr-2">
          <CardLibraryContent />
        </div>
      </div>
    </div>
  ), document.body)
}

// The catalogue body on its own, no modal chrome. Shared by the standalone
// CardLibraryModal (Home / overflow menu) and the "Card library" tab inside
// the How-to-play modal, so the reference reads the same wherever it opens.
export function CardLibraryContent() {
  return (
    <div className="space-y-6">
      <p className="text-[12px] text-slate-400 leading-snug max-w-xl">
        Bosses appear in the descent deck. Forge inscriptions are added at the sanctuary and persist for the rest of the run. Monster traits are stamped onto some cards by certain trials.
      </p>
      <Section title="Bosses">
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {BOSS_IDS.map(id => <BossEntry key={id} id={id} />)}
        </ul>
      </Section>
      <Section title="Forge inscriptions">
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {INSCRIBED_FRAME_IDS.map(id => <InscribedEntry key={id} id={id} />)}
        </ul>
      </Section>
      <Section title="Monster traits">
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {TRAIT_IDS.map(id => <TraitEntry key={id} id={id} />)}
        </ul>
      </Section>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div>
      <h3 className="text-[12px] uppercase tracking-[0.2em] text-rune/80 mb-3">{title}</h3>
      {children}
    </div>
  )
}

function BossEntry({ id }) {
  const boss = BOSSES[id]
  if (!boss) return null
  // Bosses with a rolled `rankRange` (e.g. The Mimic) have no fixed rank;
  // use the midpoint so the preview reads as a representative example.
  const previewRank = boss.rank ?? Math.round((boss.rankRange[0] + boss.rankRange[1]) / 2)
  const card = { suit: boss.suit, rank: previewRank, boss: id }
  return (
    <li className="rounded-md border border-stone-700 bg-stone-900/40 p-3 flex gap-3">
      <PreviewCard card={card} />
      <div className="min-w-0 flex-1">
        <div className="text-rune font-display text-sm">{boss.name}</div>
        <div className="text-[10px] uppercase tracking-widest text-rune/70 mt-0.5">Boss</div>
        <div className="text-[12px] text-slate-300 mt-1 leading-snug">{boss.description}</div>
      </div>
    </li>
  )
}

function InscribedEntry({ id }) {
  const frame = INSCRIBED_FRAMES[id]
  if (!frame) return null
  // Mid-range rank for the preview so cards with picks (Cursed Idol,
  // Lucky Coin, Potion of Strength) show a representative face.
  const previewRank = frame.rankMin === frame.rankMax
    ? frame.rankMin
    : Math.round((frame.rankMin + frame.rankMax) / 2)
  const card = { suit: frame.suit, rank: previewRank, inscribed: id }
  const rankRange = frame.rankMax > frame.rankMin
    ? `Rank ${frame.rankMin}-${frame.rankMax}`
    : null
  return (
    <li className="rounded-md border border-stone-700 bg-stone-900/40 p-3 flex gap-3">
      <PreviewCard card={card} />
      <div className="min-w-0 flex-1">
        <div className="text-rune font-display text-sm">{frame.name}</div>
        <div className="text-[10px] uppercase tracking-widest text-amber-700/80 mt-0.5">
          Inscription{rankRange ? ` · ${rankRange}` : ''}
        </div>
        <div className="text-[12px] text-slate-300 mt-1 leading-snug">{frame.description}</div>
      </div>
    </li>
  )
}

function TraitEntry({ id }) {
  const trait = TRAITS[id]
  if (!trait) return null
  // A representative mid-rank monster (spades are monsters) so the corner
  // symbol shows on a normal-looking card face.
  const card = { suit: SPADE, rank: 9, [id]: true }
  return (
    <li className="rounded-md border border-stone-700 bg-stone-900/40 p-3 flex gap-3">
      <PreviewCard card={card} />
      <div className="min-w-0 flex-1">
        <div className="text-rune font-display text-sm">{trait.name}</div>
        <div className="text-[10px] uppercase tracking-widest text-red-400/90 mt-0.5">Trait</div>
        <div className="text-[12px] text-slate-300 mt-1 leading-snug">{trait.description}</div>
      </div>
    </li>
  )
}

// Smaller, static cousin of CardSlot. No previews/interactions, just the
// face: rank+glyph and sigil. Boss/inscribed type is named in the entry text
// beside the card, so the face stays clean; only the trait symbol (the thing
// being catalogued) shows in the corner. Border/tone helpers keep the look
// consistent with the live card.
function PreviewCard({ card }) {
  const red = card.suit === HEART || card.suit === DIAMOND
  const boss = !!card.boss
  const inscribed = !!card.inscribed
  // Wounds and rank-0 inscriptions (Key, Map, Whetstone, Torch) carry no rank,
  // so the face shows the bare suit glyph. Lucky Coin keeps its rank.
  const synthetic = card.suit === WOUND
  const noRank = synthetic || (inscribed && card.rank === 0)
  const traitLabel = card.armored ? 'armored'
    : card.relentless ? 'relentless'
    : card.warded ? 'warded'
    : card.shrouded ? 'shrouded'
    : card.vengeful ? 'vengeful'
    : card.swelling ? 'swelling'
    : card.cursed ? 'cursed'
    : null
  return (
    <div className={`relative shrink-0 aspect-[2/3] w-20 rounded-md border-2 ${cardBorderTone(card)} card-face text-stone-900 p-2 flex flex-col`}>
      <div className={`text-sm font-bold leading-none ${red ? 'text-blood' : 'text-stone-900'}`}>
        {noRank ? SUIT_GLYPH[card.suit] : `${rankLabel(card.rank)}${SUIT_GLYPH[card.suit]}`}
      </div>
      {traitLabel && !boss && !inscribed && (
        <TraitIcon trait={traitLabel} className="absolute top-2 right-2 w-3.5 h-3.5 text-red-800" />
      )}
      <div className="flex-1 min-h-0 flex items-center justify-center">
        <SuitIcon suit={card.suit} inscribed={card.inscribed} boss={card.boss} className={`w-[68%] h-auto ${suitIconTone(card)}`} />
      </div>
    </div>
  )
}
