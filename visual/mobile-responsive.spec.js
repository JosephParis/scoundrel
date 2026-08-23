import { test, expect } from '@playwright/test'
import { DESCENT } from './fixtures/descent.js'

/**
 * Mobile Responsive Tests
 *
 * 1. No scrolling needed during gameplay
 * 2. All essential info visible on mobile
 * 3. Modals work correctly
 * 4. Desktop layout unchanged
 *
 * Rewritten for the current UI (issue 26). The previous version drove the app
 * through `Begin` -> `Skip tutorial` -> `Descend`; there is no Begin button any
 * more -- `/` loads straight into the opening sanctuary -- so all 25 tests sat
 * on a 30s selector timeout. Notes on what else moved:
 *
 * - The sanctuary's mobile compact header is deliberately hidden on the opening
 *   visit (`!isOpeningVisit`, i.e. sigilsEarned > 0), so asserting its layout
 *   requires a mid-run sanctuary. seedMidRunSanctuary() writes one straight to
 *   the save slot rather than playing a descent, which would be slow and random.
 * - The sanctuary has `Boons` and `Kit` buttons, not the old `Progress` button.
 *   `Kit` opens DeckModal; SanctuaryKitModal (the old "Your progress" heading)
 *   is now dead code, imported nowhere.
 * - The descent's kit button is an icon with aria-label "View kit", not text.
 * - "Rested" lives only in the desktop rail and is not on the mobile header.
 *
 * Every entry point goes through one of the three helpers below, so the next UI
 * change breaks one place instead of twenty-five.
 */

const MOBILE_VIEWPORT = { width: 375, height: 667 }
const DESKTOP_VIEWPORT = { width: 1920, height: 1080 }

const SAVE_KEY = 'scoundrel:save'
const TUTORIAL_KEY = 'scoundrel:tutorialCompleted'

// A sanctuary the player has already earned sigils in, so it is not the opening
// visit. boonOffers must be present (SanctuaryView reads .length unguarded) and
// the forge must be closed, or the Descend button is replaced by an offer panel.
const MID_RUN_SANCTUARY = {
  phase: 'sanctuary',
  tutorial: false,
  sigilsEarned: 3,
  sigilTarget: 10,
  hp: 20,
  maxHp: 20,
  mode: 'default',
  ascension: 0,
  boons: ['vanguard'],
  boonOffers: [],
  boonChosen: true,
  forgeOpen: false,
  forgeGrants: [],
  forgeGrantIndex: 0,
  forgeChoices: [],
  forgeInscribedIds: [],
  kit: [
    { id: 'k1', suit: 'D', rank: 7 },
    { id: 'k2', suit: 'H', rank: 5 },
    { id: 'k3', suit: 'D', rank: 4 },
    { id: 'k4', suit: 'H', rank: 6 },
  ],
  carriedWeapon: { suit: 'D', rank: 7, originalRank: 7 },
  weapon: null,
  deck: [],
  room: [],
  theme: null,
  themesFaced: ['the_quiet'],
  descents: [],
  bossesDefeated: [],
  log: ['The chamber is still.'],
}

/** Skip the curated tutorial so a plain run starts immediately. */
async function skipTutorial(page) {
  await page.addInitScript(key => {
    localStorage.setItem(key, 'true')
  }, TUTORIAL_KEY)
}

/** Opening sanctuary, tutorial skipped. Resolves once Descend is interactive. */
async function openingSanctuary(page, viewport = MOBILE_VIEWPORT) {
  await page.setViewportSize(viewport)
  await skipTutorial(page)
  await page.goto('/')
  await page.getByRole('button', { name: 'Descend' }).waitFor({ timeout: 15000 })
}

/** Mid-run sanctuary (sigils earned), so the mobile compact header renders. */
async function midRunSanctuary(page, viewport = MOBILE_VIEWPORT) {
  await page.setViewportSize(viewport)
  await page.addInitScript(({ saveKey, tutorialKey, state }) => {
    localStorage.setItem(tutorialKey, 'true')
    localStorage.setItem(saveKey, JSON.stringify({ version: 1, state }))
  }, { saveKey: SAVE_KEY, tutorialKey: TUTORIAL_KEY, state: MID_RUN_SANCTUARY })
  await page.goto('/')
  await page.getByRole('button', { name: 'Descend' }).waitFor({ timeout: 15000 })
}

/** Into a real (non-tutorial) descent, with room cards dealt. */
async function enterDescent(page, viewport = MOBILE_VIEWPORT) {
  await openingSanctuary(page, viewport)
  await page.getByRole('button', { name: 'Descend' }).click()
  await page.locator('.card-face').first().waitFor({ timeout: 15000 })
}

/**
 * The widest the header's figures realistically get.
 *
 * Max HP tops out in the 40s (base 20, plus The Quiet's +10, plus boons), a
 * fresh descent deck is 40-odd cards, and a bound weapon shows two figures of
 * two digits each -- so every read-out is at its longest at once. Narrower
 * content hides crowding bugs that this position exposes.
 */
const WIDE_DESCENT = {
  ...DESCENT,
  hp: 43,
  maxHp: 43,
  deck: Array.from({ length: 44 }, (_, i) => ({ id: `d${i}`, suit: 'S', rank: 4 })),
  weapon: { rank: 10, originalRank: 10, lastSlain: { rank: 10 } },
}

/**
 * A descent with a weapon already equipped, seeded rather than played.
 *
 * enterDescent() reaches the first room of a fresh run, where the player is
 * still bare-handed and the header reads "Bare-handed." instead of the two
 * weapon figures -- so anything asserting on those has to start from a position
 * where a weapon is in hand. The shared fixture is one.
 */
async function armedDescent(page, viewport = MOBILE_VIEWPORT, state = DESCENT) {
  await page.setViewportSize(viewport)
  await page.addInitScript(({ saveKey, tutorialKey, state }) => {
    localStorage.setItem(tutorialKey, 'true')
    localStorage.setItem(saveKey, JSON.stringify({ version: 1, state }))
  }, { saveKey: SAVE_KEY, tutorialKey: TUTORIAL_KEY, state })
  await page.goto('/')
  await page.locator('.card-face').first().waitFor({ timeout: 15000 })
  // The theme intro is a full-screen overlay; Space skips it. Not Escape, which
  // would open the pause menu over the room instead.
  await page.keyboard.press('Space')
  await page.getByRole('button', { name: 'View kit' }).waitFor({ timeout: 15000 })
  // Every assertion downstream reads a computed font size, which comes from the
  // loaded face rather than the fallback.
  await page.evaluate(() => document.fonts.ready)
}

/**
 * Minimum computed font size, in px, for each figure on the descent's mobile
 * header. Floors, not exact sizes: the figures may grow and the classes may be
 * restyled, but dropping one back to label size is the regression.
 *
 * One floor for all four, because they are deliberately one size -- see the
 * companion test that asserts they have not drifted apart.
 */
const READOUT_MIN_PX = 32

const READOUT_LABELS = ['HP', 'Deck', 'Strikes as', 'Bound to']

/**
 * Computed font size of the figure sitting under `label` on the mobile header.
 *
 * Each read-out is a small uppercase label with its figure as the next sibling,
 * so the label is what can be located by text -- the figures are bare numerals
 * that would match half the room.
 */
function readoutFigure(page, label) {
  return page
    .locator('.md\\:hidden')
    .first()
    .getByText(label, { exact: true })
    .locator('xpath=following-sibling::*[1]')
}

async function readoutFontSize(page, label) {
  const figure = readoutFigure(page, label)
  await expect(figure, `no figure sits under the "${label}" label`).toBeVisible()
  return figure.evaluate(el => parseFloat(getComputedStyle(el).fontSize))
}

/**
 * How many lines the header label `label` has taken.
 *
 * Every label on the header carries `leading-none`, so its line height is its
 * font size and the rendered height divides straight into a line count. Rounded
 * because sub-pixel font metrics put the single-line case a hair either side
 * of exactly 1.
 */
async function labelLineCount(page, label) {
  const el = page.locator('.md\\:hidden').first().getByText(label, { exact: true })
  await expect(el, `no "${label}" label on the mobile header`).toBeVisible()
  return el.evaluate(node => {
    const style = getComputedStyle(node)
    const lineHeight = parseFloat(style.lineHeight) || parseFloat(style.fontSize)
    return Math.round(node.getBoundingClientRect().height / lineHeight)
  })
}

const kitIconButton = page => page.getByRole('button', { name: 'View kit' })
const sanctuaryKitButton = page => page.getByRole('button', { name: 'Kit', exact: true })
const fleeButton = page => page.getByRole('button', { name: /Flee the room/i })
const phaseRail = page => page.locator('aside').first()

test.describe('Mobile Responsive - Descent View', () => {
  test('should show compact header on mobile', async ({ page }) => {
    await enterDescent(page)

    const mobileHeader = page.locator('.md\\:hidden').first()
    await expect(mobileHeader).toBeVisible()

    // HP and Deck read-outs plus the kit affordance all live in that header.
    await expect(mobileHeader.getByText('HP', { exact: true })).toBeVisible()
    await expect(mobileHeader.getByText('Deck', { exact: true })).toBeVisible()
    await expect(kitIconButton(page)).toBeVisible()
  })

  test('the header read-outs are large enough to read at a glance', async ({ page }) => {
    // HP, cards left, and what the weapon swings at are the figures a player
    // checks every turn on a phone, so they are sized like headings rather than
    // like labels. Asserted as a floor on the computed size rather than an
    // exact class, so restyling stays free but shrinking them back to body copy
    // does not.
    await armedDescent(page)

    for (const label of READOUT_LABELS) {
      const px = await readoutFontSize(page, label)
      expect(px, `the "${label}" figure is ${px}px, under the ${READOUT_MIN_PX}px floor`)
        .toBeGreaterThanOrEqual(READOUT_MIN_PX)
    }
  })

  test('the header figures are all the same size', async ({ page }) => {
    // They are read together -- HP against the weapon's reach against how much
    // deck is left -- so sizing one above another would rank them, and nothing
    // about the game says which would win. Asserted as equality between the
    // four rather than against a number, so raising them all stays a one-line
    // change and raising only one does not pass.
    await armedDescent(page)

    const sizes = {}
    for (const label of READOUT_LABELS) sizes[label] = await readoutFontSize(page, label)

    const distinct = new Set(Object.values(sizes))
    expect(distinct.size, `header figures differ in size: ${JSON.stringify(sizes)}`).toBe(1)
  })

  test('the header figures never crowd each other, even at 320px', async ({ page }) => {
    // Four figures at one size stop fitting on one line on the narrowest
    // phones. When they did not fit, the weapon panel squeezed rather than
    // wrapping, and "Strikes as" broke onto two lines -- which drags its label
    // down over the neighbouring "Bound to" and leaves the two numbers sitting
    // side by side with nothing left to say which is which. The panel now
    // drops to a second line instead of compressing.
    //
    // The tell is the labels, not the figures: the figures end up adjacent
    // rather than strictly overlapping, so a box-intersection check reads clean
    // on the broken layout. A label that has taken a second line does not.
    for (const viewport of [{ width: 320, height: 568 }, MOBILE_VIEWPORT]) {
      await armedDescent(page, viewport, WIDE_DESCENT)

      for (const label of READOUT_LABELS) {
        const lines = await labelLineCount(page, label)
        expect(lines, `at ${viewport.width}px the "${label}" label wrapped onto ${lines} lines`)
          .toBe(1)
      }

      // Crowding must not be relieved by shrinking a figure instead.
      for (const label of READOUT_LABELS) {
        const px = await readoutFontSize(page, label)
        expect(px, `at ${viewport.width}px the "${label}" figure shrank to ${px}px`)
          .toBeGreaterThanOrEqual(READOUT_MIN_PX)
      }

      // ...nor by letting the header push the page sideways.
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
      expect(scrollWidth, `the page scrolls sideways at ${viewport.width}px`)
        .toBeLessThanOrEqual(viewport.width)
    }
  })

  test('the sigil count is not on the mobile header', async ({ page }) => {
    // It moves once per descent and never mid-room, so it was the one figure
    // here that no turn depends on -- and the width it held was the width the
    // figures above needed to grow into. It is still on the desktop rail
    // (asserted further down) and on both outcome screens.
    await enterDescent(page)

    const mobileHeader = page.locator('.md\\:hidden').first()
    await expect(mobileHeader).toBeVisible()
    await expect(mobileHeader.getByText(/sigil/i)).toHaveCount(0)
  })

  test('should have no vertical scrollbar on mobile during descent', async ({ page }) => {
    await enterDescent(page)

    const bodyHeight = await page.evaluate(() => document.body.scrollHeight)
    expect(bodyHeight).toBeLessThanOrEqual(MOBILE_VIEWPORT.height + 50)
  })

  test('should show all room cards without scrolling on mobile', async ({ page }) => {
    await enterDescent(page)

    const cards = await page.locator('.card-face').all()
    expect(cards.length).toBeGreaterThan(0)
    for (const card of cards) {
      await expect(card).toBeInViewport()
    }
  })

  test('should open kit modal when kit button clicked', async ({ page }) => {
    await enterDescent(page)

    await kitIconButton(page).click()
    await expect(page.getByRole('heading', { name: /Your kit/i })).toBeVisible()
  })

  test('should close kit modal with Escape key', async ({ page }) => {
    await enterDescent(page)

    await kitIconButton(page).click()
    const heading = page.getByRole('heading', { name: /Your kit/i })
    await expect(heading).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(heading).toBeHidden()
  })

  test('should close kit modal when clicking outside', async ({ page }) => {
    await enterDescent(page)

    await kitIconButton(page).click()
    const heading = page.getByRole('heading', { name: /Your kit/i })
    await expect(heading).toBeVisible()

    // Click the backdrop, well away from the panel itself.
    await page.mouse.click(6, 6)
    await expect(heading).toBeHidden()
  })

  test('should hide PhaseRail sidebar on mobile', async ({ page }) => {
    await enterDescent(page)
    await expect(phaseRail(page)).toBeHidden()
  })

  test('should show flee button without scrolling on mobile', async ({ page }) => {
    await enterDescent(page)
    await expect(fleeButton(page)).toBeInViewport()
  })
})

test.describe('Mobile Responsive - Sanctuary View', () => {
  test('should show compact header on mobile in sanctuary', async ({ page }) => {
    await midRunSanctuary(page)

    const mobileHeader = page.locator('.md\\:hidden').first()
    await expect(mobileHeader).toBeVisible()
    // Same trade as the descent header: the sigil count is gone, while HP and
    // the carried weapon stay and are sized to match what the descent shows, so
    // neither figure changes size when the player descends.
    await expect(mobileHeader.getByText('HP', { exact: true })).toBeVisible()
    await expect(mobileHeader.getByText(/sigil/i)).toHaveCount(0)
    await expect(sanctuaryKitButton(page)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Boons', exact: true })).toBeVisible()
  })

  test('should have no vertical scrollbar on mobile in sanctuary', async ({ page }) => {
    await midRunSanctuary(page)

    const bodyHeight = await page.evaluate(() => document.body.scrollHeight)
    expect(bodyHeight).toBeLessThanOrEqual(MOBILE_VIEWPORT.height + 100)
  })

  test('should show descend button without scrolling on mobile', async ({ page }) => {
    await midRunSanctuary(page)
    await expect(page.getByRole('button', { name: 'Descend' })).toBeInViewport()
  })

  test('should open the kit modal from the sanctuary header', async ({ page }) => {
    await midRunSanctuary(page)

    await sanctuaryKitButton(page).click()
    // DeckModal: a "Your kit" label above an "<n> cards" heading.
    await expect(page.getByRole('button', { name: 'Close deck view' })).toBeVisible()
    await expect(page.getByRole('heading', { name: /cards/i })).toBeVisible()
  })

  test('should close the sanctuary kit modal with Escape key', async ({ page }) => {
    await midRunSanctuary(page)

    await sanctuaryKitButton(page).click()
    const close = page.getByRole('button', { name: 'Close deck view' })
    await expect(close).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(close).toBeHidden()
  })

  test('should open and close the boons modal from the sanctuary header', async ({ page }) => {
    await midRunSanctuary(page)

    await page.getByRole('button', { name: 'Boons', exact: true }).click()
    const close = page.getByRole('button', { name: 'Close boons' })
    await expect(close).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(close).toBeHidden()
  })
})

test.describe('Mobile Responsive - Desktop Layout', () => {
  test('should show full sidebar on desktop in descent', async ({ page }) => {
    await enterDescent(page, DESKTOP_VIEWPORT)

    await expect(phaseRail(page)).toBeVisible()
    // The mobile-only kit affordance must not be reachable on desktop.
    await expect(kitIconButton(page)).toBeHidden()
  })

  test('should show full sidebar on desktop in sanctuary', async ({ page }) => {
    await midRunSanctuary(page, DESKTOP_VIEWPORT)

    await expect(phaseRail(page)).toBeVisible()
    await expect(sanctuaryKitButton(page)).toBeHidden()
  })

  test('should hide mobile compact header on desktop', async ({ page }) => {
    await enterDescent(page, DESKTOP_VIEWPORT)

    const mobileHeaders = await page.locator('.md\\:hidden').all()
    for (const header of mobileHeaders) {
      await expect(header).toBeHidden()
    }
  })
})

test.describe('Mobile Responsive - Full Game Flow', () => {
  test('should show the tutorial intro without scrolling on mobile', async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT)
    // No tutorialCompleted flag: a fresh player gets the curated walk.
    await page.addInitScript(key => {
      try { localStorage.removeItem(key) } catch { /* ignore */ }
    }, TUTORIAL_KEY)
    await page.goto('/')

    const descend = page.getByRole('button', { name: 'Descend' })
    await descend.waitFor({ timeout: 15000 })
    await expect(descend).toBeInViewport()
    // The tutorial offers its own opt-out beside Descend.
    await expect(page.getByRole('button', { name: /Skip tutorial/i })).toBeVisible()
  })

  test('opening sanctuary fits the mobile viewport', async ({ page }) => {
    await openingSanctuary(page)

    const bodyHeight = await page.evaluate(() => document.body.scrollHeight)
    expect(bodyHeight).toBeLessThanOrEqual(MOBILE_VIEWPORT.height + 100)
  })

  test('should switch between mobile and desktop layouts dynamically', async ({ page }) => {
    await enterDescent(page, MOBILE_VIEWPORT)
    await expect(kitIconButton(page)).toBeVisible()
    await expect(phaseRail(page)).toBeHidden()

    await page.setViewportSize(DESKTOP_VIEWPORT)

    await expect(kitIconButton(page)).toBeHidden()
    await expect(phaseRail(page)).toBeVisible()
  })
})

test.describe('Mobile Responsive - Specific Screen Sizes', () => {
  const testSizes = [
    { name: 'iPhone SE', width: 375, height: 667 },
    { name: 'iPhone 12', width: 390, height: 844 },
    { name: 'Small Android', width: 360, height: 640 },
    { name: 'Tablet Portrait', width: 768, height: 1024 },
  ]

  for (const size of testSizes) {
    test(`should work on ${size.name} (${size.width}x${size.height})`, async ({ page }) => {
      await enterDescent(page, { width: size.width, height: size.height })

      if (size.width >= 768) {
        // Tailwind's md breakpoint is 768px, so a tablet gets the desktop rail.
        await expect(phaseRail(page)).toBeVisible()
      } else {
        await expect(kitIconButton(page)).toBeVisible()
        const cards = await page.locator('.card-face').all()
        expect(cards.length).toBeGreaterThan(0)
        for (const card of cards) {
          await expect(card).toBeInViewport()
        }
      }
    })
  }
})

// index.css raises every button to 44px under `@media (pointer: coarse)`. That
// only matches with touch emulation on, so these run in their own context --
// without hasTouch the rule never applies and the assertion would be vacuous.
test.describe('Mobile Responsive - Touch Targets', () => {
  test.use({ viewport: MOBILE_VIEWPORT, hasTouch: true, isMobile: true })

  // Guards the two tests below from becoming vacuous: if touch emulation ever
  // stops producing a coarse pointer, the 44px rule is not in play and those
  // assertions would only be measuring the buttons' natural size.
  test('touch emulation produces a coarse pointer', async ({ page }) => {
    await openingSanctuary(page)
    const coarse = await page.evaluate(() => window.matchMedia('(pointer: coarse)').matches)
    expect(coarse).toBe(true)
  })

  test('primary sanctuary action meets the 44px touch guideline', async ({ page }) => {
    await openingSanctuary(page)

    const box = await page.getByRole('button', { name: 'Descend' }).boundingBox()
    expect(box.height).toBeGreaterThanOrEqual(44)
  })

  test('flee button is tappable during a descent', async ({ page }) => {
    await enterDescent(page)

    const box = await fleeButton(page).boundingBox()
    expect(box.height).toBeGreaterThanOrEqual(44)
  })
})
