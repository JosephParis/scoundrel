---
id: 34
title: "The analytics funnel cannot see the tutorial, which is where batch 1 starts"
priority: P2
area: product
effort: M
status: open
---

## Problem

`src/games/scoundrel/analytics.js` captures four events: `run_started`,
`descent_started`, `run_ended`, `run_abandoned`. Every one of them either skips
the tutorial or is skipped during it:

- `descent_started` — `&& !game.tutorial` (`analytics.js:200`)
- `run_ended` — `terminal && !game.tutorial` (`analytics.js:218`)
- `run_abandoned` — `if (!g || g.tutorial) return` (`analytics.js:116`)

So a first-time player who opens the game, starts the curated walk, and closes
the tab produces **exactly one event**: `run_started` with `tutorial: true`.
Nothing records whether they finished the tutorial, where they stopped, or
whether they ever reached a real descent.

There is no `tutorial_completed` event at all, even though the flag it would
report is already computed and persisted (`index.jsx:418`).

## Why it matters for batch 1

The tutorial is the first thing every invited player sees, and the single
question a first batch answers is **where people stop**. As instrumented, the
funnel starts after the part most likely to lose them.

Two things follow from that:

- A drop-off in the tutorial is indistinguishable from a player who never
  arrived. Both are one `run_started` and silence.
- `WINRATE_TARGETS.md` needs 1,500-2,000 default-mode A0 runs before the theme
  bands mean anything. If a chunk of batch 1 never reaches a real descent, the
  runs table fills slowly and nothing says why.

PostHog has been live and verified since 2026-08-27 (see issue 13), so this is
instrumentation that will actually be received.

## Suggested fix

Close the first-session funnel first — that is the whole value here:

- `tutorial_started` / `tutorial_completed` / `tutorial_skipped`
- `first_descent_started` — or simply stop excluding the tutorial from
  `descent_started` and let a `tutorial: true` property carry the distinction,
  which is how `run_started` already does it
- Let `run_abandoned` fire during the tutorial, with the same property

Then the choice telemetry that makes a difficulty complaint actionable:

- `boon_taken` (which, from which offer, at which sigil)
- `forge_edit` (add / upgrade / remove, at which sigil) — worth having before
  issue 29 changes how many Forge visits a run gets
- `descent_ended` with survived/died and the theme, so an abandoned run still
  reports the descents it did finish

**Constraint that overrides all of it:** no PII to PostHog. Issue 06 settled
that — the pseudonym system exists precisely so events carry no name, no email
and nothing derived from the Google profile. A new event must not be the thing
that quietly reintroduces one; the player-typed leaderboard name is not
eligible as a property.

Keep the existing dedupe discipline: every capture in this file is keyed so a
re-render or a resumed save cannot double-count, and new events need the same.

## Acceptance criteria

- [ ] Tutorial start, completion and abandonment are all observable
- [ ] A first session that stops mid-tutorial is distinguishable from one that
      never started
- [ ] Boon and Forge choices are recorded with enough context to group them
- [ ] No event carries a name, an email, or anything derived from the account
- [ ] Each new event fires exactly once per occurrence (dedupe covered by tests)
- [ ] `test/pseudonym.test.js`'s no-PII guarantee still holds, extended to the
      new properties
