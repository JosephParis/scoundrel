# Reddit posts — first playtest push

Goal: **playtesters and feedback**, not a launch announcement. Every draft below
asks for something specific and treats the link as the smaller half of the post.

> **Unverified:** the title-tag conventions and per-sub rules below are written
> from general Reddit convention, not from reading these subs' sidebars — Reddit
> blocks automated fetching, so nothing here was checked against real posts.
> Open each sub's rules page and its top-of-month posts before using a title
> format. Correct this file when you do.

> **Corrected 2026-08-22 against the code, not the docs.** The first draft of
> this file said the next Trial is revealed in the sanctuary. It isn't — you
> descend blind (`REWORK.md` §8, confirmed against `SanctuaryView.jsx`), and the
> same false claim was live in the in-game rules until issue 25. The "44-card
> deck" pitch went for the same reason. Check a mechanic against the source
> before it goes in a post.

---

## Before you post

Traffic from a well-received post arrives in one burst. These are open, and they
are what strangers will hit first:

- ~~**Issue 14**~~ — **done 2026-08-22.** The handle field no longer promises an
  "Anonymous" listing, and an unlisted victory now says so on the outcome screen
  and offers a one-click fix. Still needs the live check against production.
- **Issue 13** — verify `/api/stats` and `/admin` against production. You cannot
  watch a burst you cannot see. Carries issue 14's last acceptance box too: one
  handle-less victory and one named victory against the real board.
- **Issue 08** — no moderation path for handles or leaderboard rows. A public
  board with no delete button, pointed at strangers, is the stated pre-launch
  risk.
- **Issue 11** — decide the feature-flag defaults for batch 1 (6 of 7 are off).
  Whatever is off is invisible to every one of these players.
- ~~**Issue 25**~~ — **done 2026-08-22.** The rules no longer promise a preview
  of the next Trial; you descend blind and the copy says so.
- **Forge cadence** — unresolved and player-visible: `forgeSigils` defaults to
  `[1..7]` while `SIGIL_TARGET` is 10, so the Forge silently doesn't open on
  returns 8 and 9, and the rules say it opens after every descent. Either extend
  the default or reword the rules before strangers reach descent 8.
- **Media** — a 10–15s GIF of one room resolving (weapon vs bare hands) outruns
  any screenshot. `docs/itch/01-descent.png` is the fallback.

---

## Sub fit, honestly

| Sub | Fit | Read |
| --- | --- | --- |
| **r/WebGames** | Strong | Exactly the pitch: free, browser, no account, no install. Least friction of the four. |
| **r/roguelites** | Strong | Meta-progression across descents (boons, forge, deck edits) is the genre's centre. |
| **r/roguelikes** | Weak | Purist sub — turn-based grid, ASCII lineage. Sigil is a card game and they will say so. Post as *design discussion*, not as "my roguelike", or skip. |
| **r/incremental_games** | Poor | Sigil is not incremental. Nothing persists across runs — sigils, boons and deck edits all reset on death, which is the opposite of the genre's contract. A plain link post is likely removed. |

**Recommendation:** r/WebGames first, r/roguelites second, several days apart.
Treat r/roguelikes as optional and r/incremental_games as a no, unless they run a
recurring adjacent-games or feedback thread you can drop into — check the sidebar
for one rather than making a top-level post.

---

## Shared building blocks

**The pitch (one line):**
> A dungeon dealt four cards at a time. Play three and leave one for the next
> room — or flee, and face all four again later.

Do **not** say "44-card deck". It's true of the source deck internally and false
as a description of play: your kit and the dungeon's rolled monster pool are
shuffled together fresh each descent. Issue 25 pulled that exact phrase out of
the in-game rules for teaching the wrong model; don't put it back in the pitch.

**The credit line — always include it, near the top:**
> It's built on **Scoundrel**, the 2011 print-and-play card game by Zach Gage and
> Kurt Bieg.

Someone in the comments will recognise Scoundrel. Getting there first turns the
"this is just Scoundrel" comment into a conversation instead of an accusation.

**Links:**
- Play: https://sigildeck.com — free, no account, saves locally
- itch (standalone, no leaderboard): *(fill in once the page is public)*
- Source: https://github.com/JosephParis/sigil

**The feedback ask — pick 2–3, never all of them.** A short list gets answered; a
long one gets ignored.
- Did the weapon rule click on its own, or did you have to reread the rules?
- Where did you die — which descent number? First run and best run.
- Was the bare-hands vs weapon tradeoff legible *before* you committed to it?
- Did any boon feel like an obvious auto-pick, or like a trap?
- Phone or desktop, and did the layout hold up?

---

## Post A — r/WebGames

**Title** *(verify their tag convention first — bracket genre tags are common)*
- `[Card/Roguelike] Sigil — a solo card roguelike dealt four cards at a time. Free, no account, ~15 min a run`
- `[Card Game] Sigil — I built a roguelike out of the print-and-play game Scoundrel. Looking for feedback`

**Body**

```
Sigil is a solo card roguelike played out of a single deck. It's built on
Scoundrel, the 2011 print-and-play game by Zach Gage and Kurt Bieg.

A room is four cards and you have to clear three of them. Monsters cost you
health. Your weapon can only take on something weaker than the last thing it
killed — so every fight is really the question of whether this is the one worth
blunting your edge on, or whether you take it bare-handed and keep the edge for
whatever's next.

What's new is the part between descents. You return to a sanctuary where you
forge weapons and potions into your kit, inscribe your own cards, and take boons
that carry forward. Each descent has a Trial — a rule or deck mutation you
don't get to see until you're already down there. Ten sigils and you're out.

Free, plays in the browser, no account, nothing to install. It saves to your
device, so a run survives closing the tab. Works on a phone. A session is about
10–20 minutes.

https://sigildeck.com

It's had a small number of players so far and I'm after rough edges. Two things
I'd especially like to know:

- Did the weapon rule click on its own, or did you have to go back to the rules?
- Where did you die — which descent?
```

**First comment (post it yourself, immediately):** source link, plus a one-line
note that it's free with no ads. Keeps the body clean and gives early commenters
something to reply under.

---

## Post B — r/roguelites

**Title**
- `I turned Scoundrel, the print-and-play card game, into a roguelite — hub, boons, deck editing. Free in browser, looking for feedback`
- `Sigil — a card roguelite where your forged weapons shuffle in with the monsters. Free, browser, ~15 min runs`

**Body**

```
Sigil is a card roguelite played out of a single deck. The base is Scoundrel
(Zach Gage and Kurt Bieg, 2011): a room is four cards, you clear three, and your
weapon can only take something weaker than the last thing it killed.

The roguelite layer is what I added around it. A run is ten descents threaded by
visits to a sanctuary:

- Boons — pick one of three after each descent, permanent for the run.
- The Forge — opens on your return. You remove cards from your kit, upgrade
  them, or inscribe new ones. Anything you forge shuffles in alongside the
  monsters, so improving your kit also means drawing your own stuff at the wrong
  time.
- Trials — each descent has one: a deck or rule mutation for that descent only.
  You descend blind. It isn't named until you're standing in it, so the kit is a
  standing answer to anything rather than a counter to a known threat.

Death resets all of it. There's no cross-run currency and I've gone back and
forth on whether that's the right call — it keeps every run honest, but it also
means a bad first run teaches you nothing you get to keep.

Free, browser, no account, saves locally: https://sigildeck.com

What I'd most like to hear:

- Does any boon read as an obvious auto-pick, or as a trap?
- Where did you die — which descent number, first run vs best run?
- Descending blind: does building for "anything" feel like real preparation, or
  just like you're guessing?
```

That last question is the post's engine. It gives the sub a design argument to
have, which is what actually pulls comments — and it's the genuinely contested
call in the design, so the answers are worth having.

---

## Post C — r/roguelikes *(optional, higher risk)*

Do not call it a roguelike here. Lead with the design problem and let the game be
the evidence.

**Title**
- `What survives when you strip a roguelike down to 44 cards? Notes from building one`

**Body**

```
I spent a while on a question that turned out to be more interesting than I
expected: how much of a roguelike survives if the only thing you have is a
standard deck of cards?

Not a grid. No line of sight, no positioning, no inventory to speak of. What's
left is resource attrition, permadeath, and a decision every turn where the
information is complete and the choice is still hard.

The base is Scoundrel (Gage/Bieg, 2011) — four cards to a room, clear three, your
weapon can only take something weaker than the last thing it killed. That one
constraint does most of the work. Complete information, no randomness in the
resolution, and the interesting decision is nearly always whether to *not* use
the tool you have.

What I couldn't reproduce without a map: the value of retreat. Positioning is
where a roguelike stores its escape hatches, and a card game has no floor to back
across. Attrition alone makes runs feel like they end rather than turn.

The thing itself is free and in the browser if anyone wants to argue with it from
the inside: https://sigildeck.com

Genuinely curious what this sub thinks is load-bearing in the genre and what's
just tradition.
```

**If their self-promo rule is one submission per N months** (3 months is cited
secondhand, unverified) — this uses up your slot. Decide whether it's worth more
than a future post.

---

## Post D — r/incremental_games *(probably skip)*

Nothing persists between runs, which is the genre's core contract, so a top-level
link post is likely to be removed as off-topic. Before posting:

- Check the sidebar for a recurring feedback / adjacent-games / "what are you
  playing" thread and comment there instead.
- If you do post, be first to say what it isn't: *"Not incremental in the strict
  sense — progression is within a run, not across them. Posting here because the
  deck-editing loop scratches a similar itch, but tell me if that's a stretch."*
- Otherwise, hold this one until there's cross-run progression to talk about.

---

## Comment prep

Have these ready. The first hour of replies decides whether the post moves.

- **"Isn't this just Scoundrel?"** — Yes, at the room level, and that's credited
  up front. Then name one concrete addition (the forge shuffling your own cards
  into the monster deck).
- **"Is this AI slop?"** — Answer plainly, point at the repo. Don't get
  defensive; the question is standard now.
- **"Are you selling it / what's the catch?"** — Free, no ads, no payments. The
  itch build is standalone with no account at all.
- **"It's too hard / I died on descent 2."** — Ask which theme and which boon.
  This is the most useful data you'll get all day; treat it as a bug report.
- **A rules misunderstanding** — do not correct and move on. Ask what they
  expected to happen. That's issue 25's evidence arriving for free.

## Mechanics

- One sub at a time, at least several days apart. The same link across four subs
  in one hour reads as spam to both the filters and the humans.
- Post when your target sub is awake — for US-heavy gaming subs that's roughly
  weekday mornings ET or Sunday afternoon. Check each sub's own top posts.
- Answer every comment for the first two hours. Reply rate drives the post more
  than the title does.
- Never ask friends to upvote. It's the one thing that gets an account banned
  rather than a post removed.
- Log what breaks. A post like this is a test run, and the bug list it produces
  is the real deliverable.

---

## Sub links to check before posting

Reddit blocks automated fetching, so these have to be opened by hand. For each
sub, read the rules page, then skim a month of top posts for the title
convention actually in use.

| Sub | Rules | Top of month | New (what gets ignored) |
| --- | --- | --- | --- |
| r/WebGames | [rules](https://www.reddit.com/r/WebGames/about/rules/) | [top](https://www.reddit.com/r/WebGames/top/?t=month) | [new](https://www.reddit.com/r/WebGames/new/) |
| r/roguelites | [rules](https://www.reddit.com/r/roguelites/about/rules/) | [top](https://www.reddit.com/r/roguelites/top/?t=month) | [new](https://www.reddit.com/r/roguelites/new/) |
| r/roguelikes | [rules](https://www.reddit.com/r/roguelikes/about/rules/) | [top](https://www.reddit.com/r/roguelikes/top/?t=month) | [new](https://www.reddit.com/r/roguelikes/new/) |
| r/incremental_games | [rules](https://www.reddit.com/r/incremental_games/about/rules/) | [top](https://www.reddit.com/r/incremental_games/top/?t=month) | [new](https://www.reddit.com/r/incremental_games/new/) |

Also worth a look, in the same shape:

- r/playmygame — [rules](https://www.reddit.com/r/playmygame/about/rules/) ·
  [top](https://www.reddit.com/r/playmygame/top/?t=month) — built for exactly
  this ask, usually with a required post format.
- r/indiegames — [rules](https://www.reddit.com/r/indiegames/about/rules/) ·
  [top](https://www.reddit.com/r/indiegames/top/?t=month) — screenshot/GIF-led.
- r/solo_roleplaying — [rules](https://www.reddit.com/r/solo_roleplaying/about/rules/) ·
  [top](https://www.reddit.com/r/solo_roleplaying/top/?t=month) — where the
  print-and-play Scoundrel crowd overlaps; the lineage is the hook there.

**What to bring back**, per sub, so the drafts above can be corrected:

- The self-promotion rule, verbatim, including any frequency cap.
- Whether flair is required, and the exact flair names.
- Whether titles use bracket tags, and which ones appear in the top 20.
- Whether link posts or text posts dominate the top of the month.
