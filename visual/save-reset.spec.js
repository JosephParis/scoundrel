import { test, expect } from '@playwright/test'
import { DESCENT, SAVE_KEY, TUTORIAL_KEY } from './fixtures/descent.js'

// The escape hatch for a run that is stuck without crashing (issue 27).
//
// Runs in the `dev` project: nothing here is build-dependent, and no /api call
// is involved -- the discard is purely local storage.
//
// Everything is seeded with page.evaluate rather than addInitScript on purpose.
// addInitScript re-runs on every navigation, so a save seeded that way would be
// resurrected by the reload the discard performs, and the central assertion of
// this file would pass no matter what the button did.

const HANDLE_KEY = 'scoundrel:leaderboardHandle'

async function seedRun(page) {
  await page.goto('/')
  await page.evaluate(({ saveKey, tutorialKey, handleKey, state }) => {
    localStorage.setItem(tutorialKey, 'true')
    localStorage.setItem(handleKey, 'Testwright')
    localStorage.setItem(saveKey, JSON.stringify({ version: 1, state }))
  }, { saveKey: SAVE_KEY, tutorialKey: TUTORIAL_KEY, handleKey: HANDLE_KEY, state: DESCENT })
  await page.reload()
  // The game is behind a lazy import, so wait for something the app itself
  // draws before touching anything.
  await page.getByRole('button', { name: 'Home menu' }).waitFor()
}

async function openSettingsFromHome(page) {
  await page.getByRole('button', { name: 'Home menu' }).click()
  await page.getByRole('button', { name: /^Settings/ }).click()
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
}

// The phase held in the save slot. Discarding reloads, and the app writes a
// fresh opening sanctuary on load -- so the key existing again is expected and
// says nothing. What has to be true is that the stuck descent is not what is in
// there any more.
const savedPhase = page =>
  page.evaluate(key => JSON.parse(localStorage.getItem(key) || 'null')?.state?.phase ?? null, SAVE_KEY)

test.describe('discarding a stuck run from Settings', () => {
  test('Settings is reachable from the home menu', async ({ page }) => {
    // Before issue 27 the only routes in were the top bar and its overflow
    // menu, and the corner badge that holds them is desktop-only.
    await seedRun(page)
    await openSettingsFromHome(page)
  })

  test('the first click arms a confirmation and clears nothing', async ({ page }) => {
    await seedRun(page)
    await openSettingsFromHome(page)

    await page.getByRole('button', { name: 'Discard current run' }).click()

    await expect(page.getByText(/cannot be undone/i)).toBeVisible()
    expect(await savedPhase(page)).toBe('descent')
  })

  test('confirming clears the run and leaves everything else alone', async ({ page }) => {
    await seedRun(page)
    await openSettingsFromHome(page)

    await page.getByRole('button', { name: 'Discard current run' }).click()
    await page.getByRole('button', { name: 'Yes, discard it' }).click()

    // The discard reloads into a brand new run, so the player lands on the
    // opening sanctuary rather than back in the descent they were stuck in.
    await expect(page.getByRole('heading', { name: 'Sanctuary' })).toBeVisible()
    expect(await savedPhase(page)).toBe('sanctuary')
    const kept = await page.evaluate(
      ([tutorialKey, handleKey]) => [
        localStorage.getItem(tutorialKey),
        localStorage.getItem(handleKey),
      ],
      [TUTORIAL_KEY, HANDLE_KEY],
    )
    expect(kept).toEqual(['true', 'Testwright'])
  })

  test('backing out of the confirmation keeps the run', async ({ page }) => {
    await seedRun(page)
    await openSettingsFromHome(page)

    await page.getByRole('button', { name: 'Discard current run' }).click()
    await page.getByRole('button', { name: 'Keep playing' }).click()

    await expect(page.getByRole('button', { name: 'Discard current run' })).toBeVisible()
    expect(await savedPhase(page)).toBe('descent')
  })
})
