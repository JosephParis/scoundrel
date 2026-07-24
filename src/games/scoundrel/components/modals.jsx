import { useEffect, useMemo, useState } from 'react'
import {
  THEMES, BOONS, getTheme,
  rollForgeGrants, initForgeBatch,
  FLAG_IDS, FLAG_META, getFlags, setFlag, resetAllFlags,
} from '../logic'
import { settings, useCardLayout } from '../settings'
import { audio, useMuted, useMusicVolume, useSfxVolume } from '../audio'

// -- Settings modal ----------------------------------------------------

const CARD_LAYOUT_OPTIONS = [
  {
    id: 'modern',
    name: 'Modern',
    blurb: 'Art at the top, name below it, and rules text on the face of bosses, inscribed cards, and trait monsters.',
  },
  {
    id: 'classic',
    name: 'Classic',
    blurb: 'Art centered with just the name and category. Rules text shows on hover only.',
  },
]

export function SettingsModal({ open, onClose }) {
  const layout = useCardLayout()
  const muted = useMuted()
  const musicVolume = useMusicVolume()
  const sfxVolume = useSfxVolume()
  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-start sm:items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="panel max-w-md w-full p-6 sm:p-8 my-4 sm:my-auto relative shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 w-9 h-9 rounded-full bg-stone-800 hover:bg-stone-700 text-parchment text-xl leading-none flex items-center justify-center border border-stone-700"
          aria-label="Close settings"
        >
          ×
        </button>
        <h2 className="font-display text-rune text-2xl mb-1">Settings</h2>
        <p className="text-[12px] text-slate-500 mb-5">
          Press <span className="font-mono text-slate-300">Esc</span> or click outside to close.
        </p>
        <section>
          <div className="text-[10px] uppercase tracking-[0.3em] text-slate-500 mb-3">
            Card layout
          </div>
          <div className="space-y-2">
            {CARD_LAYOUT_OPTIONS.map(opt => {
              const active = layout === opt.id
              return (
                <button
                  key={opt.id}
                  onClick={() => settings.setCardLayout(opt.id)}
                  aria-pressed={active}
                  className={`w-full text-left rounded-md border p-3 transition ${
                    active
                      ? 'border-rune bg-stone-800/60'
                      : 'border-stone-700 hover:border-rune/60 hover:bg-stone-800/40'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className={`font-display text-base ${active ? 'text-rune' : 'text-parchment'}`}>
                      {opt.name}
                    </span>
                    {active && (
                      <span className="text-[10px] uppercase tracking-widest text-rune">Active</span>
                    )}
                  </div>
                  <p className="text-[11.5px] text-slate-400 leading-snug mt-1">{opt.blurb}</p>
                </button>
              )
            })}
          </div>
        </section>

        <section className="mt-6">
          <div className="text-[10px] uppercase tracking-[0.3em] text-slate-500 mb-3">
            Sound
          </div>
          <div className="space-y-4">
            <VolumeSlider label="Music" value={musicVolume} onChange={v => audio.setMusicVolume(v)} />
            <VolumeSlider
              label="Effects"
              value={sfxVolume}
              onChange={v => audio.setSfxVolume(v)}
              onPreview={() => audio.sfx('cardFlip')}
            />
          </div>
          {muted && (
            <p className="mt-3 text-[11px] text-amber-300/80">
              Sound is muted. Toggle it with the speaker in the top bar.
            </p>
          )}
        </section>
      </div>
    </div>
  )
}

// A labelled 0-100% volume slider. onPreview (optional) fires on release so the
// player can hear the new level once, rather than on every drag tick.
function VolumeSlider({ label, value, onChange, onPreview }) {
  const pct = Math.round(value * 100)
  return (
    <label className="block">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[13px] text-parchment">{label}</span>
        <span className="text-[11px] text-slate-500 tabular-nums">{pct}%</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={pct}
        onChange={e => onChange(Number(e.target.value) / 100)}
        onMouseUp={onPreview}
        onTouchEnd={onPreview}
        className="w-full accent-amber-500 cursor-pointer"
      />
    </label>
  )
}

// -- Credits modal -----------------------------------------------------

export function CreditsModal({ open, onClose }) {
  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-start sm:items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="panel max-w-md w-full p-6 sm:p-8 my-4 sm:my-auto relative shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 w-9 h-9 rounded-full bg-stone-800 hover:bg-stone-700 text-parchment text-xl leading-none flex items-center justify-center border border-stone-700"
          aria-label="Close credits"
        >
          ×
        </button>
        <h2 className="font-display text-rune text-2xl mb-1">Credits</h2>
        <p className="text-[12px] text-slate-500 mb-5">
          Press <span className="font-mono text-slate-300">Esc</span> or click outside to close.
        </p>
        <section>
          <div className="text-[10px] uppercase tracking-[0.3em] text-slate-500 mb-3">
            Design & playtesting
          </div>
          <ul className="space-y-1.5 text-[15px] text-parchment font-display">
            <li>Alexander Beck</li>
            <li>Bronislaw Andrus</li>
            <li>Wesley Andrus</li>
            <li>Joshua Rolfe</li>
          </ul>
          <p className="mt-5 text-[12px] text-slate-400 italic leading-snug">
            Thanks for the runs, feedback, and ideas that shaped this wonderful game.
          </p>
        </section>
        <section className="mt-6 pt-4 border-t border-stone-800">
          <div className="text-[10px] uppercase tracking-[0.3em] text-slate-500 mb-2">
            Art
          </div>
          <p className="text-[11px] text-slate-500 leading-snug">
            Card icons by Lorc (
            <span className="text-slate-300">game-icons.net</span>), CC-BY 3.0
          </p>
        </section>
        <section className="mt-6 pt-4 border-t border-stone-800">
          <div className="text-[10px] uppercase tracking-[0.3em] text-slate-500 mb-2">
            Music
          </div>
          <p className="text-[11px] text-slate-500 leading-snug">
            Music by Kevin MacLeod (
            <span className="text-slate-300">incompetech.com</span>), CC-BY 3.0
          </p>
        </section>
        <section className="mt-6 pt-4 border-t border-stone-800">
          <div className="text-[10px] uppercase tracking-[0.3em] text-slate-500 mb-2">
            Sound Effects
          </div>
          <p className="text-[11px] text-slate-500 leading-snug">
            Combat sounds by Philippe Groarke, CC-BY-SA 3.0; smithing by hjm, CC-BY 3.0;
            card sounds by Cockatrice; additional effects from Kenney & OpenGameArt, CC0
          </p>
        </section>
      </div>
    </div>
  )
}

// -- Dev modal ---------------------------------------------------------

export function DevModal({ open, onClose, game, setGame }) {
  const tier3Ids = useMemo(
    () => Object.values(THEMES).filter(t => t.tier === 3).map(t => t.id),
    []
  )
  const [sigils, setSigils] = useState(game.sigilsEarned)
  const [themeId, setThemeId] = useState(game.nextTheme || 'the_quiet')
  const [child1, setChild1] = useState(() => game.nextThemeChildren?.[0] || tier3Ids[0] || '')
  const [child2, setChild2] = useState(() => game.nextThemeChildren?.[1] || tier3Ids[1] || '')
  const [selectedBoons, setSelectedBoons] = useState(() => new Set(game.boons))

  // When the modal re-opens, seed local form state from current game state
  // so it reflects whatever the player just did.
  // Intentional: synchronize form state when modal opens
  /* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
  useEffect(() => {
    if (!open) return
    setSigils(game.sigilsEarned)
    setThemeId(game.nextTheme || 'the_quiet')
    setChild1(game.nextThemeChildren?.[0] || tier3Ids[0] || '')
    setChild2(game.nextThemeChildren?.[1] || tier3Ids[1] || '')
    setSelectedBoons(new Set(game.boons))
  }, [open])
  /* eslint-enable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

  if (!open) return null

  const themeObj = getTheme(themeId)
  const isCompound = !!themeObj?.compound
  const maxSigils = game.sigilTarget - 1

  const toggleBoon = (id) => {
    setSelectedBoons(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const apply = () => {
    setGame(g => {
      // The Forge opens after every descent (any non-opening, non-final sigil).
      const forgeOpen = sigils >= 1 && sigils < g.sigilTarget
      const forgeGrants = forgeOpen ? rollForgeGrants(g.kit, sigils, Math.random) : []
      const batch = forgeGrants.length > 0
        ? initForgeBatch(forgeGrants, g.kit, sigils, Math.random)
        : { forgeGrantIndex: 0, forgeChoices: [] }
      return {
        ...g,
        // Stamp the run as dev-touched so its record is flagged test data and
        // kept out of admin stats. Run-level: descend() spreads state forward,
        // so this survives to the terminal record even across descents.
        devUsed: true,
        sigilsEarned: sigils,
        nextTheme: themeId,
        nextThemeChildren: isCompound
          ? [child1, child2].filter(Boolean)
          : null,
        boons: Array.from(selectedBoons),
        boonChosen: true,
        boonOffers: [],
        forgeOpen,
        forgeGrants,
        forgeGrantIndex: batch.forgeGrantIndex,
        forgeChoices: batch.forgeChoices,
        mutedBoon: null,
        log: [...g.log, `[dev] overrides applied: sigils ${sigils}, trial "${themeObj?.name || themeId}".`],
      }
    })
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-start sm:items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="panel max-w-md w-full p-6 my-4 sm:my-auto relative shadow-2xl border border-amber-900/40 space-y-3 text-[12px]"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 w-9 h-9 rounded-full bg-stone-800 hover:bg-stone-700 text-parchment text-xl leading-none flex items-center justify-center border border-stone-700"
          aria-label="Close dev overrides"
        >
          ×
        </button>
        <div className="text-[10px] uppercase tracking-[0.3em] text-amber-200/70">Dev overrides</div>
        <p className="text-[11px] text-slate-500 -mt-1">
          Press <span className="font-mono text-slate-300">Esc</span> or click outside to close.
        </p>

        <div>
          <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Sigils earned</div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              max={maxSigils}
              value={sigils}
              onChange={(e) => {
                const n = Number(e.target.value)
                setSigils(Math.max(0, Math.min(maxSigils, Number.isFinite(n) ? n : 0)))
              }}
              className="w-16 bg-stone-900 border border-stone-700 rounded px-2 py-1 text-parchment font-mono"
            />
            <span className="text-slate-500">/ {game.sigilTarget}</span>
            {sigils >= 1 && sigils < game.sigilTarget && (
              <span className="text-amber-300/70 text-[10px] uppercase tracking-wider">Forge opens</span>
            )}
          </div>
        </div>

        <div>
          <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Next trial</div>
          <select
            value={themeId}
            onChange={(e) => setThemeId(e.target.value)}
            className="block w-full bg-stone-900 border border-stone-700 rounded px-2 py-1 text-parchment"
          >
            {Object.values(THEMES).map(t => {
              const tier = t.tier ? `T${t.tier}` : 'intro'
              return <option key={t.id} value={t.id}>{t.name} ({tier})</option>
            })}
          </select>
        </div>

        {isCompound && (
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Child A', value: child1, set: setChild1 },
              { label: 'Child B', value: child2, set: setChild2 },
            ].map(({ label, value, set }) => (
              <div key={label}>
                <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">{label} (T3)</div>
                <select
                  value={value}
                  onChange={(e) => set(e.target.value)}
                  className="block w-full bg-stone-900 border border-stone-700 rounded px-2 py-1 text-parchment"
                >
                  {tier3Ids.map(id => (
                    <option key={id} value={id}>{THEMES[id].name}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        )}

        <div>
          <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Boons</div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1">
            {Object.values(BOONS).map(b => (
              <label key={b.id} className="flex items-center gap-2 text-[11px] cursor-pointer hover:text-parchment">
                <input
                  type="checkbox"
                  checked={selectedBoons.has(b.id)}
                  onChange={() => toggleBoon(b.id)}
                  className="accent-amber-500"
                />
                <span>{b.name}</span>
              </label>
            ))}
          </div>
        </div>

        <button
          onClick={apply}
          className="w-full px-3 py-2 rounded-md bg-amber-900/40 hover:bg-amber-900/60 text-amber-100 text-[11px] uppercase tracking-widest border border-amber-700/50 transition"
        >
          Apply overrides
        </button>

        <FlagsPanel />
      </div>
    </div>
  )
}

// Local feature flags. Toggling reloads the page so logic + UI re-read the
// flag state cleanly; in-place toggling would leave half the run thinking
// the flag is one value and half thinking the other.
function FlagsPanel() {
  const [flags, setFlagsState] = useState(() => getFlags())

  const onToggle = (flagId) => {
    setFlag(flagId, !flags[flagId])
    setFlagsState(getFlags())
  }
  const onReset = () => {
    resetAllFlags()
    setFlagsState(getFlags())
  }

  return (
    <div className="pt-3 border-t border-stone-800">
      <div className="flex items-baseline justify-between mb-2">
        <div className="text-[10px] uppercase tracking-wider text-slate-500">Feature flags</div>
        <button
          onClick={onReset}
          className="text-[10px] uppercase tracking-wider text-slate-500 hover:text-amber-200 transition"
          title="Restore all flags to their defaults"
        >
          Reset
        </button>
      </div>
      <p className="text-[10px] text-slate-600 leading-snug mb-2">
        Affects future state reads. Reload the page after toggling for changes
        already baked into the current run to clear.
      </p>
      <div className="space-y-1.5">
        {FLAG_IDS.map(id => {
          const meta = FLAG_META[id] || {}
          return (
            <label key={id} className="flex items-start gap-2 text-[11px] cursor-pointer group">
              <input
                type="checkbox"
                checked={!!flags[id]}
                onChange={() => onToggle(id)}
                className="accent-amber-500 mt-0.5 shrink-0"
              />
              <span className="flex-1 min-w-0">
                <span className="text-parchment group-hover:text-amber-100">{meta.name || id}</span>
                {meta.description && (
                  <span className="block text-slate-500 leading-snug">{meta.description}</span>
                )}
              </span>
            </label>
          )
        })}
      </div>
    </div>
  )
}
