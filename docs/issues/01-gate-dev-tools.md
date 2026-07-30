---
id: 01
title: "Gate Dev tools behind a non-obvious flag before public launch"
priority: P0
area: launch-blocker
effort: S
status: done
---

## Resolution

`isDevToolsEnabled()` added to `src/games/scoundrel/flags.js`, gating both the
menu entry (`TopBar.jsx`) and the `<DevModal>` render (`index.jsx`).

Deliberately **not** an entry in `DEFAULTS`: the dev panel is what toggles those
flags, so gating it with one would mean needing dev tools to enable dev tools,
and a switch in `FLAG_META` could turn itself off with no way back. It is a
sibling function with the same URL-beats-storage precedence as the flags.

Behavior: dev builds always enabled (`import.meta.env.DEV`, which folds away in
the production bundle — verified absent from `dist/`). Production is off until
`?dev=1`, which persists to `localStorage['scoundrel:devTools']` so a reload
keeps it; `?dev=0` clears it.

Gated in two places on purpose. Hiding the entry is what players see; gating the
modal render makes the panel unreachable rather than merely unadvertised, so a
future `setDevOpen` caller that forgets the check cannot open it.

This is not a security boundary — the key is discoverable in the bundle. It stops
players stumbling into a tool that trivializes the game. The `devUsed` stamp
(`modals.jsx:320` → `history.js:98`) is untouched and remains what actually keeps
those runs out of `/api/stats` and the leaderboard.

### Verified

Against a **production** preview build (`vite preview`), since `npm run dev`
always opens the gate by design — 8/8 checks:

| Check | Result |
|---|---|
| Default prod load hides Dev tools | 0 entries |
| Default prod load sets no storage key | `null` |
| `?dev=1` shows Dev tools | 1 entry |
| `?dev=1` persists the key | `1` |
| Gate survives reload with no param | 1 entry |
| `?dev=0` hides it again | 0 entries |
| `?dev=0` clears the key | `null` |
| Other menu entries unaffected | Settings + Credits present |

`npm run lint` clean, `npm run build` clean, existing Playwright suites pass with
no snapshot churn — dev-server rendering is intentionally unchanged, so the
visual baselines still hold.

### Follow-ups (not done here)

- **No regression test in the repo.** Verification was a one-off script. A
  permanent test needs a Playwright project pointing at `vite preview`, because
  `playwright.config.js` runs `npm run dev` where the gate is always open. That
  is test infrastructure — belongs with issue 15 / issue 24.
- **`DevModal` still ships in the production bundle.** It is statically imported
  from `./components/modals` alongside `SettingsModal` and `CreditsModal`, so
  gating the render saves no bytes. Lazy-loading it would trim the main chunk;
  out of scope here.

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

- [x] Dev tools does not appear in the overflow menu on a default production load
- [x] It is still reachable via the documented escape hatch (`?dev=1` or dev build)
- [x] Runs that used it still record `dev: true` and stay out of `/api/stats` and the leaderboard
- [x] `npm run lint` and `npm run build` clean
