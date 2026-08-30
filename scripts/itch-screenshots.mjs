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

// One frame for the whole set: 1280x800, shot at 2x.
//
// The height is not a free choice. index.css defines `short:` as
// @media (max-height: 760px), and the room's cards clamp to
// short:max-w-[155px] under it against md:max-w-[240px] above -- so a shot
// taken at the conventional 720 renders the *phone* card size inside a
// desktop-width frame, with a band of dead black where the missing 85px per
// card should have been. 800 clears the threshold with room to spare.
//
// Every shot keeps this frame rather than being cropped to its own content:
// a set whose images are all 16:10 hangs together in itch's strip, and one
// where each image is a different height does not. The cost is some headroom
// above the fold on the shorter screens, which is what the game looks like on
// a laptop anyway. `checkFits` below fails loudly if a screen ever outgrows it.
const VIEWPORT = { width: 1280, height: 800 }

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

// -- States for the wider set ------------------------------------------
//
// Same principle as PROMO: every screen below is stated rather than played to,
// so the set is reproducible. Each one is costed so the screen it produces has
// a real decision on it -- a sanctuary with an empty kit and a room whose
// monsters are all beneath the weapon both photograph as "nothing is happening".

// A kit worth showing: two weapons, three potions, a spread of ranks. Sized so
// the sanctuary panels are full without wrapping to a second row at 1280.
const KIT = [
  { id: 'k1', suit: 'D', rank: 8 },
  { id: 'k2', suit: 'D', rank: 5 },
  { id: 'k3', suit: 'H', rank: 7 },
  { id: 'k4', suit: 'H', rank: 4 },
  { id: 'k5', suit: 'D', rank: 3 },
  { id: 'k6', suit: 'H', rank: 9 },
  { id: 'k7', suit: 'D', rank: 10 },
  { id: 'k8', suit: 'H', rank: 6 },
  { id: 'k9', suit: 'D', rank: 6 },
  { id: 'k10', suit: 'H', rank: 3 },
  { id: 'k11', suit: 'D', rank: 9 },
]

// Mid-run sanctuary: sigils on the board, boons taken, nothing left to resolve,
// so the Descend action is the only thing asking for a click.
const SANCTUARY = {
  ...DESCENT,
  phase: 'sanctuary',
  sigilsEarned: 6,
  hp: 20,
  maxHp: 20,
  boons: ['whetstone', 'quartermaster', 'riposte'],
  boonOffers: [],
  boonChosen: true,
  kit: KIT,
  theme: null,
  themesFaced: ['the_quiet', 'the_crypt', 'the_armory'],
  forgeOpen: false,
  forgeGrants: [],
  forgeChoices: [],
}

// The boon offer. forgeOpen with grants pending is what draws the "Next > Forge"
// chip, which is the part that shows the sanctuary is a sequence rather than a
// single screen.
const BOON_PICK = {
  ...SANCTUARY,
  boons: ['vanguard'],
  boonChosen: false,
  boonOffers: ['whetstone', 'quartermaster', 'riposte'],
  forgeOpen: true,
  forgeGrants: ['inscribe', 'upgrade'],
  forgeGrantIndex: 0,
  forgeChoices: [],
}

// Forge, first edit of two: four freshly rolled tools to inscribe.
const FORGE_INSCRIBE = {
  ...SANCTUARY,
  forgeOpen: true,
  forgeGrants: ['inscribe', 'upgrade'],
  forgeGrantIndex: 0,
  forgeChoices: [
    { id: 'f1', suit: 'D', rank: 9 },
    { id: 'f2', suit: 'H', rank: 6 },
    { id: 'f3', suit: 'D', rank: 4 },
    { id: 'f4', suit: 'H', rank: 10 },
  ],
}

// Forge, second edit: the same visit offering an upgrade out of the kit, so the
// two forge shots read as one screen doing two different jobs.
const FORGE_UPGRADE = {
  ...FORGE_INSCRIBE,
  forgeGrantIndex: 1,
  forgeChoices: KIT.slice(0, 4),
}

// The Trial intro overlay. Plain monsters on purpose: a trait or boss in the
// room adds first-encounter explainers to the overlay, which both crowds the
// shot and stops the auto-dismiss, and neither is what this screenshot is of.
const TRIAL_INTRO = {
  ...DESCENT,
  hp: 16,
  sigilsEarned: 4,
  theme: 'the_crypt',
  themeChildren: [],
  themeDeckChanges: [],
  weapon: { rank: 7, originalRank: 7, lastSlain: null },
  carriedWeapon: { suit: 'D', rank: 7, originalRank: 7 },
  room: [
    { id: 't1', suit: 'S', rank: 9 },
    { id: 't2', suit: 'C', rank: 6 },
    { id: 't3', suit: 'S', rank: 12 },
    { id: 't4', suit: 'H', rank: 7 },
  ],
}

// An early room: a potion and a weapon sitting in with the monsters, which is
// the thing the kit rework actually changed and the one room shape the existing
// 01-descent shot does not show.
const ROOM_EARLY = {
  ...DESCENT,
  hp: 14,
  sigilsEarned: 1,
  theme: null,
  weapon: { rank: 6, originalRank: 6, lastSlain: null },
  carriedWeapon: { suit: 'D', rank: 6, originalRank: 6 },
  room: [
    { id: 'e1', suit: 'H', rank: 8 },
    { id: 'e2', suit: 'S', rank: 9 },
    { id: 'e3', suit: 'D', rank: 9 },
    { id: 'e4', suit: 'C', rank: 4 },
  ],
  roomsEntered: 2,
}

// The binding, which is the rule the whole game turns on: the weapon last killed
// a 5, so everything above it is locked to Bare hands and only the 3 can be
// swung at. This is the screenshot that explains the game if only one does.
const ROOM_BOUND = {
  ...DESCENT,
  hp: 11,
  sigilsEarned: 5,
  theme: null,
  weapon: { rank: 9, originalRank: 9, lastSlain: { rank: 5 } },
  carriedWeapon: { suit: 'D', rank: 9, originalRank: 9 },
  room: [
    { id: 'b1', suit: 'S', rank: 12 },
    { id: 'b2', suit: 'C', rank: 11 },
    { id: 'b3', suit: 'S', rank: 9 },
    { id: 'b4', suit: 'C', rank: 3 },
  ],
  roomsEntered: 6,
}

// Late and losing: face cards, a blunted weapon, and single-digit HP.
const ROOM_DEEP = {
  ...DESCENT,
  hp: 5,
  sigilsEarned: 8,
  theme: null,
  weapon: { rank: 7, originalRank: 10, lastSlain: null },
  carriedWeapon: { suit: 'D', rank: 7, originalRank: 10 },
  room: [
    { id: 'd1', suit: 'S', rank: 14 },
    { id: 'd2', suit: 'C', rank: 13, relentless: true },
    { id: 'd3', suit: 'S', rank: 11, vengeful: true },
    { id: 'd4', suit: 'H', rank: 6 },
  ],
  roomsEntered: 11,
}

// Trials in the order a run would meet them, light tiers first.
const THEME_POOL = [
  'the_quiet', 'the_crypt', 'the_armory', 'the_menagerie', 'the_apothecary',
  'locust_swarm', 'blood_moon', 'hungry_dark', 'cramped_halls', 'the_bog',
]

// Finished runs. Kept separate from the descent shape because the outcome view
// reads the run record, not the board: buildRunRecord defaults everything it
// does not find, so this is all it needs.
function outcome(phase, sigilsEarned) {
  return {
    phase,
    sigilsEarned,
    sigilTarget: 10,
    mode: 'default',
    ascension: 0,
    boons: ['whetstone', 'quartermaster', 'riposte'],
    kit: KIT,
    // One Trial per descent, so the list has to be as long as the run was:
    // a 7-sigil death faced eight of them, the last one fatal. A short list
    // here is the kind of detail a reader of the screenshot notices.
    themesFaced: THEME_POOL.slice(0, phase === 'victory' ? sigilsEarned : sigilsEarned + 1),
    bossesDefeated: [],
    runRoomsEntered: 34,
    monstersSlain: 51,
    biggestKill: 13,
    weapon: { rank: 8, originalRank: 10 },
    carriedWeapon: phase === 'victory' ? { rank: 8, originalRank: 10 } : null,
    retired: false,
    runStartedAt: Date.now() - 1_140_000,
    log: ['A heavy blow lands in the dark.'],
  }
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
  {
    name: '04-sanctuary.png',
    what: 'The sanctuary between descents: kit, boons, sigils, and the way down',
    async go(page) {
      await seed(page, SANCTUARY)
      await page.getByRole('heading', { name: 'Sanctuary' }).waitFor({ timeout: 20_000 })
    },
  },
  {
    name: '05-boon.png',
    what: 'Picking a Boon on the way back up, with the Forge queued behind it',
    async go(page) {
      await seed(page, BOON_PICK)
      await page.getByRole('heading', { name: 'Pick one Boon' }).waitFor({ timeout: 20_000 })
    },
  },
  {
    name: '06-forge-inscribe.png',
    what: 'The Forge, inscribing a new tool into the kit',
    async go(page) {
      await seed(page, FORGE_INSCRIBE)
      await page.getByText(/The Forge . edit 1 of 2/i).waitFor({ timeout: 20_000 })
    },
  },
  {
    name: '07-forge-upgrade.png',
    what: 'The Forge, upgrading a card already in the kit',
    async go(page) {
      await seed(page, FORGE_UPGRADE)
      await page.getByText(/The Forge . edit 2 of 2/i).waitFor({ timeout: 20_000 })
    },
  },
  {
    name: '08-trial.png',
    what: 'The Trial named on arrival — the descent you went into blind',
    async go(page) {
      await seed(page, TRIAL_INTRO)
      // The overlay auto-dismisses after ~4.2s, so this shot is a race the
      // capture has to win. Nothing else waits on it; the settle below is
      // well inside the window.
      // The board header names the Trial too, so the overlay heading is not unique.
      await page.getByRole('heading', { name: 'The Crypt' }).first().waitFor({ timeout: 20_000 })
    },
  },
  {
    name: '09-room-early.png',
    what: 'An early room: your own potion and weapon dealt in among the monsters',
    async go(page) {
      await seed(page, ROOM_EARLY)
      await page.locator('.card-face').first().waitFor({ timeout: 20_000 })
      await page.getByRole('button', { name: /Bare hands/i }).first().waitFor({ timeout: 20_000 })
    },
  },
  {
    name: '10-room-bound.png',
    what: 'The binding: the weapon last took a 5, so the face cards are bare hands only',
    async go(page) {
      await seed(page, ROOM_BOUND)
      // Only the 3 is under the binding, so exactly one bare-hands button is
      // drawn (DescentView: showBare needs a usable weapon). Waiting on it is
      // what proves the binding took: seed lastSlain as a bare number instead
      // of { rank } and every card silently loses its weapon preview.
      await page.locator('.card-face').nth(3).waitFor({ timeout: 20_000 })
      await page.getByRole('button', { name: /Bare hands/i }).first().waitFor({ timeout: 20_000 })
    },
  },
  {
    name: '11-room-deep.png',
    what: 'Descent 9 at 5 HP: an Ace, a King, and a blunted weapon',
    async go(page) {
      await seed(page, ROOM_DEEP)
      await page.locator('.card-face').first().waitFor({ timeout: 20_000 })
      await page.getByRole('button', { name: /Bare hands/i }).first().waitFor({ timeout: 20_000 })
    },
  },
  {
    // itch's "mobile friendly" tick is a claim; this is the evidence for it,
    // and a phone-shaped shot in a strip of landscape ones is the one a
    // browsing visitor actually stops on. Height is the usable viewport with
    // Safari's toolbars showing, not the screen -- see visual/fixtures/devices.js.
    name: '12-mobile.png',
    what: 'The same room on a phone',
    viewport: { width: 390, height: 754 },
    scale: 3,
    async go(page) {
      await seed(page, ROOM_EARLY)
      await page.locator('.card-face').first().waitFor({ timeout: 20_000 })
      await page.getByRole('button', { name: /Bare hands/i }).first().waitFor({ timeout: 20_000 })
    },
  },
  {
    name: '13-victory.png',
    what: 'Ten sigils: the run that got out',
    async go(page) {
      await seed(page, outcome('victory', 10))
      await page.getByText(/blinded by the light/i).waitFor({ timeout: 20_000 })
    },
  },
  {
    name: '14-death.png',
    what: 'The usual ending, and the run summary that comes with it',
    async go(page) {
      await seed(page, outcome('gameover', 7))
      await page.getByText(/You fall in the dark/i).waitFor({ timeout: 20_000 })
    },
  },
]

// Warn when a screen has outgrown the frame.
//
// Nothing here crops, so content past the bottom edge is simply missing from
// the shot -- and a screenshot that silently loses its last panel is worse
// than one that fails. Measures the drawn things inside <main>, skipping any
// box tall enough to be a stretched wrapper (<main> itself is flex-1, so
// measuring it just measures the viewport back).
async function checkFits(page, shot) {
  const { height } = shot.viewport || VIEWPORT
  const bottom = await page.evaluate(() => {
    const main = [...document.querySelectorAll('main')].pop()
    if (!main) return 0
    let max = 0
    for (const el of main.querySelectorAll('*')) {
      const r = el.getBoundingClientRect()
      if (r.width < 8 || r.height < 8) continue
      if (r.height > window.innerHeight * 0.7) continue
      const cs = getComputedStyle(el)
      if (cs.visibility === 'hidden' || cs.opacity === '0') continue
      if (r.bottom > max) max = r.bottom
    }
    return Math.ceil(max)
  })
  if (bottom > height) {
    console.warn(`  ! ${shot.name}: content runs to ${bottom}px in a ${height}px frame -- ${bottom - height}px is cut off`)
  }
}

// The top bar carries its own rules entry, so an unscoped role query matches
// twice once the overlay is open. The overlay's nav is the disambiguator.
const homeMenu = page => page.locator('nav')

async function seed(page, state = PROMO) {
  await page.addInitScript(({ saveKey, tutorialKey, layoutKey, state }) => {
    localStorage.setItem(tutorialKey, 'true')
    localStorage.setItem(layoutKey, 'modern')
    localStorage.setItem(saveKey, JSON.stringify({ version: 1, state }))
  }, { saveKey: SAVE_KEY, tutorialKey: TUTORIAL_KEY, layoutKey: LAYOUT_KEY, state })
  await page.goto(BASE)
}

try {
  const browser = await chromium.launch()
  try {
    for (const shot of shots) {
      const page = await browser.newPage({
        viewport: shot.viewport || VIEWPORT,
        deviceScaleFactor: shot.scale || 2,
      })
      try {
        await shot.go(page)
        // Webfonts change the metrics of every screen here; capturing before
        // they resolve produces a set shot in the fallback face.
        await page.evaluate(() => document.fonts.ready)
        await page.waitForTimeout(400) // let the fade-in transitions settle
        await checkFits(page, shot)
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
