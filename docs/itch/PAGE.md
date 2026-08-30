# itch.io page — draft copy and field values

Everything needed to fill in https://itch.io/game/new. Nothing here is wired up
automatically; itch has no API for page creation on a free account, so this is
the hand-off.

The uploaded build is the **standalone** target (`npm run build:itch`). It plays
entirely client-side and has no leaderboard, sign-in or feedback form — see
`src/buildTarget.js` for why, and note that the copy below is written to be true
of that build rather than of sigildeck.com.

---

## Field values

| Field | Value |
| --- | --- |
| Title | `Sigil` |
| Project URL | `sigil`, else `sigil-deck` — **permanent**, cannot be changed later |
| Short description | `A roguelite deckbuilder. Forge your kit, take a Boon, face the Trial, and earn ten sigils to escape.` |
| Classification | Games |
| Kind of project | **HTML** — this is what produces the "Play in browser" button |
| Release status | Released |
| Pricing | No payments (or Donation, suggested $0) |
| Genre | Card Game |
| Tags | `card-game`, `roguelike`, `deckbuilder`, `singleplayer`, `turn-based`, `dark-fantasy` |
| Community | **Comments on** — this is where the first real feedback arrives |
| Visibility | Draft first, then Public |

Pick tags from itch's autocomplete rather than typing new ones. Invented tags
match no browse page and are the single most common way a first itch page gets
no traffic.

### Upload

- File: `dist-itch.zip` (produced by `npm run build:itch`, ~14MB)
- Tick **"This file will be played in the browser"**
- Viewport: **1280 × 820**, and the height matters more than the width. `short:`
  in `src/index.css` is `@media (max-height: 760px)`, and under it the room's
  cards clamp to `max-w-[155px]` against `max-w-[240px]` above — so an embed set
  to the conventional 720 serves every browser player the compact phone layout
  inside a desktop-sized frame. 820 leaves headroom above the threshold
- ✅ Mobile friendly, orientation `Default` — the layout is responsive
- ✅ Click to launch in fullscreen
- ❌ Automatically start on page load — leave off, so audio has a user gesture
  to unlock on (browser autoplay policy silences it otherwise)

### Images

| File | Use |
| --- | --- |
| `cover.png` (630 × 500) | Cover image — itch fixes this size; nothing else fits the field |
| `banner.png` (1200 × 400) | Wide banner: page header, README hero, anywhere a strip is wanted |
| `01-descent.png` | A room, four monsters, the bare-hands choice |
| `02-home.png` | Title and menu |
| `03-rules.png` | How to play |
| `04-sanctuary.png` | The sanctuary between descents: kit, boons, sigils, the way down |
| `05-boon.png` | Picking a Boon, with the Forge queued behind it |
| `06-forge-inscribe.png` | The Forge, inscribing a new tool into the kit |
| `07-forge-upgrade.png` | The Forge, upgrading a card already in the kit |
| `08-trial.png` | The Trial named on arrival — the descent you went into blind |
| `09-room-early.png` | An early room: your own potion and weapon dealt in with the monsters |
| `10-room-bound.png` | The binding — three monsters above it, one under |
| `11-room-deep.png` | Descent 9 at 5 HP: an Ace, a King, a blunted weapon |
| `12-mobile.png` | The same room on a phone (390 × 754) |
| `13-victory.png` | Ten sigils and the run summary |
| `14-death.png` | The usual ending |

Regenerate with `npm run icons` (cover) and `npm run itch:shots` (screenshots).
The screenshots are taken against the standalone build served from a
subdirectory, so they show exactly what an itch visitor sees.

Every desktop shot is 1280 × 800 at 2x, so the files are a uniform 2560 × 1600.
The height clears the `short:` threshold described under Upload — below it the
cards render at their phone size in a desktop-width frame, which is how the
first version of this set looked. Nothing is cropped to fit its own content:
matching proportions are worth more across a strip of screenshots than a tight
bottom edge on each one. The script warns if a screen ever outgrows the frame.

**Ordering matters more than count.** itch shows the first few large and the
rest as thumbnails, so lead with `01-descent`, `10-room-bound`, `05-boon` and
`06-forge-inscribe`: a room, the rule the game turns on, and the two things that
are not in Scoundrel. `08-trial` and `12-mobile` are the next two — the mobile
shot is the evidence for the "mobile friendly" tick. `13`/`14` go last; an
outcome screen out of context is a table of numbers.

Every state is seeded rather than played to (`scripts/itch-screenshots.mjs`), so
regenerating gives the same set back rather than a fresh random deal. Two things
to know before editing those fixtures: `weapon.lastSlain` is `{ rank }` and not
a bare number — seed it wrong and every card silently loses its weapon preview —
and a monster above the binding draws no "Bare hands" button at all, because the
button is only offered where the weapon could have swung.

---

## Description

> Copy from here down into itch's description editor.

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

**Details**

- Free, plays in the browser, no account, nothing to install
- Saves to your device automatically; a run survives closing the tab
- Mouse or keyboard, and the layout works on a phone
- One session is 10–20 minutes

*This copy runs entirely in your browser and saves locally. The version at
[sigildeck.com](https://sigildeck.com) adds the leaderboard for fastest
victories and saves that follow you between devices.*

Music by Kevin MacLeod (incompetech.com), licensed under CC BY 3.0. Bells are
public domain. Card icons by Lorc (game-icons.net), CC BY 3.0. Full credits are
in the game.

---

## After publishing

- **Devlogs** post to your followers and land in itch's devlog feed — this is
  the only recurring distribution itch gives you. The balance-data writeup works
  as a devlog and as the Show HN post.
- itch does not promote new pages beyond listing them in "newest". Traffic comes
  from the tags, the devlogs, and whatever you point at the page.
