---
id: 07
title: "/api/runs and /api/feedback accept unauthenticated writes with client-supplied accountId"
priority: P1
area: security
effort: M
status: done
---

## Resolution

Four layers, plus the client changes needed so the existing flows keep working.

**1. Auth gate.** `mayWriteAs(claimedAccountId, account)` in `api/_lib/validate.js`.
Guests stay open — guest play has no token to present — but anything claiming a
real account must present a matching session token, verified with the existing
`accountFromRequest`. Applied in both `api/runs.js` and `api/feedback.js`. For a
batch, **every** record must pass, so a guest batch cannot smuggle in one
impersonating record.

**2. Rate limiting.** `api/_lib/rateLimit.js`, fixed-window, **Postgres-backed
rather than in-memory** — Vercel runs many short-lived instances, so a
per-process counter is bypassed by landing on another one. Buckets embed
`floor(now/window)` so windows rotate on their own; a probabilistic sweep on
write replaces a cron. `runs` 30/min, `feedback` 5/min.

**It fails open by design.** If the limiter errors, the request is allowed —
losing a real player's run is unrecoverable, whereas briefly accepting abuse is
not, and this protects a hobby leaderboard rather than anything with real value
behind it. That tradeoff is asserted in a test so it can't be "fixed" by accident.

**3. Record validation.** `validateRunRecord` in `api/_lib/validate.js`, imported
from the game's own `SIGIL_TARGET` / `VERSION_HISTORY` so the rules cannot drift
from the ruleset. Batch capped at 200 (matching `historyStore`'s local cap).

Deliberately **permissive about storing**: a wrongly rejected record is lost data
you can never notice, whereas a wrongly accepted one is still in the table and
can be deleted. So it only rejects the physically impossible — timestamps before
2024 or far in the future, `endedAt < startedAt`, `durationMs` exceeding the
wall-clock span (it's span minus pauses, so it can be shorter but never longer),
sigils above target, a victory below target, an unknown outcome or version. A
malformed record inside a resend batch is dropped individually rather than
discarding the valid ones beside it.

**4. Leaderboard floors.** Strictness about *publishing* went here, where a false
negative only hides one row: duration floor **1s → 60s**, plus a minimum
`roomsEntered` and a sigils-reached-target check.

The casts are **regex-guarded rather than bare `::int`**. The write endpoint was
open and unvalidated until now, so a single stored row with a non-numeric value
there would have aborted the query and taken the whole board down.

### Client changes (required, easy to miss)

Both writers now send the token, or signed-in players would have started getting
401s:

- `src/utils/historyStore.js` — `reconcile()` attaches `Authorization` when a
  session token exists. The queue mixes guest and account records, so it always
  presents the token when it has one.
- `src/utils/feedback.js` — same.

Verified no import cycle: `cloudSync.js` has no imports of its own.

### Tests

**vitest added** — the repo had no unit runner, so this fix could not otherwise
have any tests. That partly advances issue 15. Scoped away from `visual/` in
`vitest.config.js`, since Playwright owns that directory. `npm test` now runs
both; `test:unit` also runs in the `lint-and-build` CI job on every push, because
it is sub-second and needs no browser.

**71 unit tests**, in three files: the pure rules (`validate.test.js`), the
limiter's bucket/IP logic and its fail-open behavior (`rateLimit.test.js`), and
the handler's control flow with a stubbed Neon client (`runs.handler.test.js`) —
405/401/429/400/202, including that the limiter is checked *before* anything is
inserted, and that a forged token is rejected.

Proven to have teeth: stubbing `mayWriteAs` to `return true` fails 7 tests.

### Not done

- **`api/feedback.js` has no handler-level test.** `runs.handler.test.js`
  establishes the pattern; feedback would be a near-copy. Its logic is one
  `mayWriteAs` call plus one limiter call, both covered directly.
- **Nothing is verified against a real deployment.** There is no `/api` in `vite
  dev` or `vite preview`, so the endpoints cannot be exercised end to end
  locally — the coverage above is handler-level with a stubbed client. Posting a
  real run, a real feedback item, and confirming a signed-in player is not 401'd
  belongs on issue 13's pre-launch checklist.
- **`rate_limits` needs no migration** — created on first use — but is now
  documented in `db/schema.sql` so it does not repeat issue 10.

## Problem

Two POST endpoints are fully open: no session token, no rate limit, and the
`accountId` is taken from the request body rather than from a verified token.

**`api/runs.js`** — accepts a single record or an array. Validation is
`isValidRecord`, which only checks that `record.startedAt && record.accountId`
are truthy. Everything else — `outcome`, `durationMs`, `playerName`,
`gameVersion`, `dev` — is trusted as sent.

**`api/feedback.js`** — `accountId` comes from the body, defaulting to
`'guest'`. `MAX_MESSAGE = 4000`.

This is a deliberate design (the client mirrors runs fire-and-forget, and guests
must be able to submit without an account), and `api/save.js` gets it right:
that endpoint requires a session token and takes the account id *from the token,
never the body*. The write endpoints just haven't caught up.

## Concrete abuse paths

1. **Forged leaderboard entries.** Anyone can POST a victory record with any
   `playerName` and a `durationMs` of their choosing, and it lands on the public
   board. The only guard in `api/leaderboard.js` is `duration_ms >= 1000` — a
   one-second world record passes. The endpoint's own comment acknowledges
   durations are self-reported, but the forgery surface is wider than that: the
   attacker doesn't need to have played at all.
2. **Attribution to someone else's account.** Feedback (and runs) can be posted
   under another player's `accountId`, poisoning their history and your admin
   feedback view.
3. **Unbounded flooding.** No rate limit on either endpoint. 4000 chars ×
   unlimited requests fills the `feedback` table; forged runs fill `runs` and
   skew every aggregation in `/api/stats`, which is the data you need for the
   balance decision in issue 13.

## Why it matters for batch 1

The moment the URL is shared it is reachable by anyone. The cost isn't just a
defaced leaderboard — it's that your balance dataset becomes untrustworthy, and
you can't tell forged rows from real ones after the fact.

## Suggested fix

Layered, cheapest first:

- **Require the session token when a record claims a real account.** If
  `accountId !== 'guest'`, verify the bearer token via
  `accountFromRequest` (already in `api/_lib/session.js`) and require it to match.
  Guest posts stay open, which preserves guest play.
- **Rate limit both endpoints.** Per-IP, short window. Vercel middleware or a
  small Neon-backed counter both work; the table already exists.
- **Tighten `isValidRecord`.** Reject implausible values: `durationMs` below a
  floor or above a ceiling, `endedAt < startedAt`, `sigilsEarned` above
  `SIGIL_TARGET`, unknown `outcome`, `gameVersion` not in `VERSION_HISTORY`,
  array payloads above a length cap.
- **Raise the leaderboard duration floor** to something a human could plausibly
  achieve, and consider a server-side sanity check against `roomsEntered` /
  `monstersSlain` — a victory with 3 rooms entered is not real.

Full anti-cheat is out of scope; the goal is that casual forgery costs more than
it's worth and that you can distinguish trusted from untrusted rows.

## Acceptance criteria

- [x] A POST claiming a non-guest `accountId` without a valid matching token is rejected
- [x] Both endpoints rate limited; limits documented (runs 30/min, feedback 5/min)
- [x] Validation rejects out-of-range durations, bad outcomes, oversized arrays
- [~] Legitimate guest mirroring and guest feedback still work — covered at handler level with a stubbed client; **not** verified against a deployment (no `/api` locally, see issue 13)
- [x] Leaderboard duration floor raised 1s → 60s, plus rooms/sigil cross-checks
