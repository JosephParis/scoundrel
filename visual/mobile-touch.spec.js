import { test, expect } from '@playwright/test'
import { VIEWPORTS, SCREENS } from './fixtures/devices.js'

// The browser's own touch gestures must stay out of the game's way.
//
// Players reported the game zooming in and sliding side to side under a drag,
// and taps going unregistered around it. None of it was layout: every screen
// already measures exactly viewport-wide (mobile-no-scroll.spec.js now asserts
// that too). It was the gestures the browser reserves by default -- above all
// double-tap-drag-to-zoom, whose opening two taps are indistinguishable from
// playing a card and then the next one. Once that fires the page is zoomed, a
// sideways drag pans it, and taps land somewhere other than where they were
// aimed.
//
// The fix is a handful of declarations in src/index.css, and declarations are
// exactly the kind of thing that gets dropped by a later refactor with nothing
// to notice. Headless Chromium will not perform a real double-tap-zoom, so
// what is checked here is that the properties which suppress it are in force
// on the elements that need them -- the cause, since the effect is not
// reachable from this harness.

const PHONE = VIEWPORTS[0]
const DESCENT = SCREENS.find(s => s.id === 'descent')

async function openDescent(page) {
  await page.setViewportSize({ width: PHONE.width, height: PHONE.height })
  await page.addInitScript(store => {
    localStorage.clear()
    if (store) for (const [k, v] of Object.entries(store)) localStorage.setItem(k, v)
  }, DESCENT.storage)
  await page.goto('/', { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: /Flee the room/i }).first().waitFor()
  await page.evaluate(() => document.fonts.ready)
}

test('the page gives up double-tap zoom and overscroll', async ({ page }) => {
  await openDescent(page)

  const root = await page.evaluate(() => {
    const cs = getComputedStyle(document.documentElement)
    return {
      touchAction: cs.touchAction,
      overscrollBehavior: cs.overscrollBehaviorY,
    }
  })

  // `manipulation`, not `none`: one-finger panning and a deliberate pinch to
  // magnify both have to survive. Only the double-tap gestures go.
  expect(
    root.touchAction,
    'the root element must be touch-action: manipulation, or a double tap on two cards in a row zooms the game',
  ).toBe('manipulation')

  // Otherwise a downward drag mid-run is Android's pull-to-refresh, and the
  // run is gone.
  expect(
    root.overscrollBehavior,
    'the root element must be overscroll-behavior: none, or a drag down reloads the page mid-run',
  ).toBe('none')
})

test('cards and controls do not start a selection or a callout', async ({ page }) => {
  await openDescent(page)

  // The room's cards are the most-tapped things in the game, and the control
  // the player reaches for when a room goes badly. If a drag that starts on
  // one of these can begin a text selection or raise the long-press callout,
  // it swallows the tap that follows.
  const targets = [
    page.locator('.card-face').first(),
    page.getByRole('button', { name: /Flee the room/i }).first(),
  ]

  for (const target of targets) {
    const style = await target.evaluate(el => {
      const cs = getComputedStyle(el)
      return {
        userSelect: cs.webkitUserSelect || cs.userSelect,
        touchCallout: cs.webkitTouchCallout,
        touchAction: cs.touchAction,
      }
    })
    const what = await target.evaluate(el => el.className || el.tagName)

    expect(style.userSelect, `${what} is text-selectable, so a drag across it eats the next tap`).toBe('none')
    expect(style.touchAction, `${what} does not suppress double-tap zoom`).toBe('manipulation')
    // Chromium reports '' for -webkit-touch-callout, which only WebKit
    // implements; assert it only where the engine knows the property.
    if (style.touchCallout) expect(style.touchCallout).toBe('none')
  }
})

test('prose stays selectable', async ({ page }) => {
  // The suppression above is scoped to controls on purpose. The privacy policy
  // is a document, and a document nobody can copy a line out of is a
  // regression, not a fix.
  await page.setViewportSize({ width: PHONE.width, height: PHONE.height })
  await page.goto('/privacy', { waitUntil: 'networkidle' })
  const paragraph = page.locator('p').first()
  await paragraph.waitFor()
  const userSelect = await paragraph.evaluate(el => {
    const cs = getComputedStyle(el)
    return cs.webkitUserSelect || cs.userSelect
  })
  expect(userSelect, 'the privacy policy must stay selectable').not.toBe('none')
})
