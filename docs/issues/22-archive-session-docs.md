---
id: 22
title: "Nine session-artifact markdown files cluttering the repo root"
priority: P4
area: hygiene
effort: S
status: open
---

## Problem

The repo root holds 14 markdown files. Nine are transcripts of past working
sessions rather than documentation anyone needs going forward:

- `COMMIT_AND_PUSH.md`
- `FIXING_LINTER_ERRORS.md`
- `MOBILE_OPTIMIZATION_COMPLETE.md`
- `RESPONSIVE_CHANGES_SUMMARY.md`
- `TEST_RESPONSIVE.md`
- `TESTING_MOBILE.md`
- `PLAYWRIGHT_TESTS_SUMMARY.md`
- `GITHUB_ACTIONS_SETUP.md`
- `CI_SETUP_CHECKLIST.md`

The five that carry ongoing value: `REWORK.md` (the design of record),
`DESIGN.md` (stale — see issue 23), `WINRATE_TARGETS.md`,
`RESPONSIVE_AND_PWA_PLAN.md` (issue 04's spec), `EXTENSIONS.md`, `Storyline.md`,
and `MOBILE_UI_IMPROVEMENTS.md`.

## Why it matters

Signal-to-noise for whoever opens this repo next — increasingly, an agent. Files
named `*_COMPLETE.md` and `FIXING_*.md` describe work already finished, but
nothing distinguishes them from live specs at a glance. Worse, several describe
states of the world that no longer hold, so anyone reading them for context gets
misled. This is the same failure mode as issues 10, 14, and 23: stale docs that
look authoritative.

There is also no README to orient anyone (issue 20), so the root listing *is* the
first impression.

## Suggested fix

Don't delete outright — some contain useful reasoning worth keeping searchable.
Move them:

```
docs/archive/
```

with a short `docs/archive/README.md` saying these are historical session notes,
kept for reference, not current documentation, and not to be trusted as a
description of the present codebase.

Before moving each one, check for anything still live:

- **`CI_SETUP_CHECKLIST.md` / `GITHUB_ACTIONS_SETUP.md`** — may document required
  GitHub secrets or setup steps that aren't recorded elsewhere. Fold anything
  still needed into the README (issue 20) first. Relevant to issue 24, which
  untangles the duplicated workflows.
- **`TESTING_MOBILE.md` / `TEST_RESPONSIVE.md` / `PLAYWRIGHT_TESTS_SUMMARY.md`** —
  may describe how to run the Playwright suites. That belongs in the README.
- **`MOBILE_OPTIMIZATION_COMPLETE.md` / `RESPONSIVE_CHANGES_SUMMARY.md`** —
  cross-check against `RESPONSIVE_AND_PWA_PLAN.md`. Part 1 landed only partially,
  so a file claiming completion is exactly the kind of thing that causes issue 04
  to be skipped.

While reorganizing, consider whether `EXTENSIONS.md`, `Storyline.md`, and
`MOBILE_UI_IMPROVEMENTS.md` belong in `docs/` too, leaving the root to README,
LICENSE, and the three live design docs.

## Acceptance criteria

- [ ] All nine moved to `docs/archive/` with an explanatory README
- [ ] Any still-live setup or test-running instructions folded into the main README first
- [ ] Repo root contains only README, LICENSE, and current design docs
- [ ] No file in the root claims completion of work that is still outstanding
