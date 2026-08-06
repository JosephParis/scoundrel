import { test, expect } from '@playwright/test'

// The error boundary's recovery screen (issue 02).
//
// Runs in the `prod` project because the crash hook is gated behind
// isDevToolsEnabled(), which is unconditionally true in a dev build -- so a dev
// server cannot demonstrate that an ordinary player is unable to trigger it.
//
// Two crash paths are covered:
//   1. ?crash=1, the deterministic hook, for the recovery UI itself.
//   2. A save that parses but is semantically broken. loadSavedGame() already
//      catches parse/JSON failures and returns null, so that path never reaches
//      the boundary. The gap it does cover is state that survives parsing and
//      then throws during render -- which is the realistic corruption case.

const SAVE_KEY = 'scoundrel:save'
const TUTORIAL_KEY = 'scoundrel:tutorialCompleted'
const DEV_KEY = 'scoundrel:devTools'

const FALLBACK_HEADING = /The dungeon collapsed/i

// sigilsEarned > 0 makes this a non-opening visit, so SanctuaryView evaluates
// `!game.boonChosen && game.boonOffers.length` -- an unguarded read that throws
// on a null boonOffers. A plausible shape for a truncated or half-migrated save.
const CORRUPT_SANCTUARY = {
  phase: 'sanctuary',
  tutorial: false,
  sigilsEarned: 3,
  sigilTarget: 10,
  hp: 20,
  maxHp: 20,
  mode: 'default',
  ascension: 0,
  boons: [],
  boonOffers: null,
  boonChosen: false,
  kit: [],
  log: [],
}

async function seed(page, entries) {
  await page.addInitScript(pairs => {
    for (const [k, v] of pairs) localStorage.setItem(k, v)
  }, entries)
}

const fallback = page => page.getByRole('heading', { name: FALLBACK_HEADING })
const reloadButton = page => page.getByRole('button', { name: 'Reload', exact: true })
const discardButton = page => page.getByRole('button', { name: /Discard the current run/i })
const reportButton = page => page.getByRole('button', { name: /crash report|Sending|Report sent|Couldn't send/i })

test.describe('error boundary', () => {
  test('a render throw shows the recovery screen, not a blank page', async ({ page }) => {
    await seed(page, [[TUTORIAL_KEY, 'true'], [DEV_KEY, '1']])
    await page.goto('/?crash=1')

    await expect(fallback(page)).toBeVisible()
    // The message is surfaced so a player can quote it in a report.
    await expect(page.getByText(/Deliberate crash from \?crash=1/)).toBeVisible()
  })

  test('recovery screen offers reload, discard and report', async ({ page }) => {
    await seed(page, [[TUTORIAL_KEY, 'true'], [DEV_KEY, '1']])
    await page.goto('/?crash=1')
    await expect(fallback(page)).toBeVisible()

    await expect(reloadButton(page)).toBeVisible()
    await expect(discardButton(page)).toBeVisible()
    await expect(reportButton(page)).toBeVisible()
  })

  test('an ordinary player cannot trigger the crash hook', async ({ page }) => {
    // No dev opt-in: ?crash=1 must be inert in a production build.
    await seed(page, [[TUTORIAL_KEY, 'true']])
    await page.goto('/?crash=1')

    await expect(page.getByRole('button', { name: 'Descend' })).toBeVisible()
    await expect(fallback(page)).toHaveCount(0)
  })

  test('discarding the run clears only the save and recovers', async ({ page }) => {
    // Only the flags that should survive a reload go through addInitScript --
    // it re-runs on every navigation, so seeding the save that way would
    // resurrect it the moment Discard reloads the page.
    await seed(page, [[TUTORIAL_KEY, 'true'], [DEV_KEY, '1']])
    await page.goto('/')
    await page.evaluate(({ saveKey, state }) => {
      localStorage.setItem(saveKey, JSON.stringify({ version: 1, state }))
      localStorage.setItem('scoundrel:handle', 'Keepme')
    }, { saveKey: SAVE_KEY, state: CORRUPT_SANCTUARY })

    await page.goto('/?crash=1')
    await expect(fallback(page)).toBeVisible()

    await discardButton(page).click()

    // The reload keeps ?crash=1, so the hook fires again -- but the save is gone.
    await expect(fallback(page)).toBeVisible()
    expect(await page.evaluate(k => localStorage.getItem(k), SAVE_KEY)).toBeNull()
    // Unrelated data is deliberately preserved.
    expect(await page.evaluate(() => localStorage.getItem('scoundrel:handle'))).toBe('Keepme')
    expect(await page.evaluate(k => localStorage.getItem(k), TUTORIAL_KEY)).toBe('true')
  })

  test('reload from the recovery screen returns to the game once the cause is gone', async ({ page }) => {
    await seed(page, [[TUTORIAL_KEY, 'true'], [DEV_KEY, '1']])
    await page.goto('/?crash=1')
    await expect(fallback(page)).toBeVisible()

    // Same device, no crash param: the app must come back normally.
    await page.goto('/')
    await expect(page.getByRole('button', { name: 'Descend' })).toBeVisible()
    await expect(fallback(page)).toHaveCount(0)
  })

  test('a semantically corrupt save is caught rather than blanking the page', async ({ page }) => {
    await seed(page, [
      [TUTORIAL_KEY, 'true'],
      [SAVE_KEY, JSON.stringify({ version: 1, state: CORRUPT_SANCTUARY })],
    ])
    await page.goto('/')

    // Either the app tolerates the shape, or the boundary catches it. What must
    // never happen is an empty page with no way forward. Waiting on the union
    // rather than counting avoids racing whichever one renders -- today this
    // state does throw, but a future guard in SanctuaryView would make it not.
    const descend = page.getByRole('button', { name: 'Descend' })
    await expect(fallback(page).or(descend).first()).toBeVisible()

    if (await fallback(page).count() > 0) {
      await expect(discardButton(page)).toBeVisible()
    } else {
      await expect(descend).toBeVisible()
    }
  })

  test('the crash is recorded to the console', async ({ page }) => {
    // The PostHog leg cannot be asserted here: no VITE_PUBLIC_POSTHOG_TOKEN is
    // set for the test build, so the client never initialises and capture() is
    // correctly skipped. The console record is the unconditional one, and is the
    // only trace available if a crash reaches a real user with analytics blocked.
    const errors = []
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text())
    })

    await seed(page, [[TUTORIAL_KEY, 'true'], [DEV_KEY, '1']])
    await page.goto('/?crash=1')
    await expect(fallback(page)).toBeVisible()

    expect(errors.some(t => t.includes('[scoundrel] uncaught render error'))).toBe(true)
  })

  test('a save that is not valid JSON is ignored and a fresh run starts', async ({ page }) => {
    await seed(page, [[TUTORIAL_KEY, 'true'], [SAVE_KEY, '{ not json at all']])
    await page.goto('/')

    // loadSavedGame() swallows this and returns null, so the boundary is not
    // even reached; the player simply gets a fresh run.
    await expect(page.getByRole('button', { name: 'Descend' })).toBeVisible()
    await expect(fallback(page)).toHaveCount(0)
  })
})
