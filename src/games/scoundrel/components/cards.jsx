import { useState } from 'react'
import {
  HEART, DIAMOND, SUIT_GLYPH, rankLabel,
  describeMaxHp, describeWeaponStrength,
  getTheme, BOONS,
  AFFLICTIONS, activeAfflictionIds, afflictionRoomsLeft,
} from '../logic'
import { Formula } from './atoms'
import { AfflictionIcon, cardBorderTone } from './SuitIcon'

// The card-slot faces live in their own module; the classic/modern layout is
// chosen from the player's display setting (see settings.js / useCardLayout).
// Re-exported so existing importers of './cards' keep working.
export { CardSlot } from './cardSlot'

// -- HP bar ------------------------------------------------------------

export function HpBar({ hp, maxHp }) {
  const pct = maxHp > 0 ? Math.max(0, Math.min(100, (hp / maxHp) * 100)) : 0
  const critical = hp <= maxHp * 0.25
  // Flash + shake when HP changes. Derived during render (no effect) by
  // comparing against the last seen value; the flash overlay clears `pulse`
  // on its own animationEnd. 'damage' shakes and flashes red, 'heal' flashes
  // green only.
  const [prevHp, setPrevHp] = useState(hp)
  const [pulse, setPulse] = useState(null)
  if (hp !== prevHp) {
    setPulse(hp < prevHp ? 'damage' : 'heal')
    setPrevHp(hp)
  }
  return (
    <div className={`panel p-3 w-full relative overflow-hidden ${pulse === 'damage' ? 'animate-hp-shake' : ''}`}>
      {pulse && (
        <div
          onAnimationEnd={() => setPulse(null)}
          className={`absolute inset-0 rounded-[inherit] pointer-events-none ${
            pulse === 'damage' ? 'bg-red-600 animate-hp-flash-damage' : 'bg-emerald-500 animate-hp-flash-heal'
          }`}
        />
      )}
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-[10px] uppercase tracking-widest text-slate-500">Lifeblood</span>
        <span className="font-mono text-parchment text-lg">
          {hp}<span className="text-slate-500 text-sm">/{maxHp}</span>
        </span>
      </div>
      <div className="h-2.5 rounded-full bg-stone-900 border border-stone-800 overflow-hidden">
        <div
          className={`h-full transition-all duration-300 ${
            critical
              ? 'bg-gradient-to-r from-red-900 to-red-600 animate-critical-pulse'
              : 'bg-gradient-to-r from-red-700 to-red-500'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

// -- Affliction badges -------------------------------------------------

// Compact status chips shown directly under the HP bar so active afflictions
// are impossible to miss. Each chip is an icon + rooms-left count, with a
// hover card spelling out the effect. Renders nothing when you're clean.
export function AfflictionBadges({ game }) {
  const ids = activeAfflictionIds(game)
  if (ids.length === 0) return null
  return (
    <div className="flex flex-wrap gap-1.5">
      {ids.map(id => {
        const a = AFFLICTIONS[id]
        const rooms = afflictionRoomsLeft(game, id)
        return (
          <div key={id} className="group relative">
            <div className="flex items-center gap-1 rounded-md border border-red-800/70 bg-red-950/40 pl-1.5 pr-2 py-1">
              <AfflictionIcon id={id} className="w-3.5 h-3.5 text-red-400 shrink-0" />
              <span className="text-red-300/90 text-[11px] font-semibold leading-none">{a.name}</span>
              <span className="text-red-400/60 font-mono text-[10px] leading-none">{rooms}</span>
            </div>
            <div
              role="tooltip"
              className="pointer-events-none absolute left-0 top-full mt-1 z-40 w-56 rounded-md border border-red-700/60 bg-stone-950/95 p-2.5 text-left opacity-0 group-hover:opacity-100 transition"
            >
              <div className="flex items-center gap-1.5 mb-1">
                <AfflictionIcon id={id} className="w-4 h-4 text-red-400 shrink-0" />
                <span className="font-display text-red-300 text-[13px]">{a.name}</span>
                <span className="ml-auto text-red-400/60 font-mono text-[10px] shrink-0">
                  {rooms} room{rooms === 1 ? '' : 's'}
                </span>
              </div>
              <div className="text-slate-300 text-[11.5px] leading-snug">{a.description}</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// -- Conditions panel --------------------------------------------------

export function ConditionsPanel({ game, theme }) {
  const hpDesc = describeMaxHp(game)
  const charges = []
  if (game.boons.includes('second_wind')) {
    charges.push({ name: 'Second Wind', ready: !game.secondWindUsed })
  }
  if (game.boons.includes('scoundrels_cloak')) {
    charges.push({ name: "Scoundrel's Cloak", ready: !game.cloakUsed })
  }
  if (game.boons.includes('twin_souls')) {
    charges.push({ name: 'Twin Souls', ready: !game.twinSoulsUsed })
  }
  return (
    <div className="panel p-4 space-y-3 text-[12px]">
      <div className="text-[10px] uppercase tracking-widest text-slate-500">Conditions</div>

      {theme && (
        <div>
          <div className="text-slate-500 text-[10px] uppercase tracking-wider mb-0.5">Trial</div>
          <div className="text-rune font-semibold">{theme.name}</div>
          <div className="text-slate-400 text-[11px] mt-0.5 leading-snug">{theme.description}</div>
          {game.themeChildren && (
            <ul className="mt-1.5 space-y-0.5 pt-1.5 border-t border-stone-800">
              {game.themeChildren.map(id => {
                const c = getTheme(id)
                return c && (
                  <li key={id} className="text-[11px] text-slate-400 leading-snug">
                    <span className="text-rune">{c.name}</span>: {c.description}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}

      <div>
        <div className="text-slate-500 text-[10px] uppercase tracking-wider mb-0.5">Max HP</div>
        <div className="text-parchment font-mono">
          {hpDesc.value} <Formula parts={hpDesc.parts} />
        </div>
      </div>

      {game.riposteCharge > 0 && (
        <div>
          <div className="text-slate-500 text-[10px] uppercase tracking-wider mb-0.5">Riposte banked</div>
          <div className="text-rune font-mono">−{game.riposteCharge} to the next monster</div>
        </div>
      )}

      {(game.weapon?.strengthBonus || 0) > 0 && (
        <div>
          <div className="text-slate-500 text-[10px] uppercase tracking-wider mb-0.5">Strength</div>
          <div className="text-rune font-mono">+{game.weapon.strengthBonus} to this weapon's strikes</div>
        </div>
      )}

      {(() => {
        const kills = game.lastKilledMonsterRanks || []
        if (kills.length === 0) return null
        const devourerInPlay =
          game.deck.some(c => c?.boss === 'devourer') ||
          game.room.some(c => c?.boss === 'devourer')
        if (!devourerInPlay) return null
        return (
          <div>
            <div className="text-slate-500 text-[10px] uppercase tracking-wider mb-0.5">Devourer feeds on</div>
            <div className="text-parchment font-mono text-[12px]">
              {kills.map(rankLabel).join(' · ')}
              <span className="text-slate-500"> (last 3 kills)</span>
            </div>
          </div>
        )
      })()}

      {charges.length > 0 && (
        <div>
          <div className="text-slate-500 text-[10px] uppercase tracking-wider mb-1">Once-per-descent</div>
          <ul className="space-y-0.5">
            {charges.map(c => (
              <li key={c.name} className="text-[11px]">
                <span className={c.ready ? 'text-rune' : 'text-slate-600 line-through'}>{c.name}</span>
                <span className="text-slate-500"> ({c.ready ? 'ready' : 'spent'})</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {game.boons.length > 0 && (
        <div>
          <div className="text-slate-500 text-[10px] uppercase tracking-wider mb-1">Boons</div>
          <ul className="space-y-1">
            {game.boons.map(id => {
              const b = BOONS[id]
              const muted = game.mutedBoon === id
              return (
                <li key={id} className="group relative">
                  <div className="cursor-help text-[11px] leading-snug py-0.5">
                    <span className={muted ? 'text-slate-600 line-through font-semibold' : 'text-rune font-semibold'}>
                      {b.name}
                    </span>
                    {muted && <span className="text-slate-500 italic"> (muted)</span>}
                  </div>
                  <div
                    role="tooltip"
                    className="pointer-events-none absolute left-0 top-full mt-1 z-50 w-64 rounded-md border border-rune/40 bg-stone-950/98 backdrop-blur-sm p-2.5 text-left opacity-0 group-hover:opacity-100 transition shadow-xl"
                  >
                    <div className="text-rune font-semibold mb-1">{b.name}</div>
                    <div className="text-[11px] text-slate-300 leading-snug">{b.description}</div>
                    {b.example && (
                      <div className="mt-2 text-[10px] text-slate-400 italic leading-snug border-l-2 border-rune/30 pl-2">
                        {b.example}
                      </div>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}

// -- Weapon panel ------------------------------------------------------

export function WeaponBlock({ game, weapon, label }) {
  const strength = describeWeaponStrength(game, weapon)
  const lastSlain = weapon.lastSlain
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 min-w-0">
        {label && (
          <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">{label}</div>
        )}
        <div className="text-[10px] uppercase tracking-wider text-slate-500 whitespace-nowrap">Strikes as</div>
        <div className="font-mono font-bold text-parchment text-5xl leading-none">
          {strength.value}
        </div>
      </div>
      <div className="shrink-0 text-center">
        <div className="text-[10px] uppercase tracking-wider text-slate-500 whitespace-nowrap">Bound to</div>
        <div
          className={`font-mono font-bold leading-none text-5xl ${
            lastSlain ? 'text-parchment' : 'text-stone-700'
          }`}
          aria-label={lastSlain ? `Bound to ${rankLabel(lastSlain.rank)}` : 'No binding'}
        >
          {lastSlain ? rankLabel(lastSlain.rank) : '–'}
        </div>
      </div>
    </div>
  )
}

export function WeaponPanel({ game }) {
  const { weapon, spareWeapon } = game
  const hasQuartermaster = game.boons.includes('quartermaster')
  // Snap the panel when the equipped weapon's strike value changes (equip,
  // replace, or a strength gain). A kill only moves the binding, not the
  // strike value, so those don't snap here; the HP bar handles the hit.
  const sig = weapon ? String(describeWeaponStrength(game, weapon).value) : 'bare'
  const [prevSig, setPrevSig] = useState(sig)
  const [snap, setSnap] = useState(false)
  if (sig !== prevSig) {
    if (weapon) setSnap(true) // arm only on becoming/staying armed, not on disarm
    setPrevSig(sig)
  }
  return (
    <div
      className={`panel p-4 ${snap ? 'animate-weapon-snap' : ''}`}
      onAnimationEnd={e => { if (e.target === e.currentTarget) setSnap(false) }}
    >
      <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-2">
        {hasQuartermaster ? 'Weapons' : 'Weapon'}
      </div>
      {weapon ? (
        <div className="space-y-3">
          <WeaponBlock game={game} weapon={weapon} label={hasQuartermaster ? 'Drawn' : null} />
          {spareWeapon && (
            <div className="border-t border-stone-800 pt-3">
              <WeaponBlock game={game} weapon={spareWeapon} label="Spare" />
            </div>
          )}
          {hasQuartermaster && !spareWeapon && (
            <div className="text-[11px] text-slate-500 italic border-t border-stone-800 pt-3">
              Spare slot empty. Next weapon taken slings to your back.
            </div>
          )}
        </div>
      ) : (
        <div className="text-sm text-slate-500 italic">Bare-handed.</div>
      )}
    </div>
  )
}

// -- Mini card + foresight ---------------------------------------------

export function MiniCard({ card }) {
  const red = card.suit === HEART || card.suit === DIAMOND
  return (
    <div className={`aspect-[2/3] w-11 rounded-sm border-2 ${cardBorderTone(card)} bg-parchment text-stone-900 px-1 py-0.5 flex flex-col justify-between shadow`}>
      <div className={`text-[11px] font-bold leading-none ${red ? 'text-blood' : 'text-stone-900'}`}>
        {rankLabel(card.rank)}
      </div>
      <div className={`text-sm leading-none text-right ${red ? 'text-blood' : 'text-stone-900'}`}>
        {SUIT_GLYPH[card.suit]}
      </div>
    </div>
  )
}

export function ForesightPanel({ game }) {
  const hasCartographer = game.boons.includes('cartographer')
  const hasSoothsayer = game.boons.includes('soothsayer')
  if (!hasCartographer && !hasSoothsayer) return null
  if (game.deck.length === 0) return null

  const upcoming = hasCartographer ? game.deck : game.deck.slice(0, 1)
  const label = hasCartographer
    ? `Cartographer's chart: ${game.deck.length} card${game.deck.length === 1 ? '' : 's'} remain`
    : 'Soothsayer: next card waiting'

  return (
    <section className="panel panel-warm p-3">
      <div className="text-[10px] uppercase tracking-widest text-amber-200/70 mb-2">{label}</div>
      <div className="flex gap-1.5 flex-wrap">
        {upcoming.map((c, i) => (
          <MiniCard key={`${c.id}-${i}`} card={c} />
        ))}
      </div>
    </section>
  )
}
