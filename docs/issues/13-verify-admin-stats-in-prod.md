---
id: 13
title: "Verify /api/stats and /admin work against production before inviting anyone"
priority: P2
area: product
effort: S
status: open
---

## Problem

Balance has never been measured against real players, and the pipeline that would
measure it has never been exercised end to end in production.

`WINRATE_TARGETS.md` sets the targets: **~20% total winrate (15–25% acceptable
band)**, per-tier survival bands, and a go point of **~1,500–2,000 default-mode
A0 runs** before acting on theme bands. Batch 1 is the only way to get those
runs.

## Why this is urgent rather than routine

If `/api/stats` or `/admin` is broken in production, you find out *after* the
cohort has played. The runs are recorded either way (`api/runs.js` writes
independently of the dashboard), but you'd be flying blind during the window when
you most want to react — and any misconfiguration that affects *writes* rather
than reads loses the data permanently.

Checking takes minutes now and is unrecoverable later.

## Pre-launch checklist

Environment, in Vercel:

- [ ] `DATABASE_URL` set and reachable (all endpoints 503 without it)
- [ ] `ADMIN_TOKEN` set — `api/stats.js` requires it as a bearer token
- [ ] `CRON_SECRET` set — `api/cron-backfill-runs.js` accepts either this or `ADMIN_TOKEN`
- [ ] `GOOGLE_CLIENT_ID` + `SESSION_SECRET` set (`api/auth.js` 503s without both)
- [ ] `VITE_GOOGLE_CLIENT_ID` set at build time — without it `LoginModal` silently falls back to the local "dev sign-in" form, which must **not** happen in production
- [ ] `VITE_PUBLIC_POSTHOG_TOKEN` + `VITE_PUBLIC_POSTHOG_HOST` set

End-to-end, against the deployed URL:

- [ ] Play one real run to completion. Confirm it appears in `runs`.
- [ ] `/admin` accepts `ADMIN_TOKEN` via `TokenGate` and renders. All 19
      aggregations in `api/stats.js` return without error on a near-empty
      dataset — several are prone to divide-by-zero or null-band edge cases when
      `n` is tiny, and that is exactly the state on day one.
- [ ] `VersionRange` From/To picker filters correctly across `VERSION_HISTORY`
- [ ] Band verdicts render (`src/admin/bands.js` against `WINRATE_TARGETS.md`)
- [ ] Submit feedback from the live site; confirm it appears in the admin feedback view
- [ ] Play one run with Dev tools; confirm it is `dev: true` and **excluded** from stats
- [ ] Set a handle, win a run, confirm it appears on the leaderboard; confirm a
      handle-less victory does **not** (see issue 14)
- [ ] Confirm the weekly cron (`0 4 * * 1` → `/api/cron-backfill-runs`) is
      registered in Vercel and returns 200 when triggered manually
- [ ] Sign in on a second device; confirm history merges both ways (and see issue 09)

Carried over from issue 06:

- [ ] **Create the privacy contact mailbox** and send it a test message. The policy
      lists `scoundrel.privacy@gmail.com` (`src/privacyContact.js`); it does not
      exist yet, and a policy pointing at an unread address means deletion requests
      vanish silently.
- [ ] Confirm `/privacy` resolves on the deployment as a direct URL (it relies on
      the `vercel.json` SPA rewrite, not just client-side routing)
- [ ] Confirm PostHog person profiles show a pseudonym and **no** email or name

Carried over from issue 07, which hardened the write endpoints but could not test
them against a deployment (there is no `/api` in `vite dev` or `vite preview`):

- [ ] A **signed-in** player's run reaches `runs` — i.e. `historyStore` is sending
      `Authorization` and is not being 401'd. This is the regression to watch: a
      broken token path would silently stop recording every signed-in run.
- [ ] A **guest** run still reaches `runs` with no token
- [ ] Signed-in and guest feedback both still submit
- [ ] A hand-rolled POST to `/api/runs` claiming someone else's `accountId` is
      rejected with 401
- [ ] Hammering `/api/runs` past 30/min returns 429 with `Retry-After`
- [ ] The `rate_limits` table was created on first use and is being swept
- [ ] The leaderboard still lists real victories after the 60s floor and the
      rooms/sigil cross-checks — confirm a genuine win is not filtered out

## Measurement plan

- [ ] Record the `GAME_VERSION` the window opens on, and freeze balance-affecting changes for its duration
- [ ] Settle issue 11's flag defaults **before** the window opens
- [ ] Note that ~1,500–2,000 runs is a lot for one small batch — decide up front whether batch 1 is a *qualitative* pass (bugs, comprehension, feel) with balance deferred to a larger batch 2. Sizing the cohort against the go point tells you which one you're running.

## Acceptance criteria

- [ ] Every checklist item above verified against production, not preview
- [ ] A screenshot or note recording that `/admin` rendered correctly with real data
- [ ] Explicit decision on whether batch 1 is qualitative or a balance measurement
