import { test, expect } from '@playwright/test'
import { VIEWPORTS, SCREENS } from './fixtures/devices.js'

// No screen may scroll the page on a phone.
//
// Sigil is a game, not a document: the ASCEND button, the room cards and the
// DESCEND button are all things you reach for mid-run, and a page that scrolls
// puts them under your thumb only after a swipe. Every screen here has to fit
// the viewport outright.
//
// This exists because the outcome screen had been overflowing by ~230px on a
// modern iPhone and ~410px on an SE for long enough that nobody could say which
// change did it -- the answer turned out to be none of them, it had simply never
// fitted. Height is the easiest thing in the world to give away one padding
// class at a time, and nothing else in the suite would notice.
//
// The device and screen list lives in fixtures/devices.js because the device
// lab (`npm run lab`) renders the very same one. What you check by eye and what
// CI enforces have to be the same set, or the lab quietly stops covering the
// case that breaks.

// How to tell each screen has finished arriving -- and, for most of them, the
// control the player is actually reaching for, which the last assertion below
// requires to be on screen whole. Keyed by screen id.
const READY = {
  tutorial: p => p.getByRole('heading', { name: 'Tutorial' }),
  'sanctuary-pre': p => p.getByRole('button', { name: 'DESCEND' }),
  'sanctuary-mid': p => p.getByRole('button', { name: 'DESCEND' }),
  descent: p => p.getByRole('button', { name: /Flee the room/i }),
  'victory-anon': p => p.getByRole('button', { name: 'ASCEND' }),
  'victory-named': p => p.getByRole('button', { name: 'ASCEND' }),
  death: p => p.getByRole('button', { name: 'BEGIN AGAIN' }),
}

async function seed(page, storage) {
  await page.addInitScript(store => {
    localStorage.clear()
    if (store) for (const [k, v] of Object.entries(store)) localStorage.setItem(k, v)
  }, storage)
}

for (const vp of VIEWPORTS) {
  for (const screen of SCREENS) {
    const label = `${vp.name} ${vp.width}x${vp.height}`
    test(`${screen.name} fits ${label}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height })
      await seed(page, screen.storage)
      await page.goto('/', { waitUntil: 'networkidle' })
      const ready = READY[screen.id]
      await ready(page).first().waitFor()
      await page.evaluate(() => document.fonts.ready)
      // Cards deal in on an animation; measuring mid-flight reads the wrong
      // height in both directions.
      await page.waitForTimeout(700)

      const m = await page.evaluate(() => {
        const de = document.documentElement
        const stage = document.querySelector('.mobile-stage')
        const scale = stage
          ? Number(getComputedStyle(stage).getPropertyValue('--stage-scale')) || 1
          : 1
        return {
          scrollHeight: de.scrollHeight,
          clientHeight: de.clientHeight,
          // Layout height of the stage; the transform does not affect this, so
          // multiplying by the scale gives what is actually painted.
          stageHeight: stage ? stage.scrollHeight : de.scrollHeight,
          scale,
        }
      })

      // Two assertions, because either alone can be satisfied by a bug.
      //
      // The document not scrolling is necessary but NOT sufficient: once the
      // stage locks the viewport it sets `overflow: hidden`, which makes
      // scrollHeight equal clientHeight whether or not anything fits. On its
      // own this check would pass a screen whose bottom half had been silently
      // cut off.
      expect(
        m.scrollHeight,
        `${screen.name} scrolls on ${label} (over by ${m.scrollHeight - m.clientHeight}px)`,
      ).toBeLessThanOrEqual(m.clientHeight + 1)

      // So also check the painted height really lands inside the viewport --
      // this is the one that catches content being clipped rather than fitted.
      const painted = Math.round(m.stageHeight * m.scale)
      expect(
        painted,
        `${screen.name} is clipped on ${label}: ${m.stageHeight}px of content at scale ${m.scale} paints ${painted}px into ${m.clientHeight}px`,
      ).toBeLessThanOrEqual(m.clientHeight + 1)

      // And the thing the player reaches for has to be on screen, whole. This
      // is the actual requirement; the heights above are how it is achieved.
      const box = await ready(page).first().boundingBox()
      expect(box, `${screen.name}: could not locate its primary control`).not.toBeNull()
      expect(
        Math.round(box.y + box.height),
        `${screen.name}: its primary control ends at ${Math.round(box.y + box.height)}px, past the ${m.clientHeight}px viewport on ${label}`,
      ).toBeLessThanOrEqual(m.clientHeight)
    })
  }
}
