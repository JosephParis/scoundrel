/**
 * Build the bundle the Electron desktop shell loads.
 *
 *   npm run build:steam        the web bundle only, into dist-steam/
 *   npm run steam:pack         that, then an unpacked Windows app you can run
 *   npm run steam:dist         that, then an installer
 *
 * Produces dist-steam/. Unlike the itch build there is no zip: electron-builder
 * packages the directory, and Steam's own SteamPipe tool uploads the result.
 *
 * Two details are easy to get wrong by hand and are why this is a script:
 *
 *   - VITE_BUILD_TARGET must be set for the *build*, not just for the packaging
 *     step. It is what switches the base path, the router and the server-backed
 *     UI (see src/buildTarget.js). Setting it here rather than in the npm
 *     script keeps it working on Windows, where `VAR=x cmd` is not valid shell.
 *   - The bundle must be loadable over file://. That means a relative base and
 *     a hash router; both follow from the target, and visual/steam-build.spec.js
 *     launches the real shell to prove it, because every failure mode here is a
 *     silently blank window.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'dist-steam')

function run(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, { cwd: root, stdio: 'inherit', shell: true, ...opts })
  if (res.status !== 0) {
    console.error(`\n${cmd} failed with status ${res.status}`)
    process.exit(res.status ?? 1)
  }
}

// Stale output is worse than none: a failed build leaving the previous bundle
// in place would package and ship silently.
rmSync(outDir, { recursive: true, force: true })

run('npx', ['vite', 'build'], {
  env: { ...process.env, VITE_BUILD_TARGET: 'steam' },
})

const indexPath = join(outDir, 'index.html')
if (!existsSync(indexPath)) {
  console.error('\nBuild produced no dist-steam/index.html; refusing to continue.')
  process.exit(1)
}

// The one check worth making here rather than in a test, because it is the
// difference between a game and a black window and it costs nothing: a
// root-absolute src or href resolves against the filesystem root under file://,
// which exists and is not where the game is.
const html = readFileSync(indexPath, 'utf8')
const escaping = [...html.matchAll(/\b(?:src|href)="([^"]+)"/g)]
  .map(m => m[1])
  .filter(ref => ref.startsWith('/') && !ref.startsWith('//'))

if (escaping.length > 0) {
  console.error('\nRoot-absolute references in dist-steam/index.html:')
  for (const ref of escaping) console.error(`  ${ref}`)
  console.error('These resolve to the filesystem root under file:// and will 404 silently.')
  process.exit(1)
}

console.log('\ndist-steam/ built.')
console.log('`npm run steam:pack` runs it in the real shell; `npm run steam:dist` builds an installer.')
