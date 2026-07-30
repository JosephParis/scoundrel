---
id: 07
title: "/api/runs and /api/feedback accept unauthenticated writes with client-supplied accountId"
priority: P1
area: security
effort: M
status: open
---

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

- [ ] A POST claiming a non-guest `accountId` without a valid matching token is rejected
- [ ] Both endpoints rate limited; limit documented
- [ ] `isValidRecord` rejects out-of-range durations, bad outcomes, oversized arrays
- [ ] Legitimate guest run mirroring and guest feedback still work end to end
- [ ] Leaderboard duration floor reviewed against a real fastest human victory
