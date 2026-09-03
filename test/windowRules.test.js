import { describe, it, expect } from 'vitest'
import { fitBounds, COMFORTABLE_HEIGHT, PREFERRED, MINIMUM, MARGIN } from '../electron/windowRules.cjs'

/**
 * The desktop window's opening size (docs/STEAM.md, S04).
 *
 * Worth testing on its own because the rule it encodes is invisible from the
 * shell's side: 760px is a threshold in src/index.css, not in Electron, and a
 * window one pixel under it silently serves the phone card layout in a
 * full-size desktop window. Nothing else in the suite can see that seam --
 * the CSS does not know about windows and the window does not know about CSS.
 */

/** A work area, in the shape Electron's screen API returns one. */
const area = (width, height) => ({ x: 0, y: 0, width, height })

describe('fitBounds', () => {
  it('uses the preferred size on a display with room to spare', () => {
    expect(fitBounds(area(2560, 1440))).toEqual(PREFERRED)
  })

  it('never returns anything smaller than the window minimum', () => {
    // Electron would clamp this anyway; returning it is still wrong, because a
    // caller reading the result back would be told a size the window never had.
    const bounds = fitBounds(area(640, 480))
    expect(bounds.width).toBe(MINIMUM.width)
    expect(bounds.height).toBe(MINIMUM.height)
  })

  it('leaves a margin so the window does not touch the taskbar', () => {
    const bounds = fitBounds(area(1100, 2000))
    expect(bounds.width).toBe(1100 - MARGIN.width)
  })

  it('gives up the margin rather than drop under the comfortable height', () => {
    // The rule this file exists for. A 1440x810 work area minus the 60px
    // margin is 750 -- nine pixels under the threshold, and every card in the
    // room would clamp to 155px wide. The margin is worth less than that, so
    // it is spent.
    const workArea = area(1440, 810)
    expect(workArea.height - MARGIN.height).toBeLessThan(COMFORTABLE_HEIGHT)

    const bounds = fitBounds(workArea)
    expect(bounds.height).toBe(810)
    expect(bounds.height).toBeGreaterThanOrEqual(COMFORTABLE_HEIGHT)
  })

  it('keeps the margin when the display could never clear the threshold', () => {
    // A 1366x768 laptop: the work area itself is under 760 once the taskbar is
    // gone, so spending the margin would buy nothing and cost the breathing
    // room. The compact layout is the right answer here and is not a bug.
    const bounds = fitBounds(area(1366, 728))
    expect(bounds.height).toBe(728 - MARGIN.height)
    expect(bounds.height).toBeLessThan(COMFORTABLE_HEIGHT)
  })

  it('does not exceed the preferred size on a very tall display', () => {
    const bounds = fitBounds(area(3840, 2160))
    expect(bounds.height).toBe(PREFERRED.height)
    expect(bounds.width).toBe(PREFERRED.width)
  })
})
