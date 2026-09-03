/**
 * Which host this bundle was built for.
 *
 * The default build is the one that ships to sigildeck.com: served from a
 * domain root, with the serverless API alongside it under /api. Two other
 * targets exist for hosts that get a static bundle and no server:
 *
 *   standalone  itch.io and any other portal that serves the bundle from
 *               https://html-classic.itch.zone/html/<id>/ -- a subdirectory on
 *               someone else's origin, inside a fixed-size iframe.
 *   steam       the Electron desktop shell (electron/main.cjs), which loads the
 *               bundle over file:// from the user's own disk.
 *
 * The two share every constraint that comes from "there is no server here", and
 * share none of the constraints that come from "you are inside someone's
 * iframe". That split is the whole reason there are three names below rather
 * than one boolean: conflating them is how the desktop build would end up
 * scaled to fit a frame it does not have.
 *
 * Three things change wherever there is no server, and each of them fails
 * silently rather than loudly, which is why the target is explicit rather than
 * sniffed:
 *
 *   1. Absolute asset paths resolve against the host's root, not the game's.
 *      Handled by Vite's `base` for bundled assets, and by BASE_URL for the
 *      runtime-constructed ones (see audio.js). Under file:// a root-absolute
 *      path resolves to the filesystem root, which is the same bug wearing a
 *      different hat.
 *   2. History routing has no server to rewrite unknown paths, and the game
 *      does not sit at "/" anyway. main.jsx switches to a hash router.
 *   3. Every /api call would resolve to the host's origin and 404. The network
 *      layer already treats that as "local-only mode" and never blocks play, so
 *      the game is fully playable -- but the UI must not offer sign-in and the
 *      leaderboard, which cannot work there. Google Sign-In in particular is
 *      not merely unreachable but unsupported in a cross-origin iframe, so
 *      there is no version of this that works by adding CORS.
 *
 * Set at build time by scripts/build-itch.mjs and scripts/build-steam.mjs.
 * Undefined in every other build, so the sigildeck.com bundle is unchanged by
 * all of the above.
 */
const TARGET = import.meta.env.VITE_BUILD_TARGET || ''

/** itch.io and other portals: a static bundle inside a fixed-size iframe. */
export const IS_STANDALONE = TARGET === 'standalone'

/** The Electron desktop shell, loaded from disk over file://. */
export const IS_STEAM = TARGET === 'steam'

/**
 * No /api, no sign-in, no leaderboard, and no server to rewrite routes.
 *
 * This is the condition almost every gate in the app actually cares about.
 * Reach for `IS_STANDALONE` only where the thing being decided is genuinely
 * about the *iframe* -- the scale-to-fit stage and the layout rules that serve
 * it -- because a desktop window is not a frame and must not be scaled into one.
 */
export const IS_OFFLINE_BUILD = IS_STANDALONE || IS_STEAM

/** Where a player without the server half is pointed for the parts that need it. */
export const HOME_URL = 'https://sigildeck.com'

/**
 * Resolve a runtime asset path against the deployment's base.
 *
 * Only for paths built as strings at runtime -- anything imported or referenced
 * from HTML/CSS is rewritten by Vite already. BASE_URL is "/" in the default
 * build, so this returns the input unchanged there.
 */
export function assetUrl(path) {
  const base = import.meta.env.BASE_URL || '/'
  if (!path.startsWith('/')) return base.endsWith('/') ? base + path : `${base}/${path}`
  return base.replace(/\/$/, '') + path
}
