---
id: 09
title: "BUG: api/_lib/merge.js omits runSeed from the run dedupe key, dropping runs on sync"
priority: P1
area: bug
effort: S
status: open
---

## Problem

There are four implementations of the "which run is this" key. Three include
`runSeed`; the server-side profile merge does not. Two distinct runs that share
an `accountId` and `startedAt` therefore collapse into one during merge, and the
loser is silently discarded from synced history.

## Evidence

The odd one out — `api/_lib/merge.js:34-36`:

```js
function runKey(record) {
  return `${record?.accountId ?? ''}:${record?.startedAt ?? ''}`
}
```

The other three, all of which append `runSeed` when present:

- `api/_lib/runsTable.js:56` — `runKeyFor()`:
  ```js
  const base = `${record.accountId}:${record.startedAt}`
  return record.runSeed ? `${base}:${record.runSeed}` : base
  ```
- `src/utils/historyStore.js:76` — `serverKeyOf`
- `src/utils/cloudSync.js:102` — `foldWithLocal`, the client-side twin of this
  very merge function

The comment above `runKey` claims it mirrors "the client and /api/runs dedupe."
That was true when written and is now false — which is why the divergence went
unnoticed.

`runSeed` exists precisely for this case. From `src/games/scoundrel/history.js:100`:

> Stable per-run token (set at run start, unlike `id` which is fresh each build).
> Part of the dedupe key so two devices' guest runs can't collide on a shared
> `startedAt`.

So the collision this key was designed to prevent is exactly the one `merge.js`
still allows.

## Impact

- Two guest runs started in the same millisecond on two devices — the documented
  motivating case — merge into one, and a real run vanishes from history.
- `runs` (analytics) and `profiles` (history) disagree about how many runs
  exist, because `runsTable.js` keys them differently than `merge.js` does.
- The client's `foldWithLocal` keeps both records while the server keeps one, so
  the next sync can reintroduce and re-drop the same record.

Low frequency, high confusion: a player reporting "my run disappeared" is very
hard to debug from the outside.

## Suggested fix

Make `merge.js` use the same key as everything else. Best fix is to stop having
four copies: export the key function from a shared module and import it in all
four call sites. `api/_lib/runsTable.js` already exports `runKeyFor` with the
correct logic — if the client can't import from `api/`, move the function to a
shared location both trees can reach, or at minimum add a test asserting all
four produce identical output for the same record.

Fix the stale comment either way.

Check whether any already-synced profiles lost runs. `api/cron-backfill-runs.js`
backfills `runs` from `profiles` history, so if history rows were dropped before
backfill, those runs are gone from both tables and are not recoverable — worth
confirming the blast radius is zero before it grows.

## Acceptance criteria

- [ ] `merge.js` includes `runSeed` in the key when present
- [ ] One shared implementation, or a test proving all four agree
- [ ] Test: two records with the same `accountId` + `startedAt` but different `runSeed` both survive a merge
- [ ] Test: legacy records with no `runSeed` still dedupe correctly against themselves
- [ ] Stale comment corrected
