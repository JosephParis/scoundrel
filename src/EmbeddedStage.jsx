import { useCallback, useRef } from 'react'
import { useFitScale } from './useFitScale.js'

/**
 * Scales the whole app down until it fits the frame it is embedded in.
 *
 * Only used by the standalone (itch.io) build. itch serves the game in an
 * iframe of a fixed configured size which does not scroll its document, so a
 * screen taller than that size simply loses its bottom -- no scrollbar, no
 * indication. The sanctuary runs ~870px at 1280 wide; against a 720px frame the
 * DESCEND button is below the fold and there is no way to reach it.
 *
 * Scrolling the content inside the frame would make it reachable, but a player
 * should not have to scroll a game, and a scroll position is one more thing to
 * be wrong when a modal opens. So instead the layout is left alone and the
 * rendered result is scaled: the app lays out at the frame's true width -- which
 * keeps every responsive breakpoint reading the real device width rather than
 * some invented design width -- and is then scaled by frameHeight/contentHeight
 * so the tallest screen lands exactly on the bottom edge.
 *
 * The scale never goes above 1. When the frame is tall enough for the content
 * (which is the case at the recommended 1280x900 embed) nothing is scaled at
 * all and this costs a transform of scale(1).
 *
 * Two consequences worth knowing:
 *
 *   - Scaling is uniform, so when it engages the content is also narrower than
 *     the frame and thin pillars of page background show at the sides. That is
 *     the correct trade: a non-uniform scale would stretch every card.
 *   - A transform makes this element the containing block for `position: fixed`
 *     descendants. That is load-bearing, not incidental: the top bar and every
 *     `fixed inset-0` modal therefore position and scale against the stage, so
 *     they keep covering exactly the frame instead of drifting out of it.
 *
 * MobileFitStage plays the same trick against browser chrome on a phone; the
 * measuring loop both rely on is in useFitScale.js.
 */
export default function EmbeddedStage({ children }) {
  const ref = useRef(null)

  const computeScale = useCallback(
    (content, available) => (content > 0 ? Math.min(1, available / content) : 1),
    [],
  )
  // Set on the stage itself, as before: the CSS reads the custom property off
  // `.stage`, and keeping it there leaves the document element untouched.
  const apply = useCallback(scale => {
    ref.current?.style.setProperty('--stage-scale', String(scale))
  }, [])

  useFitScale(ref, computeScale, apply)

  return <div className="stage" ref={ref}>{children}</div>
}
