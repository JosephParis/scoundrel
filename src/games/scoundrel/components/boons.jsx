import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  BOONS, getBoon, rankLabel,
  HEART, DIAMOND, SUIT_GLYPH,
} from '../logic'
import { ConfirmButton } from './atoms'
import { CardSuitFan } from './forge'
import { WeaponBlock } from './cards'
import { SuitIcon, cardBorderTone, suitIconTone } from './SuitIcon'

const BOON_TAG_LABEL = {
  combat: 'Combat',
  survival: 'Survival',
  economy: 'Economy',
  build: 'Build',
}

// -- Boon name with tooltip --------------------------------------------

export function BoonName({ boonId, className = '', muted = false }) {
  const boon = BOONS[boonId]
  const [showTooltip, setShowTooltip] = useState(false)
  const spanRef = useRef(null)
  const [position, setPosition] = useState({ top: 0, left: 0 })

  useEffect(() => {
    if (showTooltip && spanRef.current) {
      const rect = spanRef.current.getBoundingClientRect()
      setPosition({
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX
      })
    }
  }, [showTooltip])

  if (!boon) return null

  return (
    <>
      <span
        ref={spanRef}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className="cursor-help inline-block"
      >
        <span className={muted ? 'text-slate-600 line-through font-semibold' : className || 'text-rune'}>
          {boon.name}
        </span>
        {muted && <span className="text-slate-500 italic"> (muted)</span>}
      </span>
      {showTooltip && createPortal(
        <div
          role="tooltip"
          style={{
            position: 'absolute',
            top: `${position.top}px`,
            left: `${position.left}px`,
            zIndex: 9999
          }}
          className="w-64 rounded-md border border-rune/40 bg-stone-950/98 p-2.5 text-left shadow-xl pointer-events-none"
        >
          <div className="text-rune font-semibold mb-1">{boon.name}</div>
          <div className="text-[11px] text-slate-300 leading-snug">{boon.description}</div>
          {boon.example && (
            <div className="mt-2 text-[10px] text-slate-400 italic leading-snug border-l-2 border-rune/30 pl-2">
              {boon.example}
            </div>
          )}
        </div>,
        document.body
      )}
    </>
  )
}

// -- Boon picker -------------------------------------------------------

export function BoonOfferPanel({ offers, onPick, forgeAfter = false }) {
  const [selectedId, setSelectedId] = useState(null)
  const selectedBoon = selectedId ? getBoon(selectedId) : null
  return (
    <section className="panel p-4">
      <div className="text-center mb-3">
        <div className="text-[9px] uppercase tracking-[0.3em] text-slate-500">Something comes to you</div>
        <h2 className="font-display text-rune text-lg mt-0.5">Pick one Boon</h2>
        {forgeAfter && (
          <div className="mt-2 inline-flex items-center gap-1.5 text-[9px] uppercase tracking-widest text-amber-300/80 border border-amber-700/50 rounded-full px-2.5 py-0.5">
            <span className="text-slate-500">Next</span>
            <span aria-hidden="true">▸</span>
            <span>Forge</span>
          </div>
        )}
      </div>
      <div className="grid grid-cols-3 gap-2 sm:gap-3 justify-items-center">
        {offers.map(id => {
          const boon = getBoon(id)
          return (
            <BoonCard
              key={id}
              boon={boon}
              selected={selectedId === id}
              onPick={() => setSelectedId(id)}
            />
          )
        })}
      </div>
      <div className="flex justify-center mt-3">
        <ConfirmButton
          onClick={() => onPick(selectedId)}
          disabled={!selectedId}
          label={selectedBoon ? `Take ${selectedBoon.name}` : 'Pick a Boon above'}
        />
      </div>
    </section>
  )
}

function BoonCard({ boon, selected, onPick }) {
  const tag = BOON_TAG_LABEL[boon.tag] || ''
  return (
    <button
      onClick={onPick}
      className={`group aspect-[2/3] w-full max-w-[110px] sm:max-w-[190px] md:max-w-[210px] text-left rounded-lg border bg-gradient-to-b p-2 sm:p-3.5 hover:-translate-y-1 transition-all duration-200 shadow-md flex flex-col relative overflow-hidden ${
        selected
          ? 'border-rune from-stone-800 to-stone-900 shadow-[0_0_24px_-8px_rgba(251,191,36,0.6)]'
          : 'border-stone-700 from-stone-900 to-stone-950 hover:border-rune hover:from-stone-800 hover:to-stone-900 hover:shadow-[0_0_24px_-8px_rgba(251,191,36,0.5)]'
      }`}
    >
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-rune/40 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-rune/20 to-transparent" />
      <div className="font-display text-rune text-[13px] sm:text-base leading-tight">{boon.name}</div>
      <div className="h-px bg-stone-700 my-1 sm:my-2" />
      <div className="text-[10px] sm:text-[12px] text-slate-200 leading-snug">{boon.description}</div>
      {boon.example && (
        <div className="mt-1 sm:mt-2 text-[9px] sm:text-[11px] text-slate-400 italic leading-snug border-l-2 border-rune/30 pl-1.5 sm:pl-2">
          {boon.example}
        </div>
      )}
      <div className="flex-1" />
      {tag && (
        <div className="mt-1 sm:mt-2 pt-1 sm:pt-2 border-t border-stone-800 text-[8px] sm:text-[9px] uppercase tracking-[0.2em] text-slate-500 group-hover:text-rune/70 transition">
          {tag}
        </div>
      )}
    </button>
  )
}

// -- Run state ---------------------------------------------------------

export function RunStatePanel({ game }) {
  const empty =
    game.boons.length === 0 &&
    !game.carriedWeapon &&
    !game.carriedSpareWeapon

  if (empty) {
    return (
      <div className="panel p-4">
        <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">What you carry</div>
        <div className="text-[13px] text-slate-500 italic">Nothing yet. Survive a descent to earn your first boon.</div>
      </div>
    )
  }

  return (
    <div className="panel p-4 space-y-2 text-[13px]">
      <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">What you carry</div>

      {game.carriedWeapon && (
        <div className="text-slate-300">
          <span className="text-slate-500">Weapon:</span>{' '}
          <span className="text-rune font-mono">{rankLabel(game.carriedWeapon.rank)}♦</span>
          {game.carriedWeapon.inscribed && BOONS[game.carriedWeapon.inscribed] && (
            <span className="text-slate-400"> ({BOONS[game.carriedWeapon.inscribed].name})</span>
          )}
        </div>
      )}
      {game.carriedSpareWeapon && (
        <div className="text-slate-300">
          <span className="text-slate-500">Spare:</span>{' '}
          <span className="text-rune font-mono">{rankLabel(game.carriedSpareWeapon.rank)}♦</span>
          {game.carriedSpareWeapon.inscribed && BOONS[game.carriedSpareWeapon.inscribed] && (
            <span className="text-slate-400"> ({BOONS[game.carriedSpareWeapon.inscribed].name})</span>
          )}
        </div>
      )}
      {game.boons.length > 0 && (
        <div className="text-slate-300">
          <span className="text-slate-500">Boons:</span>{' '}
          {game.boons.map((id, i) => (
            <span key={id}>
              {i > 0 && <span className="text-slate-600">, </span>}
              <BoonName boonId={id} className="text-rune" />
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// -- Deck peek ---------------------------------------------------------

export function DeckPeekButton({ game, onClick }) {
  const count = (game.kit || []).length
  return (
    <button
      onClick={onClick}
      className="panel p-3 w-full text-left hover:border-rune/40 transition flex items-baseline justify-between"
    >
      <span className="text-[10px] uppercase tracking-widest text-slate-500">View kit</span>
      <span className="text-[11px] text-slate-500">
        <span className="font-mono text-slate-300">{count}</span> cards
      </span>
    </button>
  )
}

export function DeckModal({ open, onClose, game }) {
  const deck = game.kit || []
  if (!open) return null
  return (
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
          aria-label="Close deck view"
        >
          ×
        </button>
        <div className="mb-4">
          <div className="text-[10px] uppercase tracking-[0.3em] text-slate-500">Your kit</div>
          <h2 className="font-display text-rune text-2xl mt-1">
            {deck.length} <span className="text-slate-400 text-base">cards</span>
          </h2>
          <p className="text-[11px] text-slate-500 mt-1">
            Press <span className="font-mono text-slate-300">Esc</span> or click outside to close.
          </p>
        </div>
        <CardSuitFan cards={deck} readOnly />
      </div>
    </div>
  )
}

// -- Map peek ----------------------------------------------------------

// Shown when the player plays a Map. Snapshot of the next N cards from
// the top of the deck at play-time. Portal'd to body so it floats above
// the room cards, which sit inside the action-slot stacking context.
export function MapPeekModal({ cards, onClose }) {
  if (!cards) return null
  return createPortal(
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-start sm:items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="panel max-w-2xl w-full p-6 my-4 sm:my-auto relative shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 w-9 h-9 rounded-full bg-stone-800 hover:bg-stone-700 text-parchment text-xl leading-none flex items-center justify-center border border-stone-700"
          aria-label="Close map"
        >
          ×
        </button>
        <div className="mb-4">
          <div className="text-[10px] uppercase tracking-[0.3em] text-sky-300/70">The map unfolds</div>
          <h2 className="font-display text-rune text-2xl mt-1">
            Next {cards.length} <span className="text-slate-400 text-base">{cards.length === 1 ? 'card' : 'cards'}</span>
          </h2>
          {cards.length === 0 ? (
            <p className="text-[12px] text-slate-500 italic mt-2">The deck is empty.</p>
          ) : (
            <p className="text-[11px] text-slate-500 mt-1">
              Top of the deck on the left. Press <span className="font-mono text-slate-300">Esc</span> or click outside to close.
            </p>
          )}
        </div>
        {cards.length > 0 && (
          <div className="flex flex-wrap justify-center gap-3">
            {cards.map((c, i) => (
              <PeekCard key={`${c.id}-${i}`} card={c} index={i} />
            ))}
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}

// Larger ordered-list card for the Map peek. Numbered so deck order
// reads at a glance.
function PeekCard({ card, index }) {
  const red = card.suit === HEART || card.suit === DIAMOND
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="text-[10px] uppercase tracking-widest text-slate-500">#{index + 1}</div>
      <div className={`aspect-[2/3] w-20 sm:w-24 rounded-md border-2 ${cardBorderTone(card)} card-face text-stone-900 p-2 flex flex-col text-left`}>
        <div className={`text-lg font-bold leading-none ${red ? 'text-blood' : 'text-stone-900'}`}>
          {rankLabel(card.rank)}{SUIT_GLYPH[card.suit]}
        </div>
        <div className="flex-1 min-h-0 flex items-center justify-center py-1">
          <SuitIcon suit={card.suit} inscribed={card.inscribed} boss={card.boss} className={`w-[60%] h-auto ${suitIconTone(card)}`} />
        </div>
      </div>
    </div>
  )
}

// -- Loadout (idle review panel) ---------------------------------------

export function LoadoutPanel({ game }) {
  const deck = game.kit || []
  const { carriedWeapon, carriedSpareWeapon, boons } = game
  const showWeapons = carriedWeapon || carriedSpareWeapon
  const showBoons = boons.length > 0
  const hasSidebar = showWeapons || showBoons
  return (
    <section className="panel p-5">
      <div className="flex items-baseline justify-between gap-3 flex-wrap mb-3">
        <h2 className="font-display text-rune text-base leading-tight">Ready to descend</h2>
        <div className="text-[10px] uppercase tracking-widest text-slate-500">
          Kit · <span className="font-mono text-parchment">{deck.length}</span> cards
          {showBoons && (
            <>
              <span className="text-stone-700 mx-2">|</span>
              <span className="font-mono text-parchment">{boons.length}</span>{' '}
              {boons.length === 1 ? 'boon' : 'boons'}
            </>
          )}
        </div>
      </div>

      <div className={hasSidebar ? 'grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_280px] gap-x-5 gap-y-4' : ''}>
        <div className="min-w-0">
          <CardSuitFan cards={deck} readOnly />
        </div>

        {hasSidebar && (
          <div className="space-y-4 md:border-l md:border-stone-800 md:pl-5">
            {showWeapons && (
              <div>
                <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-2">
                  {carriedSpareWeapon ? 'Weapons' : 'Weapon'}
                </div>
                <div className="space-y-3">
                  {carriedWeapon && (
                    <WeaponBlock
                      game={game}
                      weapon={carriedWeapon}
                      label={carriedSpareWeapon ? 'Drawn' : null}
                    />
                  )}
                  {carriedSpareWeapon && (
                    <div className={carriedWeapon ? 'border-t border-stone-800 pt-3' : ''}>
                      <WeaponBlock game={game} weapon={carriedSpareWeapon} label="Spare" />
                    </div>
                  )}
                </div>
              </div>
            )}

            {showBoons && (
              <div>
                <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-1.5">Boons</div>
                <ul className="space-y-2">
                  {boons.map(id => {
                    const b = BOONS[id]
                    if (!b) return null
                    return (
                      <li key={id} className="text-[12px] leading-snug">
                        <div className="text-rune font-semibold">
                          <BoonName boonId={id} className="text-rune font-semibold" />
                        </div>
                        <div className="text-slate-400">{b.description}</div>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
