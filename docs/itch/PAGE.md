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
- Viewport: **1280 × 720**, matching the screenshots below
- ✅ Mobile friendly, orientation `Default` — the layout is responsive
- ✅ Click to launch in fullscreen
- ❌ Automatically start on page load — leave off, so audio has a user gesture
  to unlock on (browser autoplay policy silences it otherwise)

### Images

| File | Use |
| --- | --- |
| `cover.png` (630 × 500) | Cover image |
| `01-descent.png` | Screenshot — a room, four monsters, the bare-hands choice |
| `02-home.png` | Screenshot — title and menu |
| `03-rules.png` | Screenshot — how to play |

Regenerate with `npm run icons` (cover) and `npm run itch:shots` (screenshots).
The screenshots are taken against the standalone build served from a
subdirectory, so they show exactly what an itch visitor sees.

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
public domain. Full credits are in the game.

---

## After publishing

- **Devlogs** post to your followers and land in itch's devlog feed — this is
  the only recurring distribution itch gives you. The balance-data writeup works
  as a devlog and as the Show HN post.
- itch does not promote new pages beyond listing them in "newest". Traffic comes
  from the tags, the devlogs, and whatever you point at the page.
