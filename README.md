# Lotto Pattern Lab

Historical Powerball and Mega Millions pattern analysis and backtesting, built
with React, TypeScript and Vite. Runs in the browser; no account or backend.

## Features

- Dashboard, Number Analysis, Common Pairs and Pattern Overview.
- Last 20, 50, 100 or all verified current-rule-era drawings.
- Random, Balanced and Trend Weighted generators with Pattern Score breakdowns.
- Saved Combinations in versioned, validated browser localStorage.
- Reproducible historical backtests, strategy comparisons and target details.
- History with lottery selection, date sorting and 25-drawing pagination.
- Settings for default lottery, analysis period, strategy and batch size; reset.
- Manual Refresh Data, source dates, loading/error states and render recovery.

## Data source and coverage

New York State Gaming Commission / NY Open Data:

- [Powerball archive](https://data.ny.gov/d/d6yy-54nr): begins 2010-02-03.
- [Mega Millions archive](https://data.ny.gov/d/5xaw-6ayf): begins 2002-05-17.

On 2026-09-29 the archives contained 1,999 Powerball drawings through 2026-09-28
and 2,540 Mega Millions drawings through 2026-09-25. These are audit snapshots;
use the application's Data Through field for the dataset actually loaded.
Current analysis eras begin 2015-10-07 and 2025-04-08 respectively. Historical
backtests use the verified rules applicable to each target and strictly earlier
same-era training data. History includes the complete available archive.

The loader paginates the public API, validates every row, checks duplicate dates,
counts and date bounds, and rejects partial or inconsistent datasets. No API key
or environment variable is required. Browser access depends on source CORS and
availability. There is no real-time update guarantee.

Loaded archives have a one-hour in-memory cache. Refresh Data bypasses/replaces
the selected lottery's cache and reloads the complete archive. A failed request
shows an error and retry; fabricated or partial data is never substituted.
Pagination, sorting, analysis and backtests do not fetch data. No background polling.

## Installation and commands

Use Node.js 24 or later and npm:

```sh
npm install
npm run dev
npm run build
npm run lint
npm test
npm run preview
```

The production build is written to `dist`. `npm ci` provides a lockfile-based
installation. Unit tests use Node's built-in test runner and TypeScript stripping.

## Independent verification

```sh
npm run test:data:live
npm run test:analysis:live
npm run test:patterns:live
npm run test:generator:live
npm run test:backtest:live
```

These checks fetch public NY Open Data and independently compare the displayed
statistics, pattern metrics, generator scores and historical backtest results.
Run live checks before UI checks to generate fresh reference artifacts.

Browser checks require the `playwright` package (install for local verification
with `npm install --no-save --package-lock=false playwright`, or supply it through
`NODE_PATH`) and installed Microsoft Edge. Start `npm run dev` in another terminal:

```sh
npm run test:patterns:ui
npm run test:generator:ui
npm run test:backtest:ui
npm run test:readiness:ui
npm run test:boundary:ui
```

The boundary check uses Vite development modules and requires the development server;
it injects a controlled render failure and checks safe fallback and page recovery.

`APP_URL` overrides `http://127.0.0.1:5173`; it can target `npm run preview`.
Readiness checks exercise all six pages at 320, 390 and 768 pixels for both games,
including generated combinations and expanded backtest details. They also check
history pagination without refetching, refresh failures/retry, settings persistence,
reset, malformed storage and storage write failures. Source changes during checks
may require regenerating references. Screenshots and JSON output in `artifacts/`
are ignored; only the hand-written Step reports are retained for review.

## Settings and local storage

Defaults are Powerball, Last 100, Random and 5 combinations. Settings apply at
reload, when changing lottery (analysis period), and when reopening Generator
(strategy/count). Saving defaults does not force the active lottery to change.
Saved combinations retain their original scores. Both stores are versioned and
validated; malformed/incompatible records show an error without crashing.
Storage denial or quota failures are reported. Reset to Defaults resets settings
only. Corrupt saved combinations are preserved rather than silently overwritten;
clear the `lotto-pattern-lab.saved.v1` storage entry to discard corrupt records.
Storage is browser/origin-specific, with no cross-device or cloud synchronization.

## Deployment preparation

Recommended Vercel settings:

| Setting | Value |
| --- | --- |
| Framework preset | Vite |
| Root directory | Project root (`.`) |
| Install command | `npm ci` |
| Build command | `npm run build` |
| Output directory | `dist` |
| Node.js version | 24.x |
| Environment variables | None |

Navigation uses React state, not URL paths. Refreshing `/` safely returns to
Dashboard with saved defaults. Section anchors do not require server rewrites.
No routing dependency or SPA rewrite is needed. `vercel.json` sets revalidation
headers for the service worker and manifest.
If path-based routes are introduced later, configure SPA rewrites as documented
in [Vercel's Vite guide](https://vercel.com/docs/frameworks/frontend/vite).

Git initialization, GitHub repository creation, pushing and deployment are separate
approval steps and have not been performed. Do not publish `node_modules`, `dist`,
local `.env` files, `.vercel` settings or generated verification artifacts.

## Statistical disclaimer

Lottery drawings are random and independent. Pattern Score is historical-pattern
similarity, not winning probability. No generator strategy improves lottery odds.
Backtest results do not establish future predictive performance. Hot, Cold and
Overdue labels describe observed history, not future outcomes. Analysis is intended
for statistical exploration and entertainment.

See [Step 5](artifacts/step-5-report.md), [Step 6](artifacts/step-6-report.md) and
[Step 7](artifacts/step-7-report.md) reports for implementation and verification details.

## Mobile and PWA

Mobile navigation is fixed to the bottom with safe-area padding. Touch controls
are at least 44px high; desktop navigation is unchanged. The existing Generator
button colors, scoring/search logic and lottery rules are unchanged.

The production build uses vite-plugin-pwa with a standalone manifest, 192/512px
icons, a maskable icon and an Apple touch icon derived from the existing mark.
Install help is opt-in: supported Android browsers expose Install app; iOS users
use Safari > Share > Add to Home Screen. Installed standalone views hide help.

The service worker precaches only the app shell/static assets, never NY API pages.
The existing one-hour memory cache remains. Complete validated archives are also
saved in Cache Storage, revalidated on read, and used if a fresh load fails. Saved
archive fallback is prominently labeled, preserving original Data Through and
Retrieved dates. With no saved archive, offline data remains unavailable. Browser
storage can be evicted; offline availability requires an earlier successful visit.
localStorage combinations/settings remain untouched by service-worker updates.

Updates are checked on load and when returning to the app. A waiting worker offers
Update and reload or Later, avoiding unexpected interruption. Old shell caches
are cleaned on activation. No data polling or backend is added. HTTPS is required
(except localhost). Vercel serves the generated dist directory without special
routing; no deployment is performed by these scripts.

To verify actual service-worker behavior, build and start `npm run preview --
--host 127.0.0.1 --port 4180`, then run `npm run test:pwa:ui` with Playwright/Edge
available. This check temporarily modifies and restores only generated dist/sw.js
to verify an update. Use APP_URL to target another local preview port. The readiness
UI suite covers 320, 390, 430 and 768px. OS install dialogs are device/browser
controlled; browser tests simulate install events and iOS detection.
