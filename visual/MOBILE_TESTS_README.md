# Mobile responsive tests

Playwright coverage for the mobile layout: nothing important requires scrolling,
the compact headers carry the information the sidebar does on desktop, the modals
open and close, and the desktop layout is unaffected.

## Files

| File | Project | What it covers |
|---|---|---|
| `mobile-responsive.spec.js` | dev | The main suite (27 tests) — descent, sanctuary, desktop parity, screen sizes, touch targets |
| `mobile-responsive-simple.spec.js` | dev | 12 fast smoke checks — meta tags, no horizontal scroll, console errors, bundle size |
| `screens.spec.js` | dev | Screenshot capture for eyeballing font/theme changes |
| `tutorial-walkthrough.spec.js` | dev | Plays the curated tutorial to a win |
| `dev-tools-gate.prod.spec.js` | prod | Dev tools hidden in a production build (issue 01) |

## Running

```bash
npm run test            # everything, both projects
npm run test:dev        # dev-server project only
npm run test:prod       # production-build project only
npm run test:mobile     # just the simple smoke spec

npx playwright test visual/mobile-responsive.spec.js --project=dev
npx playwright test --project=dev --grep "Touch Targets"
npx playwright test --ui        # best for development
npx playwright show-report
```

The `prod` project runs against `vite preview` and rebuilds first, so it is
slower than `dev`. Specs opt into it by being named `*.prod.spec.js` — use it
only when the assertion genuinely needs a production bundle (anything behind
`import.meta.env.DEV`). See `playwright.config.js`.

## Entering the game from a test

**There is no `Begin` button.** `/` loads straight into the opening sanctuary. A
previous version of this suite drove the app through `Begin` → `Skip tutorial` →
`Descend`; when the opening flow changed, all 25 tests sat on a 30-second
selector timeout and the file took 12.5 minutes to fail completely (issue 26).

All entry now goes through three helpers at the top of
`mobile-responsive.spec.js`, so the next UI change breaks one place:

- **`openingSanctuary(page, viewport)`** — sets `scoundrel:tutorialCompleted`,
  loads `/`, waits for `Descend`.
- **`midRunSanctuary(page, viewport)`** — seeds a sanctuary with sigils already
  earned. Needed because the sanctuary's mobile compact header is deliberately
  hidden on the opening visit (`!isOpeningVisit`, i.e. `sigilsEarned > 0`), so
  its layout cannot be asserted on a fresh save. Seeding beats playing a descent:
  faster and not subject to a random deck.
- **`enterDescent(page, viewport)`** — the above, then `Descend`, then waits for
  `.card-face`.

Seeding writes `scoundrel:save` as `{ version: 1, state }` via `addInitScript`,
the same trick `screens.spec.js` uses for outcome screens. `loadSavedGame()`
backfills most fields, but `boonOffers` must be present — `SanctuaryView` reads
`.length` on it unguarded.

## Selectors that commonly drift

| Thing | Current selector | Note |
|---|---|---|
| Descent kit button | `getByRole('button', { name: 'View kit' })` | An icon (`⋮`), not text |
| Sanctuary kit button | `getByRole('button', { name: 'Kit', exact: true })` | `exact` matters — `View kit` and `Kit · N cards` also exist |
| Sanctuary boons button | `getByRole('button', { name: 'Boons', exact: true })` | |
| Descent kit modal | `getByRole('heading', { name: /Your kit/i })` | `KitModal` |
| Sanctuary kit modal | `getByRole('button', { name: 'Close deck view' })` | `DeckModal`; its heading is "N cards", "Your kit" is only a label |
| Boons modal | `getByRole('button', { name: 'Close boons' })` | `RunBoonsModal` |
| Desktop sidebar | `page.locator('aside').first()` | Present in the DOM on mobile but CSS-hidden |
| Flee | `getByRole('button', { name: /Flee the room/i })` | |

There is no `Progress` button, and no "Your progress" heading in the live UI —
`SanctuaryKitModal.jsx` still defines one but is imported nowhere (dead code).
`Rested` appears only in the desktop rail, not on the mobile header.

## Coverage

**Descent (8)** — compact header shows HP/Deck/kit button; no vertical
scrollbar; all room cards in viewport; kit modal opens, closes on Escape, closes
on outside click; sidebar hidden; flee button in viewport.

**Sanctuary (6)** — compact header shows Sigils plus Kit and Boons buttons; no
vertical scrollbar; Descend in viewport; kit modal opens and closes on Escape;
boons modal opens and closes.

**Desktop parity (3)** — sidebar visible in descent and sanctuary; mobile-only
affordances hidden; compact headers hidden.

**Full flow (3)** — tutorial intro fits without scrolling and offers Skip;
opening sanctuary fits; layout switches live on viewport resize.

**Screen sizes (4)** — iPhone SE 375×667, iPhone 12 390×844, Small Android
360×640, Tablet Portrait 768×1024. The tablet asserts the *desktop* rail, since
Tailwind's `md` breakpoint is 768px.

**Touch targets (3)** — runs with `hasTouch` + `isMobile` so
`@media (pointer: coarse)` in `index.css` applies, then asserts Descend and Flee
meet 44px. The first test asserts the coarse pointer is actually active; without
it the other two would only be measuring the buttons' natural size and could
pass while the CSS rule was broken.

## Conventions

- **Write the test in the same change as the fix**, not as a follow-up. If the
  harness can't reach the behavior, extend the harness as part of that work.
- Prefer role-based selectors over CSS classes; prefer seeding state over driving
  many clicks.
- Use `toBeHidden()` rather than `not.toBeVisible()`. Both pass for a missing
  element, so when absence is the point, also assert the element exists — or
  assert on something that proves the surrounding UI rendered.
- Keep a guard test for any assertion whose meaning depends on the environment
  (see the coarse-pointer test above).
