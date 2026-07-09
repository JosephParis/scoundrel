// Per-tier survival target bands from WINRATE_TARGETS.md, used to flag themes
// whose measured survival sits outside the target for their descent slot. A
// theme's "beat rate" (survival among decisive outcomes, cleared vs died) is
// judged against the band for its tier.
//
// Caveat baked into the reading: the bands assume the engaged default-mode,
// Ascension 0 population. The dashboard does not yet segment by mode/ascension,
// so on a mixed population the verdicts are approximate. In the current default
// build (modes/ascensions flags off) nearly every run is A0 default, so the
// comparison holds for the test cohort.

import { getTheme } from '../games/scoundrel/themes'

// low/high are inclusive survival percentages; label is the short tier tag.
const TIER_BANDS = {
  quiet: { low: 96, high: 98, label: 'Quiet' },
  1: { low: 94, high: 96, label: 'T1' },
  2: { low: 92, high: 94, label: 'T2' },
  3: { low: 87, high: 90, label: 'T3' },
  4: { low: 82, high: 85, label: 'T4' },
  5: { low: 75, high: 80, label: 'T5' },
}

// WINRATE_TARGETS' decision rule: leave a theme alone while it sits within ~3
// points of its band. Only past that slack is it "off" enough to act on.
export const BAND_TOLERANCE = 3

// Decisive outcomes (cleared + died) a theme needs before we tint a verdict.
// Below this the rate is too noisy to call, so the row shows the band for
// reference but stays neutral. Deliberately modest: a hint, not a proof. The
// confident-call thresholds (~250-300 obs) live in WINRATE_TARGETS; this floor
// just suppresses single-digit-sample false alarms.
export const VERDICT_MIN_DECISIVE = 30

// The band a theme's survival is judged against, or null for themes with no
// tier we can place (e.g. an unknown id from an older record).
export function bandForTheme(themeId) {
  const theme = getTheme(themeId)
  if (!theme) return null
  if (themeId === 'the_quiet') return TIER_BANDS.quiet
  return TIER_BANDS[theme.tier] || null
}

// 'punishing' = below band (kills more than the slot wants), 'soft' = above
// band (too easy), 'ok' = inside band or within tolerance. null when we can't
// judge: no band, no rate, or too few decisive outcomes to trust.
export function bandVerdict(band, ratePct, decisive) {
  if (!band || ratePct == null) return null
  if (decisive != null && decisive < VERDICT_MIN_DECISIVE) return null
  if (ratePct < band.low - BAND_TOLERANCE) return 'punishing'
  if (ratePct > band.high + BAND_TOLERANCE) return 'soft'
  return 'ok'
}
