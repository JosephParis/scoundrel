import { test, expect } from '@playwright/test'

/**
 * The bare-hands button must not cover the card's action preview.
 *
 * The preview line at the foot of a monster card ("take 7" with the weapon
 * icon) is the *other* half of the choice the bare-hands button offers: the
 * button says what happens if you punch it, the preview says what happens if
 * you swing. The button is absolutely positioned over the card face, so it sat
 * directly on top of the line it is asking the player to compare against.
 *
 * Both card layouts are covered ('classic' and 'modern'), because they build
 * the lower half of the face differently and only the reserve is shared.
 */

const SAVE_KEY = 'scoundrel:save'
const TUTORIAL_KEY = 'scoundrel:tutorialCompleted'
const LAYOUT_KEY = 'scoundrel:cardLayout'

const MOBILE_VIEWPORT = { width: 375, height: 667 }
const DESKTOP_VIEWPORT = { width: 1920, height: 1080 }

// A descent in progress with a weapon equipped and four monsters in the room,
// so every slot shows both a weapon preview and a bare-hands button. Seeded
// straight into the save slot: playing into this position would be slow and the
// room roll is random, and this test is about layout, not the deal.
//
// Slot 0 is a plain monster, which has no rules text and so keeps the classic
// face in both layouts; slots 1-3 carry traits, which do, and so switch to the
// modern face when that layout is selected. Ranks are below the weapon's 9 so
// the weapon stays usable and `weaponDamage` is non-null -- that is the
// condition for the button to appear at all (DescentView: `showBare`).
//
// Deliberately no `armored` monster: armored means weapons do nothing, so
// there is no choice to present and no bare-hands button is drawn.
const DESCENT = {
  phase: 'descent',
  tutorial: false,
  sigilsEarned: 2,
  sigilTarget: 10,
  hp: 18,
  maxHp: 20,
  mode: 'default',
  ascension: 0,
  boons: [],
  boonOffers: [],
  boonChosen: true,
  kit: [],
  weapon: { rank: 9, originalRank: 9, lastSlain: null },
  spareWeapon: null,
  carriedWeapon: { suit: 'D', rank: 9, originalRank: 9 },
  room: [
    { id: 'm1', suit: 'S', rank: 8 },
    { id: 'm2', suit: 'C', rank: 7, relentless: true },
    { id: 'm3', suit: 'S', rank: 6, vengeful: true },
    { id: 'm4', suit: 'C', rank: 5, swelling: true },
  ],
  deck: [{ id: 'd1', suit: 'S', rank: 4 }, { id: 'd2', suit: 'C', rank: 3 }],
  discard: [],
  theme: null,
  themeChildren: [],
  themeDeckChanges: [],
  themesFaced: [],
  afflictions: {},
  potionsUsedThisRoom: 0,
  monstersFoughtThisRoom: 0,
  lastMonsterSuit: null,
  roomsEntered: 3,
  canFlee: true,
  vengefulBonus: 0,
  riposteCharge: 0,
  secondWindUsed: false,
  cloakUsed: false,
  cloakArmed: false,
  twinSoulsUsed: false,
  cowardsRewardCharge: 0,
  numbRemaining: 0,
  woundsAddedThisDescent: 0,
  pendingCursedHeal: 0,
  mapPeek: null,
  lastKilledMonsterRanks: [],
  forgeOpen: false,
  forgeGrants: [],
  forgeGrantIndex: 0,
  forgeChoices: [],
  descents: [{
    descent: 3, themes: [], startHp: 20, maxHp: 20,
    endHp: null, roomsEntered: 3, sigilEarned: false, outcome: null,
  }],
  bossesDefeated: [],
  log: ['The hall narrows.'],
}

/**
 * Load straight into the seeded descent and dismiss the theme intro.
 *
 * The intro is a full-screen overlay that auto-dismisses after ~4s; Space skips
 * it. Not Escape -- Escape also opens the pause menu over the descent
 * (index.jsx), which would leave every measurement taken through an overlay.
 * Waiting for `.card-face` is not enough on its own, since the cards render
 * behind the intro, so the bare-hands button is awaited too.
 */
async function seededDescent(page, { viewport = MOBILE_VIEWPORT, layout = 'classic' } = {}) {
  await page.setViewportSize(viewport)
  await page.addInitScript(({ saveKey, tutorialKey, layoutKey, state, layoutValue }) => {
    localStorage.setItem(tutorialKey, 'true')
    localStorage.setItem(layoutKey, layoutValue)
    localStorage.setItem(saveKey, JSON.stringify({ version: 1, state }))
  }, { saveKey: SAVE_KEY, tutorialKey: TUTORIAL_KEY, layoutKey: LAYOUT_KEY, state: DESCENT, layoutValue: layout })

  await page.goto('/')
  await page.locator('.card-face').first().waitFor({ timeout: 15000 })
  await page.keyboard.press('Space')
  await bareButtons(page).first().waitFor({ timeout: 15000 })
  // Every assertion here is a bounding box, and the preview line's height comes
  // from font metrics -- so measuring before the display face has loaded reads
  // the fallback's line height and the numbers move under you. This is what made
  // an earlier run report a 0.78px overlap that two previous runs did not.
  await page.evaluate(() => document.fonts.ready)
  // Nothing should be sitting over the room: the measurements below are
  // bounding boxes, which an overlay would not perturb, so it has to be
  // asserted rather than assumed.
  await expect(page.getByRole('button', { name: 'Resume', exact: true })).toHaveCount(0)
}

const bareButtons = page => page.getByRole('button', { name: /Bare hands/i })

/** The action preview inside card slot `i` ("take 7"), whichever face drew it. */
const previewLine = (page, i) =>
  page.locator('.card-face').nth(i).getByText(/take \d+/).first()

/** Fails if `a` and `b` overlap by more than a hairline. */
function expectNoOverlap(a, b, label) {
  expect(a, `${label}: preview box`).not.toBeNull()
  expect(b, `${label}: button box`).not.toBeNull()
  const overlap = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y)
  expect(overlap, `${label}: preview and bare-hands button overlap by ${overlap}px`)
    .toBeLessThanOrEqual(0)
}

for (const layout of ['classic', 'modern']) {
  test.describe(`bare-hands button (${layout} face)`, () => {
    test('does not cover the weapon preview on mobile', async ({ page }) => {
      await seededDescent(page, { viewport: MOBILE_VIEWPORT, layout })

      const count = await bareButtons(page).count()
      expect(count, 'every monster in the seeded room should offer bare hands').toBe(4)

      for (let i = 0; i < count; i++) {
        const preview = previewLine(page, i)
        await expect(preview, `slot ${i} preview should be visible`).toBeVisible()
        expectNoOverlap(
          await preview.boundingBox(),
          await bareButtons(page).nth(i).boundingBox(),
          `${layout} slot ${i}`,
        )
      }
    })

    test('does not cover the weapon preview on desktop', async ({ page }) => {
      await seededDescent(page, { viewport: DESKTOP_VIEWPORT, layout })

      for (let i = 0; i < 4; i++) {
        const preview = previewLine(page, i)
        await expect(preview).toBeVisible()
        expectNoOverlap(
          await preview.boundingBox(),
          await bareButtons(page).nth(i).boundingBox(),
          `${layout} slot ${i}`,
        )
      }
    })

    test('both numbers of the choice are readable at once', async ({ page }) => {
      // The point of the layout: the player can compare "swing for N" against
      // "punch for M" without moving anything. Assert the two figures are on
      // screen together and actually differ, so a regression that collapses
      // them onto one line is caught too.
      await seededDescent(page, { viewport: MOBILE_VIEWPORT, layout })

      const withWeapon = await previewLine(page, 0).innerText()
      const bare = await bareButtons(page).first().innerText()

      expect(withWeapon).toMatch(/take \d+/)
      expect(bare).toMatch(/take \d+/)
      expect(Number(withWeapon.match(/take (\d+)/)[1]))
        .toBeLessThan(Number(bare.match(/take (\d+)/)[1]))
    })
  })
}

test('rendering a room logs no console errors', async ({ page }) => {
  // The card faces are drawn by spreading one big props bag, and a `key` in a
  // spread is consumed by React as the element key rather than passed through --
  // silently, apart from a console error per card per render. It sat there for a
  // while because nothing failed: the value was also carried as `isKeyCard`, so
  // the face still drew correctly.
  //
  // This asserts on console errors generally rather than that one message. The
  // crash reporting added with the error boundary reads the console, so noise
  // here is not free, and a room render is the busiest thing the app does.
  const errors = []
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()) })
  page.on('pageerror', err => errors.push(String(err)))

  await seededDescent(page, { viewport: MOBILE_VIEWPORT, layout: 'modern' })

  expect(errors, `console errors while rendering a room:\n${errors.join('\n')}`).toEqual([])
})

test('the bare-hands label stays on one line', async ({ page }) => {
  // The reserve above the button is a fixed height, so a wrapped label would
  // grow the button back over the preview. Narrowest supported viewport, where
  // the room is two columns and each card is at its smallest.
  await seededDescent(page, { viewport: { width: 320, height: 568 }, layout: 'classic' })

  const box = await bareButtons(page).first().boundingBox()
  expect(box.height, 'bare-hands button should be a single line').toBeLessThan(44)
})
