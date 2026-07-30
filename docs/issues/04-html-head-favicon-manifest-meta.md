---
id: 04
title: "index.html has no favicon, manifest, description, or OG tags"
priority: P0
area: launch-blocker
effort: M
status: open
---

## Problem

`index.html` is 13 lines: charset, viewport, `theme-color`, title, root div,
module script. Consequences:

- Browser tab shows the default globe icon; `/favicon.ico` 404s on every load.
- Sharing the URL anywhere (Discord, Twitter, a text message) renders a bare
  link with no title, description, or image.
- No web manifest, so no install prompt and no home-screen icon on mobile.
- No `<meta name="description">`.

## Evidence

- `index.html` — 379 bytes total.
- `RESPONSIVE_AND_PWA_PLAN.md` — Part 1 (responsive) partially landed; **Part 2
  (manifest, icon set, install prompt) was never implemented.** That document is
  the spec for this issue.

## Why it blocks batch 1

You invite the first cohort by sending them a link. That link is the first thing
they see, and right now it previews as nothing. This is the cheapest credibility
win available.

## Suggested fix

Follow Part 2 of `RESPONSIVE_AND_PWA_PLAN.md`:

- Generate an icon set from the game's visual language (the rune/sigil motif in
  `src/index.css` is the obvious source). Minimum: `favicon.svg`,
  `favicon.ico` (32px), `apple-touch-icon.png` (180px), `icon-192.png`,
  `icon-512.png`, plus a maskable 512 variant.
- Add `public/manifest.webmanifest` with `name`, `short_name`, `display:
  "standalone"`, `background_color` / `theme_color` matching the existing
  `theme-color` meta, `orientation`, and the icon list.
- Add to `<head>`: manifest link, icon links, `<meta name="description">`,
  and OG/Twitter card tags (`og:title`, `og:description`, `og:image`,
  `og:url`, `twitter:card=summary_large_image`).
- Create a 1200×630 share image.

Keep it to the manifest and tags — a service worker / offline mode is a separate,
larger decision and is not needed for batch 1.

## Acceptance criteria

- [ ] Favicon renders in the tab; no 404 for `/favicon.ico`
- [ ] Pasting the deployed URL into Discord or Slack shows title, description, image
- [ ] `manifest.webmanifest` validates and mobile Chrome offers "Add to Home screen"
- [ ] Lighthouse PWA installability checks pass (service worker excepted)
