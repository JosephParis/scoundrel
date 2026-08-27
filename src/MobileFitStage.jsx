import { useCallback, useEffect, useRef, useState } from 'react'
import { useFitScale } from './useFitScale.js'

/**
 * Scales the game down on a phone until it fits the room the browser left it.
 *
 * Sigil is a game, not a document: ASCEND, DESCEND and the room cards are all
 * things you reach for mid-run, and a page that scrolls puts them under your
 * thumb only after a swipe. Fitting them by trimming padding got the layout
 * into a 375x667 viewport -- and then reality did not care, because nobody
 * plays in a 375x667 viewport. Safari's address bar and toolbar take ~114px of
 * an iPhone SE, leaving 553; an in-app browser (a link opened inside Instagram
 * or Discord, which is how a shared game actually gets opened) takes more
 * still, and the number varies by app and by whether the toolbars have
 * collapsed yet. There is no fixed budget to design against.
 *
 * So the layout is left alone and the rendered result is scaled, the same trick
 * EmbeddedStage plays for the itch.io iframe: the app lays out at the device's
 * true width -- which keeps every responsive breakpoint reading the real width
 * rather than some invented design width -- and is scaled by
 * available/content so the tallest screen lands exactly on the bottom edge.
 *
 * Three bounds keep this from making things worse:
 *
 *   - Only below `md`. A desktop window is expected to scroll, and scaling a
 *     long page down to avoid it would be absurd.
 *   - Never above 1. A screen that already fits is not touched at all, and
 *     pays nothing but a transform it never applies -- which matters, because
 *     `transform` on this element would otherwise make it the containing block
 *     for the top bar and every `fixed inset-0` modal. When the scale does
 *     engage that is exactly what we want (they scale with the stage instead of
 *     drifting off it), but it must not happen on the screens that never needed
 *     it.
 *   - Never below MIN_SCALE. Past that the game is unreadable, and shrinking
 *     something to the point of uselessness is not fitting it. A phone held in
 *     landscape lands here, and gets today's ordinary scrolling instead.
 *
 * Only the game route mounts this, so the privacy policy -- a long document
 * that is *supposed* to scroll -- is never scaled to a postage stamp.
 *
 * Scaling is uniform, so when it engages the game is also narrower than the
 * screen and pillars of page background show at the sides. That is the trade a
 * non-uniform scale would avoid by stretching every card, which is worse. It is
 * also why the stage keeps `width: 100%` rather than widening to compensate:
 * width would then feed back into content height and back into scale, and the
 * measurement could oscillate instead of settling.
 */

// Below this the game is too small to read, so scrolling is the better answer.
const MIN_SCALE = 0.72
// Tailwind's `md`. Below it the app is in its stacked mobile layouts.
const MOBILE = '(max-width: 767px)'

export default function MobileFitStage({ children }) {
  const ref = useRef(null)
  const [scale, setScale] = useState(1)

  const computeScale = useCallback((content, available) => {
    if (!window.matchMedia(MOBILE).matches) return 1
    if (content <= 0 || available <= 0) return 1
    const needed = available / content
    if (needed >= 1) return 1
    return needed < MIN_SCALE ? 1 : needed
  }, [])

  const apply = useCallback(next => setScale(prev => (prev === next ? prev : next)), [])

  useFitScale(ref, computeScale, apply)

  // The lock is what makes the viewport the hard boundary, and it is only safe
  // once we know the content fits inside it -- otherwise it would cut off a
  // bottom nothing could scroll to. Hence a class driven by the measured
  // result rather than a bare media query.
  const fitted = scale < 1
  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('fit-locked', fitted)
    return () => root.classList.remove('fit-locked')
  }, [fitted])

  return (
    <div
      className="mobile-stage"
      ref={ref}
      style={fitted ? { '--stage-scale': scale } : undefined}
    >
      {children}
    </div>
  )
}
