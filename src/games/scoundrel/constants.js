export const HEART = 'H'
export const DIAMOND = 'D'
export const CLUB = 'C'
export const SPADE = 'S'
// Wounds aren't a real playing-card suit, but reusing the suit slot keeps
// every card carrying the same shape. Nothing in the codebase treats 'W' as
// a monster, weapon, or potion; isWound() is the explicit gate.
export const WOUND = 'W'
// Skeleton Key: inscribed-only card with no natural suit fit. Same shape
// trick as wounds. isSkeletonKey() is the explicit gate.
export const KEY = 'K'
// Map: another inscribed-only tool card. Same trick as KEY: a synthetic
// suit so the deck fan can group it separately from the other tools.
export const MAP = 'M'
// Whetstone: same tool-suit pattern. A separate synthetic suit so the
// deck fan keeps it out of the real-weapon (DIAMOND) row.
export const STONE = 'O'
// Torch: a trigger-on-draw tool, same synthetic-suit pattern as KEY/MAP/STONE.
// isTorch() is the explicit gate.
export const TORCH = 'T'

export const SUIT_GLYPH = { H: '♥', D: '♦', C: '♣', S: '♠', W: '✕', K: '⚷', M: '⌖', O: '◈', T: '✦' }
export const RANK_LABEL = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' }

export const BASE_MAX_HP = 20
export const SIGIL_TARGET = 10
export const ROOM_SIZE = 4

// Run modes. Each mode is a small bundle of flags applied at the run loop's
// edges (sanctuary visit, theme pick). Default leaves the game unchanged.
// Hardcore strips boon offers and the forge for a pure deck-only run.
// Quiet Run locks every descent to The Quiet, flattening all dungeon shifts.
export const MODES = {
  default: {
    id: 'default',
    name: 'Default',
    description: 'The full game. Boons, Forge, escalating themes.',
    noBoons: false,
    noForge: false,
    lockTheme: null,
  },
  hardcore: {
    id: 'hardcore',
    name: 'Hardcore',
    description: 'No Boons, no Forge. Just the deck and your hands.',
    noBoons: true,
    noForge: true,
    lockTheme: null,
  },
  quiet: {
    id: 'quiet',
    name: 'Quiet Run',
    description: 'Every descent is The Quiet. The dungeon stays asleep.',
    noBoons: false,
    noForge: false,
    lockTheme: 'the_quiet',
  },
}

export const DEFAULT_MODE = 'default'

export function getMode(id) {
  return MODES[id] || MODES[DEFAULT_MODE]
}

export function isMonster(c) { return !!c && (c.suit === CLUB || c.suit === SPADE) }
export function isWeapon(c) { return !!c && c.suit === DIAMOND }
export function isPotion(c) { return !!c && c.suit === HEART }
export function isWound(c) { return !!c && c.suit === WOUND }
// A kit card is anything the player owns and carries: weapons, potions, and the
// neutral tool cards (Skeleton Key, Map, Whetstone). Wounds are descent-transient
// and never belong to the persisted kit, so they are excluded explicitly.
export function isKitCard(c) { return !!c && !isMonster(c) && !isWound(c) }
export function isSkeletonKey(c) { return !!c && c.suit === KEY }
export function isMap(c) { return !!c && c.suit === MAP }
export function isWhetstone(c) { return !!c && c.suit === STONE }
export function isTorch(c) { return !!c && c.suit === TORCH }
export function rankLabel(r) { return RANK_LABEL[r] ?? String(r) }
export function suitColor(suit) {
  if (suit === WOUND) return 'wound'
  if (suit === KEY) return 'key'
  if (suit === MAP) return 'map'
  if (suit === STONE) return 'stone'
  if (suit === TORCH) return 'torch'
  return (suit === HEART || suit === DIAMOND) ? 'red' : 'black'
}

// How many cards a Map reveals from the top of the deck.
export const MAP_PEEK_COUNT = 4

// Heavy hits leave a Wound: a dead card that clogs the deck and rooms for
// the rest of the descent. Threshold is the actual HP loss after Numb /
// Riposte; cap stops late-game spirals where one bad room hands you five
// wounds in a row.
export const WOUND_DAMAGE_THRESHOLD = 5
export const WOUND_CAP_PER_DESCENT = 3

let woundCounter = 0
export function makeWoundCard() {
  woundCounter += 1
  return {
    suit: WOUND,
    rank: 0,
    id: `wound_${woundCounter}_${Date.now().toString(36)}`,
    kind: 'wound',
  }
}

// A plain kit card (weapon or potion) added to the kit via the Inscribe
// verb's "add a tool" option. Needs a fresh unique id because the kit may
// already hold a card of the same suit and rank (e.g. a second D6).
let kitCounter = 0
export function makeKitCard(suit, rank) {
  kitCounter += 1
  return { suit, rank, id: `kit_${suit}${rank}_${kitCounter}_${Date.now().toString(36)}` }
}

// A sampled monster card for the dungeon's per-descent monster set. Needs a
// fresh unique id because composition sampling can produce duplicate ranks.
let monsterCounter = 0
export function makeMonsterCard(suit, rank) {
  monsterCounter += 1
  return { suit, rank, id: `mon_${suit}${rank}_${monsterCounter}_${Date.now().toString(36)}` }
}

// Inscribed cards: player-authored tools added via the Inscribe verb. Each
// frame is one template; the player picks a rank within the frame's range, and
// the card is added to the kit (state.kit) and shuffled into the deck each
// descent. `playEffect` is read by combat handlers.
export const INSCRIBED_FRAMES = {
  lucky_coin: {
    id: 'lucky_coin',
    name: 'Lucky Coin',
    description: 'A heart that heals its rank, then refills the room with one extra card.',
    suit: HEART,
    rankMin: 3,
    rankMax: 6,
    playEffect: 'extraRefill',
  },
  cursed_idol: {
    id: 'cursed_idol',
    name: 'Cursed Idol',
    description: 'A spade that hits you for its rank. The next monster you kill heals you for the idol\'s rank.',
    suit: SPADE,
    rankMin: 2,
    rankMax: 5,
    playEffect: 'pendingHeal',
  },
  skeleton_key: {
    id: 'skeleton_key',
    name: 'Skeleton Key',
    description: 'When drawn, discards every other card in the room and refills. One per run.',
    suit: KEY,
    rankMin: 0,
    rankMax: 0,
    playEffect: 'roomSkip',
    oncePerRun: true,
  },
  map: {
    id: 'map',
    name: 'Map',
    description: `When drawn, reveals the next ${MAP_PEEK_COUNT} cards of the deck, then discards.`,
    suit: MAP,
    rankMin: 0,
    rankMax: 0,
    playEffect: 'peek',
  },
  potion_of_strength: {
    id: 'potion_of_strength',
    name: 'Potion of Strength',
    description: 'A heart that does not heal. Adds its rank to your weapon strength for the rest of the descent.',
    suit: HEART,
    rankMin: 2,
    rankMax: 4,
    playEffect: 'strength',
  },
  vampiric_edge: {
    id: 'vampiric_edge',
    name: 'Vampiric Edge',
    description: 'A weapon. Each monster you strike with it restores 2 HP. Bare-handed kills do not heal.',
    suit: DIAMOND,
    rankMin: 2,
    rankMax: 8,
    playEffect: 'lifesteal',
  },
  wildedge: {
    id: 'wildedge',
    name: "Gambler's Flail",
    description: 'A weapon whose strike value rerolls to a random 2 to 10 after every swing against a monster.',
    suit: DIAMOND,
    rankMin: 2,
    rankMax: 8,
    playEffect: 'reroll',
  },
  brittle_fang: {
    id: 'brittle_fang',
    name: 'Brittle Fang',
    description: 'The ace of diamonds. Strikes at rank 14, then shatters after a single kill.',
    suit: DIAMOND,
    rankMin: 14,
    rankMax: 14,
    playEffect: 'shatterAfterKill',
  },
  panacea: {
    id: 'panacea',
    name: 'Elixir of Life',
    description: 'When drunk, restores HP to full. One per run.',
    suit: HEART,
    rankMin: 0,
    rankMax: 0,
    playEffect: 'fullHeal',
    oncePerRun: true,
  },
  draught_of_vigor: {
    id: 'draught_of_vigor',
    name: 'Draught of Vigor',
    description: 'Heals its rank and raises max HP by 2 for the rest of the descent.',
    suit: HEART,
    rankMin: 2,
    rankMax: 6,
    playEffect: 'vigor',
  },
  torch: {
    id: 'torch',
    name: 'Torch',
    description: 'When drawn, burns the strongest non-boss monster out of the room without a fight, then discards.',
    suit: TORCH,
    rankMin: 0,
    rankMax: 0,
    playEffect: 'burn',
  },
  whetstone: {
    id: 'whetstone',
    name: 'Whetstone',
    description: 'When drawn, clears the binding on your weapon and your spare. Any monster is fair game again.',
    suit: STONE,
    rankMin: 0,
    rankMax: 0,
    playEffect: 'sharpen',
  },
}

export const INSCRIBED_FRAME_IDS = Object.keys(INSCRIBED_FRAMES)

// Monster traits: per-monster modifiers that certain themes stamp onto a
// fraction of the descent deck. Each shows as a corner symbol on the card and
// is catalogued in the card library so the symbol is legible. The per-theme
// odds live on the theme, not here.
export const TRAITS = {
  armored: {
    id: 'armored',
    name: 'Armored',
    description: 'Weapons do nothing against it. You must fight it bare-handed.',
  },
  warded: {
    id: 'warded',
    name: 'Warded',
    description: 'You cannot flee a room while a warded monster is present.',
  },
  relentless: {
    id: 'relentless',
    name: 'Relentless',
    description: 'It strikes twice, dealing its damage a second time.',
  },
  shrouded: {
    id: 'shrouded',
    name: 'Shrouded',
    description: 'It sits face-down. You fight it without seeing its rank.',
  },
  vengeful: {
    id: 'vengeful',
    name: 'Vengeful',
    description: 'When it dies, every other monster in the room hits at +1 for the rest of the room.',
  },
  swelling: {
    id: 'swelling',
    name: 'Swelling',
    description: 'It hits at +1 for every monster already slain in the room.',
  },
  cursed: {
    id: 'cursed',
    name: 'Cursed',
    description: 'When you slay it, it leaves an affliction on you for a few rooms.',
  },
}

export const TRAIT_IDS = Object.keys(TRAITS)

let inscribedCounter = 0
export function makeInscribedCard(frameId, rank) {
  const frame = INSCRIBED_FRAMES[frameId]
  if (!frame) return null
  inscribedCounter += 1
  const r = Math.max(frame.rankMin, Math.min(frame.rankMax, rank | 0))
  return {
    suit: frame.suit,
    rank: r,
    id: `inscribed_${frameId}_${inscribedCounter}_${Date.now().toString(36)}`,
    inscribed: frameId,
  }
}
