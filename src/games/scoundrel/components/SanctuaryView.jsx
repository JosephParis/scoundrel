import { useEffect, useState } from 'react'
import {
  descend, pickBoon, setRunMode, setRunAscension,
  applyForgeEdit, skipForgeEdit, forgeActive,
  isEnabled,
} from '../logic'
import { PhaseRail, LogPanel, DescendAction } from './atoms'
import { BoonOfferPanel, RunStatePanel, DeckPeekButton, DeckModal, LoadoutPanel } from './boons'
import { EditOfferPanel } from './forge'
import { RulesInlinePanel, TutorialIntroPanel } from './rules'
import { ModePickerPanel, ModeBadge } from './modes'
import { LibraryPanel } from './library'
import { AscensionPickerPanel, AscensionBadge } from './ascensions'
import { audio } from '../audio'

export function SanctuaryView({ game, setGame, onSkipTutorial, ascensionUnlocked = 0, celebrateSigil = false, onSigilCelebrated }) {
  const isOpeningVisit = game.sigilsEarned === 0
  const needsBoon = !isOpeningVisit && !game.boonChosen && game.boonOffers.length > 0
  // Sequence is boon → forge edits → descend. The Forge grants a batch of edits
  // worked one at a time; descend appears once the batch is done (or none).
  const forgeWaiting = game.forgeOpen && (game.forgeGrants || []).length > 0
  const showForge = !needsBoon && forgeActive(game)
  const showDescend = !needsBoon && !showForge
  const [deckOpen, setDeckOpen] = useState(false)

  useEffect(() => {
    if (!deckOpen) return
    const onKey = (e) => { if (e.key === 'Escape') setDeckOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [deckOpen])

  // Exactly one panel renders in the action slot (or none, when the
  // player is idle and ready to descend).
  let actionSlot = null
  if (game.tutorial) {
    actionSlot = (
      <>
        <TutorialIntroPanel />
        <RulesInlinePanel />
      </>
    )
  } else if (isOpeningVisit) {
    // Ascension picker takes the rules' slot once the player has unlocked
    // the ladder. The "how to play" panel is for new players; once they've
    // beaten a run, they don't need it staring back at them.
    const showAscensionPicker = ascensionUnlocked > 0 && isEnabled('ascensions')
    actionSlot = (
      <>
        <ModePickerPanel
          currentMode={game.mode}
          onSelect={(id) => { audio.sfx('cardFlip'); setGame(g => setRunMode(g, id)) }}
        />
        {showAscensionPicker && (
          <AscensionPickerPanel
            currentLevel={game.ascension || 0}
            ceiling={ascensionUnlocked}
            onSelect={(level) => { audio.sfx('cardFlip'); setGame(g => setRunAscension(g, level)) }}
          />
        )}
        {!showAscensionPicker && <RulesInlinePanel />}
      </>
    )
  } else if (needsBoon) {
    actionSlot = (
      <BoonOfferPanel
        offers={game.boonOffers}
        onPick={(id) => { audio.sfx('boon'); setGame(g => pickBoon(g, id)) }}
        forgeAfter={forgeWaiting}
      />
    )
  } else if (showForge) {
    actionSlot = (
      <EditOfferPanel
        key={game.forgeGrantIndex}
        game={game}
        onPick={(cardId) => { audio.sfx('forge'); setGame(g => applyForgeEdit(g, cardId)) }}
        onSkip={() => { audio.sfx('cardFlip'); setGame(g => skipForgeEdit(g)) }}
      />
    )
  } else {
    actionSlot = <LoadoutPanel game={game} />
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-[300px_minmax(0,1fr)] gap-6 animate-fade-in items-start">
      <PhaseRail
        title="Sanctuary"
        subtitle={isOpeningVisit
          ? 'You wake in a quiet chamber. The only way out leads down.'
          : 'The chamber is still. Below, the dark waits.'}
        sigilsEarned={game.sigilsEarned}
        sigilTarget={game.sigilTarget}
        celebrateSigil={celebrateSigil}
        onSigilCelebrated={onSigilCelebrated}
      >
        <div className="panel p-3">
          <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">Lifeblood</div>
          <div className="font-mono text-parchment text-base">
            {game.maxHp}<span className="text-slate-500 text-sm">/{game.maxHp}</span>
            <span className="ml-2 text-[10px] uppercase tracking-widest text-rune/70">Rested</span>
          </div>
        </div>
        <AscensionBadge level={game.ascension} />
        <ModeBadge modeId={game.mode} />
        <RunStatePanel game={game} />
        <LibraryPanel unlockedBoons={game.unlockedBoons} />
        <DeckPeekButton game={game} onClick={() => setDeckOpen(true)} />
        <LogPanel lines={game.log} collapsible />
      </PhaseRail>

      <DeckModal open={deckOpen} onClose={() => setDeckOpen(false)} game={game} />

      <div className="space-y-5 min-w-0">
        {actionSlot}

        {showDescend && (
          <div className="relative">
            <DescendAction
              onDescend={() => { audio.sfx('descend'); setGame(g => descend(g)) }}
              disabled={false}
              reason={null}
            />
            {game.tutorial && onSkipTutorial && (
              <button
                onClick={onSkipTutorial}
                className="absolute right-0 bottom-0 px-4 py-2 rounded-md border border-stone-700 hover:border-stone-500 text-slate-400 hover:text-slate-200 text-sm font-medium transition"
              >
                Skip tutorial
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
