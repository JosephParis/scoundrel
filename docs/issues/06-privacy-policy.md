---
id: 06
title: "No privacy policy despite Google sign-in, email storage, and PostHog identify"
priority: P0
area: legal
effort: M
status: open
---

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

- [ ] `/privacy` route exists and is reachable from LoginModal, Settings, footer
- [ ] Every processor above is named
- [ ] A deletion-request contact is listed
- [ ] Decision recorded on whether PostHog still receives `email` / `name`
