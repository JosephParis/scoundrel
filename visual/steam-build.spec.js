import { test, expect, _electron as electron } from '@playwright/test'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

/**
 * The Steam build, launched in the real Electron shell.
 *
 * Everything specific to this target fails silently, and none of it reproduces
 * on the dev server or in `vite preview`, both of which serve the app over
 * http:// from a root:
 *
 *   - a root-absolute asset path resolves against the *filesystem* root under
 *     file://, which exists, is not the game, and 404s with no error surface
 *   - a history router matches none of its routes, so the app renders its
 *     catch-all forever and the privacy page is unreachable
 *   - UI backed by /api renders fine and does nothing
 *   - and the one the web build has never had to care about: an installed
 *     application that quietly makes third-party network requests, which is a
 *     store-page privacy disclosure and reads badly in reviews
 *
 * So this spec builds the real bundle and launches the real main process. It is
 * the only arrangement in the suite where those bugs exist at all.
 */

const root = fileURLToPath(new URL('..', import.meta.url))
const MAIN = join(root, 'electron', 'main.cjs')

let app
let page
/** Every http(s) request the renderer made. Should stay empty, forever. */
let networkRequests = []
let consoleErrors = []
let userDataDir

test.beforeAll(async () => {
  test.setTimeout(300_000)

  // Always rebuild, for the same reason the itch spec and the prod project do:
  // a bundle left over from an earlier tree would report on code that is not
  // there any more.
  const built = spawnSync('node', ['scripts/build-steam.mjs'], {
    cwd: root, encoding: 'utf8', shell: true,
  })
  expect(built.status, `build:steam failed:\n${built.stdout}\n${built.stderr}`).toBe(0)

  // A throwaway profile. Without it the window-state file written by a previous
  // run decides the window size in this one, and the size assertions below
  // would be reading yesterday's state rather than today's defaults.
  userDataDir = mkdtempSync(join(tmpdir(), 'sigil-steam-'))

  app = await electron.launch({
    args: [MAIN, `--user-data-dir=${userDataDir}`],
    // SIGIL_DEV_SERVER would point the shell at the dev server, which is the
    // one environment this spec must not test.
    env: { ...process.env, SIGIL_DEV_SERVER: '' },
  })

  page = await app.firstWindow()
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()) })
  page.on('pageerror', err => consoleErrors.push(String(err)))
  page.on('request', req => {
    if (/^https?:/.test(req.url())) networkRequests.push(req.url())
  })

  await expect(page.getByRole('button', { name: 'Home menu' })).toBeVisible({ timeout: 30_000 })
})

test.afterAll(async () => {
  if (app) await app.close()
  if (userDataDir) rmSync(userDataDir, { recursive: true, force: true })
})

// One Electron app serves the whole file -- launching a fresh one per test
// would mean a fresh build check and a fresh window each time, for minutes of
// runtime and no extra coverage. The cost is that React state survives between
// tests: a menu left open by one test intercepts the click of the next, which
// is exactly how this spec first went flaky. Reloading the renderer is the
// cheap fix and the honest one, because it also means every test below asserts
// against a cold start rather than against whatever the last one left behind.
test.beforeEach(async () => {
  networkRequests = []
  consoleErrors = []
  await page.reload()
  await expect(page.getByRole('button', { name: 'Home menu' })).toBeVisible({ timeout: 30_000 })
})

test('the shell opens the game with no console errors', async () => {
  await expect(page.getByRole('button', { name: 'Home menu' })).toBeVisible()
  expect(consoleErrors, `console errors:\n${consoleErrors.join('\n')}`).toEqual([])
})

test('the renderer is the desktop build, not the embedded one', async () => {
  // The distinction src/buildTarget.js exists to keep: no server *and* no
  // iframe. `embedded` would scale the whole app to fit a frame the desktop
  // window does not have, and a transform on that element silently re-homes
  // every `position: fixed` modal in the game.
  await expect(page.locator('html')).toHaveClass(/desktop/)
  await expect(page.locator('html')).not.toHaveClass(/embedded/)
  await expect(page.locator('.stage')).toHaveCount(0)
})

test('the preload bridge is present and exposes nothing that can act', async () => {
  const bridge = await page.evaluate(() => ({ ...window.sigilDesktop }))
  expect(bridge.isDesktop).toBe(true)

  // The renderer is the same code that runs on the website. Anything callable
  // here is a capability the web build does not have, and every one of them is
  // a way the two can drift. Until S07 adds Steamworks, there should be none.
  const callables = await page.evaluate(() =>
    Object.entries(window.sigilDesktop).filter(([, v]) => typeof v === 'function').map(([k]) => k),
  )
  expect(callables).toEqual([])
})

test('makes no network requests at all', async () => {
  // The assertion behind the privacy disclosure on the store page (S06, S14).
  // PostHog, Vercel Analytics and Speed Insights are all gated off for this
  // target in main.jsx; this is what proves it against the built bundle rather
  // than against the source.
  // beforeEach reloaded the page with the listener already attached, so this
  // covers the whole startup path -- which is where the first version of this
  // spec found the game fetching its typefaces from fonts.googleapis.com, and
  // therefore rendering in fallback fonts for any player who was offline.
  await page.waitForTimeout(2_000)
  expect(networkRequests, `the desktop build phoned home:\n${networkRequests.join('\n')}`).toEqual([])
})

test('offers no UI that needs the server', async () => {
  await page.getByRole('button', { name: 'Home menu' }).click()

  // Their backing endpoints cannot be reached from an installed app with no
  // /api. Offering them would render a permanently empty modal.
  await expect(page.getByRole('button', { name: 'Leaderboard' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Send feedback' })).toHaveCount(0)

  // And the copy is the desktop one. "in your browser" is the itch string, and
  // it would be a lie in an installed application.
  await expect(page.getByText('plays entirely offline')).toBeVisible()
})

test('routes with the hash router', async () => {
  // Under BrowserRouter the path here is the file's absolute path on disk,
  // which matches no route and falls through to the catch-all Navigate --
  // so the privacy page would be unreachable and the game might not render
  // at all. Under HashRouter it loads.
  const url = await page.evaluate(() => location.href)
  expect(url.startsWith('file://'), `not loaded from disk: ${url}`).toBe(true)

  await page.evaluate(() => { location.hash = '#/privacy' })
  await expect(page.getByRole('heading', { name: /privacy/i })).toBeVisible({ timeout: 15_000 })

  await page.evaluate(() => { location.hash = '#/' })
  await expect(page.getByRole('button', { name: 'Home menu' })).toBeVisible()
})

test('the window opens large enough for the full card layout', async () => {
  // The 760px seam (electron/windowRules.cjs). Asserted against the real window
  // rather than the arithmetic, because the arithmetic is only right if the
  // bounds it returns are the bounds Electron actually used.
  const size = await page.evaluate(() => ({
    w: window.innerWidth,
    h: window.innerHeight,
  }))
  expect(size.w).toBeGreaterThanOrEqual(960)

  // Not asserted as >= 760: the display this runs on may not have the room,
  // and the compact layout is the correct answer there. What must hold is that
  // the shell asked for as much as the display allowed.
  const requested = await app.evaluate(async ({ screen }) => {
    const { workArea } = screen.getPrimaryDisplay()
    return workArea
  })
  expect(size.h).toBeGreaterThan(Math.min(600, requested.height) - 200)
})

test('external links leave the app instead of navigating it', async () => {
  // sigildeck.com is linked from the home menu in every server-less build. In a
  // browser that is a new tab; in an installed app, letting it navigate would
  // replace the game with a website inside a window with no address bar and no
  // way back.
  const before = await page.evaluate(() => location.href)
  await page.evaluate(() => {
    const link = [...document.querySelectorAll('a')].find(a => a.href.includes('sigildeck.com'))
    if (link) link.click()
  })
  await page.waitForTimeout(1_000)
  expect(await page.evaluate(() => location.href)).toBe(before)
  expect(app.windows().length, 'a second window was opened').toBe(1)
})
