/**
 * The build stamp, in one place.
 *
 * Values are inlined by vite.config.js at build time, so this self-updates on
 * every deploy with nothing to hand-edit. Shared because the stamp is now shown
 * in two places -- the desktop corner badge and the Settings modal, which is
 * where a phone has to reach it -- and two copies of this formatting would
 * drift the moment either changed.
 */

const REPO = 'https://github.com/JosephParis/sigil'

export const BUILD_SHA = import.meta.env.VITE_BUILD_SHA || 'dev'
const REF = import.meta.env.VITE_BUILD_REF || ''
const TIME = import.meta.env.VITE_BUILD_TIME || ''

const built = TIME ? new Date(TIME) : null
const date = built && !Number.isNaN(built.getTime())
  ? `${built.toISOString().slice(0, 16).replace('T', ' ')} UTC`
  : ''

/** A local dev run has no SHA, so there is no commit to link to -- use the repo. */
export const BUILD_HREF = BUILD_SHA !== 'dev' ? `${REPO}/commit/${BUILD_SHA}` : REPO

/** Long form, for a tooltip and as the accessible name. */
export const BUILD_TITLE = [
  `build ${BUILD_SHA}`,
  REF && `branch ${REF}`,
  date && `built ${date}`,
].filter(Boolean).join(' · ')
