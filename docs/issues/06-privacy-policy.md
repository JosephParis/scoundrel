---
id: 06
title: "No privacy policy despite Google sign-in, email storage, and PostHog identify"
priority: P0
area: legal
effort: M
status: done
---

## Resolution

`/privacy` route (`src/PrivacyPolicy.jsx`, lazy-loaded), reachable from three
places. Written in plain language rather than legalese, and deliberately specific:
every processor is named, and the genuinely-private parts are stated as plainly as
the public ones.

Covers what is collected and why, who holds each item, what is public, retention,
deletion, children, and that guest play needs no sign-in at all.

### PostHog no longer receives any personal data

Was `identify(user.sub, { email, name })`. Now `identify(user.sub, { pseudonym })`.

The reasoning, since the ask was whether identity could be anonymous: **the Google
`sub` is already pseudonymous** — it is an opaque per-application identifier
containing no personal data, and it cannot be resolved to a person without Google.
So it was kept as the `distinct_id` rather than replaced, for two reasons: a
random new id would break cross-device identity, and keeping `sub` means PostHog
events can still be joined to the `runs` table, which keys on the same value as
`accountId`.

What was lost by dropping the name is a readable PostHog UI — every person would
show as a long number. `src/utils/pseudonym.js` restores that without restoring
the data: a stable label derived from the id via FNV-1a, e.g. "Ashen Vagrant 47",
in the game's own register. Same player always gets the same pseudonym; nothing
about it reveals who they are. Collisions are possible and harmless, since
identity is the `distinct_id` and this is only a label beside it.

### Entry points

The app has no footer, so the always-visible slot is the version-badge corner —
`VersionBadge.jsx` now renders "Privacy · &lt;sha&gt;". Plus `SettingsModal` and
`LoginModal`.

Both modal links open in a new tab on purpose: reading the policy must not discard
the run behind the modal. The `LoginModal` disclosure was initially placed inside
the Google-sign-in branch, which meant it did not render at all on the local
dev-fallback path; it is now outside the conditional so it shows on both.

### Tests

- `test/pseudonym.test.js` (6) — stability, spread across sequential ids, and that
  the output leaks no fragment of the id it came from.
- `visual/privacy.spec.js` (9) — the page renders, names all four processors,
  exposes a `mailto:` deletion contact, and is reachable from all three entry
  points. One test pins the claim that PostHog receives no email: if `identify()`
  starts sending PII again, that assertion is what should fail, because the policy
  would have become untrue.

### ACTION REQUIRED before launch

**The contact address does not exist yet.** You chose a dedicated alias over your
personal inbox, so the policy lists `scoundrel.privacy@gmail.com`, defined in one
place (`src/privacyContact.js`). **Create it and send a test message**, or change
that constant to an address you do read.

A policy listing a dead address is worse than no policy — a deletion request would
vanish silently. Added to issue 13's pre-launch checklist.

### Follow-up

The policy discloses that Google sees visitors' IP addresses because the fonts are
loaded from `fonts.googleapis.com`. **Issue 18** removes that by self-hosting;
when it lands, this page should be updated to drop the claim.

## Problem

The app collects and transmits personal data with no privacy policy anywhere.
What actually happens today:

- **Google sign-in** returns an `id_token`; `api/_lib/google.js` verifies it and
  `api/auth.js` mints a session JWT carrying `{ sub, email }`.
- **Email is stored server-side** in the Neon `profiles` table.
- **PostHog `identify`** is called with `user.sub` plus `{ email, name }` —
  `src/games/scoundrel/analytics.js`. That sends the player's email and display
  name to a third-party processor.
- **Vercel Analytics** and **Speed Insights** both run on every page.
- **Google Fonts** loads from `fonts.googleapis.com` on every visit, which
  discloses visitor IPs to Google (see issue 18).
- Session tokens live in localStorage with a 60-day TTL
  (`api/_lib/session.js`).

The only user-facing disclosure is a single sentence of copy in
`src/games/scoundrel/components/LoginModal.jsx`.

## Why it blocks batch 1

Sending a real cohort a link that takes their Google identity and forwards their
email to two analytics vendors, with no stated policy, is the one item on this
list with consequences beyond product quality. It is also a Google OAuth
requirement — apps using Google Identity Services are expected to publish a
privacy policy, and this can affect the OAuth consent screen.

## Suggested fix

Write a short, honest policy — this does not need a lawyer to be a large
improvement over nothing. Cover:

- What is collected: Google account id, email, display name; gameplay run
  records; optional leaderboard handle; optional free-text feedback.
- Why: cross-device save sync, balance analytics, the public leaderboard.
- Who it goes to: Neon (database), PostHog (product analytics), Vercel
  (hosting/analytics), Google (auth).
- What is public: **only** the opt-in handle and run stats on the leaderboard —
  `api/leaderboard.js` explicitly strips `account_id` before responding, and
  never derives a name from the Google profile. This is a genuinely good design
  decision and worth stating plainly.
- Retention, and how to request deletion (needs a contact address).
- That guest play works with no sign-in at all.

Add it as a route (`/privacy`) plus a link in the footer, Settings, and
`LoginModal` next to the sign-in button.

Then reconsider whether PostHog needs `email` and `name` at all. `sub` alone
identifies a player across devices for every analytics question you actually ask.
Dropping the two PII fields from `identify` is a one-line change that materially
shrinks the disclosure surface — do that regardless of the policy.

## Acceptance criteria

- [x] `/privacy` route exists and is reachable from LoginModal, Settings, and the version-badge corner (there is no footer)
- [x] Every processor above is named
- [~] A deletion-request contact is listed — **but the mailbox has not been created yet**, see above
- [x] Decision recorded: PostHog receives neither; `sub` plus a derived pseudonym
