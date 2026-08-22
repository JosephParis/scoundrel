/**
 * Rasterise the SVG sources into the PNG/ICO assets index.html and the web
 * manifest reference (issue 04).
 *
 * Uses Playwright's bundled Chromium, already a devDependency, rather than
 * adding an image library for a job that runs a handful of times. Outputs are
 * committed, so this is an authoring tool: contributors never need to run it
 * unless the artwork changes.
 *
 *   node scripts/generate-icons.mjs
 *
 * Sources:
 *   public/favicon.svg          the mark, with its own rounded corners
 *   scripts/icon-maskable.svg   full-bleed variant for Android masking
 *   scripts/og-image.svg        1200x630 social card
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, relative } from 'node:path'
import { chromium } from 'playwright'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const pub = join(root, 'public')

// square: rendered from favicon.svg unless a source is named.
const TARGETS = [
  { out: 'favicon-32.png', size: 32 },
  { out: 'apple-touch-icon.png', size: 180 },
  { out: 'icon-192.png', size: 192 },
  { out: 'icon-512.png', size: 512 },
  { out: 'icon-512-maskable.png', size: 512, src: join(here, 'icon-maskable.svg') },
  { out: 'og-image.png', width: 1200, height: 630, src: join(here, 'og-image.svg') },
  // Store art rather than a shipped asset, so it lands outside public/ -- it is
  // uploaded to itch by hand and has no business in the bundle.
  {
    out: 'cover.png', width: 630, height: 500,
    src: join(here, 'itch-cover.svg'), dir: join(root, 'docs', 'itch'),
  },
]

/**
 * Wrap a PNG in a single-image ICO container.
 *
 * The ICO format allows an embedded PNG payload, so no bitmap re-encoding is
 * needed -- just a 6-byte directory header and one 16-byte entry in front of the
 * bytes we already have. Exists only so browsers and crawlers that blindly probe
 * /favicon.ico get a file instead of a 404.
 */
function pngToIco(png, size) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0) // reserved
  header.writeUInt16LE(1, 2) // type 1 = icon
  header.writeUInt16LE(1, 4) // one image

  const entry = Buffer.alloc(16)
  // 0 means 256 in this field; every size we emit here is smaller than that.
  entry.writeUInt8(size >= 256 ? 0 : size, 0) // width
  entry.writeUInt8(size >= 256 ? 0 : size, 1) // height
  entry.writeUInt8(0, 2)                      // palette count (0 = truecolour)
  entry.writeUInt8(0, 3)                      // reserved
  entry.writeUInt16LE(1, 4)                   // colour planes
  entry.writeUInt16LE(32, 6)                  // bits per pixel
  entry.writeUInt32LE(png.length, 8)          // payload size
  entry.writeUInt32LE(header.length + entry.length, 12) // payload offset

  return Buffer.concat([header, entry, png])
}

const browser = await chromium.launch()

try {
  for (const t of TARGETS) {
    const width = t.width ?? t.size
    const height = t.height ?? t.size
    const src = t.src ?? join(pub, 'favicon.svg')
    const svg = readFileSync(src, 'utf8')

    const page = await browser.newPage({
      viewport: { width, height },
      // Transparent so the SVG's own background is what shows, and nothing is
      // composited against an assumed white page.
      deviceScaleFactor: 1,
    })
    // The SVG is sized by CSS rather than its own attributes, so one source can
    // produce every size without editing it.
    await page.setContent(
      `<!doctype html><style>
         html,body{margin:0;padding:0;background:transparent}
         svg{display:block;width:${width}px;height:${height}px}
       </style>${svg}`,
      { waitUntil: 'load' },
    )
    const buf = await page.screenshot({ omitBackground: true, type: 'png' })
    const outDir = t.dir ?? pub
    mkdirSync(outDir, { recursive: true })
    writeFileSync(join(outDir, t.out), buf)
    await page.close()
    console.log(`wrote ${relative(root, join(outDir, t.out)).replaceAll('\\', '/')} (${width}x${height})`)

    if (t.out === 'favicon-32.png') {
      writeFileSync(join(pub, 'favicon.ico'), pngToIco(buf, 32))
      console.log('wrote public/favicon.ico (32x32, PNG payload)')
    }
  }
} finally {
  await browser.close()
}
