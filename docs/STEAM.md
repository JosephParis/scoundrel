# Steam port — plan and task list

A second milestone, separate from `docs/issues/`: **shipping Sigil as a paid or
free desktop app on Steam.** Phase 1 is built (see *Status* below); everything
that needs a Steamworks account is not. Nothing here is a
numbered backlog issue, and these tasks should not be folded into
`docs/issues/README.md` — that backlog is scoped to sending the *web* game to
the first batch of users, and finishing it is a prerequisite for this, not a
part of it.

Task IDs are `S01`–`S21` so they never collide with backlog issue numbers.

---

## Verdict

**Feasible, and the code half is small.** The `standalone` build target
(`src/buildTarget.js`, `npm run build:itch`) already produces exactly what a
Steam build needs: no `/api` calls, hash routing, base-relative assets, fully
playable offline, 845KB of JS. Wrapping it in Electron is a weekend.

The work that is *not* small:

- **Achievements.** There are none. A grep for `achievement` across `src/`
  returns nothing. A genre expectation, and the main retention hook — but see
  *Revised task priority under "free"*: since S01 answered **free**, these moved
  off the launch-blocking list and became a post-launch patch.
- **Store art.** There are zero image assets in `src/` — Sigil is entirely CSS
  and typography. That is a fine look in a browser and a serious problem for a
  920×430 capsule in the most saturated genre on the platform.
- **Steam Cloud.** 54 raw `localStorage.` call sites across 14 files, with no
  storage adapter to point somewhere else.

Two backlog items become **moot** on Steam and should not be done *for* this
milestone: issue 35 (service worker — the app is already offline) and issue 32
(the 15MB music bed — a web payload concern only; on Steam you can afford
*more* audio, not less).

---

## Status — what is built (2026-09-02)

| Task | State |
| --- | --- |
| S01 paid or free | **Answered: free.** See below. |
| S03 Electron wrapper + `steam` target | **Done.** `electron/`, `npm run build:steam`, `npm run steam:pack`. |
| S04 window, fullscreen, resolution | **Done.** `electron/windowRules.cjs`, F11 / Alt+Enter. |
| S06 telemetry and web-only surfaces | **Done.** The packaged app makes zero network requests, asserted. |
| S08 achievement list | **Drafted, awaiting sign-off** — `docs/ACHIEVEMENTS.md`. |
| S05 storage adapter | **Deferred.** See the note on the task. |
| S07, S09, S10 | **Blocked on the App ID** (S13). |
| S12 controller / Deck | Not started. |
| Everything in Phase 3 | Needs Joey's Steamworks account. |

A packaged `Sigil.exe` has been built and launched. It loads from `file://`,
carries the `desktop` class and not `embedded`, opens at 1266x864 (clear of the
760px threshold), renders in Cinzel and Inter loaded from disk, and makes **no
network requests at all**.

Two things came out of building it that were not in the original plan:

- **The fonts were being fetched from Google at runtime** — open backlog issue
  18, which turns out to be a Steam blocker rather than a P3 performance nit.
  Sigil has no illustrations; it is typography. Offline, the entire game was
  rendering in fallback fonts. Fixed by vendoring them (`npm run fonts`), which
  closes issue 18.
- **electron-builder cannot package inside a OneDrive folder.** It extracts to
  `win-unpacked.tmp`, renames, and OneDrive's handle makes the rename fail with
  an EPERM that names only the rename. `scripts/steam-pack.mjs` detects this and
  writes to `%LOCALAPPDATA%\Sigil\dist-electron` instead, saying so.

## The facts this plan is built on

| Thing | Value |
| --- | --- |
| Steam Direct fee | **$100 USD per app**, refundable after $1,000 adjusted gross revenue |
| Revenue split | 70/30, improving at $10M and $50M |
| Identity | Legal first and last name, **no alias**; must match bank and tax documents |
| Tax + bank | W-9 equivalent (US). **2–7 business days**, may request more documents |
| Hold after paying | **30 days** before you may release your first title |
| Coming Soon page | Must be publicly visible **≥2 weeks** before launch |
| Review | **3–5 business days**; Valve advises submitting **≥7 business days** early |
| Re-review | Not needed after approval — patch freely thereafter |
| Capsules | Header **920×430** (required), Small 462×174, Main 1232×706, Vertical 748×896, Library 600×900. JPG/PNG ≤2MB |
| Capsule rules | Readable title/logo required; **no** review scores, award logos or marketing text |
| Screenshots | ≥5 (8–10 recommended), ≥1920×1080, **gameplay only** — no concept art, no text overlays |
| Trailer | 1920×1080, H.264, 30fps |
| Build review | Must start up properly on **every** OS listed, and every listed feature must be in the build |

**Calendar floor: ~6–7 weeks** from paying the fee to being live, and only if
art and build are ready when the 30-day hold expires. Start the paperwork clock
early — it runs in parallel with everything else.

Sources are listed at the bottom of this file.

---

## Decisions that gate the rest

### S01 — Paid or free on Steam?  **ANSWERED: free** `2026-09-02`

> **Decision (Joey, 2026-09-02): ship free.** Recorded as a leaning rather than
> a signed contract — it is reversible until S13 is paid and effectively
> one-way after release (see *If it ships free* below). Everything in this file
> is now planned around it.
>
> What that buys: no refund window to survive, no "this is free on your
> website" reviews, no obligation to make the Steam build meaningfully better
> than sigildeck.com before it can ship. The return is **players, a store
> presence and a portfolio credential — not money.** The $100 becomes a
> marketing spend that does not come back.
>
> What it does **not** excuse: the store page, the art and the build-quality
> bar are identical for free games. Valve reviews them the same way, and a free
> game with a weak capsule is invisible in exactly the same way a paid one is.

The reasoning, kept for the record:

- Free-on-web plus paid-on-Steam is **allowed**. Cookie Clicker is the standing
  precedent: same developer, free browser version still live, paid on Steam.
- It only works if the Steam build visibly buys something. That "something" is
  precisely S07–S12: achievements, cloud saves, offline, controller, no browser
  jank. **If Sigil ships paid, those tasks are mandatory, not optional.**
- Launching **free** lowers the bar enormously: no refund pressure, no "this is
  free on your website" reviews, faster to ship. But no revenue, and the $100
  never comes back — the refund is tied to $1,000 of earnings.

### If it ships free — the rules that actually differ

Researched 2026-09-02, after the decision. Four of these are not obvious:

- **The $100 is gone.** The Steam Direct refund is tied to $1,000 of adjusted
  gross revenue. A free game with no DLC and no microtransactions never reaches
  it. Budget the fee as a sunk cost, not a deposit.
- **Free titles are ineligible for curated spotlights** — Daily Deals, Midweek
  and Weekend Deals. They *are* eligible for the Free to Play hub and for the
  ordinary Featured and Recommended sections.
- **Top Sellers is measured by in-game revenue** for free titles. With no
  monetisation Sigil scores zero there permanently. That chart is closed.
- **Popular New Releases uses player count**, not revenue — so it *is* open to a
  free game, and it is the realistic launch-visibility target. Wishlists still
  count normally toward Popular Upcoming, so S18 matters as much as ever.
- **Treat free as one-way.** Valve documents the paid → free conversion (support
  form, one week of notice to customers) and does not document the reverse.
  Plan as though Sigil cannot be made paid after release.
- The pricing flag is set at app creation: *"This is a free product."* Get it
  right in S13; do not assume it is a toggle later.

### Revised task priority under "free"

The decision demotes the tasks that existed to justify a price tag. It does not
delete them — for a free game they are retention and visibility rather than
value-for-money, which is a weaker argument but not a null one.

| Task | Was | Now | Why |
| --- | --- | --- | --- |
| S08 + S09 achievements | mandatory | **strongly recommended** | Still the main retention hook and a genre expectation, but no longer something a buyer is owed. Ship v1 without them if they are the only thing left. |
| S10 Steam Cloud | mandatory | **optional** | Nice; nobody demands it of a free game. S05 is still worth doing on its own merits. |
| Web-save import (in S10) | worth building | **drop for v1** | Its whole purpose was converting existing web players into buyers. There is nothing to convert now. |
| S12 controller / Deck | mandatory | **recommended** | Deck visibility is real and cheap-ish traffic, so keep it in scope — just not as a launch blocker. |
| S05 storage adapter | blocks S10 | **still do it** | 54 raw call sites is a liability regardless; it is the prerequisite if S10 ever happens. |
| S15 capsule art | critical | **critical** | Unchanged. Free does not buy discovery. |

Minimum shippable v1 under this decision: **S03, S04, S06, S13, S14, S15, S16,
S17, S18, S19, S20, S21.** Everything in Phase 2 becomes a post-launch patch,
which is fine — Valve does not re-review updates.

### S02 — Who makes the capsule art and trailer?  `needs a person` `effort: —`

The single highest-leverage item in this document and the long pole on the
calendar. You cannot screenshot a CSS card layout into a competitive capsule.
Options, decide before S15:

- Commission it (budget plus lead time, likely 2–4 weeks)
- Make it (a real project; the game's typographic identity is a starting point,
  not a finished capsule)
- Lean hard into the typographic look as a deliberate style — cheapest, and the
  one most likely to be scrolled past in the store feed

---

## Phase 1 — the wrapper  `agent-workable`

### S03 — Electron wrapper and a `steam` build target  **DONE** `2026-09-02`

- Add a third value to `VITE_BUILD_TARGET` (`steam`) alongside `standalone`, or
  reuse `standalone` if nothing needs to differ — read `src/buildTarget.js`
  first and decide there rather than guessing.
- **Electron, not Tauri.** Tauri uses WebKit on Mac/Linux (weaker graphics), and
  decisively: Electron and NW.js are the only frameworks the Steam JS bindings
  officially support.
- Package with `electron-builder`. Expect ~120MB of Chromium on top of the 17MB
  bundle; irrelevant on Steam.
- Mirror `scripts/build-itch.mjs` conventions: a script, not hand steps, with
  the env var set inside the script (Windows has no `VAR=x cmd`), and a refusal
  to package if the build produced no `index.html`.

Acceptance criteria:
- [ ] `npm run build:steam` produces a launchable Windows executable
- [ ] The app runs with the network fully disabled, start to a finished run
- [ ] No `/api` request is ever attempted (assert it, do not eyeball it)
- [ ] A test guards the target switch the way `visual/itch-build.spec.js` guards
      the standalone one

### S04 — Window, fullscreen and resolution pass  **DONE** `2026-09-02`

The layout is responsive for *web* breakpoints. Note the trap already recorded
in `docs/itch/PAGE.md`: `short:` in `src/index.css` is
`@media (max-height: 760px)`, and under it room cards clamp to `155px` against
`240px` — a badly sized default window serves desktop players the compact phone
layout inside a desktop-sized frame.

Acceptance criteria:
- [ ] Default window size sits **above** the 760px height threshold
- [ ] Fullscreen toggle (F11 and a menu affordance), state persisted
- [ ] Looks deliberate at 1280×720, 1920×1080 and 2560×1440
- [ ] No browser chrome, no right-click context menu, no text-selection cursor
- [ ] Devtools gated in the packaged build the way `dev-tools-gate.prod.spec.js`
      gates the web build

### S05 — Storage adapter, ahead of Steam Cloud  **DEFERRED** `effort: L`

> **Deferred on purpose, 2026-09-02.** S01 answered *free*, which demoted S10
> (Steam Cloud) from mandatory to optional, and S05 exists to unblock S10. What
> is left is a 54-call-site refactor across 14 files with real regression risk
> and no user-visible payoff until cloud saves actually ship. Electron persists
> `localStorage` in the app's own Chromium profile, so the packaged build saves
> and reloads correctly today — verified. Do this when S10 gets scheduled, not
> before.

Blocks S10. There are **54 raw `localStorage.` call sites across 14 files** and
no wrapper. Two routes, and the first is the right one:

- **Introduce a storage adapter** (`get`/`set`/`remove` over the `scoundrel:`
  prefix), backed by `localStorage` on web and a JSON file in Electron's
  `userData` on Steam. Then S10 is just pointing Auto-Cloud at one file.
- Auto-cloud Electron's Chromium `Local Storage/leveldb` directly. Cheaper
  today, and a bad idea: binary, lock files, and a sync conflict corrupts every
  save at once rather than one.

Acceptance criteria:
- [ ] Every `scoundrel:` read/write goes through the adapter; zero raw
      `localStorage.` calls remain in `src/` outside it
- [ ] Web behaviour is byte-identical — existing players lose nothing
- [ ] Steam build persists across a restart, saving to `userData`
- [ ] Unit coverage for both backends

### S06 — Web-only surfaces and telemetry in the Steam target  **DONE** `2026-09-02`

- **Analytics.** PostHog and Vercel Analytics phoning home from a desktop app is
  a store-page privacy disclosure and reads badly in reviews. Gate or strip both
  in the Steam target. Coordinate with issue 34 rather than fighting it.
- **Sign-in and leaderboard.** The standalone target hides both because Google
  Sign-In cannot work in itch's cross-origin iframe. **Electron is not an
  iframe**, so that constraint does not apply here — but do not simply re-enable
  them; that is decided in S11.
- **Any update nag or version check** must go. Steam patches via depots.
- `HOME_URL` links out to sigildeck.com: keep, but open in the system browser
  rather than an Electron window.

Acceptance criteria:
- [ ] No telemetry request leaves the packaged app (assert with a network stub)
- [ ] External links open in the OS browser, never in-app
- [ ] The privacy disclosure drafted in S14 matches actual behaviour

---

## Phase 2 — Steam integration  `agent-workable once the App ID exists`

All of Phase 2 needs the Steam App ID from S13. The design work in S08 does not.

### S07 — Steamworks bindings  `effort: M` `depends: S03, S13`

- `steamworks.js` (ceifa) or `steamworks-ffi-node` (no native build toolchain).
  Prefer whichever is currently maintained; check before committing.
- Note the licence constraint found in research: **GPL-licensed libraries cannot
  be linked with the Steamworks SDK.** Audit the dependency tree before shipping.
- The app must handle Steam not running: fail soft to local-only, exactly as the
  network layer already does when there is no `/api`.

Acceptance criteria:
- [ ] Steam overlay opens over the game
- [ ] Launching outside Steam does not crash; it degrades to local-only
- [ ] App ID is configuration, not a literal in game code

### S08 — Design the achievement list  **DRAFTED, NEEDS SIGN-OFF** `2026-09-02`

Do this **before** writing any achievement code. An agent may draft it; Joey
approves it.

- Target ~20–30. Cover: first descent, first win, each ascension level, kit
  archetypes, Boon and Trial variety, deep-descent milestones, the Forge, and a
  small number of genuinely hard ones.
- Anchor them to constants that already exist (`SIGIL_TARGET`, the ascension
  table, the theme tiers) so `test/designDocs.test.js` can hold the list to the
  code the way it already holds `DESIGN.md` and `REWORK.md`.
- Write the list into this file, or into `docs/ACHIEVEMENTS.md` if it grows.

**Drafted at `docs/ACHIEVEMENTS.md`** — 24 achievements anchored to
`SIGIL_TARGET`, the `ASCENSIONS` table and the tool ids, with three open
questions at the bottom that need Joey's answer before S09 can start.

Acceptance criteria:
- [ ] Every achievement has an ID, display name, description and a stated
      trigger condition naming the code path that can detect it
- [ ] No achievement depends on the server half
- [ ] Joey has signed off

### S09 — Achievement implementation  `effort: L` `depends: S07, S08`

- One event hook in the run lifecycle rather than scattered unlock calls —
  `src/games/scoundrel/logic/lifecycle.js` is the seam.
- Unlocks must be idempotent and must survive a mid-run quit.
- Keep the trigger logic testable without Steam running: emit events, let a thin
  Steam sink consume them.

Acceptance criteria:
- [ ] Every achievement in S08 has vitest coverage over its trigger, with no
      Steam SDK in the test path
- [ ] Unlock is idempotent — re-triggering does not error or double-fire
- [ ] Achievements configured in the Steamworks partner site, icons included

### S10 — Steam Cloud saves  `effort: M` `depends: S05, S07`

- Auto-Cloud the single JSON file S05 produces. Do not sync a leveldb.
- Decide and document the conflict policy: newest-wins is acceptable for a
  single-player roguelite; say so rather than leaving it implicit.
- **Web-save import.** Cookie Clicker's export-and-paste pattern is the
  precedent. Worth building — it converts existing sigildeck.com players into
  Steam buyers who do not start from zero.

Acceptance criteria:
- [ ] A run started on machine A resumes on machine B
- [ ] A web save exported from sigildeck.com imports into the Steam build
- [ ] Cloud quota and file paths configured in Steamworks

### S11 — Leaderboard: native or server?  `effort: L` `needs a person`

The trade, so the decision gets made once:

- **Native Steam Leaderboards** — what Steam players expect, no auth to build,
  no backend cost, works offline then syncs. Isolated from the sigildeck.com
  board.
- **Keep the existing backend, SteamID as identity** — one shared board across
  web and Steam, reuses `src/utils/leaderboard.js` and the whole API layer, but
  Steam players must be reachable by your server and the handle/moderation
  machinery has to accept a second identity source.

Recommendation: **native**, unless a unified board is a stated goal. This
interacts with open issues 30 and 31 — finish those before choosing the second
option.

Acceptance criteria:
- [ ] Decision recorded in this file with its reasoning
- [ ] Implemented, with the offline path tested

### S12 — Controller and Steam Deck  `effort: L`

The game is click-driven. Keyboard handlers exist in only a few places
(`DescentView.jsx`, `SanctuaryView.jsx`, `TopBar.jsx`, `index.jsx`,
`library.jsx`) and there is no gamepad support at all.

- Deck's trackpad-mouse alone would likely earn **Playable**; real gamepad
  navigation is what earns **Verified**, and a card game suits it well.
- Steam Input is the route — do not hand-roll the Gamepad API.
- Deck also wants: readable text at 1280×800, no tiny hit targets, and a
  launched-into-fullscreen default.

Acceptance criteria:
- [ ] Every interactive element reachable and activatable by gamepad
- [ ] A visible focus ring that is not the browser default
- [ ] Text legible at 1280×800
- [ ] Deck compatibility self-review submitted

### S12b — Pull `prefers-reduced-motion` forward  `effort: S`

Open backlog **issue 17**, promoted for this milestone: ~20 animations, 4 of
them infinite, and a storefront audience that is vocal about accessibility.
Work it from `docs/issues/17-prefers-reduced-motion.md`; do not duplicate it
here.

---

## Phase 3 — Steam admin and store  `needs a person`

### S13 — Pay the fee and clear the paperwork  `effort: —`

**Do this early.** The 30-day hold and the 2–7 day tax review run in parallel
with all of Phase 1 and Phase 2, and they are pure waiting.

- [ ] Steamworks account created, NDA and Distribution Agreement signed
- [ ] $100 paid — this starts the 30-day clock, and per S01 it will not come back
- [ ] App created with **"This is a free product"** ticked. Set at creation;
      do not assume it is a toggle you can flip afterwards
- [ ] Legal name, bank details and W-9 submitted; account holder name matches
- [ ] Identity verification cleared
- [ ] **App ID recorded here** — S07 is blocked without it

### S14 — Store page copy and fields  `effort: M`

Reuse `docs/itch/PAGE.md` as the source of truth for tone and short
description; do not rewrite from scratch. Steam-specific constraints:

- Description must be detailed and coherent; **external links are not permitted**
- Only features present at launch may appear anywhere on the page
- Tags picked from Steam's list, not invented
- Privacy disclosure must match what S06 actually leaves running

### S15 — Capsule art  `effort: L` `depends: S02`

- [ ] Header 920×430 — the only strictly required one, and the one that does the
      most work (store page, home recommendations, Big Picture)
- [ ] Small 462×174, Main 1232×706, Vertical 748×896, Library 600×900
- [ ] Readable title/logo on each; no marketing text, review scores or award
      logos — breaking this makes the game ineligible for Steam sales and events

### S16 — Screenshots  `effort: S`

`docs/itch/` already holds 14 captured screens (`01-descent.png` through
`14-death.png`). Re-shoot at ≥1920×1080 from the Steam build.

- [ ] 8–10 selected, gameplay only, no overlaid text or concept art
- [ ] Captured from the packaged app, not the browser
- [ ] Extend `scripts/itch-screenshots.mjs` rather than shooting by hand

### S17 — Trailer  `effort: L` `depends: S02`

1920×1080, H.264, 30fps, uploaded through the Steamworks video manager. The repo
already has `@ffmpeg-installer/ffmpeg` and `fluent-ffmpeg` from the itch work —
reuse that pipeline.

### S18 — Coming Soon page live  `effort: —` `depends: S14, S15`

- [ ] Page submitted and approved (3–5 business days)
- [ ] Publicly visible **≥2 weeks** before the launch date
- [ ] Wishlist campaign started — for this genre, wishlists at launch matter more
      than the build does

### S19 — Depot upload and build verification  `effort: M` `depends: S03`

- [ ] SteamPipe depot configured, build uploaded to a branch
- [ ] Installed and launched from the Steam client on a clean machine
- [ ] Every OS listed on the store page actually starts (list only what you test)
- [ ] Steam DRM wrapper decision made and recorded

### S20 — Submit for review  `effort: —` `depends: everything above`

Submit **≥7 business days** before the intended date. Deselect any feature not
in the build. Once approved, no further review is needed for patches.

### S21 — Launch  `effort: —`

- [ ] No launch discount to set — the app is free (S01). Skip the discount step
      rather than hunting for it
- [ ] sigildeck.com points at the Steam page
- [ ] itch page updated
- [ ] Post-launch patches, in this order: S08/S09 achievements, then S12
      controller/Deck, then S10 cloud saves if it still looks worth it. No
      re-review is needed for any of them

---

## Dependency graph

```
S01 (paid/free) ──> sets the stakes for everything
S02 (art path)  ──> S15 ──> S18
S13 (fee, App ID, 30-day clock) ──> S07 ──> S09, S10
S03 (wrapper)   ──> S04, S06, S19
S05 (storage adapter) ──> S10
S08 (achievement design) ──> S09
S14 + S15 ──> S18 ──(2 weeks)──> S20 ──> S21
```

Critical path is **S13 → 30-day hold → S18 → two weeks → S20 → S21**. Start S13
the day S01 is answered; everything in Phases 1 and 2 fits inside that wait.

---

## Needs a person, not an agent

Skip these rather than approximate them:

- **S02, S11** — product decisions. (**S01 is answered: free.**)
- **S13** — legal identity, bank details, tax forms and a $100 payment.
- **S14, S15, S16, S17, S18, S20, S21** — Joey's Steamworks account, and in
  S15/S17 art that does not exist yet. An agent may draft copy and generate
  screenshots; it may not operate the account.
- **S19** — needs the Steamworks account and a clean machine to install on.

Fair game unattended: **S03, S04, S05, S06, S12, S12b**, plus a *draft* of S08.
S07, S09 and S10 are ordinary code but blocked on an App ID.

---

## Explicitly out of scope

- **Issue 35 (service worker)** — the Steam app is already offline. Do it for
  the web, not for this.
- **Issue 32 (music bed payload)** — a web download-size concern. Do not degrade
  audio quality for Steam; there is room for more, not less.
- **Mac and Linux builds** — Windows only for v1. Players on other platforms
  have sigildeck.com. Only list an OS on the store page once S19 has actually
  launched the build on it; Valve checks.
- **Auto-update machinery** — Steam does this via depots.

---

## Sources

- [Steamworks Onboarding](https://partner.steamgames.com/doc/gettingstarted/onboarding) — fee, identity, tax, 30-day hold, two-week Coming Soon
- [Steam Review Process](https://partner.steamgames.com/doc/store/review_process) — timelines, store and build review checklist
- [Graphical Asset Rules](https://partner.steamgames.com/doc/store/assets/rules)
- [Web Game Dev — Desktop publishing](https://www.webgamedev.com/publishing/desktop) — Electron/NW.js vs Tauri for Steam
- [steamworks.js](https://github.com/ceifa/steamworks.js/)
- [steamworks-ffi-node](https://dev.to/arty_prof/steamworks-ffi-node-a-steamworks-sdk-library-for-javascript-game-frameworks-15h1)
- [Porting a browser-based game to Steam, pt. 2](https://log.schemescape.com/posts/game-development/browser-based-game-on-steam-2.html) — wrapper trade-offs, and the GPL/Steamworks linking constraint
- [Steam capsule sizes 2026](https://presskit.gg/field-guides/steam-capsule-art-guide)
- [Cookie Clicker on Steam](https://store.steampowered.com/app/1454400/Cookie_Clicker/) — the free-on-web, paid-on-Steam precedent, kept for the record now that S01 answered free
- [Free to Play Games (Steamworks)](https://partner.steamgames.com/doc/store/freetoplay) — the free-title rules in *If it ships free*: spotlight ineligibility, Top Sellers by in-game revenue, Popular New Releases by player count, the paid→free support path
- [Pricing (Steamworks)](https://partner.steamgames.com/doc/store/pricing)

Researched 2026-09-01, with the free-title section added 2026-09-02. Steam's fees, hold periods and asset dimensions change —
re-check the two `partner.steamgames.com` links before acting on the numbers.
