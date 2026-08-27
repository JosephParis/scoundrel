import { BUILD_SHA, BUILD_HREF, BUILD_TITLE } from './buildInfo.js'

/**
 * Tiny build stamp pinned to the bottom-right corner, with the privacy link
 * beside it. `fixed` positioning keeps it out of the layout, so it adds no page
 * scroll to a full-screen view. The SHA links to the matching GitHub commit, so
 * "is prod on the latest build?" is one glance away.
 *
 * Desktop only. Pinned to the bottom-right corner of a phone it sits exactly
 * where a thumb rests, and players kept opening the privacy policy or a GitHub
 * commit mid-run by accident -- a 10px target with a whole run behind it. It is
 * also outside the scaling stage (it is fixed to the viewport, not the game), so
 * on a scaled screen it overlapped the panel beneath it rather than sitting
 * under it.
 *
 * Both links live in the Settings modal too, which is how a phone reaches them.
 * That does mean the privacy policy is no longer one tap from anywhere on
 * mobile, which is what issue 06 originally asked for; it is now two, via the
 * top bar's overflow menu. The sign-in modal still carries its own disclosure
 * link, and /privacy is still a plain URL.
 */
export default function VersionBadge() {
  return (
    <div className="hidden md:flex fixed bottom-1 right-2 z-50 items-center gap-2 text-[10px] leading-none select-none">
      <a
        href="/privacy"
        className="text-slate-600/70 hover:text-rune transition-colors"
      >
        Privacy
      </a>
      <span className="text-slate-700/60" aria-hidden="true">·</span>
      <a
        href={BUILD_HREF}
        target="_blank"
        rel="noopener noreferrer"
        title={BUILD_TITLE}
        aria-label={BUILD_TITLE}
        className="font-mono text-slate-600/70 hover:text-rune transition-colors"
      >
        {BUILD_SHA}
      </a>
    </div>
  )
}
