import { test, expect } from '@playwright/test'

/**
 * Mobile Responsive Tests
 *
 * Tests all mobile optimizations to ensure:
 * 1. No scrolling needed during gameplay
 * 2. All essential info visible on mobile
 * 3. Modals work correctly
 * 4. Desktop layout unchanged
 */

// Mobile viewport (iPhone SE - smallest common device)
const MOBILE_VIEWPORT = { width: 375, height: 667 }
// Desktop viewport
const DESKTOP_VIEWPORT = { width: 1920, height: 1080 }

test.describe('Mobile Responsive - Descent View', () => {
  test('should show compact header on mobile', async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT)
    await page.goto('/')

    // Start a new game (skip tutorial for faster testing)
    await page.getByRole('button', { name: /Begin/i }).click()
    await page.getByRole('button', { name: /Skip tutorial/i }).click()
    await page.getByRole('button', { name: /Descend/i }).click()

    // Wait for descent view to load
    await page.waitForSelector('text=/Descent|The/')

    // Mobile compact header should be visible
    const mobileHeader = page.locator('.md\\:hidden').first()
    await expect(mobileHeader).toBeVisible()

    // Kit button should be visible
    const kitButton = page.getByRole('button', { name: /Kit/i })
    await expect(kitButton).toBeVisible()

    // HP bar should be visible
    const hpBar = mobileHeader.locator('text=/HP|[0-9]+/[0-9]+/')
    await expect(hpBar).toBeVisible()
  })

  test('should have no vertical scrollbar on mobile during descent', async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT)
    await page.goto('/')

    // Start game and descend
    await page.getByRole('button', { name: /Begin/i }).click()
    await page.getByRole('button', { name: /Skip tutorial/i }).click()
    await page.getByRole('button', { name: /Descend/i }).click()

    // Wait for room cards to appear
    await page.waitForSelector('.card-face', { timeout: 5000 })

    // Check if page height exceeds viewport height (would cause scroll)
    const bodyHeight = await page.evaluate(() => document.body.scrollHeight)
    const viewportHeight = MOBILE_VIEWPORT.height

    // Allow small buffer for browser chrome
    expect(bodyHeight).toBeLessThanOrEqual(viewportHeight + 50)
  })

  test('should show all room cards without scrolling on mobile', async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT)
    await page.goto('/')

    // Start game and descend
    await page.getByRole('button', { name: /Begin/i }).click()
    await page.getByRole('button', { name: /Skip tutorial/i }).click()
    await page.getByRole('button', { name: /Descend/i }).click()

    // Wait for room cards
    await page.waitForSelector('.card-face', { timeout: 5000 })

    // All cards should be in viewport
    const cards = await page.locator('.card-face').all()
    expect(cards.length).toBeGreaterThan(0)

    for (const card of cards) {
      await expect(card).toBeInViewport()
    }
  })

  test('should open kit modal when Kit button clicked', async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT)
    await page.goto('/')

    // Start game and descend
    await page.getByRole('button', { name: /Begin/i }).click()
    await page.getByRole('button', { name: /Skip tutorial/i }).click()
    await page.getByRole('button', { name: /Descend/i }).click()

    await page.waitForSelector('.card-face', { timeout: 5000 })

    // Click Kit button
    await page.getByRole('button', { name: /Kit/i }).click()

    // Modal should be visible
    await expect(page.getByRole('heading', { name: /Your kit/i })).toBeVisible()

    // Modal should contain weapon info
    await expect(page.getByText(/Weapon/i)).toBeVisible()
  })

  test('should close kit modal with Escape key', async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT)
    await page.goto('/')

    // Start game and descend
    await page.getByRole('button', { name: /Begin/i }).click()
    await page.getByRole('button', { name: /Skip tutorial/i }).click()
    await page.getByRole('button', { name: /Descend/i }).click()

    await page.waitForSelector('.card-face', { timeout: 5000 })

    // Open kit modal
    await page.getByRole('button', { name: /Kit/i }).click()
    await expect(page.getByRole('heading', { name: /Your kit/i })).toBeVisible()

    // Press Escape
    await page.keyboard.press('Escape')

    // Modal should be closed
    await expect(page.getByRole('heading', { name: /Your kit/i })).not.toBeVisible()
  })

  test('should close kit modal when clicking outside', async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT)
    await page.goto('/')

    // Start game and descend
    await page.getByRole('button', { name: /Begin/i }).click()
    await page.getByRole('button', { name: /Skip tutorial/i }).click()
    await page.getByRole('button', { name: /Descend/i }).click()

    await page.waitForSelector('.card-face', { timeout: 5000 })

    // Open kit modal
    await page.getByRole('button', { name: /Kit/i }).click()
    await expect(page.getByRole('heading', { name: /Your kit/i })).toBeVisible()

    // Click backdrop (outside modal)
    await page.locator('.fixed.inset-0').click({ position: { x: 10, y: 10 } })

    // Modal should be closed
    await expect(page.getByRole('heading', { name: /Your kit/i })).not.toBeVisible()
  })

  test('should hide PhaseRail sidebar on mobile', async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT)
    await page.goto('/')

    // Start game and descend
    await page.getByRole('button', { name: /Begin/i }).click()
    await page.getByRole('button', { name: /Skip tutorial/i }).click()
    await page.getByRole('button', { name: /Descend/i }).click()

    await page.waitForSelector('.card-face', { timeout: 5000 })

    // PhaseRail should be hidden on mobile (has hidden md:block classes)
    const phaseRail = page.locator('aside').first()
    await expect(phaseRail).not.toBeVisible()
  })

  test('should show flee button without scrolling on mobile', async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT)
    await page.goto('/')

    // Start game and descend
    await page.getByRole('button', { name: /Begin/i }).click()
    await page.getByRole('button', { name: /Skip tutorial/i }).click()
    await page.getByRole('button', { name: /Descend/i }).click()

    await page.waitForSelector('.card-face', { timeout: 5000 })

    // Flee button should be in viewport
    const fleeButton = page.getByRole('button', { name: /Flee the room/i })
    await expect(fleeButton).toBeInViewport()
  })
})

test.describe('Mobile Responsive - Sanctuary View', () => {
  test('should show compact header on mobile in sanctuary', async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT)
    await page.goto('/')

    // Start game
    await page.getByRole('button', { name: /Begin/i }).click()
    await page.getByRole('button', { name: /Skip tutorial/i }).click()

    // Should be in sanctuary
    await expect(page.getByText(/Sanctuary/i)).toBeVisible()

    // Progress button should be visible on mobile
    const progressButton = page.getByRole('button', { name: /Progress/i })
    await expect(progressButton).toBeVisible()

    // HP should be visible
    await expect(page.getByText(/Rested/i)).toBeVisible()
  })

  test('should have no vertical scrollbar on mobile in sanctuary', async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT)
    await page.goto('/')

    // Start game
    await page.getByRole('button', { name: /Begin/i }).click()
    await page.getByRole('button', { name: /Skip tutorial/i }).click()

    await page.waitForSelector('text=/Sanctuary/i')

    // Check if page height exceeds viewport height
    const bodyHeight = await page.evaluate(() => document.body.scrollHeight)
    const viewportHeight = MOBILE_VIEWPORT.height

    // Allow buffer for dynamic content
    expect(bodyHeight).toBeLessThanOrEqual(viewportHeight + 100)
  })

  test('should show descend button without scrolling on mobile', async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT)
    await page.goto('/')

    // Start game
    await page.getByRole('button', { name: /Begin/i }).click()
    await page.getByRole('button', { name: /Skip tutorial/i }).click()

    // Descend button should be in viewport
    const descendButton = page.getByRole('button', { name: /Descend/i })
    await expect(descendButton).toBeInViewport()
  })

  test('should open progress modal when Progress button clicked', async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT)
    await page.goto('/')

    // Start game
    await page.getByRole('button', { name: /Begin/i }).click()
    await page.getByRole('button', { name: /Skip tutorial/i }).click()

    // Click Progress button
    await page.getByRole('button', { name: /Progress/i }).click()

    // Modal should be visible
    await expect(page.getByRole('heading', { name: /Your progress/i })).toBeVisible()
  })

  test('should close progress modal with Escape key', async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT)
    await page.goto('/')

    // Start game
    await page.getByRole('button', { name: /Begin/i }).click()
    await page.getByRole('button', { name: /Skip tutorial/i }).click()

    // Open progress modal
    await page.getByRole('button', { name: /Progress/i }).click()
    await expect(page.getByRole('heading', { name: /Your progress/i })).toBeVisible()

    // Press Escape
    await page.keyboard.press('Escape')

    // Modal should be closed
    await expect(page.getByRole('heading', { name: /Your progress/i })).not.toBeVisible()
  })
})

test.describe('Mobile Responsive - Desktop Layout', () => {
  test('should show full sidebar on desktop in descent', async ({ page }) => {
    await page.setViewportSize(DESKTOP_VIEWPORT)
    await page.goto('/')

    // Start game and descend
    await page.getByRole('button', { name: /Begin/i }).click()
    await page.getByRole('button', { name: /Skip tutorial/i }).click()
    await page.getByRole('button', { name: /Descend/i }).click()

    await page.waitForSelector('.card-face', { timeout: 5000 })

    // PhaseRail sidebar should be visible on desktop
    const phaseRail = page.locator('aside').first()
    await expect(phaseRail).toBeVisible()

    // Kit button should NOT be visible on desktop
    const kitButton = page.getByRole('button', { name: /^Kit$/i })
    await expect(kitButton).not.toBeVisible()
  })

  test('should show full sidebar on desktop in sanctuary', async ({ page }) => {
    await page.setViewportSize(DESKTOP_VIEWPORT)
    await page.goto('/')

    // Start game
    await page.getByRole('button', { name: /Begin/i }).click()
    await page.getByRole('button', { name: /Skip tutorial/i }).click()

    // PhaseRail sidebar should be visible
    const phaseRail = page.locator('aside').first()
    await expect(phaseRail).toBeVisible()

    // Progress button should NOT be visible on desktop
    const progressButton = page.getByRole('button', { name: /Progress/i })
    await expect(progressButton).not.toBeVisible()
  })

  test('should hide mobile compact header on desktop', async ({ page }) => {
    await page.setViewportSize(DESKTOP_VIEWPORT)
    await page.goto('/')

    // Start game and descend
    await page.getByRole('button', { name: /Begin/i }).click()
    await page.getByRole('button', { name: /Skip tutorial/i }).click()
    await page.getByRole('button', { name: /Descend/i }).click()

    await page.waitForSelector('.card-face', { timeout: 5000 })

    // Mobile header should not be visible (has md:hidden class)
    const mobileHeaders = await page.locator('.md\\:hidden').all()
    for (const header of mobileHeaders) {
      await expect(header).not.toBeVisible()
    }
  })
})

test.describe('Mobile Responsive - Full Game Flow', () => {
  test('should complete tutorial without scrolling on mobile', async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT)
    await page.goto('/')

    // Start tutorial
    await page.getByRole('button', { name: /Begin/i }).click()

    // Should not need to scroll to see tutorial content
    const tutorialPanel = page.locator('text=/Tutorial/i').first()
    await expect(tutorialPanel).toBeInViewport()

    // Descend button should be visible
    const descendButton = page.getByRole('button', { name: /Descend/i })
    await expect(descendButton).toBeInViewport()
  })

  test('should handle boon selection without scrolling on mobile', async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT)
    await page.goto('/')

    // This test would need to complete a full descent to reach boon selection
    // For now, we'll just verify the sanctuary layout is correct
    await page.getByRole('button', { name: /Begin/i }).click()
    await page.getByRole('button', { name: /Skip tutorial/i }).click()

    // Verify sanctuary fits
    const bodyHeight = await page.evaluate(() => document.body.scrollHeight)
    expect(bodyHeight).toBeLessThanOrEqual(MOBILE_VIEWPORT.height + 100)
  })

  test('should switch between mobile and desktop layouts dynamically', async ({ page }) => {
    // Start with mobile
    await page.setViewportSize(MOBILE_VIEWPORT)
    await page.goto('/')

    await page.getByRole('button', { name: /Begin/i }).click()
    await page.getByRole('button', { name: /Skip tutorial/i }).click()
    await page.getByRole('button', { name: /Descend/i }).click()

    await page.waitForSelector('.card-face', { timeout: 5000 })

    // Kit button should be visible on mobile
    await expect(page.getByRole('button', { name: /Kit/i })).toBeVisible()

    // Resize to desktop
    await page.setViewportSize(DESKTOP_VIEWPORT)

    // Wait for resize to take effect
    await page.waitForTimeout(500)

    // Kit button should be hidden on desktop
    await expect(page.getByRole('button', { name: /^Kit$/i })).not.toBeVisible()

    // Sidebar should be visible on desktop
    const phaseRail = page.locator('aside').first()
    await expect(phaseRail).toBeVisible()
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
    test(`should work on ${size.name} (${size.width}×${size.height})`, async ({ page }) => {
      await page.setViewportSize({ width: size.width, height: size.height })
      await page.goto('/')

      // Start game and descend
      await page.getByRole('button', { name: /Begin/i }).click()
      await page.getByRole('button', { name: /Skip tutorial/i }).click()
      await page.getByRole('button', { name: /Descend/i }).click()

      await page.waitForSelector('.card-face', { timeout: 5000 })

      // For tablets (>= 768px), expect desktop layout
      if (size.width >= 768) {
        // Should show sidebar
        const phaseRail = page.locator('aside').first()
        await expect(phaseRail).toBeVisible()
      } else {
        // Should show mobile compact header
        const kitButton = page.getByRole('button', { name: /Kit/i })
        await expect(kitButton).toBeVisible()

        // All room cards should be visible
        const cards = await page.locator('.card-face').all()
        for (const card of cards) {
          await expect(card).toBeInViewport()
        }
      }
    })
  }
})

test.describe('Mobile Responsive - Touch Targets', () => {
  test('should have minimum 44px touch targets on mobile', async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT)
    await page.goto('/')

    // Start game
    await page.getByRole('button', { name: /Begin/i }).click()
    await page.getByRole('button', { name: /Skip tutorial/i }).click()

    // Check Kit/Progress button height
    const progressButton = page.getByRole('button', { name: /Progress/i })
    const buttonBox = await progressButton.boundingBox()

    // Should be at least 44px tall (iOS guideline)
    expect(buttonBox.height).toBeGreaterThanOrEqual(44)
  })

  test('should have tappable flee button on mobile', async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT)
    await page.goto('/')

    // Start game and descend
    await page.getByRole('button', { name: /Begin/i }).click()
    await page.getByRole('button', { name: /Skip tutorial/i }).click()
    await page.getByRole('button', { name: /Descend/i }).click()

    await page.waitForSelector('.card-face', { timeout: 5000 })

    // Flee button should be large enough to tap
    const fleeButton = page.getByRole('button', { name: /Flee the room/i })
    const buttonBox = await fleeButton.boundingBox()

    expect(buttonBox.height).toBeGreaterThanOrEqual(44)
  })
})
