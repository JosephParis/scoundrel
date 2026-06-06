import {
  HEART, DIAMOND, SUIT_GLYPH, rankLabel,
  isMonster, isWeapon, isPotion, isWound, isSkeletonKey, isMap, isWhetstone, isBoss,
  describeMaxHp, describeWeaponStrength,
  getTheme, BOONS, INSCRIBED_FRAMES, BOSSES,
} from '../logic'
import { Formula, formatFormula } from './atoms'
import { SuitIcon, cardBorderTone, suitIconTone } from './SuitIcon'

// -- HP bar ------------------------------------------------------------

export function HpBar({ hp, maxHp }) {
  const pct = maxHp > 0 ? Math.max(0, Math.min(100, (hp / maxHp) * 100)) : 0
  const critical = hp <= maxHp * 0.25
  return (
    <div className="panel p-3 w-full">
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
              ? 'bg-gradient-to-r from-red-900 to-red-600 shadow-[0_0_8px_rgba(239,68,68,0.6)]'
              : 'bg-gradient-to-r from-red-700 to-red-500'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
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
          <div className="text-slate-500 text-[10px] uppercase tracking-wider mb-0.5">Theme</div>
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

      {(game.strengthBonus || 0) > 0 && (
        <div>
          <div className="text-slate-500 text-[10px] uppercase tracking-wider mb-0.5">Strength</div>
          <div className="text-rune font-mono">+{game.strengthBonus} to weapon strikes</div>
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
                <li key={id} className="text-[11px] leading-snug">
                  <span className={muted ? 'text-slate-600 line-through font-semibold' : 'text-rune font-semibold'}>
                    {b.name}
                  </span>
                  <span className={muted ? 'text-slate-600' : 'text-slate-400'}>: {b.description}</span>
                  {muted && <span className="text-slate-500 italic"> (muted by Wormwood)</span>}
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}

// -- Card slot ---------------------------------------------------------

export function CardSlot({ card, onClick, onBareHands, weaponDamage, bareDamage, potionPreview, reveal, recommended, tutorialTip, blocked, bareBlocked, bareRecommended, displayRank }) {
  if (!card) {
    return (
      <div className="aspect-[2/3] w-full max-w-[240px] rounded-lg border border-dashed border-stone-800 bg-stone-900/30" />
    )
  }
  if (card.faceDown && !reveal) {
    return <FaceDownCardSlot onClick={blocked ? undefined : onClick} blocked={blocked} />
  }
  const red = card.suit === HEART || card.suit === DIAMOND
  const wound = isWound(card)
  const key = isSkeletonKey(card)
  const map = isMap(card)
  const stone = isWhetstone(card)
  const inscribed = !!card.inscribed
  const boss = isBoss(card)
  const bossDef = boss ? BOSSES[card.boss] : null
  const frame = card.inscribed ? INSCRIBED_FRAMES[card.inscribed] : null
  const kind = bossDef
    ? bossDef.name
    : frame
      ? frame.name
      : isMonster(card)
        ? 'Monster'
        : isWeapon(card)
          ? 'Weapon'
          : isPotion(card)
            ? 'Potion'
            : wound
              ? 'Wound'
              : key
                ? 'Skeleton Key'
                : ''
  // Devourer's printed rank is 3 but its live rank scales; DescentView
  // hands us the resolved value when needed. Anything else falls back to
  // the card's rank.
  const shownRank = displayRank != null ? displayRank : card.rank
  const monster = isMonster(card)
  const willUseWeapon = monster && weaponDamage !== null
  const monsterPreview = !monster ? null : willUseWeapon ? weaponDamage : bareDamage
  const monsterIcon = willUseWeapon ? '⚔' : '✊'
  const potionHeal = potionPreview && potionPreview.mode === 'heal' ? potionPreview : null
  const potionSour = potionPreview && potionPreview.mode === 'damage' ? potionPreview : null
  const potionStrength = potionPreview && potionPreview.mode === 'strength' ? potionPreview : null
  const potionSkip = potionPreview && potionPreview.mode === 'skip' ? potionPreview : null

  // When the lesson points at the bare-hands button AND the card-click
  // would actually swing (weapon usable), forbid the swing. If the
  // weapon is already locked out, clicking the card auto-bare-hands,
  // which is the same outcome as the button: don't grey it.
  const cardLockedForBare = !!bareRecommended && weaponDamage !== null
  const cardDisabled = reveal || blocked || cardLockedForBare
  const cardInteractive = reveal
    ? 'animate-card-reveal cursor-default ring-2 ring-rune/60'
    : (blocked || cardLockedForBare)
      ? 'cursor-not-allowed grayscale opacity-40'
      : 'hover:-translate-y-1 hover:shadow-[0_8px_24px_-6px_rgba(0,0,0,0.6)]'

  return (
    <div className="group relative w-full max-w-[240px] flex flex-col">
      {recommended && !bareRecommended && (
        <div
          className="absolute -top-7 left-1/2 -translate-x-1/2 z-20 text-rune text-2xl animate-bounce pointer-events-none drop-shadow-[0_0_6px_rgba(251,191,36,0.75)]"
          aria-hidden="true"
        >
          ▼
        </div>
      )}
      <button
        onClick={cardDisabled ? undefined : onClick}
        disabled={cardDisabled}
        className={`aspect-[2/3] rounded-lg border-2 ${cardBorderTone(card)} bg-gradient-to-b from-parchment to-[#e8d5b3] text-stone-900 p-3 flex flex-col text-left transition-all shadow-md ${cardInteractive} ${(recommended && !bareRecommended) ? 'tutorial-recommended' : ''}`}
      >
        <div className={`text-2xl font-bold leading-none ${
          red ? 'text-blood' : wound ? 'text-red-900' : key ? 'text-amber-700' : map ? 'text-sky-800' : stone ? 'text-slate-700' : 'text-stone-900'
        }`}>
          {(wound || key || map || stone) ? SUIT_GLYPH[card.suit] : `${rankLabel(shownRank)}${SUIT_GLYPH[card.suit]}`}
        </div>
        {inscribed && (
          <div className="absolute top-1.5 right-1.5 text-[9px] uppercase tracking-widest text-amber-700/80 font-semibold">
            inscribed
          </div>
        )}
        {boss && (
          <div className="absolute top-1.5 right-1.5 text-[9px] uppercase tracking-widest text-rune font-semibold drop-shadow-[0_0_4px_rgba(251,191,36,0.7)]">
            boss
          </div>
        )}
        <div className="flex-1 min-h-0 flex items-center justify-center py-1">
          <SuitIcon suit={card.suit} inscribed={card.inscribed} boss={card.boss} className={`w-[62%] h-auto ${suitIconTone(card)}`} />
        </div>
        <div className="text-center flex flex-col items-center gap-0.5 min-h-[34px] justify-center">
          {monsterPreview ? (
            <>
              <span className="text-[12px] tracking-normal text-stone-800 font-medium">
                {monsterIcon} take {monsterPreview.value}
              </span>
              {monsterPreview.parts.length > 1 && (
                <span className="text-[10px] tracking-normal text-stone-500 leading-tight">
                  ({formatFormula(monsterPreview.parts)})
                </span>
              )}
            </>
          ) : potionHeal ? (
            <>
              <span className="text-[12px] tracking-normal text-stone-800 font-medium">
                ♥ heal {potionHeal.value}
              </span>
              {potionHeal.parts.length > 0 && (
                <span className="text-[10px] tracking-normal text-stone-500 leading-tight">
                  ({formatFormula(potionHeal.parts)})
                </span>
              )}
            </>
          ) : potionSour ? (
            <>
              <span className="text-[12px] tracking-normal text-stone-800 font-medium">
                ✸ take {potionSour.value}
              </span>
              {potionSour.parts.length > 0 && (
                <span className="text-[10px] tracking-normal text-stone-500 leading-tight">
                  ({formatFormula(potionSour.parts)})
                </span>
              )}
            </>
          ) : potionStrength ? (
            <span className="text-[12px] tracking-normal text-stone-800 font-medium">
              ⚒ strikes +{potionStrength.value}
            </span>
          ) : potionSkip ? (
            <span className="text-[10px] uppercase tracking-[0.2em] text-stone-500">{potionSkip.note}</span>
          ) : wound ? (
            <span className="text-[11px] tracking-normal text-stone-700 font-medium">Bind to clear</span>
          ) : key ? (
            <span className="text-[11px] tracking-normal text-amber-800 font-medium">Skip the room</span>
          ) : map ? (
            <span className="text-[11px] tracking-normal text-sky-800 font-medium">Read the map</span>
          ) : stone ? (
            <span className="text-[11px] tracking-normal text-slate-700 font-medium">Hone the blade</span>
          ) : (
            <span className="text-[10px] uppercase tracking-[0.2em] text-stone-500">{kind}</span>
          )}
        </div>
      </button>
      {onBareHands && (
        <div className="relative mt-2">
          {bareRecommended && (
            <div
              className="absolute -top-6 left-1/2 -translate-x-1/2 z-20 text-rune text-2xl animate-bounce pointer-events-none drop-shadow-[0_0_6px_rgba(251,191,36,0.75)]"
              aria-hidden="true"
            >
              ▼
            </div>
          )}
        <button
          onClick={(blocked || bareBlocked) ? undefined : onBareHands}
          disabled={blocked || bareBlocked}
          className={`w-full py-2.5 px-3 rounded-md bg-stone-800 text-parchment text-sm font-medium border border-stone-700 transition flex flex-col items-center ${(blocked || bareBlocked) ? 'cursor-not-allowed opacity-40' : 'hover:bg-stone-700'} ${bareRecommended ? 'tutorial-recommended' : ''}`}
        >
          <span>✊ Bare hands · take {bareDamage.value}</span>
          {bareDamage.parts.length > 1 && (
            <span className="text-[10px] text-stone-400 leading-tight">
              ({formatFormula(bareDamage.parts)})
            </span>
          )}
        </button>
        </div>
      )}
      {tutorialTip && (
        <div
          className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-30 w-72 panel p-3 text-[13px] leading-relaxed text-slate-200 text-left pointer-events-none shadow-2xl border border-rune/40"
          role="tooltip"
        >
          {tutorialTip}
        </div>
      )}
    </div>
  )
}

function FaceDownCardSlot({ onClick, blocked }) {
  return (
    <div className="w-full max-w-[240px] flex flex-col">
      <button
        onClick={blocked ? undefined : onClick}
        disabled={!!blocked}
        className={`aspect-[2/3] rounded-lg border-2 border-stone-700 bg-gradient-to-br from-stone-900 via-stone-950 to-black p-4 flex flex-col justify-between transition-all shadow-md text-rune/60 ${blocked ? 'cursor-not-allowed grayscale opacity-40' : 'hover:-translate-y-1 hover:shadow-[0_8px_24px_-6px_rgba(0,0,0,0.6)] hover:border-rune/50'}`}
      >
        <div className="text-4xl leading-none font-display">?</div>
        <div className="text-xs uppercase tracking-[0.2em] text-slate-500 text-center">
          Face-down
        </div>
        <div className="text-5xl leading-none text-right text-rune/30">✦</div>
      </button>
      <div className="mt-2 text-[10px] text-slate-500 italic text-center leading-snug">
        Played sight-unseen.
      </div>
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
  return (
    <div className="panel p-4">
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
