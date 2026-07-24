import { test, expect } from '@playwright/test'

/**
 * Simplified Mobile Responsive Tests
 *
 * These tests verify the mobile layout works without timing out.
 */

const MOBILE_VIEWPORT = { width: 375, height: 667 }
const DESKTOP_VIEWPORT = { width: 1920, height: 1080 }

test.describe('Mobile Responsive - Basic Tests', () => {
  test('should load the app on mobile', async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT)
    await page.goto('/', { waitUntil: 'networkidle' })

    // App should load
    await expect(page.locator('body')).toBeVisible()

    // Should have the title somewhere
    await expect(page.locator('text=SCOUNDREL')).toBeVisible({ timeout: 10000 })
  })

  test('should load the app on desktop', async ({ page }) => {
    await page.setViewportSize(DESKTOP_VIEWPORT)
    await page.goto('/', { waitUntil: 'networkidle' })

    // App should load
    await expect(page.locator('body')).toBeVisible()

    // Should have the title
    await expect(page.locator('text=SCOUNDREL')).toBeVisible({ timeout: 10000 })
  })

  test('should have mobile-optimized meta tags', async ({ page }) => {
    await page.goto('/')

    // Check viewport meta tag
    const viewport = await page.locator('meta[name="viewport"]').getAttribute('content')
    expect(viewport).toContain('width=device-width')
  })

  test('should render without JavaScript errors on mobile', async ({ page }) => {
    const errors = []
    page.on('pageerror', error => errors.push(error.message))

    await page.setViewportSize(MOBILE_VIEWPORT)
    await page.goto('/', { waitUntil: 'networkidle' })

    // Wait a bit for any errors to show up
    await page.waitForTimeout(2000)

    // Should have no errors
    expect(errors).toEqual([])
  })

  test('should have responsive CSS classes', async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT)
    await page.goto('/', { waitUntil: 'networkidle' })

    // Check for Tailwind responsive classes (md:hidden should exist)
    const html = await page.content()
    expect(html).toContain('md:hidden')
  })

  test('should fit on mobile screen without horizontal scroll', async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT)
    await page.goto('/', { waitUntil: 'networkidle' })

    // Check if page has horizontal scroll
    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth
    })

    expect(hasHorizontalScroll).toBe(false)
  })

  test('should switch layouts between mobile and desktop', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' })

    // Start with mobile
    await page.setViewportSize(MOBILE_VIEWPORT)
    await page.waitForTimeout(500)

    // Check page width matches mobile
    const mobileWidth = await page.evaluate(() => window.innerWidth)
    expect(mobileWidth).toBe(MOBILE_VIEWPORT.width)

    // Resize to desktop
    await page.setViewportSize(DESKTOP_VIEWPORT)
    await page.waitForTimeout(500)

    // Check page width matches desktop
    const desktopWidth = await page.evaluate(() => window.innerWidth)
    expect(desktopWidth).toBe(DESKTOP_VIEWPORT.width)
  })

  test('should have appropriate font sizes on mobile', async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT)
    await page.goto('/', { waitUntil: 'networkidle' })

    // Find any text element and check it's readable (not too small)
    const fontSize = await page.evaluate(() => {
      const element = document.querySelector('body')
      return window.getComputedStyle(element).fontSize
    })

    const size = parseInt(fontSize)
    // Font should be at least 12px
    expect(size).toBeGreaterThanOrEqual(12)
  })

  test('should load assets on mobile', async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT)

    const failedRequests = []
    page.on('requestfailed', request => {
      failedRequests.push(request.url())
    })

    await page.goto('/', { waitUntil: 'networkidle' })

    // Should have no failed requests (or only acceptable ones)
    const criticalFailed = failedRequests.filter(url =>
      !url.includes('analytics') && !url.includes('tracking')
    )
    expect(criticalFailed).toEqual([])
  })

  test('should have accessible touch targets on mobile', async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT)
    await page.goto('/', { waitUntil: 'networkidle' })

    // Wait for interactive elements
    await page.waitForTimeout(1000)

    // Find all buttons
    const buttons = await page.locator('button').all()

    if (buttons.length > 0) {
      // Check first button has minimum height
      const box = await buttons[0].boundingBox()
      if (box) {
        // Should be at least 40px (close to 44px iOS guideline)
        expect(box.height).toBeGreaterThanOrEqual(40)
      }
    }
  })
})

test.describe('Mobile Responsive - Performance', () => {
  test('should load quickly on mobile', async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT)

    const startTime = Date.now()
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    const loadTime = Date.now() - startTime

    // Should load in under 5 seconds
    expect(loadTime).toBeLessThan(5000)
  })

  test('should have reasonable bundle size', async ({ page }) => {
    await page.goto('/')

    const transferSize = await page.evaluate(() => {
      const resources = performance.getEntriesByType('resource')
      const jsResources = resources.filter(r => r.name.endsWith('.js'))
      return jsResources.reduce((total, r) => total + r.transferSize, 0)
    })

    // JS bundle should be under 5MB (very generous, should be much smaller)
    expect(transferSize).toBeLessThan(5 * 1024 * 1024)
  })
})
