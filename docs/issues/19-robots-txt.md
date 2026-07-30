---
id: 19
title: "No robots.txt while /admin is a live client route"
priority: P3
area: hygiene
effort: S
status: open
---

## Problem

There is no `public/robots.txt`, and `/admin` is a real client-side route
(`src/App.jsx`, lazy-loading `AdminDashboard`). Because `vercel.json` rewrites
everything except `/api/*` to `index.html`, `/admin` returns 200 to any crawler.

## Why it matters

`/admin` is not a security hole — `TokenGate` blocks the UI and `api/stats.js`
independently requires the `ADMIN_TOKEN` bearer token, so an unauthenticated
visitor sees only a password prompt and the data endpoint refuses them. The
problem is discoverability and noise:

- Search engines can index the admin URL, advertising that the route exists.
- Crawlers hitting it burn serverless invocations and add junk to your analytics.
- It's a free hint to anyone probing the deployment.

## Suggested fix

Add `public/robots.txt`:

```
User-agent: *
Disallow: /admin
Allow: /

Sitemap: https://<your-domain>/sitemap.xml
```

Drop the `Sitemap:` line unless you actually add one.

Also add `<meta name="robots" content="noindex, nofollow">` to the admin view
itself — `robots.txt` is advisory and only discourages well-behaved crawlers,
whereas the meta tag also covers the case where someone links to the URL
directly. Since `/admin` is a client route rendered from the same `index.html`,
this means setting it dynamically when the admin route mounts (e.g. via a small
effect that injects the tag), not statically in `index.html`.

Decide separately whether the game itself should be indexed. If batch 1 is meant
to be a private, invite-only cohort, you may want `Disallow: /` for now and to
open it up at public launch — that's a product call, and worth making
deliberately rather than by default. Note that this interacts with issue 04: OG
tags make shared links preview nicely in chat apps regardless of indexing, so
blocking crawlers does not hurt the invite flow.

## Acceptance criteria

- [ ] `public/robots.txt` exists and is served at `/robots.txt` in production
- [ ] `/admin` disallowed
- [ ] `noindex` applied when the admin route renders
- [ ] Explicit decision recorded on whether the game route is indexable during batch 1
