import { test, expect } from '@playwright/test'
import { DESCENT, SAVE_KEY, TUTORIAL_KEY } from './fixtures/descent.js'

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
// The kit below is deliberately the demanding one: five cards across four
// suits, so the ending-kit fan draws four rows rather than the two a small kit
// would. A guard set against an easy fixture is not a guard.

const HANDLE_KEY = 'scoundrel:leaderboardHandle'

// The heights below are the *usable* viewport, not the screen. That distinction
// is the whole reason this file needed a second pass: an earlier version tested
// 375x667 and passed, while a real iPhone SE still scrolled, because Safari's
// address bar and toolbar take ~114px and the page only ever gets 553 of it.
// Testing the screen size measures a device nobody is holding.
//
// Values are the toolbars-showing state, which is what you land on. Once you
// scroll they collapse and you get more -- but needing to scroll to earn the
// room to not scroll is exactly the bug.
const VIEWPORTS = [
  { name: 'iPhone SE / Safari 375x553', width: 375, height: 553 },
  { name: 'Android / Chrome 360x650', width: 360, height: 650 },
  { name: 'iPhone 12-14 / Safari 390x754', width: 390, height: 754 },
  { name: 'iPhone 15 Pro / Safari 393x762', width: 393, height: 762 },
  // Installed to the home screen there is no chrome at all, so the full screen
  // is usable. Kept so the no-chrome case cannot regress unnoticed.
  { name: 'iPhone SE / installed 375x667', width: 375, height: 667 },
]

function outcomeState(phase) {
  return {
    phase,
    sigilsEarned: phase === 'victory' ? 10 : 3,
    sigilTarget: 10,
    mode: 'default',
    ascension: 0,
    boons: ['vanguard'],
    kit: [
      { id: 'k1', suit: 'D', rank: 7 },
      { id: 'k2', suit: 'H', rank: 5 },
      { id: 'k3', suit: 'C', rank: 9 },
      { id: 'k4', suit: 'S', rank: 11 },
      { id: 'k5', suit: 'C', rank: 4 },
    ],
    themesFaced: ['the_quiet'],
    bossesDefeated: [],
    runRoomsEntered: 9,
    monstersSlain: 14,
    biggestKill: 11,
    weapon: { rank: 7, originalRank: 7 },
    carriedWeapon: phase === 'victory' ? { rank: 7, originalRank: 7 } : null,
    retired: false,
    runStartedAt: Date.now() - 540000,
    log: ['A heavy blow lands in the dark.'],
  }
}

async function seed(page, { state = null, handle = null } = {}) {
  await page.addInitScript(({ saveKey, tutKey, handleKey, state, handle }) => {
    localStorage.setItem(tutKey, 'true')
    if (handle !== null) localStorage.setItem(handleKey, handle)
    if (state) localStorage.setItem(saveKey, JSON.stringify({ version: 1, state }))
  }, { saveKey: SAVE_KEY, tutKey: TUTORIAL_KEY, handleKey: HANDLE_KEY, state, handle })
}

// Screens a player lands on with no interaction, each seeded straight into the
// save slot.
const SCREENS = [
  // A first visit opens on the tutorial, not the sanctuary.
  { name: 'tutorial (first visit)', fresh: true, ready: p => p.getByRole('heading', { name: 'Tutorial' }) },
  // Tutorial done, no run in progress: the pre-run sanctuary. No heading here,
  // and DESCEND is the thing the player must be able to reach without a swipe,
  // which makes it the honest thing to wait on.
  { name: 'sanctuary (pre-run)', seed: { handle: '' }, ready: p => p.getByRole('button', { name: 'DESCEND' }) },
  { name: 'sanctuary (mid-run)', seed: { state: { ...DESCENT, phase: 'sanctuary', room: [] }, handle: '' },
    ready: p => p.getByRole('heading', { name: 'Ready to descend' }) },
  { name: 'descent', seed: { state: DESCENT, handle: '' }, ready: p => p.getByText(/Flee the room/i) },
  // The anonymous victory is listed separately from the named one because it
  // carries an extra paragraph -- the leaderboard nudge -- and so is the
  // tallest state the outcome screen has.
  { name: 'victory (anonymous)', seed: { state: outcomeState('victory'), handle: '' },
    ready: p => p.getByRole('button', { name: 'ASCEND' }) },
  { name: 'victory (named)', seed: { state: outcomeState('victory'), handle: 'Rookwarden' },
    ready: p => p.getByRole('button', { name: 'ASCEND' }) },
  { name: 'death', seed: { state: outcomeState('gameover'), handle: '' },
    ready: p => p.getByRole('button', { name: 'BEGIN AGAIN' }) },
]

for (const vp of VIEWPORTS) {
  for (const screen of SCREENS) {
    test(`${screen.name} fits ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height })
      if (!screen.fresh) await seed(page, screen.seed)
      await page.goto('/', { waitUntil: 'networkidle' })
      await screen.ready(page).first().waitFor()
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
        `${screen.name} scrolls on ${vp.name} (over by ${m.scrollHeight - m.clientHeight}px)`,
      ).toBeLessThanOrEqual(m.clientHeight + 1)

      // So also check the painted height really lands inside the viewport --
      // this is the one that catches content being clipped rather than fitted.
      const painted = Math.round(m.stageHeight * m.scale)
      expect(
        painted,
        `${screen.name} is clipped on ${vp.name}: ${m.stageHeight}px of content at scale ${m.scale} paints ${painted}px into ${m.clientHeight}px`,
      ).toBeLessThanOrEqual(m.clientHeight + 1)

      // And the thing the player reaches for has to be on screen, whole. This
      // is the actual requirement; the heights above are how it is achieved.
      const box = await screen.ready(page).first().boundingBox()
      expect(box, `${screen.name}: could not locate its primary control`).not.toBeNull()
      expect(
        Math.round(box.y + box.height),
        `${screen.name}: its primary control ends at ${Math.round(box.y + box.height)}px, past the ${m.clientHeight}px viewport on ${vp.name}`,
      ).toBeLessThanOrEqual(m.clientHeight)
    })
  }
}
