// Display helpers shared by the admin dashboard and its tables. Pure functions:
// they coerce the string/bigint counts Postgres returns and map game ids to the
// same human names the game itself uses.

import { BOONS } from '../games/scoundrel/boons'
import { getTheme } from '../games/scoundrel/themes'
import { getBoss } from '../games/scoundrel/bosses'
import { INSCRIBED_FRAMES, SUIT_GLYPH, rankLabel, getMode } from '../games/scoundrel/constants'

export const num = v => Number(v || 0)
export const pct = (wins, n) => (num(n) > 0 ? `${Math.round((num(wins) / num(n)) * 100)}%` : '–')

export const boonName = id => BOONS[id]?.name || id
export const themeName = id => getTheme(id)?.name || id
export const frameName = id => INSCRIBED_FRAMES[id]?.name || id
export const modeName = id => getMode(id)?.name || id
export const cardLabel = (suit, rank, boss) =>
  boss ? (getBoss(boss)?.name || boss) : `${rankLabel(num(rank))}${SUIT_GLYPH[suit] || suit || ''}`

export const fmtDuration = (sec) => {
  const s = num(sec)
  if (s <= 0) return '–'
  const m = Math.floor(s / 60)
  return m > 0 ? `${m}m ${s % 60}s` : `${s}s`
}

export const fmtDate = (ms) => {
  const n = num(ms)
  if (n <= 0) return '–'
  const days = Math.floor((Date.now() - n) / 86400000)
  if (days <= 0) return 'today'
  return days === 1 ? '1d ago' : `${days}d ago`
}

// account_id is the auth `sub` for signed-in players; every anonymous player
// collapses into the single 'guest' bucket. Truncate signed-in ids to the
// tail so full auth identifiers don't splash across the table.
export const shortId = (id) => {
  if (id === 'guest') return 'Guests (all anonymous)'
  const tail = id.includes('|') ? id.slice(id.indexOf('|') + 1) : id
  return `…${tail.slice(-8)}`
}
