/**
 * Capture the screenshots for the itch.io page into docs/itch/.
 *
 *   npm run itch:shots
 *
 * An authoring tool, not a test: it produces artwork to upload by hand, so it
 * asserts nothing and never fails the build. Shots that cannot be reached are
 * reported and skipped rather than aborting the run.
 *
 * Shoots the *standalone* build, not the dev server, and serves it from a
 * subdirectory the way itch does. The two builds do not render the same menu --
 * standalone hides the leaderboard and sign-in, which cannot work there (see
 * src/buildTarget.js) -- so a shot taken against the dev server would advertise
 * entries the uploaded build does not have.
 *
 * States are seeded through localStorage, the same way visual/ does it, because
 * playing into a specific room is slow and the deal is random -- a screenshot
 * set that changes every time it is regenerated is not a set.
 */
import { spawnSync } from 'node:child_process'
import { createServer } from 'node:http'
import { mkdirSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join, extname, normalize, sep } from 'node:path'
import { chromium } from 'playwright'
import { DESCENT, SAVE_KEY, TUTORIAL_KEY, LAYOUT_KEY } from '../visual/fixtures/descent.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'docs', 'itch')
const distDir = join(root, 'dist-itch')
const PORT = 5183
const MOUNT = '/html/12345'
// 127.0.0.1, not localhost. On Windows localhost resolves to ::1 first, so a
// server bound only to IPv4 can be shadowed by anything already holding the
// IPv6 address -- which is how an earlier draft of this script screenshotted a
// leftover dev server instead of the build, and produced a menu the uploaded
// bundle does not have. Binding and navigating to the same literal removes the
// ambiguity; the listen error below removes the silence.
const HOST = '127.0.0.1'
const BASE = `http://${HOST}:${PORT}${MOUNT}/`

const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.mp3': 'audio/mpeg', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
}

// Wider than tall, so it reads in the strip under the embed rather than as a
// phone-shaped shot. Height trimmed to roughly where the board ends -- the
// seeded position leaves the lower third empty, and dead space is what makes a
// screenshot look like a placeholder.
const VIEWPORT = { width: 1280, height: 720 }

// The layout fixture is built for measuring, not for showing: its weapon
// outranks every monster in the room, so every preview reads "take 0" and the
// screen looks broken rather than tense. Same position, re-costed so the choice
// on offer is a real one -- a blunted weapon and enough damage taken that the
// numbers matter.
//
// `lastSlain` stays null on purpose. The weapon may only take monsters weaker
// than the last one it killed, so any value here silences the bare-hands button
// on every card at or above it: there is no choice to show when the weapon
// cannot be swung at all, which is exactly what this screenshot is of.
const PROMO = {
  ...DESCENT,
  hp: 9,
  sigilsEarned: 6,
  weapon: { rank: 4, originalRank: 9, lastSlain: null },
  carriedWeapon: { suit: 'D', rank: 4, originalRank: 9 },
}

mkdirSync(outDir, { recursive: true })

const built = spawnSync('node', [join(root, 'scripts', 'build-itch.mjs')], {
  cwd: root, stdio: 'inherit', shell: true,
})
if (built.status !== 0) process.exit(built.status ?? 1)

// Static, and mounted under a path, because that is what the shots need to be
// of. No index.html fallback: a 404 here should look like a 404.
const server = createServer(async (req, res) => {
  let pathname = decodeURIComponent(new URL(req.url, BASE).pathname)
  if (!pathname.startsWith(MOUNT)) return void res.writeHead(404).end()
  pathname = pathname.slice(MOUNT.length) || '/'
  if (pathname.endsWith('/')) pathname += 'index.html'
  const filePath = normalize(join(distDir, pathname))
  if (!filePath.startsWith(distDir + sep)) return void res.writeHead(403).end()
  try {
    const body = await readFile(filePath)
    res.writeHead(200, { 'content-type': TYPES[extname(filePath)] || 'application/octet-stream' })
    res.end(body)
  } catch {
    res.writeHead(404).end()
  }
})
await new Promise((resolve, reject) => {
  server.once('error', reject)
  server.listen(PORT, HOST, resolve)
})

const shots = [
  {
    name: '01-descent.png',
    what: 'A room mid-descent: four monsters, a weapon, and the choice',
    async go(page) {
      await seed(page)
      await page.locator('.card-face').first().waitFor({ timeout: 20_000 })
      await page.keyboard.press('Space')
      await page.getByRole('button', { name: /Bare hands/i }).first().waitFor({ timeout: 20_000 })
    },
  },
  {
    name: '02-home.png',
    what: 'The home menu / title',
    async go(page) {
      await seed(page)
      await page.locator('.card-face').first().waitFor({ timeout: 20_000 })
      await page.keyboard.press('Space')
      await page.getByRole('button', { name: 'Home menu' }).click()
      await homeMenu(page).getByRole('button', { name: 'How to play' }).waitFor({ timeout: 10_000 })
    },
  },
  {
    name: '03-rules.png',
    what: 'How to play',
    async go(page) {
      await seed(page)
      await page.locator('.card-face').first().waitFor({ timeout: 20_000 })
      await page.keyboard.press('Space')
      await page.getByRole('button', { name: 'Home menu' }).click()
      await homeMenu(page).getByRole('button', { name: 'How to play' }).click()
      await page.getByRole('heading', { name: /how to play|the deck|rules/i })
        .first().waitFor({ timeout: 10_000 })
    },
  },
]

// The top bar carries its own rules entry, so an unscoped role query matches
// twice once the overlay is open. The overlay's nav is the disambiguator.
const homeMenu = page => page.locator('nav')

async function seed(page) {
  await page.addInitScript(({ saveKey, tutorialKey, layoutKey, state }) => {
    localStorage.setItem(tutorialKey, 'true')
    localStorage.setItem(layoutKey, 'modern')
    localStorage.setItem(saveKey, JSON.stringify({ version: 1, state }))
  }, { saveKey: SAVE_KEY, tutorialKey: TUTORIAL_KEY, layoutKey: LAYOUT_KEY, state: PROMO })
  await page.goto(BASE)
}

try {
  const browser = await chromium.launch()
  try {
    for (const shot of shots) {
      const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: 2 })
      try {
        await shot.go(page)
        // Webfonts change the metrics of every screen here; capturing before
        // they resolve produces a set shot in the fallback face.
        await page.evaluate(() => document.fonts.ready)
        await page.waitForTimeout(400) // let the fade-in transitions settle
        await page.screenshot({ path: join(outDir, shot.name) })
        console.log(`wrote docs/itch/${shot.name}  — ${shot.what}`)
      } catch (err) {
        console.warn(`skipped ${shot.name}: ${err.message.split('\n')[0]}`)
      } finally {
        await page.close()
      }
    }
  } finally {
    await browser.close()
  }
} finally {
  await new Promise(resolve => server.close(resolve))
}
