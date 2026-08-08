import { test, expect } from '@playwright/test'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

/**
 * robots.txt (issue 19) and the shipped audio payload (issue 16).
 *
 * Both are about what a stranger's browser fetches, which is why they sit
 * together: one controls what crawlers are told, the other controls how many
 * megabytes a first visit costs.
 */

const AUDIO_JS = fileURLToPath(new URL('../src/games/scoundrel/audio.js', import.meta.url))
const AUDIO_DIR = fileURLToPath(new URL('../public/audio', import.meta.url))

test.describe('robots.txt', () => {
  test('is a real file, not the SPA fallback', async ({ request }) => {
    // vercel.json rewrites everything outside /api/* to index.html, so a missing
    // robots.txt answers 200 with the whole game page. A status check alone
    // passes in that state -- which is exactly how this went unnoticed. Assert
    // on the body.
    const res = await request.get('/robots.txt')
    expect(res.status()).toBe(200)

    const body = await res.text()
    expect(body, 'served the SPA HTML instead of robots.txt').not.toContain('<!doctype html')
    expect(body).toMatch(/^\s*(#|User-agent:)/im)
  })

  test('disallows /admin', async ({ request }) => {
    const body = await (await request.get('/robots.txt')).text()
    expect(body).toMatch(/^User-agent:\s*\*/im)
    expect(body).toMatch(/^Disallow:\s*\/admin\s*$/im)
  })

  test('does not accidentally block the whole game', async ({ request }) => {
    // `Disallow: /` is a deliberate choice (see the file's comment), not
    // something that should arrive by a stray edit. If it is ever wanted, this
    // test is the place to record the flip.
    const body = await (await request.get('/robots.txt')).text()
    const rules = body.split('\n').filter(l => /^\s*Disallow:/i.test(l)).map(l => l.trim())
    expect(rules, 'game route blocked from indexing').not.toContain('Disallow: /')
  })
})

test.describe('admin route', () => {
  test('sets noindex when it renders', async ({ page }) => {
    // robots.txt is advisory and only reaches crawlers that fetch it first. A
    // crawler following a direct link needs the meta tag.
    await page.goto('/admin')
    const robots = page.locator('meta[name="robots"]')
    await expect(robots).toHaveCount(1)
    expect(await robots.getAttribute('content')).toMatch(/noindex/i)
  })

  test('the game itself is not marked noindex', async ({ page }) => {
    // The tag is injected by AdminDashboard on mount and removed on unmount, so
    // it must not leak onto the game.
    await page.goto('/')
    await expect(page.locator('meta[name="robots"]')).toHaveCount(0)
  })
})

test.describe('audio payload', () => {
  /** Every audio file present on disk, with its size. */
  function shippedAudio() {
    const out = []
    for (const dir of readdirSync(AUDIO_DIR)) {
      const full = join(AUDIO_DIR, dir)
      if (!statSync(full).isDirectory()) continue
      for (const f of readdirSync(full)) {
        if (!/\.(mp3|ogg|wav|m4a)$/i.test(f)) continue
        out.push({ name: f, path: `/audio/${dir}/${f}`, bytes: statSync(join(full, f)).size })
      }
    }
    return out
  }

  const registered = () => {
    const source = readFileSync(AUDIO_JS, 'utf8')
    return new Set([...source.matchAll(/src:\s*'(\/audio\/[^']+)'/g)].map(m => m[1]))
  }

  test('ships no audio file the game never plays', async () => {
    // 16MB of unreferenced audio was being deployed: two byte-identical copies
    // of tracks that were already shipping under their in-game names, plus an
    // unused alternative. Nothing failed, because nothing looks at what is in
    // the directory -- only at what the registry names.
    const wanted = registered()
    const orphans = shippedAudio().filter(f => !wanted.has(f.path))
    expect(orphans.map(o => `${o.path} (${(o.bytes / 1048576).toFixed(1)}MB)`)).toEqual([])
  })

  test('no two shipped files are byte-identical', async () => {
    // The duplicates were the bulk of the waste and are invisible by name:
    // dark-times.mp3 and descent.mp3 were the same recording under two titles.
    const { createHash } = await import('node:crypto')
    const byHash = new Map()
    for (const f of shippedAudio()) {
      const h = createHash('md5').update(readFileSync(join(AUDIO_DIR, ...f.path.split('/').slice(2)))).digest('hex')
      byHash.set(h, [...(byHash.get(h) || []), f.name])
    }
    const dupes = [...byHash.values()].filter(names => names.length > 1)
    expect(dupes).toEqual([])
  })

  test('the total payload stays within a sane first-visit budget', async () => {
    // A ceiling, not a target. Audio is lazy-loaded per cue rather than up
    // front, but the directory is still what a determined visit pulls down, and
    // it grew to 32MB without anyone noticing.
    const total = shippedAudio().reduce((n, f) => n + f.bytes, 0)
    expect(total / 1048576, 'total audio MB').toBeLessThan(20)
  })
})
