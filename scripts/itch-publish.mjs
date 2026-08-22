/**
 * Build the standalone bundle and push it to itch.io.
 *
 *   npm run itch:publish
 *
 * Requires butler, itch's upload CLI, and a one-time `butler login` (browser
 * auth -- it cannot be scripted). Install location and PATH are set up already;
 * if butler is missing this script says so rather than failing obscurely.
 *
 * Pushes the *directory*, not the zip. butler diffs against what is already on
 * itch and uploads only the changed blocks, so a code-only change moves a few
 * hundred KB rather than the ~14MB the audio accounts for. It also sets the
 * browser-playable flag itself, from the `:html` channel name -- the same flag
 * the web uploader exposes as a checkbox.
 *
 * The build stamp doubles as the itch user version, so the version shown on the
 * itch page matches the badge in the corner of the game.
 */
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'dist-itch')

// channel must contain "html" for itch to treat the upload as playable in the
// browser. Changing the target after the first push orphans the old channel,
// so this is deliberately a constant rather than an argument.
const TARGET = 'josephparis/sigil:html'

function run(cmd, args, opts = {}) {
  return spawnSync(cmd, args, { cwd: root, stdio: 'inherit', shell: true, ...opts })
}

function capture(cmd, args) {
  return spawnSync(cmd, args, { cwd: root, encoding: 'utf8', shell: true })
}

if (capture('butler', ['-V']).status !== 0) {
  console.error([
    'butler not found on PATH.',
    '',
    'It was installed to %LOCALAPPDATA%\\butler and added to the user PATH, so a',
    'terminal opened before that will not see it yet -- open a new one.',
    'Otherwise reinstall from https://itch.io/docs/butler/installing.html',
  ].join('\n'))
  process.exit(1)
}

// Fail before building rather than after, so a missing project or login does
// not cost a full build first.
//
// Note butler prompts for login itself when it has no credentials, so a first
// run here can open a browser. Match on the *error*, not on incidental words in
// the transcript: "Authenticated successfully" contains "auth", which is how an
// earlier version reported a missing game as a login problem.
const status = capture('butler', ['status', TARGET])
if (status.status !== 0) {
  const out = `${status.stdout || ''}${status.stderr || ''}`
  console.error(`butler could not read ${TARGET}:\n`)
  if (/invalid game/i.test(out)) {
    console.error(`No itch project at ${TARGET.split(':')[0]} yet.`)
    console.error('Create it first at https://itch.io/game/new, with Kind of project')
    console.error('set to HTML, then rerun this. The page has to exist before there')
    console.error('is anything to push a build to.')
  } else if (/no credentials|not logged in|please log ?in/i.test(out)) {
    console.error('Run `butler login` once (it opens a browser), then retry.')
  } else {
    console.error(out.trim())
  }
  process.exit(1)
}

const build = run('node', [join(root, 'scripts', 'build-itch.mjs')])
if (build.status !== 0) process.exit(build.status ?? 1)

if (!existsSync(join(outDir, 'index.html'))) {
  console.error('\nNo dist-itch/index.html; refusing to push.')
  process.exit(1)
}

// Same short SHA the in-game version badge shows, so a player reporting a bug
// against "the itch version" names something findable in the history.
const sha = capture('git', ['rev-parse', '--short=7', 'HEAD']).stdout?.trim()
const versionArgs = sha ? ['--userversion', sha] : []

const push = run('butler', ['push', outDir, TARGET, ...versionArgs])
if (push.status !== 0) process.exit(push.status ?? 1)

console.log(`\nPushed ${sha || 'build'} to ${TARGET}.`)
console.log('Live within a minute or so. Consider a devlog -- it is the only')
console.log('notification your itch followers get.')
