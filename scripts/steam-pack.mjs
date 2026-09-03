/**
 * Package the desktop shell into a runnable application.
 *
 *   npm run steam:pack        an unpacked directory -- what SteamPipe uploads
 *   npm run steam:dist        an installer, for handing a build to someone
 *                             outside Steam
 *
 * Wraps electron-builder for one reason, and it is not a nice-to-have: this
 * repo lives inside a OneDrive-synced folder, and electron-builder cannot
 * package into one.
 *
 * It extracts the Electron runtime to `<out>/win-unpacked.tmp` and then renames
 * it to `<out>/win-unpacked`. OneDrive holds a handle on directories it is
 * syncing, the rename fails with EPERM, and the error names only the rename --
 * nothing in it points at OneDrive, and the build leaves a `win-unpacked.tmp`
 * behind that looks like a partial success. Reproduced on 2026-09-02: it fails
 * every time inside OneDrive and succeeds every time outside it.
 *
 * So the default output moves out of the synced tree, and the script says where
 * it went. On a checkout that is not inside OneDrive nothing changes and the
 * output stays in dist-electron/, which is what .gitignore and CI expect.
 *
 *   SIGIL_PACK_OUT=<path>   overrides the choice entirely
 */
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve, sep } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const makeInstaller = process.argv.includes('--installer')

/**
 * Is this path inside a OneDrive-synced tree?
 *
 * Checks the environment OneDrive sets, then falls back to the conventional
 * folder name -- the env vars are absent when the process was not started from
 * a normal user session, and the failure this guards against does not care.
 */
function insideOneDrive(path) {
  const roots = [process.env.OneDrive, process.env.OneDriveConsumer, process.env.OneDriveCommercial]
    .filter(Boolean)
    .map(p => resolve(p).toLowerCase())

  const lower = resolve(path).toLowerCase()
  if (roots.some(r => lower.startsWith(r + sep) || lower === r)) return true
  return lower.split(sep).includes('onedrive')
}

function chooseOutDir() {
  if (process.env.SIGIL_PACK_OUT) return resolve(process.env.SIGIL_PACK_OUT)

  const inRepo = join(root, 'dist-electron')
  if (!insideOneDrive(inRepo)) return inRepo

  // Somewhere local, stable between runs (so an incremental build is not a
  // fresh download every time) and outside anything that syncs.
  const local = process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local') || tmpdir()
  const out = join(local, 'Sigil', 'dist-electron')
  console.log(
    `\nThis checkout is inside OneDrive, which electron-builder cannot package into.\n` +
    `Writing the packaged app to:\n  ${out}\n` +
    `Set SIGIL_PACK_OUT to override.\n`,
  )
  return out
}

function run(cmd, args) {
  const res = spawnSync(cmd, args, { cwd: root, stdio: 'inherit', shell: true })
  if (res.status !== 0) process.exit(res.status ?? 1)
}

run('node', ['scripts/build-steam.mjs'])

const outDir = chooseOutDir()
mkdirSync(outDir, { recursive: true })

const args = ['electron-builder', `--config.directories.output=${outDir}`]
if (!makeInstaller) args.push('--dir')
run('npx', args)

// electron-builder reports the EPERM above as a failure, but a half-finished
// package could still leave an exe from a previous run in place. Check for the
// thing that actually has to exist.
const exe = join(outDir, 'win-unpacked', 'Sigil.exe')
if (!makeInstaller && !existsSync(exe)) {
  console.error(`\nPackaging reported success but ${exe} is missing.`)
  process.exit(1)
}

console.log(`\nPackaged: ${makeInstaller ? outDir : join(outDir, 'win-unpacked')}`)
if (!makeInstaller) {
  console.log('This directory is what SteamPipe uploads as the depot (docs/STEAM.md, S19).')
}
