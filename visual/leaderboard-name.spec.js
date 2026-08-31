import { test, expect } from '@playwright/test'
import { assignedNameFor } from '../src/games/scoundrel/assignedName.js'

// The two places a player can change the name the board credits them with.
//
// copy-accuracy.spec.js asserts what each state *says*; this asserts what the
// controls actually *do* — that picking a suggestion stores it, that the opt-out
// round-trips, and that renaming from the victory screen reaches the run that
// was just recorded rather than only the next one.
//
// Runs in the `dev` project. historyStore.claimRun stops before the network in
// dev, which is exactly the seam wanted here: the local half (preference, run
// mirror, pending queue) is what this file is about, and the server half is
// covered by test/claim.handler.test.js.

const TUTORIAL_KEY = 'scoundrel:tutorialCompleted'
const HANDLE_KEY = 'scoundrel:leaderboardHandle'
const SAVE_KEY = 'scoundrel:save'
const DEVICE_KEY = 'scoundrel:deviceId'
const ANON_KEY = 'scoundrel:leaderboardAnonymous'

const DEVICE_SEED = 'e2e-naming-device'
const ASSIGNED = assignedNameFor(DEVICE_SEED)

async function seed(page, { handle = null, outcome = null, anonymous = false } = {}) {
  await page.addInitScript(({ keys, handle, outcome, deviceSeed, anonymous }) => {
    localStorage.setItem(keys.tutorial, 'true')
    localStorage.setItem(keys.device, deviceSeed)
    if (anonymous) localStorage.setItem(keys.anon, '1')
    if (handle !== null) localStorage.setItem(keys.handle, handle)
    if (outcome) {
      const state = {
        phase: outcome,
        sigilsEarned: outcome === 'victory' ? 10 : 3,
        sigilTarget: 10,
        mode: 'default',
        ascension: 0,
        boons: ['vanguard'],
        kit: [{ id: 'k1', suit: 'D', rank: 7 }],
        themesFaced: ['the_quiet'],
        bossesDefeated: [],
        runRoomsEntered: 9,
        monstersSlain: 14,
        biggestKill: 11,
        weapon: { rank: 7, originalRank: 7 },
        carriedWeapon: outcome === 'victory' ? { rank: 7, originalRank: 7 } : null,
        retired: false,
        // Fixed so the run key is stable across a reload within one test.
        runStartedAt: 1755300000000,
        runSeed: 'e2eseed1',
        log: ['A heavy blow lands in the dark.'],
      }
      localStorage.setItem(keys.save, JSON.stringify({ version: 1, state }))
    }
  }, {
    keys: {
      tutorial: TUTORIAL_KEY, handle: HANDLE_KEY, save: SAVE_KEY,
      device: DEVICE_KEY, anon: ANON_KEY,
    },
    handle, outcome, deviceSeed: DEVICE_SEED, anonymous,
  })
}

async function openSettings(page) {
  await page.getByRole('button', { name: 'More options' }).click()
  await page.getByRole('menuitem', { name: /Settings/ }).click()
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
}

const HISTORY_KEY = 'scoundrel:history:guest'

const stored = page => page.evaluate(k => localStorage.getItem(k), HANDLE_KEY)

test.describe('Settings — choosing a name', () => {
  test('Surprise me fills the field with a usable name', async ({ page }) => {
    await seed(page, { handle: '' })
    await page.goto('/')
    await openSettings(page)
    await page.getByRole('button', { name: 'Surprise me' }).click()
    const value = await page.getByLabel('Leaderboard name').inputValue()
    expect(value).toMatch(/^[A-Z][a-z]+ [A-Z][a-z]+ \d{1,2}$/)
    expect(value.length).toBeLessThanOrEqual(16)
    // And it is a real choice, not just decoration in the input.
    expect(await stored(page)).toBe(value)
  })

  test('Surprise me does not hand back the name already in use', async ({ page }) => {
    await seed(page, { handle: 'Rookwarden' })
    await page.goto('/')
    await openSettings(page)
    await page.getByRole('button', { name: 'Surprise me' }).click()
    expect(await page.getByLabel('Leaderboard name').inputValue()).not.toBe('Rookwarden')
  })

  test('opting out disables the field and persists', async ({ page }) => {
    await seed(page, { handle: '' })
    await page.goto('/')
    await openSettings(page)
    await page.getByRole('checkbox', { name: /list a name/i }).check()
    await expect(page.getByLabel('Leaderboard name')).toBeDisabled()
    await expect(page.getByText(/listed without a name/i)).toBeVisible()
    expect(await page.evaluate(k => localStorage.getItem(k), ANON_KEY)).toBe('1')
  })

  test('opting back in restores the assigned name', async ({ page }) => {
    await seed(page, { handle: '', anonymous: true })
    await page.goto('/')
    await openSettings(page)
    await page.getByRole('checkbox', { name: /list a name/i }).uncheck()
    await expect(page.getByLabel('Leaderboard name')).toBeEnabled()
    await expect(page.getByText(ASSIGNED, { exact: false }).first()).toBeVisible()
  })

  test('typing a name lifts the opt-out rather than being ignored by it', async ({ page }) => {
    // Otherwise a player who opted out months ago types a name, sees it accepted,
    // and stays unlisted with no indication why.
    await seed(page, { handle: '', anonymous: true })
    await page.goto('/')
    await openSettings(page)
    await page.getByRole('checkbox', { name: /list a name/i }).uncheck()
    await page.getByLabel('Leaderboard name').fill('Rookwarden')
    await expect(page.getByRole('checkbox', { name: /list a name/i })).not.toBeChecked()
    await expect(page.getByText(/Victories are credited to/i)).toBeVisible()
  })
})

test.describe('Victory screen — claiming a name', () => {
  test('Make it yours reveals suggestions and a field', async ({ page }) => {
    await seed(page, { handle: '', outcome: 'victory' })
    await page.goto('/')
    await page.getByRole('button', { name: /Make it yours/i }).click()
    await expect(page.getByPlaceholder('or type your own')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Show different names' })).toBeVisible()
  })

  test('picking a suggestion stores it and reports it back', async ({ page }) => {
    await seed(page, { handle: '', outcome: 'victory' })
    await page.goto('/')
    await page.getByRole('button', { name: /Make it yours/i }).click()
    const suggestion = page.locator('button', { hasText: /^[A-Z][a-z]+ [A-Z][a-z]+ \d{1,2}$/ }).first()
    const name = (await suggestion.textContent()).trim()
    await suggestion.click()
    await expect(page.getByText(name, { exact: false }).first()).toBeVisible()
    expect(await stored(page)).toBe(name)
  })

  test('the reroll offers a different set', async ({ page }) => {
    await seed(page, { handle: '', outcome: 'victory' })
    await page.goto('/')
    await page.getByRole('button', { name: /Make it yours/i }).click()
    const first = await page.getByPlaceholder('or type your own').locator('xpath=../..')
      .locator('button').allTextContents()
    await page.getByRole('button', { name: 'Show different names' }).click()
    const second = await page.getByPlaceholder('or type your own').locator('xpath=../..')
      .locator('button').allTextContents()
    expect(second).not.toEqual(first)
  })

  test('a typed name can be claimed', async ({ page }) => {
    await seed(page, { handle: '', outcome: 'victory' })
    await page.goto('/')
    await page.getByRole('button', { name: /Make it yours/i }).click()
    await page.getByPlaceholder('or type your own').fill('Rookwarden')
    await page.getByRole('button', { name: 'Claim' }).click()
    await expect(page.getByText(/This victory is listed as/i)).toBeVisible()
    await expect(page.getByText('Rookwarden', { exact: false }).first()).toBeVisible()
    expect(await stored(page)).toBe('Rookwarden')
  })

  test('Claim stays disabled until something is typed', async ({ page }) => {
    await seed(page, { handle: '', outcome: 'victory' })
    await page.goto('/')
    await page.getByRole('button', { name: /Make it yours/i }).click()
    await expect(page.getByRole('button', { name: 'Claim' })).toBeDisabled()
    await page.getByPlaceholder('or type your own').fill('Rook')
    await expect(page.getByRole('button', { name: 'Claim' })).toBeEnabled()
  })

  test('the claim reaches the run that was just recorded, not only the next one', async ({ page }) => {
    // The whole reason /api/claim exists. The run is written the moment the game
    // ends, so a rename that only changed the preference would leave this
    // victory on the board under its old name.
    await seed(page, { handle: 'OldName', outcome: 'victory' })
    await page.goto('/')
    await page.getByRole('button', { name: /Make it yours/i }).click()
    await page.getByPlaceholder('or type your own').fill('NewName')
    await page.getByRole('button', { name: 'Claim' }).click()
    await expect(page.getByText('NewName', { exact: false }).first()).toBeVisible()
    const names = await page.evaluate(() => {
      const raw = localStorage.getItem('scoundrel:history:guest')
      return raw ? JSON.parse(raw).map(r => r.playerName) : []
    })
    expect(names).toContain('NewName')
    expect(names).not.toContain('OldName')
  })

  test('after claiming, the offer becomes a second chance rather than vanishing', async ({ page }) => {
    await seed(page, { handle: '', outcome: 'victory' })
    await page.goto('/')
    await page.getByRole('button', { name: /Make it yours/i }).click()
    await page.getByPlaceholder('or type your own').fill('Rookwarden')
    await page.getByRole('button', { name: 'Claim' }).click()
    await expect(page.getByRole('button', { name: /Change it again/i })).toBeVisible()
  })
})
