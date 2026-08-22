/**
 * Which host this bundle was built for.
 *
 * The default build is the one that ships to sigildeck.com: served from a
 * domain root, with the serverless API alongside it under /api. A second target
 * exists for portals that host the game as a static bundle inside an iframe --
 * itch.io serves it from https://html-classic.itch.zone/html/<id>/, a
 * subdirectory on someone else's origin, with no API to call.
 *
 * Three things change in that environment, and each of them fails silently
 * rather than loudly, which is why the target is explicit rather than sniffed:
 *
 *   1. Absolute asset paths resolve against the portal's root, not the game's.
 *      Handled by Vite's `base` for bundled assets, and by BASE_URL for the
 *      runtime-constructed ones (see audio.js).
 *   2. History routing has no server to rewrite unknown paths, and the game
 *      does not sit at "/" anyway. main.jsx switches to a hash router.
 *   3. Every /api call would resolve to the portal's origin and 404. The
 *      network layer already treats that as "local-only mode" and never blocks
 *      play, so the game is fully playable -- but the UI must not offer
 *      sign-in and the leaderboard, which cannot work there. Google Sign-In in
 *      particular is not merely unreachable but unsupported in a cross-origin
 *      iframe, so there is no version of this that works by adding CORS.
 *
 * Set at build time by scripts/build-itch.mjs. Undefined in every other build,
 * so the sigildeck.com bundle is unchanged by all of the above.
 */
export const IS_STANDALONE = import.meta.env.VITE_BUILD_TARGET === 'standalone'

/** Where a standalone player is pointed for the parts that need the server. */
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
