# Achievements — draft for approval

**Status: DRAFT. Not implemented, and not to be implemented until Joey signs
off.** This is docs/STEAM.md S08; S09 is the code, and it is blocked on both
this sign-off and the App ID from S13.

24 achievements. The list is deliberately anchored to constants that already
exist — `SIGIL_TARGET`, the `ASCENSIONS` table, the tool ids, the Forge — so
`test/designDocs.test.js` can hold it to the code the same way it already holds
`DESIGN.md` and `REWORK.md`. If the sigil target or an ascension name changes,
this file should fail a test until it is updated with them.

## Rules the list follows

- **Nothing depends on the server.** No leaderboard placement, no account, no
  cross-device anything. The Steam build has no `/api` (`src/buildTarget.js`),
  and an achievement that can never fire is worse than one that does not exist.
- **Every trigger is detectable from run state alone**, at a point the
  lifecycle already passes through. The named code path is where the event
  belongs, not necessarily where the unlock call goes — S09 puts one event hook
  in `logic/lifecycle.js` and lets a thin Steam sink consume it.
- **No grind achievements.** "Play 500 runs" measures patience, not play. The
  hard ones here are hard because the game is hard.
- **Roughly a third should be reachable in the first hour.** A player who sees
  nothing unlock in their first three runs concludes the feature is broken.

## The list

### Getting started — most players see these

| ID | Name | Description | Trigger |
|---|---|---|---|
| `first_descent` | Down We Go | Complete your first descent. | First return to the sanctuary. `lifecycle.js`, the sanctuary transition. |
| `first_sigil` | One of Ten | Earn your first sigil. | `newSigils === 1`. |
| `tutorial_done` | Taught | Finish the tutorial. | `scoundrel:tutorialCompleted` flips true. Covers issue 34's blind spot in the same stroke. |
| `first_forge` | Kit and Caboodle | Change your kit at the Forge for the first time. | Any Forge action committed — Add, Upgrade or Remove. |
| `first_boon` | Blessed | Take your first Boon. | Boon selection resolves. |
| `first_death` | The Dungeon Wins | Lose a run. | Run ends with a death. Deliberately early and deliberately gentle — a first loss is the most common first ending, and it should feel like progress. |

### The run — the spine of the game

| ID | Name | Description | Trigger |
|---|---|---|---|
| `sigil_5` | Halfway Marked | Reach 5 sigils in a single run. | `newSigils === 5`. |
| `sigil_9` | One Short | Reach 9 sigils in a single run. | `newSigils === SIGIL_TARGET - 1`. The near-miss deserves a mark; it is the most common place a good run ends. |
| `escape` | Escaped | Earn all ten sigils and escape. | Victory at `SIGIL_TARGET`. |
| `escape_untouched` | Unbled | Escape without ever dropping below half HP. | Track the run's minimum HP against `BASE_MAX_HP + maxHpBonus`. |
| `deep_trial` | Tier Five | Face a Tier 5 Trial. | Theme tier band 5 (`themes.js`, "Tier 5 covers 8-10"). |
| `bare_hands` | Bare Hands | Win a room with no weapon equipped. | Room cleared while the weapon slot is empty. The layout for this already has a spec (`visual/bare-hands-layout.spec.js`), so the state is reachable and known. |

### The kit — rewards learning the systems

| ID | Name | Description | Trigger |
|---|---|---|---|
| `tool_collector` | Locksmith's Bag | Hold all five tools at once. | Kit contains Skeleton Key, Map, Whetstone, Torch and Lucky Coin simultaneously (`isTool` ids in `constants.js`). |
| `upgrade_max` | Sharpened | Upgrade a kit card to the Forge's rank cap. | Upgrade lands on the cap. The cap is already asserted by rolling it, not grepping (commit `1be2684`) — reuse that. |
| `lean_kit` | Travel Light | Escape with a kit of six cards or fewer. | Kit size at victory. |
| `removed_ten` | Ruthless | Remove ten cards from your kit across one run. | Count Forge removals per run. |
| `all_suits` | Full Hand | Clear a room containing all four suits. | Room composition at clear. |

### Ascensions — one per level, and they are the long tail

| ID | Name | Description | Trigger |
|---|---|---|---|
| `asc_1` | Restless Sanctuary | Escape at Ascension 1. | Victory with `level >= 1`. |
| `asc_2` | Lean Offers | Escape at Ascension 2. | Victory with `level >= 2`. |
| `asc_3` | Quickening Halls | Escape at Ascension 3. | Victory with `level >= 3`. |
| `asc_4` | Cold Coals | Escape at Ascension 4. | Victory with `level >= 4`. |
| `asc_5` | Hollow Bones | Escape at Ascension 5. | Victory with `level >= 5`. |
| `asc_6` | Sharpened Names | Escape at Ascension 6 — the deepest the game goes. | Victory with `level >= ASCENSION_MAX`. |

Names are taken verbatim from `ASCENSIONS` in `src/games/scoundrel/ascensions.js`.
That is the point: they are already written, already themed, and already the
thing the player is trying to beat. Achievements that restate the game's own
vocabulary need no explaining.

### One hidden

| ID | Name | Description | Trigger |
|---|---|---|---|
| `coin_luck` | House Money | *Hidden.* Win a Lucky Coin flip three times in one run. | Coin resolutions per run. Marked hidden on Steam, so it is a surprise rather than a checklist item. |

## Open questions for Joey

1. **Ascension achievements: escape, or reach?** Escaping at A6 is a very high
   bar and six of the 24 sit behind it. The alternative is *reaching* 5 sigils
   at each level, which more players would see. Escape is the more honest mark;
   reach is the more generous one.
2. **`escape_untouched` needs a number.** Half HP is a guess. `WINRATE_TARGETS.md`
   has the real distribution — pick the threshold from data rather than feel.
3. **Icons.** 24 achievement icons is a real art task and it lands in the same
   place as the capsule problem (S02, S15). The typographic mark scales down
   better than most things here, which may be the answer.

## Acceptance criteria (from S08)

- [ ] Every achievement has an ID, display name, description and a stated
      trigger condition naming the code path that can detect it
- [ ] No achievement depends on the server half
- [ ] Joey has signed off
