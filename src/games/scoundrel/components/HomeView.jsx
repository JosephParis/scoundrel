// Full-screen home / main menu. Reached by clicking the SCOUNDREL logo in
// the top bar. It's an overlay rather than a game phase, so the live run is
// untouched underneath: "Resume" just closes it. Menu entries hand off to the
// same modals the top bar opens.
export function HomeView({ open, onResume, onOpenRules, onOpenHistory, onOpenCardLibrary, onReplayTutorial, onOpenCredits }) {
  if (!open) return null

  const items = [
    { label: 'Resume', hint: 'Back to your run', onClick: onResume, accent: true },
    { label: 'How to play', hint: 'Rules, boons, trials', onClick: onOpenRules },
    { label: 'Run history', hint: 'Past descents', onClick: onOpenHistory },
    { label: 'Card library', hint: 'Every card in the deck', onClick: onOpenCardLibrary },
    { label: 'Tutorial', hint: 'A guided walkthrough', onClick: onReplayTutorial },
    { label: 'Credits', hint: 'Who built this', onClick: onOpenCredits },
  ]

  return (
    <div className="fixed inset-0 z-40 bg-dungeon flex flex-col items-center justify-center px-4 overflow-y-auto animate-fade-in">
      <div className="w-full max-w-md py-10 text-center">
        <h1 className="font-display text-rune text-5xl sm:text-6xl tracking-[0.2em]">
          SCOUNDREL
        </h1>
        <div className="rune-divider mx-auto max-w-[10rem] mt-4 mb-8 text-[10px]">
          <span>✦</span>
        </div>
        <nav className="flex flex-col gap-2.5">
          {items.map(it => (
            <button
              key={it.label}
              onClick={it.onClick}
              className={`group w-full px-5 py-3 rounded-md border text-left flex items-baseline justify-between gap-3 transition ${
                it.accent
                  ? 'border-rune/50 bg-rune/5 hover:border-rune hover:bg-rune/10'
                  : 'border-stone-700 hover:border-rune/60 hover:bg-stone-800/40'
              }`}
            >
              <span className={`font-display tracking-wide ${it.accent ? 'text-rune' : 'text-parchment'}`}>
                {it.label}
              </span>
              <span className="text-[11px] text-slate-500 group-hover:text-slate-400 transition">
                {it.hint}
              </span>
            </button>
          ))}
        </nav>
      </div>
    </div>
  )
}
