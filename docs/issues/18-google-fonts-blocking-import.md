---
id: 18
title: "Google Fonts loaded via render-blocking CSS @import"
priority: P3
area: performance
effort: S
status: open
---

## Problem

`src/index.css:1`:

```css
@import url('https://fonts.googleapis.com/css2?family=Cinzel...&family=Inter...');
```

A CSS `@import` to a third-party host is the slowest way to load a font. It
creates a serial dependency chain: the browser must download and parse your CSS
before it even discovers the font CSS URL, then fetch *that*, then fetch the font
files themselves. Three round trips to two hosts before any text renders, all of
it blocking.

Bundlers generally can't optimize this away — the `@import` stays in the emitted
CSS as-is.

## Why it matters

- It's on the critical rendering path for every visit, and it's the first thing
  that happens. Directly hurts First Contentful Paint and Largest Contentful
  Paint — the numbers Speed Insights is already reporting to you.
- Worst on mobile over cellular, where the extra DNS + TLS handshakes to
  `fonts.googleapis.com` and `fonts.gstatic.com` cost the most.
- **Privacy**: every visitor's IP is disclosed to Google on page load, before any
  consent or interaction. This is the specific pattern that has drawn GDPR
  attention in the EU, and it interacts with issue 06 — if you publish a privacy
  policy, this has to be disclosed or removed.

## Suggested fix

**Preferred: self-host the fonts.** Solves performance and privacy together.

1. Download the Cinzel and Inter woff2 subsets you actually use — check which
   weights are referenced before pulling all of them; unused weights are pure
   payload.
2. Place them in `public/fonts/`.
3. Replace the `@import` with local `@font-face` declarations using
   `font-display: swap` so text renders immediately in the fallback.
4. Add `<link rel="preload" as="font" type="font/woff2" crossorigin>` in
   `index.html` for the one or two faces used above the fold.

Both fonts are open licensed (SIL OFL), so self-hosting is permitted — include
the license files alongside them.

**Fallback if self-hosting is rejected:** at minimum move the request out of CSS
into `index.html` as `<link rel="preconnect" href="https://fonts.gstatic.com"
crossorigin>` plus a `<link rel="stylesheet">`. Removes one round trip but keeps
the privacy exposure, so this is strictly the lesser option.

While here: define a sensible `font-family` fallback stack so the game is
readable even if fonts fail entirely.

## Acceptance criteria

- [ ] No `@import` to a third-party host in `src/index.css`
- [ ] No requests to `fonts.googleapis.com` or `fonts.gstatic.com` on page load
- [ ] Fonts render with `font-display: swap`; no invisible-text flash
- [ ] Only the weights actually used are shipped
- [ ] OFL license files included with the self-hosted fonts
- [ ] FCP/LCP measured before and after, recorded in the commit
