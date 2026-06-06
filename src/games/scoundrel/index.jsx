import { useCallback, useEffect, useRef, useState } from 'react'
import { createRun, retireRun, STARTER_BOON_IDS, UNLOCKABLE_BOON_IDS, ASCENSION_MAX } from './logic'
import { TopBar, RetireModal, TutorialReplayModal } from './components/TopBar'
import { CreditsModal, DevModal } from './components/modals'
import { CardLibraryModal } from './components/cardLibrary'
import { RulesModal } from './components/rules'
import { SanctuaryView } from './components/SanctuaryView'
import { DescentView } from './components/DescentView'
import { OutcomeView } from './components/OutcomeView'
import { LoginModal } from './components/LoginModal'
import { loadUser, signOut as signOutUser } from '../../utils/auth'

// -- Save / load -------------------------------------------------------
// Bump SAVE_VERSION whenever the shape of game state in logic.js changes
// in a way that would break older saves. Old data is discarded silently.
const SAVE_KEY = 'scoundrel:save'
const SAVE_VERSION = 1
const TUTORIAL_KEY = 'scoundrel:tutorialCompleted'
const LIBRARY_KEY = 'scoundrel:boonLibrary'
const ASCENSION_KEY = 'scoundrel:ascensionUnlocked'

// Highest ascension level the player has unlocked. 0 = only the base game is
// playable; winning at level N raises this to N+1. The picker shows levels
// 0..ascensionUnlocked and is hidden entirely while still at 0.
function loadAscensionUnlocked() {
  try {
    const raw = localStorage.getItem(ASCENSION_KEY)
    if (!raw) return 0
    const n = Number.parseInt(raw, 10)
    if (!Number.isFinite(n) || n < 0) return 0
    return Math.min(n, ASCENSION_MAX)
  } catch {
    return 0
  }
}

function saveAscensionUnlocked(level) {
  try {
    localStorage.setItem(ASCENSION_KEY, String(level))
  } catch {
    // ignore
  }
}

// Persists Boon discoveries across runs. Stored separately from the run
// save so retiring/dying/wiping the save preserves the library. Filtered
// against UNLOCKABLE_BOON_IDS on read so a previously-unlocked Boon that
// got disabled stops appearing without corrupting the file.
function loadLibrary() {
  try {
    const raw = localStorage.getItem(LIBRARY_KEY)
    if (!raw) return STARTER_BOON_IDS.slice()
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return STARTER_BOON_IDS.slice()
    const valid = parsed.filter(id => UNLOCKABLE_BOON_IDS.includes(id))
    // Guarantee the starter set is always present, even if an older library
    // file omits one.
    const merged = Array.from(new Set([...STARTER_BOON_IDS, ...valid]))
    return merged
  } catch {
    return STARTER_BOON_IDS.slice()
  }
}

function saveLibrary(unlockedBoons) {
  try {
    localStorage.setItem(LIBRARY_KEY, JSON.stringify(unlockedBoons || []))
  } catch {
    // ignore
  }
}

function loadSavedGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || parsed.version !== SAVE_VERSION || !parsed.state) return null
    const state = { ...parsed.state, rng: Math.random }
    // Backfill fields added after this save was written so older runs do
    // not load with undefined state. Mode is read via getMode() with its
    // own fallback; unlockedBoons is read directly by UI so it needs one
    // explicit assignment here.
    if (!Array.isArray(state.unlockedBoons)) {
      state.unlockedBoons = loadLibrary()
    }
    return state
  } catch {
    return null
  }
}

function saveGame(state) {
  try {
    const { rng: _rng, ...serializable } = state
    localStorage.setItem(SAVE_KEY, JSON.stringify({ version: SAVE_VERSION, state: serializable }))
  } catch {
    // Quota exceeded or storage disabled. Silently skip.
  }
}

// Tutorial completion is tracked separately from save state so it
// persists across "begin again" presses and survives a save wipe.
function tutorialAlreadyCompleted() {
  try {
    return localStorage.getItem(TUTORIAL_KEY) === 'true'
  } catch {
    return false
  }
}

function markTutorialCompleted() {
  try {
    localStorage.setItem(TUTORIAL_KEY, 'true')
  } catch {
    // ignore
  }
}

// Wraps createRun so the tutorial flag is decided once, based on
// whether the player has finished it before. Seeds the new run's Boon
// library from localStorage so unlocks persist across runs. Ascension
// starts at 0 each run; the player picks on the opening visit.
function freshRun() {
  return createRun(Math.random, {
    tutorial: !tutorialAlreadyCompleted(),
    unlockedBoons: loadLibrary(),
    ascension: 0,
  })
}

// -- Root --------------------------------------------------------------

export default function Scoundrel() {
  const [game, setGame] = useState(() => loadSavedGame() || freshRun())
  const [user, setUser] = useState(() => loadUser())
  const [ascensionUnlocked, setAscensionUnlocked] = useState(() => loadAscensionUnlocked())
  const [rulesOpen, setRulesOpen] = useState(false)
  const [retireOpen, setRetireOpen] = useState(false)
  const [creditsOpen, setCreditsOpen] = useState(false)
  const [devOpen, setDevOpen] = useState(false)
  const [tutorialReplayOpen, setTutorialReplayOpen] = useState(false)
  const [loginOpen, setLoginOpen] = useState(false)
  const [cardLibraryOpen, setCardLibraryOpen] = useState(false)

  const handleLogin = useCallback((u) => {
    setUser(u)
    setLoginOpen(false)
  }, [])

  const handleSignOut = useCallback(() => {
    signOutUser(() => setUser(null))
  }, [])

  useEffect(() => {
    saveGame(game)
  }, [game])

  // Persist the Boon library on every change so unlocks survive even if
  // the run save is wiped (death, retire, "begin again").
  useEffect(() => {
    if (game.unlockedBoons) saveLibrary(game.unlockedBoons)
  }, [game.unlockedBoons])

  // On victory, raise the unlocked ceiling so the next level becomes
  // pickable. Winning at level N exposes level N+1 (capped at the max).
  // Partial wins at lower levels do not push the ladder backward.
  useEffect(() => {
    if (game.phase !== 'victory') return
    const cleared = game.ascension || 0
    const newUnlocked = Math.min(cleared + 1, ASCENSION_MAX)
    if (newUnlocked > ascensionUnlocked) {
      setAscensionUnlocked(newUnlocked)
      saveAscensionUnlocked(newUnlocked)
    }
  }, [game.phase, game.ascension, ascensionUnlocked])

  // Mark the tutorial as completed when the player finishes the
  // curated descent (tutorial flag flips off via endDescentVictory and
  // they land in sanctuary). Death during tutorial leaves the flag on
  // and phase=gameover, so it won't fire there.
  const wasTutorialRef = useRef(game.tutorial)
  useEffect(() => {
    if (wasTutorialRef.current && !game.tutorial && game.phase === 'sanctuary') {
      markTutorialCompleted()
    }
    wasTutorialRef.current = game.tutorial
  }, [game.tutorial, game.phase])

  useEffect(() => {
    const anyOpen = rulesOpen || retireOpen || creditsOpen || devOpen || tutorialReplayOpen || loginOpen || cardLibraryOpen
    if (!anyOpen) return
    const onKey = (e) => {
      if (e.key !== 'Escape') return
      if (devOpen) setDevOpen(false)
      else if (creditsOpen) setCreditsOpen(false)
      else if (cardLibraryOpen) setCardLibraryOpen(false)
      else if (retireOpen) setRetireOpen(false)
      else if (tutorialReplayOpen) setTutorialReplayOpen(false)
      else if (loginOpen) setLoginOpen(false)
      else if (rulesOpen) setRulesOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [rulesOpen, retireOpen, creditsOpen, devOpen, tutorialReplayOpen, loginOpen, cardLibraryOpen])

  const confirmReplayTutorial = () => {
    setGame(createRun(Math.random, { tutorial: true, unlockedBoons: loadLibrary() }))
    setTutorialReplayOpen(false)
  }

  // Skip the tutorial from the sanctuary intro panel. Marks it
  // completed so future "begin again" presses also skip, then drops
  // the player into a real opening run (The Quiet).
  const skipTutorial = () => {
    markTutorialCompleted()
    setGame(createRun(Math.random, { tutorial: false, unlockedBoons: loadLibrary() }))
  }

  const confirmRetire = () => {
    setGame(g => retireRun(g))
    setRetireOpen(false)
  }

  return (
    <div className="min-h-screen text-parchment flex flex-col items-center">
      <TopBar
        game={game}
        user={user}
        onOpenRules={() => setRulesOpen(true)}
        onRetire={() => setRetireOpen(true)}
        onOpenCredits={() => setCreditsOpen(true)}
        onOpenDev={() => setDevOpen(true)}
        onReplayTutorial={() => setTutorialReplayOpen(true)}
        onOpenLogin={() => setLoginOpen(true)}
        onSignOut={handleSignOut}
        onOpenCardLibrary={() => setCardLibraryOpen(true)}
      />
      <RulesModal open={rulesOpen} onClose={() => setRulesOpen(false)} />
      <RetireModal
        open={retireOpen}
        sigilsEarned={game.sigilsEarned}
        sigilTarget={game.sigilTarget}
        onConfirm={confirmRetire}
        onCancel={() => setRetireOpen(false)}
      />
      <CreditsModal open={creditsOpen} onClose={() => setCreditsOpen(false)} />
      <CardLibraryModal open={cardLibraryOpen} onClose={() => setCardLibraryOpen(false)} />
      <DevModal open={devOpen} onClose={() => setDevOpen(false)} game={game} setGame={setGame} />
      <TutorialReplayModal
        open={tutorialReplayOpen}
        onConfirm={confirmReplayTutorial}
        onCancel={() => setTutorialReplayOpen(false)}
      />
      <LoginModal
        open={loginOpen}
        onLogin={handleLogin}
        onClose={() => setLoginOpen(false)}
      />
      <main className="flex-1 w-full max-w-7xl px-4 sm:px-6 pt-16 sm:pt-20 pb-8">
        {game.phase === 'sanctuary' && <SanctuaryView game={game} setGame={setGame} onSkipTutorial={skipTutorial} ascensionUnlocked={ascensionUnlocked} />}
        {game.phase === 'descent' && <DescentView game={game} setGame={setGame} />}
        {(game.phase === 'gameover' || game.phase === 'victory') && (
          <OutcomeView game={game} onBeginAgain={() => setGame(freshRun())} />
        )}
      </main>
    </div>
  )
}
