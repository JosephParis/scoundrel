import { useEffect } from 'react'

/**
 * Shared measuring loop behind both scale-to-fit stages.
 *
 * The two callers want different answers -- EmbeddedStage always fits the app
 * to a fixed iframe, MobileFitStage only steps in on a phone whose browser
 * chrome has eaten the room -- but the plumbing that decides *when* to remeasure
 * is identical and subtle, so it lives here once rather than being copied and
 * left to drift.
 *
 * `computeScale(contentHeight, availableHeight)` returns the scale to apply, or
 * null to mean "not our business right now"; what a caller does with that is
 * its own concern.
 *
 * Two things this gets right that a naive version does not:
 *
 *   - It reads `scrollHeight`, the layout height, which a transform does not
 *     affect. So it reads the natural height even while a previous scale is
 *     applied, and no measuring pass with the transform removed is needed --
 *     which also means applying a scale cannot re-trigger the observer below.
 *   - Height settles a frame or two after render (late webfonts, images, a
 *     dealt card animating in), so measurements are coalesced to one rAF.
 */
export function useFitScale(ref, computeScale, apply) {
  useEffect(() => {
    const el = ref.current
    if (!el) return

    let frame = 0

    const fit = () => {
      frame = 0
      const content = el.scrollHeight
      // clientHeight rather than innerHeight: excludes any scrollbar, and is
      // the visual viewport the browser is actually giving the page after its
      // own chrome has taken its cut.
      const available = document.documentElement.clientHeight
      apply(computeScale(content, available))
    }

    const schedule = () => { if (!frame) frame = requestAnimationFrame(fit) }

    // Observing the element catches content changes; the transform does not
    // affect the observed layout box, so applying a scale cannot re-trigger it.
    const observer = new ResizeObserver(schedule)
    observer.observe(el)
    window.addEventListener('resize', schedule)
    // iOS fires this, not resize, when the Safari toolbars slide away and the
    // usable height changes underneath a page that never scrolled.
    window.visualViewport?.addEventListener('resize', schedule)
    window.addEventListener('orientationchange', schedule)
    schedule()

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', schedule)
      window.visualViewport?.removeEventListener('resize', schedule)
      window.removeEventListener('orientationchange', schedule)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [ref, computeScale, apply])
}
