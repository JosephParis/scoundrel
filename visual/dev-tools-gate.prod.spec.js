import { test, expect } from '@playwright/test'

// Dev tools must not be reachable by an ordinary player (issue 01).
//
// This runs in the `prod` project against `vite preview`, NOT the dev server:
// isDevToolsEnabled() returns true whenever import.meta.env.DEV is set, so the
// dev server always shows the entry by design. Asserting absence there would
// assert the opposite of what ships. See playwright.config.js.
//
// The gate is not a security boundary -- the storage key is readable in the
// bundle. These tests pin the player-facing behavior: you don't stumble into it,
// and the documented escape hatch still works.

const DEV_KEY = 'scoundrel:devTools'

// Skip the curated walkthrough so the top bar is immediately interactive.
async function skipTutorial(page) {
  await page.addInitScript(() => {
    localStorage.setItem('scoundrel:tutorialCompleted', 'true')
  })
}

function devToolsItem(page) {
  return page.getByRole('menuitem', { name: /Dev tools/ })
}

// Navigate and wait for the app to actually boot. page.goto resolves on `load`,
// but the game is behind a lazy import, so flags.js -- the code under test --
// has not necessarily run by then. Without this, a test can read localStorage
// before the gate ever evaluated and assert on a state the app never saw.
async function load(page, url) {
  await page.goto(url)
  await page.getByRole('button', { name: 'More options' }).waitFor()
}

async function readGateKey(page) {
  return page.evaluate(k => localStorage.getItem(k), DEV_KEY)
}

async function openOverflowMenu(page) {
  await page.getByRole('button', { name: 'More options' }).click()
  // Credits is always present, so its arrival means the menu has rendered and
  // a missing Dev tools entry is a real absence rather than a race.
  await page.getByRole('menuitem', { name: /Credits/ }).waitFor()
}

test.beforeEach(async ({ page }) => {
  await skipTutorial(page)
})

test('production build hides Dev tools by default', async ({ page }) => {
  await load(page, '/')
  await openOverflowMenu(page)
  await expect(devToolsItem(page)).toHaveCount(0)
})

test('a default load writes no dev-tools key', async ({ page }) => {
  await load(page, '/')
  // Asserted only after boot: checking before the gate has evaluated would
  // pass even if a default load did opt the device in.
  expect(await readGateKey(page)).toBeNull()
})

test('?dev=1 reveals Dev tools and persists the opt-in', async ({ page }) => {
  await load(page, '/?dev=1')
  await openOverflowMenu(page)
  await expect(devToolsItem(page)).toBeVisible()
  expect(await readGateKey(page)).toBe('1')
})

test('the opt-in survives a reload with no query param', async ({ page }) => {
  await load(page, '/?dev=1')
  // The opt-in is written when the gate evaluates, so confirm it landed before
  // navigating away -- otherwise this test can only fail for the wrong reason.
  expect(await readGateKey(page)).toBe('1')

  await load(page, '/')
  await openOverflowMenu(page)
  await expect(devToolsItem(page)).toBeVisible()
})

test('?dev=0 hides Dev tools again and clears the key', async ({ page }) => {
  await load(page, '/?dev=1')
  expect(await readGateKey(page)).toBe('1')

  await load(page, '/?dev=0')
  await openOverflowMenu(page)
  await expect(devToolsItem(page)).toHaveCount(0)
  expect(await readGateKey(page)).toBeNull()
})

test('gating one entry does not disturb the rest of the menu', async ({ page }) => {
  await load(page, '/')
  await openOverflowMenu(page)
  // Guards against "hid the whole menu" passing the assertions above.
  await expect(page.getByRole('menuitem', { name: /Settings/ })).toBeVisible()
  await expect(page.getByRole('menuitem', { name: /Credits/ })).toBeVisible()
})
