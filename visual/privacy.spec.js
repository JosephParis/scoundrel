import { test, expect } from '@playwright/test'

// The privacy policy and its entry points (issue 06).
//
// Runs in the `dev` project: nothing here differs between builds. The point of
// asserting on content is that a policy which drifts from what the code does is
// worse than none, so the processors it names are pinned by a test.

const TUTORIAL_KEY = 'scoundrel:tutorialCompleted'

async function skipTutorial(page) {
  await page.addInitScript(key => {
    localStorage.setItem(key, 'true')
  }, TUTORIAL_KEY)
}

test.describe('privacy policy page', () => {
  test('renders at /privacy', async ({ page }) => {
    await page.goto('/privacy')
    await expect(page.getByRole('heading', { name: 'Privacy', exact: true })).toBeVisible()
  })

  test('names every processor that receives data', async ({ page }) => {
    // If a processor is added or removed in code, this test should be what fails.
    await page.goto('/privacy')
    for (const processor of ['Google', 'Neon', 'PostHog', 'Vercel']) {
      await expect(page.getByText(processor, { exact: false }).first()).toBeVisible()
    }
  })

  test('lists a deletion contact as a mailto link', async ({ page }) => {
    await page.goto('/privacy')
    const mailto = page.locator('a[href^="mailto:"]')
    await expect(mailto.first()).toBeVisible()
    expect(await mailto.first().getAttribute('href')).toContain('@')
  })

  test('states that PostHog does not receive an email address', async ({ page }) => {
    // Pins the decision made in issue 06 -- if identify() starts sending PII
    // again, this claim becomes false and the policy has to change with it.
    await page.goto('/privacy')
    await expect(page.getByText(/not your email address or your name/i)).toBeVisible()
  })

  test('explains that the leaderboard handle is the only public field', async ({ page }) => {
    await page.goto('/privacy')
    await expect(page.getByRole('heading', { name: /What is public/i })).toBeVisible()
  })

  test('links back to the game', async ({ page }) => {
    await page.goto('/privacy')
    await page.getByRole('link', { name: /Back to the game/i }).first().click()
    await expect(page.getByRole('button', { name: 'Descend' })).toBeVisible()
  })
})

test.describe('privacy policy entry points', () => {
  test('is reachable from the corner badge on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await skipTutorial(page)
    await page.goto('/')
    const link = page.getByRole('link', { name: 'Privacy', exact: true })
    await expect(link).toBeVisible()
    expect(await link.getAttribute('href')).toBe('/privacy')
  })

  test('the corner badge is gone on a phone, where it was a thumb trap', async ({ page }) => {
    // Pinned bottom-right it sat under a resting thumb, and a 10px target with
    // a whole run behind it kept getting opened by accident. Settings is the
    // way in on mobile now (asserted below), so the corner must be empty --
    // both halves of it, since the build SHA was the other half of the trap.
    await page.setViewportSize({ width: 390, height: 754 })
    await skipTutorial(page)
    await page.goto('/')
    await expect(page.getByRole('link', { name: 'Privacy', exact: true })).toBeHidden()
    await expect(page.locator('a[href*="/commit/"], a[href$="JosephParis/sigil"]')).toBeHidden()
  })

  test('is reachable from Settings', async ({ page }) => {
    await skipTutorial(page)
    await page.goto('/')
    await page.getByRole('button', { name: 'More options' }).click()
    await page.getByRole('menuitem', { name: /Settings/ }).click()
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()

    const link = page.getByRole('link', { name: /Privacy .* what data is collected/i })
    await expect(link).toBeVisible()
    expect(await link.getAttribute('href')).toBe('/privacy')
    // A new tab, so reading it does not discard the run behind the modal.
    expect(await link.getAttribute('target')).toBe('_blank')
  })

  test('carries the build stamp too, since the corner badge is desktop-only', async ({ page }) => {
    // On a phone this is the only place the build is readable, and "which build
    // is this?" is the first question any bug report has to answer.
    await page.setViewportSize({ width: 390, height: 754 })
    await skipTutorial(page)
    await page.goto('/')
    await page.getByRole('button', { name: 'More options' }).click()
    await page.getByRole('menuitem', { name: /Settings/ }).click()
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()

    const build = page.getByRole('link', { name: /^build / })
    await expect(build).toBeVisible()
    expect(await build.getAttribute('href')).toContain('github.com/JosephParis/sigil')
    expect(await build.getAttribute('target')).toBe('_blank')
  })

  test('is reachable from the sign-in modal', async ({ page }) => {
    await skipTutorial(page)
    await page.goto('/')
    await page.getByRole('button', { name: 'More options' }).click()
    await page.getByRole('menuitem', { name: /Log in with Google/i }).click()
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()

    // Asserted in the dev project, where VITE_GOOGLE_CLIENT_ID is absent and the
    // modal shows its local fallback form -- so this also pins that the
    // disclosure renders on both sign-in paths, not just the Google one.
    const link = page.getByRole('link', { name: /What is collected/i })
    await expect(link).toBeVisible()
    expect(await link.getAttribute('href')).toBe('/privacy')
  })
})
