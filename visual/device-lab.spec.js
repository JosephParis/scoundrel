import { test, expect } from '@playwright/test'
import { spawnSync } from 'node:child_process'
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { VIEWPORTS, SCREENS } from './fixtures/devices.js'

/**
 * The device lab (`npm run lab`, served at /lab in dev).
 *
 * The lab is how a human checks by eye what mobile-no-scroll.spec.js checks by
 * assertion, so it earns two guards of its own.
 *
 * The first is that it keeps working. It is wired to the app through three
 * things that are easy to break silently -- the fixture injection in
 * vite.config.js, shared localStorage between the page and its frames, and
 * reading `--stage-scale` back out of a frame. Break any of them and the lab
 * still renders; it just quietly reports nothing, or reports about a game it
 * failed to seed. Nobody would notice until they trusted it.
 *
 * The second is that it never ships. It is a tool for looking at the app, not
 * part of the app, and it is served by dev-only middleware precisely so no
 * build can carry it. That is a claim worth enforcing rather than assuming.
 */

const root = fileURLToPath(new URL('..', import.meta.url))

test.describe('device lab', () => {
  test('renders a live frame for every viewport the guard tests', async ({ page }) => {
    const errors = []
    page.on('pageerror', e => errors.push(e.message))

    await page.goto('/lab', { waitUntil: 'networkidle' })
    await expect(page.getByRole('heading', { name: /device lab/i })).toBeVisible()

    // One frame per viewport, at exactly the size being simulated. A frame
    // sized to anything else is measuring a device nobody is holding, which is
    // the bug this whole area exists to prevent.
    const frames = page.locator('iframe')
    await expect(frames).toHaveCount(VIEWPORTS.length)
    for (const [i, vp] of VIEWPORTS.entries()) {
      const frame = frames.nth(i)
      await expect(frame).toHaveAttribute('width', String(vp.width))
      await expect(frame).toHaveAttribute('height', String(vp.height))
    }

    expect(errors, 'the lab page threw').toEqual([])
  })

  test('reports a real verdict per frame, not a blank one', async ({ page }) => {
    await page.goto('/lab', { waitUntil: 'networkidle' })

    // The summary only resolves once every frame has been measured, so waiting
    // on it waits on the whole chain: fixtures injected, storage seeded, frames
    // loaded, scale read back.
    await expect(page.locator('#summary')).toHaveText(/^\d+\/\d+ fit$|still scroll/, { timeout: 30000 })

    const verdicts = await page.locator('.verdict').allTextContents()
    expect(verdicts).toHaveLength(VIEWPORTS.length)
    for (const v of verdicts) {
      expect(v, 'a frame never reported').toMatch(/^[✓✗]/)
    }
    // And it agrees with the guard: on a tree where mobile-no-scroll passes,
    // nothing here may be reporting a scroll.
    expect(verdicts.filter(v => v.startsWith('✗')), 'lab disagrees with the guard').toEqual([])
  })

  test('offers every screen the guard covers', async ({ page }) => {
    await page.goto('/lab', { waitUntil: 'networkidle' })
    const options = await page.locator('#screen option').allTextContents()
    expect(options.sort()).toEqual(SCREENS.map(s => s.name).sort())
  })

  test('is dev-only and cannot reach a build', async () => {
    // Not in public/, which is copied verbatim into every build.
    expect(
      existsSync(join(root, 'public', 'lab')),
      'the lab must not live in public/ -- that ships it',
    ).toBe(false)

    // And not in the output. Built fresh rather than trusting whatever dist/
    // happens to hold, since a stale directory would pass this for free.
    const build = spawnSync('npx', ['vite', 'build'], { cwd: root, shell: true, encoding: 'utf8' })
    expect(build.status, `vite build failed:\n${build.stderr}`).toBe(0)

    const marker = 'device lab'
    const offenders = []
    const walk = dir => {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry)
        if (statSync(full).isDirectory()) { walk(full); continue }
        if (!/\.(html|js|css|json|webmanifest|txt)$/i.test(entry)) continue
        if (readFileSync(full, 'utf8').toLowerCase().includes(marker)) offenders.push(full)
      }
    }
    walk(join(root, 'dist'))
    expect(offenders, 'the device lab leaked into the production build').toEqual([])
  })
})
