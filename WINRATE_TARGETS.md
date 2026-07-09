# Winrate Targets

Balance targets for run winrate and per-theme survival. Working notes for tuning
themes and tiers. Numbers here are design targets, not measured values.

## Structure (as built)

- A run is **10 descents** (`SIGIL_TARGET = 10`). Win = survive all ten.
- Difficulty is not flat; it ramps by theme tier per descent:
  - Descent 1: The Quiet (warm-up)
  - Descent 2: Tier 1
  - Descent 3: Tier 2
  - Descents 4-5: Tier 3
  - Descents 6-7: Tier 4
  - Descents 8-10: Tier 5
- An Ascension ladder (levels 0-6) layers extra nerfs on top for mastery play.
  These targets describe **Ascension 0** (the base game).

## The compounding trap

Total winrate is the **product** of the ten per-descent survival rates, not the
average. To hit a target total `W` over 10 descents at flat survival `p`, you
need `p = W^(1/10)`:

| Target total winrate | Required avg per-descent survival |
|---|---|
| 60% | 95.0% |
| 50% | 93.3% |
| 40% | 91.2% |
| 33% | 89.5% |
| 25% | 87.1% |
| 20% | 85.1% |
| 15% | 82.7% |
| 10% | 79.4% |
| 5%  | 74.1% |

Takeaway: a descent that kills you 1 time in 7 (86% survival) feels fair alone
but yields only a ~22% run when stacked ten deep. Per-descent lethality must be
read through the tenth power. Early descents have to be near-freebies so the
budget can be spent late.

## Total target

**~20%** (working midpoint of a **15-25%** band).

Reference population assumption: this is the aggregate winrate across the
**engaged default-mode Ascension 0 population** (all real runs, minus obvious
tutorial noise), not a hypothetical skilled player. If the target is instead
"a skilled player wins 20%," the game is 2-3x harder and every band below
shifts down. (Open question, see bottom.)

## Per-descent curve landing at ~20%

| Descent | Tier | Target survival |
|---|---|---|
| 1 | Quiet | 97% |
| 2 | Tier 1 | 95% |
| 3 | Tier 2 | 93% |
| 4 | Tier 3 | 90% |
| 5 | Tier 3 | 88% |
| 6 | Tier 4 | 85% |
| 7 | Tier 4 | 83% |
| 8 | Tier 5 | 80% |
| 9 | Tier 5 | 78% |
| 10 | Tier 5 | 76% |

Product ≈ 23%. Drop the Tier 5 rows a point or two each to reach 18-20%. That
is the tuning space inside the 15-25% band.

## Per-tier survival bands (the theme-balance targets)

Each theme is measured against its tier's band:

| Tier | Descents | Target survival band |
|---|---|---|
| Quiet | 1 | 96-98% |
| Tier 1 | 2 | 94-96% |
| Tier 2 | 3 | 92-94% |
| Tier 3 | 4-5 | 87-90% |
| Tier 4 | 6-7 | 82-85% |
| Tier 5 | 8-10 | 75-80% |

### Decision rule

- Theme measured **below its tier band** → too punishing for the slot. Promote
  it up a tier (later descent, lower expected pass rate) or nerf it into band.
- Theme **above the band** → too soft. Demote it a tier or add teeth.
- **Within ~3 points of the band** → leave it; that tolerance avoids chasing noise.

Example: a Tier 4 theme clearing at 70% is really a Tier 5 theme; one clearing
at 92% belongs in Tier 2-3.

## Measurement notes

1. **Use conditional pass rate.** Compare "of the runs that entered a descent
   under this theme, what fraction cleared it" to the band. Raw "fraction of all
   runs that cleared this theme" is contaminated by reachability and makes
   late-tier themes look artificially deadly. The admin dashboard should compute
   entered → cleared per theme.

2. Themes are pinned to tiers, so a theme's measured survival is essentially the
   survival of its descent slot(s). Player power (boons, forge, weapon) at that
   point in the run modulates it slightly; the tier band absorbs that.

## Consequence: where the wall lands

At a 20% total, attrition has to go somewhere. With the curve above, the
heaviest death cluster is the **mid-game (descents 5-6)**, and only ~30% of runs
reach descent 10. You cannot have both a gentle mid-game and most players
reaching the aces at 20% total.

Reachability entering each descent (from the curve above):

| Descent | Entering | Deaths this descent |
|---|---|---|
| 1 | 100% | 3.0% |
| 2 | 97.0% | 4.9% |
| 3 | 92.2% | 6.5% |
| 4 | 85.7% | 8.6% |
| 5 | 77.1% | 9.3% |
| 6 | 67.9% | 10.2% |
| 7 | 57.7% | 9.8% |
| 8 | 47.9% | 9.6% |
| 9 | 38.3% | 8.4% |
| 10 | 29.9% | 7.2% |
| Win | 22.7% | - |

Fork for later: **spread deaths across the whole descent (current curve)** vs
**concentrate them at the aces (steeper, more brutal end)**. The latter makes
late deaths, after a long invested run, feel worse; the former is gentler but
less climactic.

## Sample size before acting

The total winrate stabilizes fast; individual themes are the bottleneck, and the
late tiers are worst (rarely reached, split across large pools). Act on the
per-theme slices, not the total.

### The total is the easy part

A single proportion around 20% tightens quickly. 95% CI half-widths:

- 400 runs → ±3.9 pts
- 1,000 runs → ±2.5 pts
- 2,500 runs → ±1.6 pts

A few hundred default-mode A0 runs already tells you whether you're in the
15-25% band. Don't wait on the total; wait on the themes.

### Per-theme sample sizes

To act on a theme you need its conditional pass rate precise enough to tell "off"
from noise. Per theme, at ~80% power / 95% confidence:

| What you want to detect | Obs per theme | CI half-width |
|---|---|---|
| Gross outlier (a full tier off, ~8-9 pts) | ~100-180 | ±7-9 pts |
| Comfortable tier-placement call (~5 pt miss) | ~250-300 | ±5-6 pts |
| Fine tuning (±3 pt) | ~700 | ±3 pts |

The middle row is the sweet spot: it matches the resolution the "nerf it or move
it a tier" rule needs. A tier gap is 5-9 points wide, so ±3 pt precision is more
than the decision requires.

### Converting to runs

A theme is one of several in its pool, and late tiers are reached by fewer runs.
Observations of a single theme per 1,000 runs started (current pool sizes and
the reachability curve above):

| Tier | Pool size | Slots | Obs per 1,000 runs (per theme) |
|---|---|---|---|
| Tier 1 | 3 | D2 | ~320 |
| Tier 2 | 6 | D3 | ~150 |
| Tier 3 | 6 | D4-5 | ~270 |
| Tier 4 | 8 | D6-7 | ~155 |
| Tier 5 | 11 | D8-10 | ~105 |

Binding case is an individual Tier 5 theme (big pool, rarely reached). Go points:

- **~500-700 runs:** total is solid; Tier 1 and Tier 3 themes actionable for big
  misses.
- **~1,500-2,000 runs:** every theme reaches ~150-300 obs. Practical "act on tier
  placement" threshold for the whole set.
- **~5,000+ runs:** fine ±3 pt tuning across all themes.

Recommendation: treat **~1,500-2,000 default-mode A0 runs** as the go point for
acting on the theme bands, but act on early-tier themes sooner (ready by ~600)
and be patient with individual Tier 5 themes.

### Pitfalls

1. **Segment hard.** Pool only runs from the same balance version (`GAME_VERSION`
   stamp), default mode, and Ascension 0. Hardcore, Quiet, and each ascension
   are different games. A theme retune resets that theme's clock.
2. **Multiple comparisons.** ~34 themes eyeballed at once; at 95% confidence ~1-2
   look out of band by chance. Require a theme clearly out, or confirm it
   persists across a second data pull, before acting.
3. **Late-tier survivorship.** Only strong runs reach D8-10, so Tier 5 pass rates
   are inflated vs a random player. Fine for theme-vs-theme within a tier (shared
   selection); never compare a Tier 5 number to a Tier 2 number directly.
4. **Speed lever.** If late-tier data is too slow, temporarily shrink the Tier 5
   pool or bias selection toward undersampled themes to gather faster, at the
   cost of changing the game while you measure.

## Open questions

- Reference population: aggregate-all-runs (assumed) vs skilled player. Decides
  whether the bands hold or shift down 2-3x.
- Death distribution shape: spread vs concentrated-at-aces.
- How these targets rescale down the Ascension ladder (A1-A6).
