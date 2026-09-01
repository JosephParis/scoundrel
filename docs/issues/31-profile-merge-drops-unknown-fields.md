---
id: 31
title: "The profile merge silently drops any field it does not already know about"
priority: P1
area: bug
effort: S
status: open
---

## Problem

`mergeProfiles` rebuilds a fixed six-key object and returns it:

```js
// api/_lib/merge.js:87
return {
  library, ascensionUnlocked, tutorialCompleted, seenSpecials, history, save,
}
```

Anything else the client sends is discarded. Not rejected, not logged —
discarded, and the discarded shape is what gets written back to the row and
handed to the device as the merged truth.

The same whitelist is restated in three more places:

- `snapshotLocalState` — `src/utils/cloudSync.js:71`
- `foldWithLocal` — `src/utils/cloudSync.js:103`
- `applyCloudState` — `src/utils/cloudSync.js:137`

So adding one field to a player's synced state means editing four lists, and
missing any of them fails **silently and asymmetrically**: the field appears to
save locally, syncs to nothing, and reappears as its default the moment another
device writes back.

## Why it matters for batch 1

This is the failure mode issue 30 is an instance of, and it will happen again —
the next field somebody adds to the profile is the next silent data loss. It is
also the only sync bug a player cannot report usefully: nothing errors, they
just say "it forgot my settings."

The dedupe keys had exactly this shape of problem and were solved exactly this
way: `test/dedupeKeys.test.js` holds four separately-written key functions in
agreement, and it is why the `merge.js` `runSeed` bug (issue 09) could not come
back. The profile shape has no such test.

## Suggested fix

One vitest file that asserts the four shapes agree:

- The key set `snapshotLocalState` produces
- The key set `mergeProfiles` returns
- The keys `foldWithLocal` folds
- The keys `applyCloudState` writes back

Fail on any key present in one and missing from another, with a message naming
the four files, so the next person to add a field is told where to add it rather
than discovering it in production. Keep any deliberate exception (a device-local
key like `deviceId` — issue 30) as an explicit, named allowlist in the test, not
as an accident of omission.

Whether to make the merge pass unknown keys through instead is a real
alternative and probably a worse one: the blob is written to a `jsonb` column
from an unauthenticated-ish client and an open passthrough lets a device store
arbitrary data in the row. Keep the whitelist; test it.

## Acceptance criteria

- [ ] A test fails when a field is added to one of the four lists and not the others
- [ ] Its failure message names the files that need editing
- [ ] Device-local keys are an explicit allowlist with a stated reason
- [ ] `merge.js`'s doc comment says the shape is enforced by that test
