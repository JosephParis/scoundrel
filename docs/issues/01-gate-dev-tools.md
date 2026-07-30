---
id: 01
title: "Gate Dev tools behind a non-obvious flag before public launch"
priority: P0
area: launch-blocker
effort: S
status: open
---

## Problem

The "Dev tools" entry is rendered in the overflow menu unconditionally, so every
player in batch 1 can open it. `DevModal` grants: set sigils to any value, select
any trial, choose Long Night children, and enable every boon — plus `FlagsPanel`,
which toggles all 7 feature flags.

## Evidence

- `src/games/scoundrel/components/TopBar.jsx:347` — `<span>Dev tools</span>` menu
  item, no gating condition. Handler wired at `TopBar.jsx:342` (`onOpenDev()`).
- `src/games/scoundrel/components/modals.jsx` — `DevModal` + `FlagsPanel`.

## Why it blocks batch 1

Runs that touch the tool are stamped `devUsed: true` and excluded from admin
stats and the leaderboard, so the *data* stays clean. The problem is the player
experience and the balance signal: testers will find this within minutes, and any
run they trivialize is a run that produced no difficulty information. See
`WINRATE_TARGETS.md` — the go point needs ~1,500–2,000 genuine default-mode A0
runs.

## Suggested fix

Gate the menu item on either `import.meta.env.DEV` or a URL param, matching the
existing flag-override convention in `src/games/scoundrel/flags.js` (which
already supports `?flag-<id>=1`). A `?dev=1` check is the smallest change and
keeps the tool reachable in production for you.

Keep the `devUsed` stamp regardless — it's the safety net if the gate is ever
bypassed.

## Acceptance criteria

- [ ] Dev tools does not appear in the overflow menu on a default production load
- [ ] It is still reachable via the documented escape hatch (`?dev=1` or dev build)
- [ ] Runs that used it still record `dev: true` and stay out of `/api/stats` and the leaderboard
- [ ] `npm run lint` and `npm run build` clean
