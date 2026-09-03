# Steam store page — draft copy and field values

Everything needed to fill in the Steamworks store page (docs/STEAM.md, S14).
Nothing here is wired up automatically; Steamworks has no API for page creation,
so this is the hand-off — the same shape as `docs/itch/PAGE.md`, which is where
the copy below started.

**The build this describes is the `steam` target** (`npm run build:steam`,
packaged with `npm run steam:pack`). It plays entirely offline, has no
leaderboard and no sign-in, and makes no network requests at all — the copy is
written to be true of *that* build rather than of sigildeck.com. Valve checks
this: only features present at launch may appear on the page.

---

## Field values

| Field | Value |
| --- | --- |
| Name | `Sigil` |
| App type | Game |
| Pricing | **Free** — tick "This is a free product" **at app creation**. It is not a toggle afterwards (docs/STEAM.md, *If it ships free*) |
| Developer | Joseph Paris |
| Publisher | Joseph Paris |
| Release date | Set after the 30-day hold and ≥2 weeks of Coming Soon |
| Website | `https://sigildeck.com` — goes in the dedicated field, **not** the description |
| Primary genre | Indie |
| Secondary genres | Strategy, Casual |
| Tags | `Roguelike Deckbuilder`, `Card Game`, `Singleplayer`, `Turn-Based`, `Roguelite`, `Dark Fantasy`, `Difficult`, `Replay Value`, `2D`, `Minimalist` |
| Languages | English (interface, full audio n/a — there is no voice) |
| Players | Single-player |
| Features | Full controller support **only once S12 ships** — leave unticked at launch |

Pick tags from Steam's own list rather than typing new ones, the same rule as
itch. `Roguelike Deckbuilder` is the one that matters: it is a real Steam tag
with its own browse page and it is how this genre is found.

### Do not tick at launch

Every one of these is a feature Valve verifies against the build, and each is
false today:

- Steam Achievements (S09)
- Steam Cloud (S10)
- Steam Leaderboards (S11)
- Full Controller Support / Partial Controller Support (S12)
- Steam Trading Cards, Workshop, Remote Play — not planned

They can be added later. A page that claims them at review is a page that fails
review.

---

## System requirements

Electron bundles Chromium, so the floor is Chromium's, not the game's.

| | Minimum |
| --- | --- |
| OS | Windows 10 64-bit |
| Processor | Any x64 processor |
| Memory | 4 GB RAM |
| Graphics | Any GPU with hardware acceleration |
| Storage | 400 MB available space |

Windows only for v1. **Only list an OS after S19 has actually launched the build
on it** — Valve checks that the product starts on every platform listed.

---

## Content survey

- Violence: **mild, non-graphic.** The game is playing cards and typography;
  monsters are ranks on a card and damage is a number. There is no depiction of
  violence at all.
- No sexual content, no drugs, no gambling with real money.
- The Lucky Coin is an in-game random outcome with no purchase attached — worth
  mentioning in the survey only if asked directly about chance-based mechanics.

## Privacy and EULA

The packaged build makes **no network requests** — asserted by
`visual/steam-build.spec.js`, which fails if any leave the app. So:

- No third-party analytics to disclose.
- No account, no email address, no personal data leaves the machine.
- Saves are local. Nothing is transmitted.
- Use Steam's default EULA. There is nothing here that needs a custom one.

This is a materially stronger position than the website's, where the privacy
policy exists precisely because the site takes sign-in and uses processors. If
S06 is ever reversed and telemetry is switched on for the desktop build, this
section and the store page must change with it.

---

## Assets

See docs/STEAM.md S15–S17 for the dimensions and the rules. Nothing here exists
yet — this is the long pole.

| Asset | Size | Status |
| --- | --- | --- |
| Header capsule | 920 × 430 | **Missing.** Required. |
| Small capsule | 462 × 174 | Missing |
| Main capsule | 1232 × 706 | Missing |
| Vertical capsule | 748 × 896 | Missing |
| Library capsule | 600 × 900 | Missing |
| Screenshots | ≥1920 × 1080, 8–10 | Re-shoot from the packaged app |
| Trailer | 1920 × 1080, H.264, 30fps | Missing |

`docs/itch/` already holds 14 captured screens at 2560 × 1600, taken against the
standalone build. They are the right *content* and the right resolution, but
they were shot in a browser against the itch bundle. Re-shoot from the Steam
build so the page shows what a Steam player installs — S16 says extend
`scripts/itch-screenshots.mjs` rather than shooting by hand.

The ordering advice from the itch page holds here too, and matters more: lead
with a room, then the binding, then the Boon and the Forge. Steam shows the
first screenshot large.

---

## Short description

> 300 characters max. This is what appears under the capsule in search results.

A roguelike deckbuilder on a single deck of cards. Clear the room, blunt your
weapon or take the hit bare-handed, and forge your kit between descents. Earn
ten sigils and get out. Runs are short; losing is normal.

---

## Description

> Copy from here down into Steamworks' description editor. **No external links**
> — Valve does not permit them in the description. sigildeck.com goes in the
> Website field instead.

**Sigil** is a roguelike deckbuilder built on a single deck of cards.

It descends from **Scoundrel**, the 2011 print-and-play solo card game by Zach
Gage and Kurt Bieg. If you have played that with a physical deck, you already
know the core: a room is four cards, you must clear three of them, monsters cost
you lifeblood, and your weapon can only take something weaker than the last
thing it killed.

What is new is everything around the room. Between descents you reach a
sanctuary, where you forge your kit, inscribe custom cards into the deck, and
take boons that carry forward. Each descent is themed, and the theme changes
what the deck is made of. Earn ten sigils and you get out.

**What it plays like**

- Every room is a decision with a number attached. Swing and blunt your weapon,
  or take the hit bare-handed and keep the edge for something worse.
- No hidden information you could have played around — the risk is always
  legible before you take it.
- Runs are short. Losing is the normal outcome and starting again costs nothing.
- Six ascensions stack difficulty on top of each other once you have escaped
  once, each one changing a single rule.

**Details**

- Plays entirely offline. No account, no sign-in, nothing to connect to.
- Saves locally and automatically; a run survives closing the game.
- Mouse or keyboard.
- One session is 10–20 minutes.

Music by Kevin MacLeod (incompetech.com), licensed under CC BY 3.0. Bells are
public domain. Card icons by Lorc (game-icons.net), CC BY 3.0. Full credits are
in the game.

---

## After publishing

- **Steam does not promote a new free game beyond listing it.** Popular New
  Releases is scored by player count and is the one chart open to a free title —
  which makes the launch-day player count the thing worth pushing for, and the
  wishlist campaign during Coming Soon the thing that produces it.
- Announcements post to followers and wishlisters. The balance-data writeup
  works here the same way it works as an itch devlog.
- Free titles are ineligible for Daily/Midweek/Weekend deals, so there is no
  discount calendar to plan around. The Free to Play hub is the equivalent.
