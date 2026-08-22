/**
 * Build the standalone bundle and zip it in the shape itch.io wants.
 *
 *   npm run build:itch
 *
 * Produces dist-itch/ and dist-itch.zip. Upload the zip, tick "This file will
 * be played in the browser", and itch unpacks it to
 * https://html-classic.itch.zone/html/<project-id>/ inside an iframe.
 *
 * Two details are easy to get wrong by hand and are why this is a script:
 *
 *   - index.html must be at the *root* of the zip. Zipping the folder rather
 *     than its contents nests everything one level down and itch reports no
 *     playable file. Both branches below zip the contents.
 *   - VITE_BUILD_TARGET must be set for the build, not just for the zip. It is
 *     what switches the base path, the router and the server-backed UI (see
 *     src/buildTarget.js). Setting it here rather than in the npm script keeps
 *     it working on Windows, where `VAR=x cmd` is not valid shell.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, rmSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { zipDir } from './zip-dir.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'dist-itch')
const zipPath = join(root, 'dist-itch.zip')

function run(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, { cwd: root, stdio: 'inherit', shell: true, ...opts })
  if (res.status !== 0) {
    console.error(`\n${cmd} failed with status ${res.status}`)
    process.exit(res.status ?? 1)
  }
}

// Stale output is worse than none: a failed build leaving the previous bundle
// in place would zip and upload silently.
rmSync(outDir, { recursive: true, force: true })
rmSync(zipPath, { force: true })

run('npx', ['vite', 'build'], {
  env: { ...process.env, VITE_BUILD_TARGET: 'standalone' },
})

if (!existsSync(join(outDir, 'index.html'))) {
  console.error('\nBuild produced no dist-itch/index.html; refusing to zip.')
  process.exit(1)
}

// Written by hand rather than shelled out to, because both obvious shell
// options are wrong here: PowerShell's Compress-Archive emits backslash entry
// separators, which itch unpacks into files *named* "assets\index-abc.js" at
// the root -- index.html then serves fine and every asset under it 404s, with
// no error anywhere -- and `zip` does not exist on a stock Windows box.
// See scripts/zip-dir.mjs.
const count = zipDir(outDir, zipPath)

const mb = (statSync(zipPath).size / 1048576).toFixed(1)
console.log(`\ndist-itch.zip  ${mb}MB, ${count} entries.`)
console.log('`npm run itch:publish` is the normal route; the zip is the manual fallback.')
