import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  playCard, playCardBare, fleeRoom,
  dismissMapPeek,
  getTheme,
  isMonster, isWeapon, isPotion,
  previewMonsterDamage,
  describePotion,
  tutorialAllLessonsDone,
  devourerEffectiveRank,
  HEART, DIAMOND, SUIT_GLYPH, rankLabel,
} from '../logic'
import { PhaseRail, LogPanel } from './atoms'
import { ModeBadge } from './modes'
import { AscensionBadge } from './ascensions'
import { CardSlot, HpBar, WeaponPanel, ConditionsPanel, ForesightPanel } from './cards'
import { MapPeekModal } from './boons'
import { SuitIcon, cardBorderTone, suitIconTone } from './SuitIcon'

export function DescentView({ game, setGame }) {
  // When the player commits to a face-down card (Oath), flip it visibly first,
  // then resolve. revealing holds the room index of the card mid-reveal.
  const [revealing, setRevealing] = useState(null)
  // Theme intro: shown once when the descent mounts. Auto-dismisses, but the
  // player can tap to skip ahead. Themes that show a deck-changes animation
  // need a longer window so the last card finishes flipping before dismissal.
  const [introOpen, setIntroOpen] = useState(true)
  const introDeckChangeCount = (game.themeDeckChanges || []).reduce(
    (n, c) => n + c.additions.length + c.removals.length, 0
  )
  const introDurationMs = introDeckChangeCount > 0 ? 6200 : 4200
  useEffect(() => {
    if (!introOpen) return
    const t = setTimeout(() => setIntroOpen(false), introDurationMs)
    return () => clearTimeout(t)
  }, [introOpen, introDurationMs])
  useEffect(() => {
    if (!introOpen) return
    const onKey = (e) => { if (e.key === 'Escape' || e.key === ' ' || e.key === 'Enter') setIntroOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [introOpen])

  const onCard = useCallback((i) => {
    if (revealing != null) return
    const card = game.room[i]
    if (card?.faceDown) {
      setRevealing(i)
      return
    }
    setGame(g => playCard(g, i))
  }, [game.room, revealing, setGame])
  const onCardBare = useCallback((i) => {
    if (revealing != null) return
    setGame(g => playCardBare(g, i))
  }, [revealing, setGame])
  const onFlee = useCallback(() => {
    if (revealing != null) return
    setGame(g => fleeRoom(g))
  }, [revealing, setGame])

  useEffect(() => {
    if (revealing == null) return
    const t = setTimeout(() => {
      setGame(g => playCard(g, revealing))
      setRevealing(null)
    }, 1400)
    return () => clearTimeout(t)
  }, [revealing, setGame])

  const onCloseMapPeek = useCallback(() => {
    setGame(g => dismissMapPeek(g))
  }, [setGame])
  useEffect(() => {
    if (!game.mapPeek) return
    const onKey = (e) => { if (e.key === 'Escape') onCloseMapPeek() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [game.mapPeek, onCloseMapPeek])

  const theme = getTheme(game.theme)

  const themeIronBones = (game.themeChildren
    ? game.themeChildren.map(id => getTheme(id))
    : [theme]
  ).some(t => t && t.ironBones)

  const childNames = (game.themeChildren || [])
    .map(id => getTheme(id)?.name)
    .filter(Boolean)

  // Tutorial cue: recommends one card per turn based on game state.
  // Recomputes whenever the room or weapon binding changes. Stops
  // recommending (and hides hover tips) once the player has done
  // every action the walkthrough exists to teach.
  const tutorialActive = game.tutorial && !tutorialAllLessonsDone(game)
  const tutorialCue = useMemo(
    () => (tutorialActive ? computeTutorialCue(game) : null),
    [tutorialActive, game]
  )
  // While the cue points at a specific action (a card or the Flee
  // button), every other action gets locked out so the player can't
  // make a mistake during the walk.
  const cueHasTarget = tutorialActive && !!tutorialCue && (tutorialCue.recommendedId != null || tutorialCue.recommendFlee)

  return (
    <div className="grid grid-cols-1 md:grid-cols-[300px_minmax(0,1fr)] gap-6 animate-fade-in items-start">
      {introOpen && (
        <ThemeIntroOverlay
          theme={theme}
          themeChildren={game.themeChildren}
          deckChanges={game.themeDeckChanges}
          onDismiss={() => setIntroOpen(false)}
        />
      )}

      <MapPeekModal cards={game.mapPeek} onClose={onCloseMapPeek} />

      <PhaseRail
        title={theme?.name || 'Descent'}
        subtitle={childNames.length > 0 ? childNames.join(' + ') : null}
        sigilsEarned={game.sigilsEarned}
        sigilTarget={game.sigilTarget}
      >
        <HpBar hp={game.hp} maxHp={game.maxHp} />
        <WeaponPanel game={game} />
        <ConditionsPanel game={game} theme={theme} />
        <AscensionBadge level={game.ascension} />
        <ModeBadge modeId={game.mode} />
        <LogPanel lines={game.log} collapsible />
      </PhaseRail>

      <div className="space-y-5 min-w-0">
        <section>
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-[10px] uppercase tracking-[0.3em] text-slate-500">The room</h2>
            <div className="text-[13px] text-slate-500">
              Deck <span className="font-mono text-slate-300">{game.deck.length}</span> remain
            </div>
          </div>
          {game.tutorial && (
            tutorialActive ? (
              <div className="mb-3 panel panel-warm p-4 text-[14px] text-slate-300 leading-relaxed space-y-2">
                <div>
                  <span className="text-rune font-semibold uppercase text-[11px] tracking-[0.2em] mr-2">Tutorial</span>
                  Take the glowing move (explanation below it). Other actions are locked while you learn.
                </div>
                <div className="text-slate-400 text-[13px]">
                  When a room is unwinnable, the cue points at <span className="text-rune">Flee the room</span> instead. Fleeing sends all 4 cards to the bottom of the deck and deals 4 fresh; you can't flee twice in a row.
                </div>
              </div>
            ) : (
              <div className="mb-3 panel p-4 text-[14px] text-slate-400 leading-relaxed">
                <span className="text-rune font-semibold uppercase text-[11px] tracking-[0.2em] mr-2">Tutorial</span>
                Lessons complete. Finish the walk on your own; the next descent is The Quiet.
              </div>
            )
          )}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 justify-items-center">
            {game.room.map((c, i) => {
              let weaponDamage = null
              let bareDamage = null
              let potionPreview = null
              if (c && isMonster(c)) {
                // During the Oath reveal animation, peek the damage of the
                // card that's flipping so the player can see what they're in for.
                const previewCard = (revealing === i && c.faceDown) ? { ...c, faceDown: false } : c
                const preview = previewMonsterDamage(game, previewCard)
                weaponDamage = preview.weapon
                bareDamage = preview.bare
              } else if (c && isPotion(c) && !c.faceDown) {
                potionPreview = describePotion(game, c)
              }
              // The player has already committed once the reveal starts, so
              // suppress the bare-hands alternate to avoid implying a choice.
              const showBare = weaponDamage !== null && !themeIronBones && revealing !== i
              const isRecommended = tutorialActive && tutorialCue && c?.id === tutorialCue.recommendedId && revealing !== i
              const tip = isRecommended && c ? tutorialTipFor(game, c) : null
              const blocked = cueHasTarget && !!c && !isRecommended
              // The recommended action is to swing this monster, so the
              // bare-hands shortcut on the same card is the wrong move.
              const bareBlocked = isRecommended && !!c && isMonster(c) && tutorialCue?.recommendBare === false
              // The recommended action IS the bare-hands button: glow it so
              // the player's eye finds the right click.
              const bareRecommended = isRecommended && !!c && isMonster(c) && tutorialCue?.recommendBare === true
              // The Devourer's printed rank is 3, but its real rank is
              // 3 + the last three kills. Surface that here so the card
              // top-left reflects the threat at a glance.
              const displayRank = c?.boss === 'devourer' ? devourerEffectiveRank(game) : undefined
              return (
                <CardSlot
                  key={i}
                  card={c}
                  reveal={revealing === i}
                  onClick={() => c && onCard(i)}
                  onBareHands={showBare ? () => onCardBare(i) : null}
                  weaponDamage={weaponDamage}
                  bareDamage={bareDamage}
                  potionPreview={potionPreview}
                  recommended={isRecommended}
                  tutorialTip={tip}
                  blocked={blocked}
                  bareBlocked={bareBlocked}
                  bareRecommended={bareRecommended}
                  displayRank={displayRank}
                />
              )
            })}
          </div>

          <div className="mt-4 flex justify-center">
            <div className="group relative">
              {tutorialCue?.recommendFlee && (
                <div
                  className="absolute -top-7 left-1/2 -translate-x-1/2 z-20 text-rune text-2xl animate-bounce pointer-events-none drop-shadow-[0_0_6px_rgba(251,191,36,0.75)]"
                  aria-hidden="true"
                >
                  ▼
                </div>
              )}
              <button
                onClick={onFlee}
                disabled={!game.canFlee || (tutorialActive && tutorialCue?.recommendedId != null)}
                className={`px-6 py-2.5 rounded-md bg-stone-800 hover:bg-stone-700 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium border border-stone-700 transition ${tutorialCue?.recommendFlee ? 'tutorial-recommended' : ''}`}
              >
                Flee the room
              </button>
              {tutorialCue?.recommendFlee && (
                <div
                  className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-30 w-80 panel p-3 text-[13px] leading-relaxed text-slate-200 text-left pointer-events-none shadow-2xl border border-rune/40"
                  role="tooltip"
                >
                  Sends all 4 cards to the bottom of the deck and deals a fresh 4 from the top. No damage. Cooldown after: you must clear a fresh room first.
                </div>
              )}
            </div>
          </div>
        </section>

        <ForesightPanel game={game} />
      </div>
    </div>
  )
}

// -- Theme intro overlay -----------------------------------------------

function ThemeIntroOverlay({ theme, themeChildren, deckChanges, onDismiss }) {
  const childThemes = (themeChildren || []).map(id => getTheme(id)).filter(Boolean)
  if (!theme) return null
  const allAdds = (deckChanges || []).flatMap(c => c.additions)
  const allRemoves = (deckChanges || []).flatMap(c => c.removals)
  const hasDeckChanges = allAdds.length > 0 || allRemoves.length > 0
  return (
    <div
      onClick={onDismiss}
      role="button"
      tabIndex={-1}
      aria-label="Dismiss theme intro"
      className="fixed inset-0 z-40 flex items-center justify-center px-6 bg-dungeon/90 backdrop-blur-md cursor-pointer animate-fade-in"
    >
      <div className="max-w-lg text-center">
        <div className="animate-theme-intro-title">
          <h2 className="font-display text-rune text-4xl sm:text-5xl rune-pulse inline-block px-6 py-3 rounded-lg">
            {theme.name}
          </h2>
        </div>
        <p className="mt-6 text-[15px] sm:text-base text-slate-300 leading-relaxed animate-theme-intro-body">
          {theme.description}
        </p>
        {childThemes.length > 0 && (
          <ul className="mt-5 pt-4 border-t border-stone-800/80 space-y-2 text-left animate-theme-intro-children">
            {childThemes.map(c => (
              <li key={c.id} className="text-[13px] leading-snug">
                <span className="text-rune font-semibold">{c.name}</span>
                <span className="text-slate-400">: {c.description}</span>
              </li>
            ))}
          </ul>
        )}
        {hasDeckChanges && (
          <DeckChangesPreview additions={allAdds} removals={allRemoves} />
        )}
        <div className="mt-8 text-[11px] uppercase tracking-[0.3em] text-slate-500 animate-theme-intro-children">
          Tap anywhere to begin
        </div>
      </div>
    </div>
  )
}

// Shows each card actually added or removed by the descent's theme,
// flipping into view (additions) or fading away with a strike-through
// (removals). Same flip vocabulary as the Oath face-down reveal so the
// language reads consistently as "the deck reshuffles itself".
function DeckChangesPreview({ additions, removals }) {
  // Hold off until the body/children copy has settled.
  const baseDelay = 1.0
  const stagger = 0.18
  return (
    <div
      className="mt-6 pt-4 border-t border-stone-800/80 space-y-4 animate-theme-intro-children"
    >
      {additions.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-[0.3em] text-emerald-400/70 mb-2">
            Added to the deck
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {additions.map((card, i) => (
              <IntroCard
                key={`add-${card.id}-${i}`}
                card={card}
                delay={baseDelay + i * stagger}
              />
            ))}
          </div>
        </div>
      )}
      {removals.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-[0.3em] text-rose-400/70 mb-2">
            Removed from the deck
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {removals.map((card, i) => (
              <IntroCard
                key={`rm-${card.id}-${i}`}
                card={card}
                delay={baseDelay + (additions.length + i) * stagger}
                removed
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function IntroCard({ card, delay, removed }) {
  const red = card.suit === HEART || card.suit === DIAMOND
  const animClass = removed ? 'animate-intro-card-remove' : 'animate-intro-card-enter'
  return (
    <div className="relative w-16 sm:w-[72px]">
      <div
        className={`aspect-[2/3] rounded-md border-2 ${cardBorderTone(card)} bg-gradient-to-b from-parchment to-[#e8d5b3] text-stone-900 p-1.5 flex flex-col text-left shadow-md ${animClass}`}
        style={{ animationDelay: `${delay}s` }}
      >
        <div className={`text-base font-bold leading-none ${red ? 'text-blood' : 'text-stone-900'}`}>
          {rankLabel(card.rank)}{SUIT_GLYPH[card.suit]}
        </div>
        <div className="flex-1 min-h-0 flex items-center justify-center">
          <SuitIcon suit={card.suit} boss={card.boss} className={`w-[60%] h-auto ${suitIconTone(card)}`} />
        </div>
      </div>
      {removed && (
        <div
          className="absolute inset-0 flex items-center justify-center text-blood text-4xl font-bold pointer-events-none animate-intro-card-strike drop-shadow-[0_0_6px_rgba(185,28,28,0.7)]"
          style={{ animationDelay: `${delay + 0.5}s` }}
          aria-hidden="true"
        >
          ✕
        </div>
      )}
    </div>
  )
}

// -- Tutorial cue + tooltip helpers ------------------------------------

// Tutorial: which card in the current room should the player consider
// next? Priority is set so every recommendation is the smart play:
//   1. Equip a weapon if you don't have one
//   2. Replace your weapon when locked monsters block the room
//      AND a new weapon in the room would actually unlock at least one
//   3. Swing at the LARGEST usable monster (binding drops, so spend the
//      weapon's headroom on the biggest target first)
//   4. Sip a potion when hurt (smallest one that fully heals; if none
//      can fully heal, the largest non-overshooting one)
//   5. Bare-hand a lone locked monster you can safely absorb
//   6. Flee if multiple locked monsters remain, or one too big to eat
//   7. Otherwise no recommendation (room is just wind-down plays)
function computeTutorialCue(game) {
  const room = game.room.filter(Boolean)
  if (room.length === 0) return { recommendedId: null, recommendFlee: false }

  const weapon = game.weapon
  const weaponInRoom = room.find(c => isWeapon(c))
  const monsters = room.filter(c => isMonster(c))
  const potions = room.filter(c => isPotion(c))

  const bound = weapon?.lastSlain?.rank
  const usableMonsters = monsters.filter(m => {
    if (!weapon) return false
    if (bound == null) return true
    return m.rank <= bound
  })
  const lockedMonsters = monsters.filter(m => !usableMonsters.includes(m))

  const potionUseful = potions.length > 0
    && game.hp < game.maxHp
    && game.potionsUsedThisRoom === 0

  // Tutorial second bare-hands lesson, hand-curated for the
  // {7♦, 8♠, 10♦} room. The standard priorities would either skip 7♦
  // (too weak to unlock 8♠) or swing 8♠ with a fresh weapon (1 damage,
  // binds at 8 and re-locks the 10♣ waiting in the deck). Force the
  // lesson: take up 7♦, then bare-hand 8♠ to keep that swing fresh
  // for the bigger fight ahead.
  const lessons = game.tutorialLessons || []
  if (game.tutorial
      && lessons.includes('barehands')
      && !lessons.includes('barehands_choice')) {
    const tutD7 = room.find(c => c?.id === 'tut_d7')
    const tutS8 = room.find(c => c?.id === 'tut_s8')
    // Step 1: still wielding the bound weapon, with both pieces in the
    // room. Send the player to 7♦ instead of letting the standard cue
    // walk past it or jump straight to 10♦.
    if (tutD7 && tutS8 && weapon && weapon.lastSlain && weapon.rank !== 7) {
      return { recommendedId: tutD7.id, recommendFlee: false, recommendBare: false }
    }
    // Step 2: 7♦ is gone (picked up), 8♠ remains. Override the case-3
    // "swing 8♠ with fresh weapon" instinct and direct the bare-hand.
    if (tutS8 && weapon && weapon.rank === 7 && !weapon.lastSlain) {
      return { recommendedId: tutS8.id, recommendFlee: false, recommendBare: true }
    }
  }

  // 1. No weapon yet, one is sitting in the room.
  if (!weapon && weaponInRoom) {
    return { recommendedId: weaponInRoom.id, recommendFlee: false }
  }

  // 2. Replace the weapon when a swap would unlock at least one
  // currently-locked monster. A fresh weapon swings at anything until
  // its first kill, so taking it first means we fight the biggest
  // locked enemy at full power.
  if (
    weapon
    && lockedMonsters.length > 0
    && weaponInRoom
    && lockedMonsters.some(m => weaponInRoom.rank >= m.rank)
  ) {
    return { recommendedId: weaponInRoom.id, recommendFlee: false }
  }

  // 3. Swing at the biggest monster the weapon can still reach. After
  // the kill, binding drops to that monster's rank; smaller usable
  // monsters stay usable, while smaller-first would have wasted the
  // weapon's headroom.
  if (usableMonsters.length > 0) {
    const biggest = [...usableMonsters].sort((a, b) => b.rank - a.rank)[0]
    return { recommendedId: biggest.id, recommendFlee: false, recommendBare: false }
  }

  // 4. Heal. Pick the smallest potion that fully covers the missing HP
  // (so nothing spills over the cap). If none does, the largest non-
  // overshooting potion (or just the largest if all overshoot equally).
  if (potionUseful) {
    const need = game.maxHp - game.hp
    const sorted = [...potions].sort((a, b) => a.rank - b.rank)
    const exact = sorted.find(p => p.rank >= need)
    const choice = exact || sorted[sorted.length - 1]
    return { recommendedId: choice.id, recommendFlee: false }
  }

  // 5/6. Only locked monsters left (no usable swing, no useful potion,
  // no helpful weapon in the room). Decide between bare hands and flee.
  if (lockedMonsters.length > 0) {
    const smallestLocked = [...lockedMonsters].sort((a, b) => a.rank - b.rank)[0]
    // Can't flee: must bare-hand the smallest.
    if (!game.canFlee) {
      return { recommendedId: smallestLocked.id, recommendFlee: false, recommendBare: true }
    }
    // Multiple locked monsters, or one too big to safely absorb -> flee.
    const tooBig = smallestLocked.rank > Math.floor(game.hp / 2)
    if (lockedMonsters.length > 1 || tooBig) {
      return { recommendedId: null, recommendFlee: true }
    }
    // One small locked monster, can safely bare-hand it.
    return { recommendedId: smallestLocked.id, recommendFlee: false, recommendBare: true }
  }

  // 7. No strategic move left (e.g., leftover wasted potions, downgrade
  // weapons). Let the player play through without a highlight.
  return { recommendedId: null, recommendFlee: false }
}

// Per-card tutorial tip. Reads current game state so the explanation
// reflects what will actually happen if the player clicks (e.g.
// "locked, take a new weapon" vs "swing, binds at 4").
function tutorialTipFor(game, card) {
  const lessons = game.tutorialLessons || []
  const inBareChoiceSetup = game.tutorial
    && lessons.includes('barehands')
    && !lessons.includes('barehands_choice')
  if (isWeapon(card)) {
    if (!game.weapon) return 'Pick up the weapon. You equip it and can swing at monsters.'
    // Tutorial setup for the second bare-hands lesson: prefer the smaller
    // 7♦ over the optimizer's choice (10♦) so the next lesson stages a
    // strategic bare-hand instead of a clean swing.
    if (inBareChoiceSetup && card.id === 'tut_d7') {
      return "Take up 7♦, not the 10♦. The smaller weapon, but fresh. Resetting the binding matters more than raw rank here; the lesson is the choice that comes next."
    }
    const lockedAhead = game.room.some(c => c && isMonster(c) && c.rank > (game.weapon.lastSlain?.rank ?? Infinity))
    if (lockedAhead) {
      return 'Replace your weapon. The new one is fresh, swings at anything until its first kill, so use it on the biggest locked monster first.'
    }
    return 'Replaces your current weapon with a fresh one (no binding). Usually only worth taking when a monster in the room is locked.'
  }
  if (isPotion(card)) {
    if (game.potionsUsedThisRoom > 0) {
      return 'Wasted. Only the first potion drunk in a room heals; the rest pass through.'
    }
    if (game.hp >= game.maxHp) {
      return "You're already at full HP. Drinking now wastes the potion."
    }
    const need = game.maxHp - game.hp
    const healed = Math.min(card.rank, need)
    const overshoot = card.rank - healed
    if (overshoot > 0) {
      return `Heals ${healed} HP (the other ${overshoot} spills over the cap).`
    }
    return `Heals ${card.rank} HP, exactly back to full. Only the first potion drunk in a room heals; any extras are wasted.`
  }
  if (isMonster(card)) {
    if (!game.weapon) {
      return `No weapon equipped. Bare hands: take the full ${card.rank} damage.`
    }
    const bound = game.weapon.lastSlain?.rank
    if (bound !== undefined && card.rank > bound) {
      return `Your weapon is bound at ${bound}, useless against rank ${card.rank}. Bare hands take the full ${card.rank} damage.`
    }
    // Tutorial: second bare-hands lesson, fired only after the player has
    // followed the cue to pick up 7♦. With the fresh weapon in hand, the
    // raw mechanics permit a swing, but the lesson is the strategic trade.
    if (inBareChoiceSetup && card.id === 'tut_s8' && !game.weapon.lastSlain) {
      return `You always have the option to bare-hand a monster, and take it's full rank in damage instead of using your weapon.`
    }
    const damage = Math.max(0, card.rank - game.weapon.rank)
    return `Swing. Take ${damage} damage (${card.rank} - ${game.weapon.rank}). After the kill the weapon binds at ${card.rank}; only monsters of that rank or lower can be swung at.`
  }
  return null
}

