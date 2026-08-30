import { test, expect } from '@playwright/test'

// Player-facing copy that makes a promise the code has to keep (issues 14, 25).
//
// Runs in the `dev` project: none of this differs between builds. These are
// content assertions on purpose. Both bugs behind this file were copy that had
// drifted from behavior — the game did the right thing and told the player
// something else — which no screenshot or unit test would ever have caught.

const TUTORIAL_KEY = 'scoundrel:tutorialCompleted'
const HANDLE_KEY = 'scoundrel:leaderboardHandle'
const SAVE_KEY = 'scoundrel:save'

async function seed(page, { handle = null, outcome = null } = {}) {
  await page.addInitScript(({ tutorialKey, handleKey, saveKey, handle, outcome }) => {
    localStorage.setItem(tutorialKey, 'true')
    if (handle !== null) localStorage.setItem(handleKey, handle)
    if (outcome) {
      // Minimal terminal state, mirroring visual/screens.spec.js: every field
      // buildRunRecord reads is defaulted, so this is enough to render the
      // outcome screen on load without playing a run.
      const state = {
        phase: outcome,
        sigilsEarned: outcome === 'victory' ? 10 : 3,
        sigilTarget: 10,
        mode: 'default',
        ascension: 0,
        boons: ['vanguard'],
        kit: [
          { id: 'k1', suit: 'D', rank: 7 },
          { id: 'k2', suit: 'H', rank: 5 },
        ],
        themesFaced: ['the_quiet'],
        bossesDefeated: [],
        runRoomsEntered: 9,
        monstersSlain: 14,
        biggestKill: 11,
        weapon: { rank: 7, originalRank: 7 },
        carriedWeapon: outcome === 'victory' ? { rank: 7, originalRank: 7 } : null,
        retired: false,
        runStartedAt: Date.now() - 540000,
        log: ['A heavy blow lands in the dark.'],
      }
      localStorage.setItem(saveKey, JSON.stringify({ version: 1, state }))
    }
  }, { tutorialKey: TUTORIAL_KEY, handleKey: HANDLE_KEY, saveKey: SAVE_KEY, handle, outcome })
}

async function openSettings(page) {
  await page.getByRole('button', { name: 'More options' }).click()
  // The overflow entries carry role="menuitem", which overrides the implicit
  // button role, and their accessible name includes the leading glyph.
  await page.getByRole('menuitem', { name: /Settings/ }).click()
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
}

// -- The board lists nameless runs as Anonymous, and the copy must say so -----
//
// This inverts what issue 14 originally asserted. That issue's complaint was
// that the copy promised an Anonymous listing the server did not deliver, and
// it was settled by removing the promise; the server now delivers it, so the
// promise is what has to be here instead. Either way the rule is the same one:
// Settings and the board must agree about what an empty name does.

test.describe('leaderboard handle copy', () => {
  test('the handle placeholder shows what an empty name lists as', async ({ page }) => {
    // The placeholder is the shortest possible answer to "what happens if I
    // leave this blank", so it has to be the literal name the board will show.
    await seed(page, { handle: '' })
    await page.goto('/')
    await openSettings(page)
    await expect(page.getByLabel('Leaderboard name')).toHaveAttribute('placeholder', 'Anonymous')
  })

  test('an empty handle is described as an Anonymous listing, not an absent one', async ({ page }) => {
    await seed(page, { handle: '' })
    await page.goto('/')
    await openSettings(page)
    await expect(page.getByText(/listed publicly as Anonymous/i)).toBeVisible()
    // The old promise, now false: an empty name no longer keeps a run off the
    // board, and nothing in Settings may still claim it does.
    await expect(page.getByText(/stay off the leaderboard entirely/i)).toHaveCount(0)
    await expect(page.getByText(/not listed/i)).toHaveCount(0)
  })

  test('a set handle is named as the credit', async ({ page }) => {
    await seed(page, { handle: 'Rookwarden' })
    await page.goto('/')
    await openSettings(page)
    await expect(page.getByText(/Victories are credited to/i)).toBeVisible()
    await expect(page.getByText('Rookwarden', { exact: false }).first()).toBeVisible()
  })
})

// -- Issue 08: a screened handle has to say so before the run is played -------

test.describe('screened handle copy', () => {
  test('warns that a screened name will not be listed', async ({ page }) => {
    await seed(page, { handle: 'xXnaziXx' })
    await page.goto('/')
    await openSettings(page)
    await expect(page.getByText(/will not be listed on the public leaderboard/i)).toBeVisible()
    // And says where the run does go, rather than implying it is lost. The name
    // is what is refused; the victory still places.
    await expect(page.getByText(/appear as Anonymous instead/i)).toBeVisible()
    // And does not also claim the opposite.
    await expect(page.getByText(/Victories are credited to/i)).toHaveCount(0)
  })

  test('names impersonation as the reason when that is the reason', async ({ page }) => {
    await seed(page, { handle: 'admin' })
    await page.goto('/')
    await openSettings(page)
    await expect(page.getByText(/reserved for the game and its moderators/i)).toBeVisible()
    await expect(page.getByText(/appear as Anonymous instead/i)).toBeVisible()
  })

  test('leaves an ordinary handle alone', async ({ page }) => {
    // The false-positive half. A denylist that eats real names is the failure
    // mode nobody reports, because the player just gives up on the board.
    await seed(page, { handle: 'Cassandra' })
    await page.goto('/')
    await openSettings(page)
    await expect(page.getByText(/Victories are credited to/i)).toBeVisible()
    await expect(page.getByText(/will not be listed/i)).toHaveCount(0)
  })

  test('still lets the name be typed through a screened prefix', async ({ page }) => {
    // "Nazir" passes through "nazi" on the fourth keystroke. Refusing to store
    // it would make the name untypable, so the field keeps accepting input and
    // only the copy changes.
    await seed(page, { handle: '' })
    await page.goto('/')
    await openSettings(page)
    const input = page.getByLabel('Leaderboard name')
    await input.fill('nazi')
    await expect(page.getByText(/will not be listed/i)).toBeVisible()
    await input.fill('Nazir')
    await expect(input).toHaveValue('Nazir')
    await expect(page.getByText(/Victories are credited to/i)).toBeVisible()
  })
})

// -- Issue 14: say it at the moment it matters, on the victory screen ---------

test.describe('anonymous-victory nudge', () => {
  const NUDGE = /listed as Anonymous/i

  test('a victory with no handle says how it is listed and links to Settings', async ({ page }) => {
    await seed(page, { handle: '', outcome: 'victory' })
    await page.goto('/')
    await expect(page.getByText(NUDGE)).toBeVisible()
    // And it must not still read as a loss -- the run does place now.
    await expect(page.getByText(/isn't on the leaderboard/i)).toHaveCount(0)
    await page.getByRole('button', { name: /Set one in Settings/i }).click()
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
  })

  test('a victory with a handle shows no nudge', async ({ page }) => {
    await seed(page, { handle: 'Rookwarden', outcome: 'victory' })
    await page.goto('/')
    await expect(page.getByText(NUDGE)).toHaveCount(0)
  })

  test('a whitespace-only handle counts as no handle', async ({ page }) => {
    // sanitizeHandle keeps a trailing space so two-word names can be typed;
    // nothing is ever posted under one, so the nudge has to trim before
    // deciding.
    await seed(page, { handle: '   ', outcome: 'victory' })
    await page.goto('/')
    await expect(page.getByText(NUDGE)).toBeVisible()
  })

  test('a death shows no nudge', async ({ page }) => {
    // Only victories are ranked, so a death has no listing to be credited for.
    await seed(page, { handle: '', outcome: 'gameover' })
    await page.goto('/')
    await expect(page.getByText(/You fall in the dark/i)).toBeVisible()
    await expect(page.getByText(NUDGE)).toHaveCount(0)
  })
})

// -- Issue 25: the rules must not promise a Trial preview --------------------

test.describe('rules copy matches the post-rework game', () => {
  test('the sanctuary rules do not claim the next Trial is previewed', async ({ page }) => {
    // REWORK.md §8: you descend fully blind. Nothing in the sanctuary reveals
    // the theme — SanctuaryView never reads state.nextTheme — so any copy
    // offering a preview teaches a loop the game does not have.
    await seed(page)
    await page.goto('/')
    await page.getByRole('button', { name: 'How to play' }).first().click()
    const modal = page.locator('.panel', { hasText: 'How the room flows' }).first()
    await expect(modal).not.toContainText(/previewed before you commit/i)
    await expect(modal).not.toContainText(/see it before you descend/i)
    await expect(modal).not.toContainText(/next Trial is shown/i)
  })

  test('the rules state that you descend blind', async ({ page }) => {
    await seed(page)
    await page.goto('/')
    await page.getByRole('button', { name: 'How to play' }).first().click()
    await expect(page.getByText(/descend blind/i).first()).toBeVisible()
  })

  test('the opening inline rules also say you descend blind', async ({ page }) => {
    // The inline panel on the first sanctuary visit is the copy most players
    // actually read; the modal is opt-in. Both have to tell the same story.
    await seed(page)
    await page.goto('/')
    const inline = page.locator('.panel', { hasText: 'The run' }).first()
    await expect(inline).toContainText(/descend blind/i)
    await expect(inline).not.toContainText(/before you commit/i)
  })

  test('no player-facing rules text still says 44-card', async ({ page }) => {
    // Settled by the rename (issue 25): the player owns a kit and the dungeon
    // rolls its own pool, so no single 44-card deck is ever handled as a unit.
    // deck.js's internal comment about the source deck stays correct and is
    // deliberately out of scope here — this asserts on player-facing copy only.
    await seed(page)
    await page.goto('/')
    await page.getByRole('button', { name: 'How to play' }).first().click()
    await expect(page.getByText(/44-card/i)).toHaveCount(0)
  })
})
