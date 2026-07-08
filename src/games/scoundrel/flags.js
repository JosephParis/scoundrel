// Local feature flags. Per-device toggles for shipping or hiding optional
// systems without rebuilding. Persisted via localStorage; URL params take
// precedence so a `?flag-wounds=0` link reproduces a specific config.
//
// To add a flag:
//   1. Add an entry to DEFAULTS with its default value.
//   2. Add a matching entry to FLAG_META for the dev panel.
//   3. Guard the feature in code with `isEnabled('your-flag')`.
//
// Flags read at module load and on every isEnabled() call. Logic functions
// that need a stable view within a single setGame() can call isEnabled()
// once and pass the result down.

const STORAGE_KEY = 'scoundrel:flags'

const DEFAULTS = {
  modes: false,
  library: false,
  ascensions: false,
  wounds: false,
  customCards: true,
  bosses: false,
  specialMonsters: false,
}

export const FLAG_IDS = Object.keys(DEFAULTS)

export const FLAG_META = {
  modes: {
    name: 'Run modes',
    description: 'Hardcore and Quiet Run appear in the opening picker. Off: every run plays default rules.',
  },
  library: {
    name: 'Boon library',
    description: 'Boons start locked and unlock through play. Off: every Boon is available from run 1.',
  },
  ascensions: {
    name: 'Ascensions',
    description: 'Difficulty ladder unlocked by winning. Off: all runs play at A0.',
  },
  wounds: {
    name: 'Wound cards',
    description: 'Heavy hits add a Wound to the deck. Off: no Wounds appear.',
  },
  customCards: {
    name: 'Custom cards (Inscribe)',
    description: "Inscribe's menu gains the special tool frames (Lucky Coin, Skeleton Key, and the like). Off: Inscribe offers only plain weapons and potions.",
  },
  bosses: {
    name: 'Bosses',
    description: 'One random boss (The Hollow One, The Brood, The Devourer, The Mimic, or The Warden) is shuffled into every descent deck. Off: every monster is a plain card.',
  },
  specialMonsters: {
    name: 'Special monsters (experimental)',
    description: 'Trials that give monsters traits (armored, relentless, cursed, and the like) enter rotation. Off: those Trials never roll, and the dungeon draws only from the settled pool.',
  },
}

let cached = null

function readStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return {}
    return parsed
  } catch {
    return {}
  }
}

// URL params: `?flag-<id>=1|0|true|false`. Empty value treated as enabled
// so `?flag-wounds` alone turns wounds on. Unknown flag ids are ignored.
function readUrl() {
  try {
    if (typeof window === 'undefined') return {}
    const params = new URLSearchParams(window.location.search)
    const overrides = {}
    for (const [key, value] of params.entries()) {
      if (!key.startsWith('flag-')) continue
      const flag = key.slice(5)
      if (!(flag in DEFAULTS)) continue
      const v = value.toLowerCase()
      overrides[flag] = v === '' || v === '1' || v === 'true' || v === 'yes' || v === 'on'
    }
    return overrides
  } catch {
    return {}
  }
}

function compute() {
  return { ...DEFAULTS, ...readStorage(), ...readUrl() }
}

export function getFlags() {
  if (!cached) cached = compute()
  return { ...cached }
}

export function isEnabled(flagId) {
  return !!getFlags()[flagId]
}

export function setFlag(flagId, enabled) {
  if (!(flagId in DEFAULTS)) return
  const current = readStorage()
  current[flagId] = !!enabled
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current))
  } catch {
    // ignore storage failures (quota, disabled)
  }
  cached = null
}

export function resetAllFlags() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
  cached = null
}

export function getFlagDefault(flagId) {
  return !!DEFAULTS[flagId]
}
