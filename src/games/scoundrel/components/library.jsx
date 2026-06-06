import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { BOONS, UNLOCKABLE_BOON_IDS, isEnabled } from '../logic'

const TAG_ORDER = ['combat', 'survival', 'economy', 'build']
const TAG_LABEL = {
  combat: 'Combat',
  survival: 'Survival',
  economy: 'Economy',
  build: 'Build',
}

// Small rail button that opens the full library. Shows current progress
// inline so a glance is enough to see if there's more to find.
export function LibraryChip({ unlockedBoons, onOpen }) {
  const unlockedCount = useMemo(() => {
    const set = new Set(unlockedBoons || [])
    return UNLOCKABLE_BOON_IDS.filter(id => set.has(id)).length
  }, [unlockedBoons])
  const total = UNLOCKABLE_BOON_IDS.length
  const fullyDiscovered = unlockedCount >= total
  return (
    <button
      onClick={onOpen}
      className="panel p-3 w-full text-left hover:border-rune/40 transition flex items-baseline justify-between"
    >
      <span className="text-[10px] uppercase tracking-widest text-slate-500">Boon library</span>
      <span className="text-[11px] text-slate-500">
        <span className="font-mono text-slate-300">{unlockedCount}</span>
        <span className="text-slate-600"> / </span>
        <span className="font-mono text-slate-500">{total}</span>
        {fullyDiscovered && <span className="ml-2 text-rune">✦</span>}
      </span>
    </button>
  )
}

// Full library view. Boons are grouped by tag. Locked ones show as redacted
// placeholders with just the tag, so the player can see the shape of what is
// left to find without spoilers. Unlocked ones show full name + description.
export function LibraryModal({ open, onClose, unlockedBoons }) {
  const unlockedSet = useMemo(() => new Set(unlockedBoons || []), [unlockedBoons])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const byTag = useMemo(() => {
    const groups = {}
    for (const id of UNLOCKABLE_BOON_IDS) {
      const tag = BOONS[id]?.tag || 'misc'
      groups[tag] = groups[tag] || []
      groups[tag].push(id)
    }
    return groups
  }, [])

  if (!open) return null
  const totalUnlocked = UNLOCKABLE_BOON_IDS.filter(id => unlockedSet.has(id)).length

  // Portal to body so the modal escapes PhaseRail's sticky stacking context
  // and renders above sibling panels (Boon offer, Forge views, etc).
  return createPortal((
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-start sm:items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="panel max-w-3xl w-full p-6 my-4 sm:my-auto relative shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 w-9 h-9 rounded-full bg-stone-800 hover:bg-stone-700 text-parchment text-xl leading-none flex items-center justify-center border border-stone-700"
          aria-label="Close library"
        >
          ×
        </button>
        <div className="mb-5">
          <div className="text-[10px] uppercase tracking-[0.3em] text-slate-500">The library</div>
          <h2 className="font-display text-rune text-2xl mt-1">
            {totalUnlocked} <span className="text-slate-400 text-base">of {UNLOCKABLE_BOON_IDS.length} Boons known</span>
          </h2>
          <p className="text-[11.5px] text-slate-500 mt-1 max-w-md">
            Every sigil earned discovers one new Boon. Discoveries persist across runs.
          </p>
        </div>

        <div className="space-y-5 max-h-[60vh] overflow-y-auto pr-2">
          {TAG_ORDER.map(tag => {
            const ids = byTag[tag] || []
            if (ids.length === 0) return null
            const tagUnlocked = ids.filter(id => unlockedSet.has(id)).length
            return (
              <div key={tag}>
                <div className="flex items-baseline justify-between mb-2">
                  <h3 className="text-[12px] uppercase tracking-[0.2em] text-rune/80">
                    {TAG_LABEL[tag] || tag}
                  </h3>
                  <div className="text-[10px] text-slate-500">
                    <span className="font-mono text-slate-300">{tagUnlocked}</span>
                    <span className="text-slate-600"> / </span>
                    <span className="font-mono text-slate-500">{ids.length}</span>
                  </div>
                </div>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {ids.map(id => (
                    <LibraryEntry key={id} id={id} unlocked={unlockedSet.has(id)} />
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  ), document.body)
}

function LibraryEntry({ id, unlocked }) {
  const boon = BOONS[id]
  if (!boon) return null
  if (!unlocked) {
    return (
      <li className="rounded-md border border-stone-800 bg-stone-950/60 p-3">
        <div className="text-slate-600 font-mono tracking-[0.3em]">???</div>
        <div className="text-[11.5px] text-slate-700 mt-1 italic">Undiscovered.</div>
      </li>
    )
  }
  return (
    <li className="rounded-md border border-stone-700 bg-stone-900/40 p-3">
      <div className="text-rune font-display text-sm">{boon.name}</div>
      <div className="text-[12px] text-slate-300 mt-1 leading-snug">{boon.description}</div>
    </li>
  )
}

// Top-level controller. Owns the open/closed state so callers only have to
// drop one component into the rail.
export function LibraryPanel({ unlockedBoons }) {
  const [open, setOpen] = useState(false)
  if (!isEnabled('library')) return null
  return (
    <>
      <LibraryChip unlockedBoons={unlockedBoons} onOpen={() => setOpen(true)} />
      <LibraryModal open={open} onClose={() => setOpen(false)} unlockedBoons={unlockedBoons} />
    </>
  )
}
