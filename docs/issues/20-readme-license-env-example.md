---
id: 20
title: "No README, LICENSE, or .env.example"
priority: P4
area: docs
effort: M
status: open
---

## Problem

The repo root has 14 markdown files and none of them is a README. There is also
no LICENSE and no `.env.example`.

The practical consequence: setting up a fresh machine — or onboarding anyone,
human or agent — requires reading source comments to discover the environment
variables. There are eight, spread across client and server:

| Variable | Used by | Effect if missing |
|---|---|---|
| `VITE_GOOGLE_CLIENT_ID` | `src/utils/auth.js`, `LoginModal.jsx` | **Silently falls back to a local "dev sign-in" form** |
| `GOOGLE_CLIENT_ID` | `api/_lib/google.js`, `api/auth.js` | `/api/auth` returns 503 |
| `SESSION_SECRET` | `api/_lib/session.js`, `api/auth.js` | `/api/auth` returns 503 |
| `DATABASE_URL` | all `api/*` endpoints | every endpoint 503s |
| `ADMIN_TOKEN` | `api/stats.js`, `api/cron-backfill-runs.js` | `/admin` unusable |
| `CRON_SECRET` | `api/cron-backfill-runs.js` | weekly backfill unauthorized |
| `VITE_PUBLIC_POSTHOG_TOKEN` | `src/main.jsx` | no product analytics |
| `VITE_PUBLIC_POSTHOG_HOST` | `src/main.jsx` | no product analytics |

The `VITE_GOOGLE_CLIENT_ID` row is the dangerous one — its absence doesn't error,
it quietly swaps real auth for a fake local sign-in. A production build missing
that variable ships a login form that trusts whatever name you type.

## Suggested fix

**`README.md`** — what the game is, one screenshot, then:

- Quick start: `npm i`, `npm run dev`
- Every script: `dev`, `build`, `lint`, `preview`, `test`, `test:mobile`
- The full env var table above, marking which are build-time (`VITE_*`) vs runtime
- Architecture in a few paragraphs: localStorage as source of truth with
  convergent server-side merge; `logic/` module split; the feature flag system
  and its `?flag-<id>=1` override; `GAME_VERSION` balance stamping
- Pointers to the other docs: `REWORK.md` as the design of record, `DESIGN.md`
  (with a staleness warning until issue 23 lands), `WINRATE_TARGETS.md`,
  `db/schema.sql`, and `docs/issues/` for this backlog
- Deployment notes: Vercel, the SPA rewrite, the weekly cron

**`.env.example`** — all eight variables with placeholder values and a comment
each. Explicitly warn that a production build without `VITE_GOOGLE_CLIENT_ID`
falls back to dev sign-in.

**`LICENSE`** — pick one. This matters more than it looks: without a license the
default is "all rights reserved," so nobody can legally fork or contribute, and
it's ambiguous what batch-1 users may do with the code if the repo is public.
Note the audio is CC BY 3.0 (see `public/audio/music/CREDITS.md`) and the fonts
are OFL if issue 18 self-hosts them — so a note on third-party asset licensing
belongs here too.

## Acceptance criteria

- [ ] `README.md` covers setup, scripts, all eight env vars, architecture, deployment
- [ ] `.env.example` lists all eight with the dev-sign-in warning called out
- [ ] `LICENSE` chosen and added, with third-party asset licenses noted
- [ ] A clean clone can be brought up from the README alone
