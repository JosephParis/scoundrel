/**
 * The devices and screens Sigil has to fit, as plain data.
 *
 * Shared by the guard (visual/mobile-no-scroll.spec.js) and the device lab
 * (visual/lab/index.html, served at /lab in dev), so the thing you look at by
 * eye and the thing CI enforces are the same list. A private copy in each is
 * how a lab quietly stops covering the case that actually breaks.
 *
 * Deliberately serializable -- no locators, no functions. The spec attaches its
 * own readiness locators by id; the lab writes `storage` straight into
 * localStorage, which it can do because it is served same-origin with the app.
 */
import { DESCENT, SAVE_KEY, TUTORIAL_KEY } from './descent.js'

export const HANDLE_KEY = 'scoundrel:leaderboardHandle'
export { SAVE_KEY, TUTORIAL_KEY }

/**
 * Usable viewport heights, not screen heights. That distinction is the whole
 * point: an earlier guard tested 375x667 and passed while a real iPhone SE
 * still scrolled, because Safari's address bar and toolbar take ~114px and the
 * page only ever gets 553 of it. Testing the screen size measures a device
 * nobody is holding.
 *
 * Values are the toolbars-showing state, which is what you land on. Once you
 * scroll they collapse and you get more -- but needing to scroll to earn the
 * room not to scroll is exactly the bug.
 */
export const VIEWPORTS = [
  { id: 'se-safari', name: 'iPhone SE · Safari', width: 375, height: 553, note: 'toolbars showing' },
  { id: 'android-chrome', name: 'Android · Chrome', width: 360, height: 650, note: 'toolbars showing' },
  { id: 'ip14-safari', name: 'iPhone 12-14 · Safari', width: 390, height: 754, note: 'toolbars showing' },
  { id: 'ip15-safari', name: 'iPhone 15 Pro · Safari', width: 393, height: 762, note: 'toolbars showing' },
  // Installed to the home screen there is no chrome at all, so the full screen
  // is usable. Kept so the no-chrome case cannot regress unnoticed.
  { id: 'se-installed', name: 'iPhone SE · installed', width: 375, height: 667, note: 'no browser chrome' },
]

// The demanding kit: five cards across four suits, so the ending-kit fan draws
// four rows rather than the two a small kit would. A guard set against an easy
// fixture is not a guard.
const KIT = [
  { id: 'k1', suit: 'D', rank: 7 },
  { id: 'k2', suit: 'H', rank: 5 },
  { id: 'k3', suit: 'C', rank: 9 },
  { id: 'k4', suit: 'S', rank: 11 },
  { id: 'k5', suit: 'C', rank: 4 },
]

function outcomeState(phase) {
  return {
    phase,
    sigilsEarned: phase === 'victory' ? 10 : 3,
    sigilTarget: 10,
    mode: 'default',
    ascension: 0,
    boons: ['vanguard'],
    kit: KIT,
    themesFaced: ['the_quiet'],
    bossesDefeated: [],
    runRoomsEntered: 9,
    monstersSlain: 14,
    biggestKill: 11,
    weapon: { rank: 7, originalRank: 7 },
    carriedWeapon: phase === 'victory' ? { rank: 7, originalRank: 7 } : null,
    retired: false,
    runStartedAt: Date.now() - 540000,
    log: ['A heavy blow lands in the dark.'],
  }
}

const save = state => JSON.stringify({ version: 1, state })

/**
 * Screens a player lands on with no interaction, each seeded straight into the
 * save slot. `storage: null` means clear everything -- a genuine first visit.
 *
 * The anonymous victory is listed separately from the named one because it
 * carries an extra paragraph, the leaderboard nudge, and so is the tallest
 * state the outcome screen has.
 */
export const SCREENS = [
  { id: 'tutorial', name: 'Tutorial (first visit)', storage: null },
  {
    id: 'sanctuary-pre',
    name: 'Sanctuary (pre-run)',
    storage: { [TUTORIAL_KEY]: 'true', [HANDLE_KEY]: '' },
  },
  {
    id: 'sanctuary-mid',
    name: 'Sanctuary (mid-run)',
    storage: {
      [TUTORIAL_KEY]: 'true',
      [HANDLE_KEY]: '',
      [SAVE_KEY]: save({ ...DESCENT, phase: 'sanctuary', room: [] }),
    },
  },
  {
    id: 'descent',
    name: 'Descent',
    storage: { [TUTORIAL_KEY]: 'true', [HANDLE_KEY]: '', [SAVE_KEY]: save(DESCENT) },
  },
  {
    id: 'victory-anon',
    name: 'Victory (anonymous)',
    storage: { [TUTORIAL_KEY]: 'true', [HANDLE_KEY]: '', [SAVE_KEY]: save(outcomeState('victory')) },
  },
  {
    id: 'victory-named',
    name: 'Victory (named)',
    storage: { [TUTORIAL_KEY]: 'true', [HANDLE_KEY]: 'Rookwarden', [SAVE_KEY]: save(outcomeState('victory')) },
  },
  {
    id: 'death',
    name: 'Death',
    storage: { [TUTORIAL_KEY]: 'true', [HANDLE_KEY]: '', [SAVE_KEY]: save(outcomeState('gameover')) },
  },
]
