// Afflictions: temporary negative status effects the player can carry mid-
// descent. Each holds a rooms-remaining counter in state.afflictions[id] that
// ticks down as new rooms are presented and clears at 0. Any source can apply
// one through inflictAffliction (logic/helpers): a monster trait on hit, a
// hazard card, a theme's ambient effect, or a boss. A fresh descent rebuilds
// state, so afflictions never cross the sanctuary.

export const AFFLICTIONS = {
  blind: {
    id: 'blind',
    name: 'Blind',
    description: 'Every card in the room shows only its back. You commit without seeing it.',
  },
  obscured: {
    id: 'obscured',
    name: 'Obscured',
    description: "Card ranks are hidden. You see each card's kind, not how strong it is.",
  },
  sealed: {
    id: 'sealed',
    name: 'Sealed',
    description: 'Potions and every other source of healing restore nothing.',
  },
  bleeding: {
    id: 'bleeding',
    name: 'Bleeding',
    description: 'Lose 2 HP at the threshold of each new room.',
  },
}

export const AFFLICTION_IDS = Object.keys(AFFLICTIONS)

// HP lost to Bleeding at each room threshold.
export const BLEEDING_DAMAGE = 2

export function hasAffliction(state, id) {
  return (state.afflictions?.[id] || 0) > 0
}

export function afflictionRoomsLeft(state, id) {
  return state.afflictions?.[id] || 0
}

// Ids of every affliction currently active, in registry order.
export function activeAfflictionIds(state) {
  if (!state.afflictions) return []
  return AFFLICTION_IDS.filter(id => (state.afflictions[id] || 0) > 0)
}
