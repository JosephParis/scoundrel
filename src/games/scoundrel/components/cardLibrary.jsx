import { createPortal } from 'react-dom'
import {
  HEART, DIAMOND, SUIT_GLYPH, rankLabel,
  BOSSES, BOSS_IDS, INSCRIBED_FRAMES, INSCRIBED_FRAME_IDS,
} from '../logic'
import { SuitIcon, cardBorderTone, suitIconTone } from './SuitIcon'

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
          <p className="text-[11.5px] text-slate-500 mt-1 max-w-md">
            Bosses appear in the descent deck. Forge inscriptions are added at the sanctuary and persist for the rest of the run.
          </p>
        </div>

        <div className="space-y-6 max-h-[65vh] overflow-y-auto pr-2">
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
        </div>
      </div>
    </div>
  ), document.body)
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

// Smaller, static cousin of CardSlot. No previews/interactions, just the
// face: rank+glyph, sigil, kind label. Boss and inscribed bits flow
// through the same border/tone helpers so the look stays consistent.
function PreviewCard({ card }) {
  const red = card.suit === HEART || card.suit === DIAMOND
  const boss = !!card.boss
  const inscribed = !!card.inscribed
  return (
    <div className={`relative shrink-0 aspect-[2/3] w-20 rounded-md border-2 ${cardBorderTone(card)} card-face text-stone-900 p-2 flex flex-col`}>
      <div className={`text-sm font-bold leading-none ${red ? 'text-blood' : 'text-stone-900'}`}>
        {rankLabel(card.rank)}{SUIT_GLYPH[card.suit]}
      </div>
      {inscribed && (
        <div className="absolute top-1 right-1 text-[7px] uppercase tracking-widest text-amber-700/80 font-semibold">
          inscribed
        </div>
      )}
      {boss && (
        <div className="absolute top-1 right-1 text-[7px] uppercase tracking-widest text-rune font-semibold drop-shadow-[0_0_3px_rgba(251,191,36,0.7)]">
          boss
        </div>
      )}
      <div className="flex-1 min-h-0 flex items-center justify-center">
        <SuitIcon suit={card.suit} inscribed={card.inscribed} boss={card.boss} className={`w-[68%] h-auto ${suitIconTone(card)}`} />
      </div>
    </div>
  )
}
