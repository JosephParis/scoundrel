---
id: 30
title: "BUG a signed-in player gets a different leaderboard name on every device"
priority: P1
area: bug
effort: M
status: done
branch: dawn/2026-09-06
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

- [x] A custom name set on one device is the name the second device posts under
- [x] The anonymous opt-out crosses devices
- [x] A device with only an assigned name adopts the account's name on first sync
- [x] Two devices syncing in either order converge on one name (no flapping)
- [x] `deviceId` is still per-device, and a test says why
- [x] vitest over the merge rules, both halves (client fold and server merge)
- [x] Anything only provable against the real database goes on issue 13

## Resolution

`leaderboardName`, `anonymous` and `nameSetAt` are now part of the synced
profile and are picked **as one value**, newest stamp wins — the same treatment
`save` gets. Picking them apart would let one device's opt-out land beside
another device's name and publish a player who asked not to be named.

Three decisions worth knowing:

- **An equal stamp keeps the incumbent**, on both sides of the sync. That is
  what makes this converge rather than merely be deterministic: a device
  re-posting a value it already holds never displaces the account's name.
- **Adopting a name copies the server's stamp verbatim.** Re-stamping with the
  local clock would let the adopting device win the next round, and the two
  would trade the name forever.
- **A name nobody typed carries `nameSetAt: 0`.** It is still promoted when the
  account has no name — which is what gives a player who never opens Settings
  one name across their devices — and always loses to a name actually chosen.

`cardLayout` was left **device-local**, deliberately. The `classic` layout shows
rules on hover only, and there is no hover on a phone, so syncing a desktop
choice onto a handset would actively degrade it. It is a rendering preference
tied to the screen, not an identity. Reverse this if that reasoning is wrong.

The live `settings` singleton re-reads on a `sigil:profile-synced` event. Without
it a device that adopted the account's name would keep *posting runs* under the
name it read at startup until the next reload — the same bug, quieter.

`test/nameSync.test.js` (15 tests) drives both halves through the real round
trip: two devices with their own `localStorage` against one server profile.
`test/profileShape.test.js` (issue 31) is what keeps the four declarations of
the shape in step now that three fields were added to it.

**For issue 13:** confirm against the real database that a signed-in player's
name survives a sync — none of this has run against `/api/save` in production,
since there is no `/api` in `vite dev`.
