# Sigil: Classes

A proposal for starting classes. **Nothing here is committed.** This is a
scaffold for the idea, written to be argued with.

Sits alongside `DESIGN.md` (the current shape), `REWORK.md` (the kit model this
builds on) and `docs/EXTENSIONS.md` (growth ideas). Where it disagrees with
EXTENSIONS §1, see §2 — that section predates the kit rework and aims at a
different target.

## 1. The one-sentence idea

A class decides **what you start holding** and **which one core rule bends for
you** — and nothing else.

Everything a class touches is already a seam in the code. That is the whole
argument for cutting it this way: the cheap version of this feature is a
constant table, one branch in `buildStartingKit`, and a picker panel copied from
the one that already exists.

## 2. Prior art: how this differs from EXTENSIONS §1

`docs/EXTENSIONS.md` §1 ("Other Survivors") already proposes seven characters —
the Brute, the Pathfinder, the Collector, the Tactician, the Mason, the
Stranger. It is a good list and this doc does not replace it, but it aims
somewhere else:

| EXTENSIONS §1 | This doc |
| --- | --- |
| Each survivor overrides a **rule or a stat** (max HP 30, no weapons at all, Boon offers of 2, Forge cadence) | Each class changes its **starting kit** first; a rule bend only where the kit alone can't carry it |
| Written before the kit rework — "44-card deck", seven descents, three Forge openings | Written against the kit model: you own cards, the dungeon rolls monsters |
| Unlocked by specific in-run accomplishments | Unlock policy is an open question (§9), and probably shouldn't gate the first two |
| Seven at once | Two at a time, because each one costs a balance pass (§8) |

The two converge later. The Brute is the same shape as the Warden sketch in §7;
the Pathfinder is the Seer. Take them off that list once the seam exists.

## 3. What the engine already gives you

None of this needs new architecture. In rough order of usefulness:

- **`buildStartingKit()`** (`logic/deck.js:39`) is a pure function returning
  ♦2–6 and ♥2–6 — "the low ten". Every class needs exactly one thing from it:
  that it take an argument.
- **`MODES`** (`constants.js:47`) is the precedent for the entire feature. An
  id/name/description table, picked on the opening sanctuary visit, locked once
  you descend. A class table is the same shape, and `ModePickerPanel` is the
  panel already written.
- **`createRun(rng, options)`** (`logic/lifecycle.js:19`) already threads
  `mode`, `unlockedBoons` and `ascension` through from the root. `charClass`
  slots in beside them with no new plumbing.
- **`unlockedBoons` / `pickBoonOffers`** (`boons.js`) already gate which Boons an
  offer can draw from, per run. Class-private Boons need no new mechanism — only
  a different seed set than `STARTER_BOON_IDS`.
- **`INSCRIBED_FRAMES`** (`constants.js:147`) is a working third card category on
  the TOOL suit: Lucky Coin, Skeleton Key, Map, Torch, Whetstone, Panacea,
  Wildedge, Brittle Fang, Vampiric Edge, Draught of Vigor. Class-private
  inscriptions are new rows in a table that exists, behind the `customCards`
  flag that also exists.
- **`flags.js`** already gates every feature of this size. Classes ship behind
  `classes`, default off, the way everything else did.

## 4. The contract

What a class **may** touch:

1. Its starting kit.
2. **One** core-rule bend. One — not a package.
3. A private slice of the Boon pool.
4. A private slice of the inscription frames.

What a class **may not** touch: `SIGIL_TARGET`, the Trial ladder and its tiers,
the room shape (four cards, play three, the fourth carries), the flee rule, or
max HP as its headline difference.

The reasoning isn't purity. Those are the things the tutorial teaches, the rules
modal explains, and every screenshot shows. A class that changes them isn't a
class — it's a mode, and modes already exist as their own axis.

**Classes and modes are orthogonal and should stack.** Modes *subtract systems*
(`noBoons`, `noForge`, `lockTheme`). Classes *add identity*. "Ranger, Hardcore"
should be a legal and coherent run.

## 5. The base class

The control group: today's game, named.

- **Kit**: ♦2–6, ♥2–6, unchanged — so every existing save is already playing it.
- **Bend**: none. It *is* the rule.
- **Purpose**: the reference row every other class is balanced against (§8).

Name candidates: **The Scoundrel**, The Vagrant, The Debtor, The Prisoner.

Recommendation: **The Scoundrel.** It moves the credit to Gage and Bieg out of
the footnotes and into the fiction, and it's the one name here that can't be
called generic. The cost is collision with the old project name and the
`src/games/scoundrel/` path — a documentation problem, not a code one.

## 6. The Ranger

*Fights at a distance. Never lets anything get close.*

- **Kit**: fewer, sharper — ♦4, ♦6, ♦8, ♥3, ♥5. Five cards against the base ten,
  so it draws its own gear half as often, but what it draws is worth having.
- **The bend — ranged weapons blunt instead of bind.**

Today a weapon **binds**: after a kill it swings only at monsters of equal or
lower rank (`logic/combat.js:86`), a ratchet that only ever tightens, and above
the binding your one option is bare hands. A Ranger's weapons never bind.
Instead, every kill costs the weapon **1 rank, permanently**.

Same numbers, different failure curve — and a different question in front of the
player every room:

| | The question the room asks |
| --- | --- |
| Scoundrel | *Which one fight is worth spending the binding on?* |
| Ranger | *How many shots are left in this thing?* |

The binding is a cliff: one bad kill and a card is simply locked. Blunting is a
slope you can count down. That's the interesting part, and also the danger — a
slope is **easier to play**, because nothing is ever unavailable and no move is
ever forced. Halving the kit is what pays for it. Whether that's enough is a
measurement, not an opinion (§8).

- **Private Boons**: *Quiver* — the first kill each descent costs no rank.
  *Long Shot* — a weapon at rank 8+ takes no rank when it kills a 4 or lower.
- **Private inscription**: a ♦ frame that starts at rank 10 and loses 2 a kill.
  Four kills and it's gone. Reads as a bow that breaks.
- **Watch for**: this deletes the game's hardest teaching moment. A locked card
  with nothing but a Bare hands button is *how players learn the binding*. The
  Ranger should not be the class a new player meets first.

## 7. The Brewmaster

*The wasted potion is the whole class.*

- **Kit**: potion-heavy — ♥2–6 plus ♦3, ♦5. Seven cards, only two of which will
  ever kill anything.
- **The bend — extra potions brew instead of being wasted.**

Today only the first potion in a room heals; any others are discarded for
nothing. That rule is pure punishment — the one place the game takes something
from you and hands back nothing. The Brewmaster makes it the engine: the second
and later potions in a room **bank their rank into a flask**, and the flask can
be spent later as a single heal for the banked total.

Why it's worth building: it changes room *ordering*, which is the decision the
game is actually made of. Every other build wants potions spread thin across
rooms. A Brewmaster wants them **clumped** — which fights the carry-over rule,
because clumping means deliberately leaving a potion behind as the fourth card
to pair with next room's draw. It makes the game's quietest rule load-bearing.

- **Private Boons**: *Distillation* — the flask survives between descents.
  *Sour Mash* — banked ranks may be spent as weapon rank instead of healing.
- **Private inscription**: a ♥ frame worth nothing on its own that doubles
  whatever it banks.
- **Watch for**: unbounded healing is the standard way an attrition game dies.
  Cap the flask at 10 (matching `UPGRADE_RANK_CAP`), empty it on death, and
  don't let *Distillation* and *Sour Mash* be takeable in the same run without a
  hard look at the numbers first.

## 8. Balance: the compounding trap

From `WINRATE_TARGETS.md`: a run is ten descents, and total winrate is the
**product** of ten per-descent survival rates, not the average. 60% total needs
95% per descent.

So classes cannot be eyeballed. Starting from a 60% run:

| Per-descent survival shift | Total winrate |
| --- | --- |
| +2 points (95% → 97%) | ~74% |
| baseline (95%) | 60% |
| −2 points (95% → 93%) | ~48% |

A change too small to feel in any single descent moves the run by twenty-five
points. Therefore:

- Every class ships with **its own target row in `WINRATE_TARGETS.md`**, and the
  base class stays the reference.
- Balance each class at **Ascension 0, default mode**, and let the ladder ride.
  Class × mode × ascension is a three-way matrix, and trying to balance every
  cell is how this feature stops shipping.
- The kit-size lever (ten cards → five) is the cheapest knob and should be the
  first one turned. Rule bends are expensive to retune once players have learned
  them.

## 9. Open questions

These block. The rest is detail.

1. **Does the class picker replace the mode picker, or sit above it?** Two
   pickers on the opening visit is a lot of decision before anyone has seen a
   card. Leaning: class takes the picker slot, mode moves behind a "more
   options" affordance.
2. **Available from run 1, or unlocked?** The `library` flag precedent says
   unlock. But most players never win a roguelike, so an unlock gate makes this
   invisible content for the majority. Leaning: base plus one class from the
   start, anything further unlocks.
3. **Do class Boons dilute the shared pool?** Private pools are cleaner to reason
   about and double the tuning surface. Shared pools are cheaper and mean a
   Ranger can be offered a Boon that does nothing for them.
4. **Save migration.** State carries `mode`; a `charClass` field needs a default
   for every existing save. Defaulting to base is correct, and should be a test.
5. **The tutorial teaches binding.** A Ranger who never binds is being taught a
   rule they don't have. Either the tutorial stays base-class only (and the
   picker appears after it), or it forks — and forking it is a second tutorial.

## 10. The smallest slice that proves it

Ship **base + Ranger only.** One class with one rule bend exercises every seam.
The Brewmaster needs new run state (the flask), which means save migration, new
UI and its own balance pass — a second project, not a second row in a table.

1. `classes` flag in `flags.js`, default off.
2. `CLASSES` table in `constants.js` beside `MODES`:
   `{ id, name, description, startingKit, boonPool }`.
3. `buildStartingKit(classId)` in `logic/deck.js`.
4. `charClass` option on `createRun`, stored on state, defaulted for old saves.
5. `ClassPickerPanel`, copied from `ModePickerPanel`, opening visit only.
6. The Ranger's bend lives in two places in `logic/combat.js`: the usability
   check (~line 86) and where `lastSlain` advances after a kill (~line 299).

Everything but step 6 is table-shaped. Step 6 is the only real code, and it's one
branch in two functions.

## 11. What would kill this

Worth naming the failure conditions before starting:

- **Boon maintenance.** If every class needs its own Boon balance pass, the
  pool's upkeep multiplies for a game with one developer.
- **Tutorial forking.** If each class needs its own walkthrough, the cost per
  class triples and the second class never ships.
- **Two pickers.** If question 1 lands on "show both", the opening visit stops
  being a warm-up and becomes a character-creation screen for a fifteen-minute
  game.
- **The Ranger is just easier.** If the halved kit doesn't pay for losing the
  binding cliff, the class is a difficulty setting in a costume — and there is
  already a difficulty setting.
