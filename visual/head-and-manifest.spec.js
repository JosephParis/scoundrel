import { test, expect } from '@playwright/test'

// Icons, web manifest, description and social cards (issue 04).
//
// The point of most of these is that the referenced files actually resolve. The
// original complaint was a 404 on /favicon.ico, which no amount of correct markup
// would have revealed -- so every asset the head points at is fetched here rather
// than just asserted to be present in the HTML.

const DUNGEON = '#0b0d12'

const content = (page, selector) => page.locator(selector).first().getAttribute('content')

async function expectResolves(request, url) {
  const res = await request.get(url)
  expect(res.status(), `${url} should resolve`).toBe(200)
  return res
}

test.describe('document head', () => {
  test('has a title and a non-empty description', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/Sigil/)

    const description = await content(page, 'meta[name="description"]')
    expect(description).toBeTruthy()
    expect(description.length).toBeGreaterThan(40)
  })

  test('theme-color matches the page background', async ({ page }) => {
    // These drifted apart before: the meta said slate-800 while the app renders
    // on --color-dungeon, so browser chrome sat at a visibly different shade.
    await page.goto('/')
    expect((await content(page, 'meta[name="theme-color"]')).toLowerCase()).toBe(DUNGEON)
  })
})

test.describe('icons', () => {
  test('every icon the head references resolves', async ({ page, request }) => {
    await page.goto('/')
    const hrefs = await page.locator('link[rel~="icon"], link[rel="apple-touch-icon"]')
      .evaluateAll(nodes => nodes.map(n => n.getAttribute('href')))

    expect(hrefs.length).toBeGreaterThanOrEqual(3)
    for (const href of hrefs) await expectResolves(request, href)
  })

  test('/favicon.ico resolves, since clients probe it unprompted', async ({ request }) => {
    // This is the 404 that made the tab show a default globe.
    const res = await expectResolves(request, '/favicon.ico')
    const body = await res.body()
    // ICO container: reserved=0, type=1.
    expect(body.readUInt16LE(0)).toBe(0)
    expect(body.readUInt16LE(2)).toBe(1)
  })

  test('an SVG favicon is offered alongside a PNG fallback', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('link[rel="icon"][type="image/svg+xml"]')).toHaveCount(1)
    await expect(page.locator('link[rel="icon"][type="image/png"]')).toHaveCount(1)
  })
})

test.describe('web manifest', () => {
  test('is linked, valid, and installable', async ({ page, request }) => {
    await page.goto('/')
    const href = await page.locator('link[rel="manifest"]').first().getAttribute('href')
    expect(href).toBeTruthy()

    const res = await expectResolves(request, href)
    const manifest = JSON.parse(await res.text())

    // The fields Chrome requires before it will offer an install.
    expect(manifest.name).toBeTruthy()
    expect(manifest.short_name).toBeTruthy()
    expect(manifest.start_url).toBeTruthy()
    expect(manifest.display).toBe('standalone')
    expect(manifest.background_color).toBe(DUNGEON)
    expect(manifest.theme_color).toBe(DUNGEON)
  })

  test('declares 192 and 512 PNG icons plus a maskable one', async ({ page, request }) => {
    await page.goto('/')
    const href = await page.locator('link[rel="manifest"]').first().getAttribute('href')
    const manifest = JSON.parse(await (await request.get(href)).text())

    const sizes = manifest.icons.map(i => i.sizes)
    expect(sizes).toContain('192x192')
    expect(sizes).toContain('512x512')
    expect(manifest.icons.some(i => i.purpose === 'maskable')).toBe(true)
  })

  test('every manifest icon resolves', async ({ page, request }) => {
    await page.goto('/')
    const href = await page.locator('link[rel="manifest"]').first().getAttribute('href')
    const manifest = JSON.parse(await (await request.get(href)).text())
    for (const icon of manifest.icons) await expectResolves(request, icon.src)
  })
})

test.describe('social cards', () => {
  test('declares the tags a link preview needs', async ({ page }) => {
    await page.goto('/')
    for (const selector of [
      'meta[property="og:type"]',
      'meta[property="og:title"]',
      'meta[property="og:description"]',
      'meta[property="og:image"]',
      'meta[property="og:url"]',
      'meta[name="twitter:card"]',
    ]) {
      expect(await content(page, selector), selector).toBeTruthy()
    }
    expect(await content(page, 'meta[name="twitter:card"]')).toBe('summary_large_image')
  })

  test('the share image resolves and is 1200x630', async ({ page, request }) => {
    await page.goto('/')
    const src = await content(page, 'meta[property="og:image"]')
    // Relative in a local build (no VITE_SITE_URL); absolute on a deployment.
    // Resolving against the page URL covers both.
    const res = await expectResolves(request, new URL(src, page.url()).toString())
    expect(res.headers()['content-type']).toContain('image/png')

    // Declared dimensions must match the file, or previews crop oddly.
    const body = await res.body()
    // PNG IHDR: width at byte 16, height at 20, both big-endian.
    expect(body.readUInt32BE(16)).toBe(1200)
    expect(body.readUInt32BE(20)).toBe(630)
    expect(Number(await content(page, 'meta[property="og:image:width"]'))).toBe(1200)
    expect(Number(await content(page, 'meta[property="og:image:height"]'))).toBe(630)
  })

  test('the share image has alt text', async ({ page }) => {
    await page.goto('/')
    expect(await content(page, 'meta[property="og:image:alt"]')).toBeTruthy()
  })
})
