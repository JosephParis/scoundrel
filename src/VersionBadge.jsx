// Tiny build stamp pinned to the bottom-right corner. Reads the commit SHA and
// build time that vite.config.js inlined at build time, so it self-updates on
// every deploy with nothing to hand-edit. `fixed` positioning keeps it out of
// the layout (no added page scroll on full-screen views). The SHA links to the
// matching GitHub commit so "is prod on the latest build?" is one glance away.

const REPO = 'https://github.com/JosephParis/sigil'

const SHA = import.meta.env.VITE_BUILD_SHA || 'dev'
const REF = import.meta.env.VITE_BUILD_REF || ''
const TIME = import.meta.env.VITE_BUILD_TIME || ''

export default function VersionBadge() {
  const built = TIME ? new Date(TIME) : null
  const date = built && !Number.isNaN(built.getTime())
    ? built.toISOString().slice(0, 16).replace('T', ' ') + ' UTC'
    : ''
  const known = SHA !== 'dev'
  const href = known ? `${REPO}/commit/${SHA}` : REPO
  const title = [
    `build ${SHA}`,
    REF && `branch ${REF}`,
    date && `built ${date}`,
  ].filter(Boolean).join(' · ')

  // The app has no footer, so this corner is the one always-visible slot for
  // site-level links. The privacy policy has to be reachable from anywhere
  // without opening a modal first (issue 06), so it lives here beside the stamp.
  return (
    <div className="fixed bottom-1 right-2 z-50 flex items-center gap-2 text-[10px] leading-none select-none">
      <a
        href="/privacy"
        className="text-slate-600/70 hover:text-rune transition-colors"
      >
        Privacy
      </a>
      <span className="text-slate-700/60" aria-hidden="true">·</span>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        title={title}
        aria-label={title}
        className="font-mono text-slate-600/70 hover:text-rune transition-colors"
      >
        {SHA}
      </a>
    </div>
  )
}
