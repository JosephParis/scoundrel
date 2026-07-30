import { test, expect } from '@playwright/test'

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
    await expect(mobileHeader.getByText('Sigils')).toBeVisible()
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
