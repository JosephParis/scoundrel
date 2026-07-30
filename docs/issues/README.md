# Launch-readiness backlog

27 issues, scoped against one milestone: **sending the game to the first batch of
users.** Issues 01–25 came from a read-only audit of the codebase, API layer, and
markdown docs; issue 26 surfaced when the full test suite was actually run.

Baseline: `npm run lint` clean, `npm run build` clean. Test suite as it stands:

| Spec | Project | Status |
|---|---|---|
| `screens.spec.js` | dev | 6 pass (1 known skip — issue 12) |
| `mobile-responsive-simple.spec.js` | dev | 12 pass |
| `tutorial-walkthrough.spec.js` | dev | 1 pass |
| `dev-tools-gate.prod.spec.js` | prod | 6 pass |
| `error-boundary.prod.spec.js` | prod | 8 pass |
| `mobile-responsive.spec.js` | dev | 27 pass |

**Full suite: 60 passed, 1 skipped (`card-library`, issue 12), 1.8 minutes.**

## Testing convention

Write the Playwright test in the **same change as the fix**, not as a follow-up.
If the assertion needs a production build (e.g. anything gated on
`import.meta.env.DEV`), name the spec `*.prod.spec.js` and it runs in the `prod`
project against `vite preview`. See `playwright.config.js` and
`visual/dev-tools-gate.prod.spec.js` for the pattern.

- `npm run test` — everything
- `npm run test:dev` / `npm run test:prod` — one project

One file per issue, each self-contained: problem, evidence with `file:line`,
why it matters for batch 1, suggested fix, acceptance criteria. You should not
need to re-derive the audit to work one.

## How to work an issue

1. Pick one whose dependencies are met (see the graph below).
2. Set `status: in-progress` in its frontmatter, and add your branch name.
3. Read the linked files before changing them — several issues note that the
   *code* is right and the *docs* are wrong. Don't "fix" correct code to match a
   stale spec.
4. Work the acceptance criteria as a checklist.
5. `npm run lint && npm run build && npm run test` before you're done.
6. Set `status: done` and record any decision the issue asked you to record.

Done so far: **05** (tree clean, `GAME_VERSION` now `0.4`), **01** (dev tools
gated), **26** (suite green and runnable), **02** (error boundary).
**Next up is issue 07** (unauthenticated write endpoints), then 03, 06, 04.

Issue 02 left one gap, now tracked as **issue 27**: there is still no save reset
outside the crash path, so a run that gets *stuck* without throwing has no escape
hatch. That is the more likely of the two failure modes.

Note for anything touching gameplay: 05 opened version `0.4`, so runs recorded
from here on stamp `0.4`. If you make another balance-affecting change before
launch, decide whether it needs its own entry or can share `0.4` — nothing has
shipped to users on `0.4` yet, so sharing is usually fine.

## Priorities

- **P0** — visible to every user on day one, or legally required. Do before launch.
- **P1** — data integrity and abuse. The link is public the moment you send it.
- **P2** — product decisions that need an explicit answer, not a default.
- **P3** — quality, performance, accessibility.
- **P4** — repo hygiene and doc accuracy.

## The backlog

### P0 — blockers

| # | Issue | Area | Effort | Status |
|---|---|---|---|---|
| [01](01-gate-dev-tools.md) | Gate Dev tools behind a non-obvious flag | launch-blocker | S | **done** |
| [02](02-error-boundary-and-recovery.md) | Add an error boundary and an always-available save reset | launch-blocker | M | **done** |
| [03](03-missing-victory-gameover-music.md) | `victory.mp3` / `gameover.mp3` registered but missing | content | S | open |
| [04](04-html-head-favicon-manifest-meta.md) | No favicon, manifest, description, or OG tags | launch-blocker | M | open |
| [05](05-uncommitted-wip.md) | Commit or shelve the 4-file uncommitted tree | process | S | **done** |
| [06](06-privacy-policy.md) | No privacy policy despite Google sign-in + PostHog `identify` | legal | M | open |

### P1 — data integrity and abuse

| # | Issue | Area | Effort | Status |
|---|---|---|---|---|
| [07](07-unauthenticated-write-endpoints.md) | `/api/runs` + `/api/feedback` accept unauthenticated writes | security | M | open |
| [08](08-moderation-tools.md) | No moderation path for handles, rows, or feedback | security | M | open |
| [09](09-merge-runseed-dedupe-bug.md) | **BUG** `merge.js` omits `runSeed`, dropping runs on sync | bug | S | open |
| [10](10-stale-db-schema.md) | `db/schema.sql` no longer describes the database | docs | S | open |
| [26](26-dead-mobile-responsive-spec.md) | **BUG** all 25 tests in `mobile-responsive.spec.js` were dead | testing | M | **done** |

### P2 — product decisions

| # | Issue | Area | Effort | Status |
|---|---|---|---|---|
| [11](11-feature-flag-defaults.md) | Decide feature flag defaults (6 of 7 off) | product | S | open |
| [12](12-unreachable-glossary-and-card-library.md) | Card library + Boons/Trials glossary unreachable | product | S | open |
| [13](13-verify-admin-stats-in-prod.md) | Verify `/api/stats` + `/admin` in prod before inviting anyone | product | S | open |
| [14](14-anonymous-handle-copy-mismatch.md) | **BUG** UI promises "Anonymous" listing; server excludes it | bug | S | open |
| [27](27-save-reset-outside-crash-path.md) | No save reset for a run stuck without crashing | product | S | open |

### P3 — quality, performance, accessibility

| # | Issue | Area | Effort |
|---|---|---|---|
| [15](15-unit-tests-game-logic.md) | No unit tests over ~100KB of game logic | testing | L |
| [16](16-audio-payload.md) | ~31MB audio, ~17MB byte-identical duplicates | performance | S |
| [17](17-prefers-reduced-motion.md) | No `prefers-reduced-motion`; 4 infinite animations | accessibility | S |
| [18](18-google-fonts-blocking-import.md) | Render-blocking Google Fonts `@import` | performance | S |
| [19](19-robots-txt.md) | No `robots.txt` while `/admin` is live | hygiene | S |

### P4 — hygiene and doc accuracy

| # | Issue | Area | Effort |
|---|---|---|---|
| [20](20-readme-license-env-example.md) | No README, LICENSE, or `.env.example` | docs | M |
| [21](21-gitignore-env.md) | `.gitignore` misses `.env` while docs point at it | security | S |
| [22](22-archive-session-docs.md) | Nine session-artifact docs in the repo root | hygiene | S |
| [23](23-stale-design-md.md) | `DESIGN.md` contradicts the shipped game | docs | M |
| [24](24-duplicate-ci-workflows.md) | Mobile tests run twice per push | ci | S |
| [25](25-rules-copy-review.md) | Review rules copy against the post-rework game | docs | S |

## If you only do five

**01** (dev tools), **02** (error boundary), **03** (missing music), **07**
(unauthenticated writes), **15** (unit tests).

01–03 are visible to every user on day one. 07 and 15 are what make the data you
collect from batch 1 worth acting on.

## Dependencies

```
05 (commit WIP) ──> everything else
                    │
07 (auth writes) ──>├─ 08 (moderation: needs a trusted accountId to block)
                    │
10 (schema) ───────>├─ 08 (needs a `blocked` column)
                    │
15 (vitest) ───────>├─ 24 (wire test:unit into CI)
09 (dedupe bug) ───>┘    (09's acceptance criteria want a test)

23 (DESIGN.md) ────> 25 (rules copy) ──┐
                                       ├─ audit content together
12 (unhide tabs) ─────────────────────>┘

11 (flag defaults) ──> 13 (measurement window)   settle flags before opening it
12 (library tab) ────> 11 (needs `library: true`)

20 (README) ───────> 22 (fold live setup notes in before archiving)
21 (.gitignore) ───> 20 (.env.example must stay trackable)

03 (music) <───────> 16 (audio cleanup: mourning-song.ogg may become gameover)
04 (manifest) ─────> 19 (indexing decision)
06 (privacy) <─────> 18 (Google Fonts is a disclosure item)
```

## Pushing these to GitHub

`gh` was not installed when this backlog was written, so these live in the repo
rather than as GitHub issues. To push them:

```powershell
winget install GitHub.cli
gh auth login
./scripts/create-github-issues.ps1 -DryRun   # preview
./scripts/create-github-issues.ps1           # create
```

The script reads every `docs/issues/NN-*.md`, creates one GitHub issue per file
with `priority:*` and area labels, and skips any already marked
`status: done`. It does not delete these files — they stay as the offline copy.
