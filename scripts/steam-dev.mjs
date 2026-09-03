/**
 * Run the desktop shell against the Vite dev server.
 *
 *   npm run dev          in one terminal
 *   npm run steam:dev    in another
 *
 * Hot reload inside the real window, which is the only way to iterate on
 * anything the shell owns (window size, fullscreen, the file:// seam) without
 * a full rebuild between every change.
 *
 * A script rather than an npm script because of the env var: `VAR=x cmd` is not
 * valid shell on Windows, and this repo is developed on Windows. Same reason
 * scripts/build-itch.mjs sets VITE_BUILD_TARGET itself.
 *
 * Note what this does NOT prove. The dev server hands the app an http:// origin
 * with a server behind it, so the two failure modes specific to the packaged
 * build -- a root-absolute path resolving to the filesystem root, and a history
 * router with nothing to rewrite unknown paths -- cannot happen here. Those
 * belong to visual/steam-build.spec.js, which launches the built bundle.
 */
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const require = createRequire(import.meta.url)
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const DEV_SERVER = process.env.SIGIL_DEV_SERVER || 'http://localhost:5173'

// The electron package exports the path to its own binary.
const electron = require('electron')

const child = spawn(electron, [join(root, 'electron', 'main.cjs')], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, SIGIL_DEV_SERVER: DEV_SERVER },
})

child.on('close', code => process.exit(code ?? 0))
