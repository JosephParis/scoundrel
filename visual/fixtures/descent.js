/**
 * A descent in progress, seeded straight into the save slot.
 *
 * Shared by every spec that needs to be *inside* a run rather than at the menu.
 * Playing into this position would be slow and the room roll is random, so the
 * position is stated rather than reached.
 *
 * Lives here rather than in one spec because two specs now depend on the exact
 * shape: bare-hands-layout.spec.js measures the faces it produces, and
 * itch-build.spec.js needs a phase that has music bound to it. A private copy in
 * each would drift.
 *
 * Storage keys mirror the ones index.jsx owns; keep them in step.
 */
export const SAVE_KEY = 'scoundrel:save'
export const TUTORIAL_KEY = 'scoundrel:tutorialCompleted'
export const LAYOUT_KEY = 'scoundrel:cardLayout'

// A weapon equipped and four monsters in the room, so every slot shows both a
// weapon preview and a bare-hands button.
//
// Slot 0 is a plain monster, which has no rules text and so keeps the classic
// face in both layouts; slots 1-3 carry traits, which do, and so switch to the
// modern face when that layout is selected. Ranks are below the weapon's 9 so
// the weapon stays usable and `weaponDamage` is non-null -- that is the
// condition for the button to appear at all (DescentView: `showBare`).
//
// Deliberately no `armored` monster: armored means weapons do nothing, so
// there is no choice to present and no bare-hands button is drawn.
export const DESCENT = {
  phase: 'descent',
  tutorial: false,
  sigilsEarned: 2,
  sigilTarget: 10,
  hp: 18,
  maxHp: 20,
  mode: 'default',
  ascension: 0,
  boons: [],
  boonOffers: [],
  boonChosen: true,
  kit: [],
  weapon: { rank: 9, originalRank: 9, lastSlain: null },
  spareWeapon: null,
  carriedWeapon: { suit: 'D', rank: 9, originalRank: 9 },
  room: [
    { id: 'm1', suit: 'S', rank: 8 },
    { id: 'm2', suit: 'C', rank: 7, relentless: true },
    { id: 'm3', suit: 'S', rank: 6, vengeful: true },
    { id: 'm4', suit: 'C', rank: 5, swelling: true },
  ],
  deck: [{ id: 'd1', suit: 'S', rank: 4 }, { id: 'd2', suit: 'C', rank: 3 }],
  discard: [],
  theme: null,
  themeChildren: [],
  themeDeckChanges: [],
  themesFaced: [],
  afflictions: {},
  potionsUsedThisRoom: 0,
  monstersFoughtThisRoom: 0,
  lastMonsterSuit: null,
  roomsEntered: 3,
  canFlee: true,
  vengefulBonus: 0,
  riposteCharge: 0,
  secondWindUsed: false,
  cloakUsed: false,
  cloakArmed: false,
  twinSoulsUsed: false,
  cowardsRewardCharge: 0,
  numbRemaining: 0,
  woundsAddedThisDescent: 0,
  pendingCursedHeal: 0,
  mapPeek: null,
  lastKilledMonsterRanks: [],
  forgeOpen: false,
  forgeGrants: [],
  forgeGrantIndex: 0,
  forgeChoices: [],
  descents: [{
    descent: 3, themes: [], startHp: 20, maxHp: 20,
    endHp: null, roomsEntered: 3, sigilEarned: false, outcome: null,
  }],
  bossesDefeated: [],
  log: ['The hall narrows.'],
}
