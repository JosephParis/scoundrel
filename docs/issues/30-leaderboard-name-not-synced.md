---
id: 30
title: "BUG a signed-in player gets a different leaderboard name on every device"
priority: P1
area: bug
effort: M
status: open
---

## Problem

Every device assigns itself a name on first launch (`Ashen Vagrant 47`), seeded
by a per-device id. That is correct for guests — it is what makes two guests
distinguishable on the board. It is wrong for a signed-in player, because the
name is never synced, so **the same account is a different person on each
device.**

Nothing in the profile blob carries it:

```js
// src/utils/cloudSync.js:71 — snapshotLocalState()
return {
  library, ascensionUnlocked, tutorialCompleted, seenSpecials, history, save,
}
```

Four keys the player owns are absent from that shape:

- `scoundrel:leaderboardHandle` (`src/games/scoundrel/settings.js:14`)
- `scoundrel:leaderboardAnonymous` (`settings.js:15`)
- `scoundrel:cardLayout` (`settings.js:13`)
- `scoundrel:deviceId` (`src/games/scoundrel/assignedName.js:32`) — see the trap
  below; this one must **not** be synced

## What the player sees

- They name themselves `Rookwarden` on the laptop. On the phone, the same
  account posts as whatever that phone was assigned.
- Both names are claimed, permanently. `api/_lib/handles.js` never releases a
  claim, so one account can hold two names forever and there is no way to
  merge them.
- Turning on "don't list a name" in Settings applies to one device. The other
  keeps posting a name — which is the setting failing in the direction that
  matters, since it is the privacy-shaped one.
- Card layout (`modern`/`classic`) resets per device too. Cosmetic, but it is
  the same missing seam.

## Why it matters for batch 1

Signing in is the thing the game asks a player to do, and cross-device sync is
what it offers in return (`api/save.js` syncs unlocks, ascension, tutorial and
history already). A player who signs in on two devices and finds two identities
on the leaderboard concludes the sync is broken — reasonably, since it is.

## Suggested fix

Add the **name choice** to the synced profile, not the device identity:

- `leaderboardName` — the resolved string, so a device that only ever had an
  assigned name still publishes one canonical name for the account
- `anonymous` — the explicit opt-out
- `nameSetAt` — a timestamp, because a name is a single evolving value and
  cannot set-union. Newest-wins, exactly as `save` does (`api/_lib/merge.js:66`,
  `newerSave`). Without a stamp two devices flap between names forever.
- `cardLayout` — same newest-wins treatment, or leave it device-local and say so

The first sync promotes whatever that device is currently posting under into the
account's name; later devices adopt it rather than assigning their own.

**Trap: never sync `deviceId`.** `api/leaderboard.js` partitions guests by it,
so two devices sharing one would collapse into a single ranked row and drop the
slower one — the exact defect the `deviceId` work fixed on 2026-08-30. It is a
device id, not a player id, and it must stay device-local even though it lives
beside the keys above.

Four places move together (`test/dedupeKeys.test.js` is the model for holding
them in step — see also issue 31):

- `snapshotLocalState` (`cloudSync.js:71`)
- `foldWithLocal` (`cloudSync.js:103`)
- `applyCloudState` (`cloudSync.js:137`)
- `mergeProfiles` (`api/_lib/merge.js:87`)

Renaming already-stored runs is out of scope — `/api/claim` owns that, and a
past run keeps the name it was posted under by design.

## Acceptance criteria

- [ ] A custom name set on one device is the name the second device posts under
- [ ] The anonymous opt-out crosses devices
- [ ] A device with only an assigned name adopts the account's name on first sync
- [ ] Two devices syncing in either order converge on one name (no flapping)
- [ ] `deviceId` is still per-device, and a test says why
- [ ] vitest over the merge rules, both halves (client fold and server merge)
- [ ] Anything only provable against the real database goes on issue 13
