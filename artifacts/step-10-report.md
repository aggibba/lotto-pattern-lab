# Step 10 — Mobile UX and PWA

Implemented locally; not committed, pushed, or manually deployed.

## Behavior

- Mobile bottom navigation at widths up to 800px, compact labels, accessible full names,
  safe-area padding, 44px minimum touch targets, 16px form inputs, larger balls/scores,
  and a full-width 52px Generator button. Desktop layout remains unchanged.
- Existing light-yellow Generator background and 200ms blue flash preserved.
- vite-plugin-pwa generates a standalone Lotto Pattern Lab / Lotto Lab manifest and
  service worker. PNG icons: 192px, 512px, 512px maskable, 180px Apple touch icon.
  Icons reuse the existing logo. Theme/background: #0c1526.
- Install help is collapsed and user-initiated. Supported browser install events
  expose an Install app button. iOS instructions direct users to Safari > Share >
  Add to Home Screen. Standalone/installed state hides the help.
- Shell/static assets are precached. NY Open Data API responses are not cached by
  the service worker. Only complete, successfully validated archives are persisted.
  Offline snapshots are revalidated before use, retain their original dates, and
  carry an explicit stale-data warning when fresh loading fails.
- Existing one-hour in-memory cache and localStorage combinations/settings remain.
  No snapshot means a visible offline/error state, never fabricated data. Failed
  refreshes do not overwrite the last valid snapshot. No background data polling.
- App updates are user-confirmed; old shell caches are cleaned on activation.
  Update checks occur on registration and when returning to the app. Vercel headers
  prevent long-lived caching of sw.js and require manifest revalidation.
- Generator algorithms, highest-score search, scoring formula/weights, backtest
  engine and lottery rule configuration are unchanged.

## Modified files

- README.md
- index.html
- package.json
- package-lock.json
- vite.config.ts
- src/App.tsx
- src/App.css
- src/components/LotteryWorkspace.tsx
- src/services/drawingRepository.ts
- src/types/lottery.ts
- tests/verifyReadinessUI.mjs

## New files

- vercel.json
- public/pwa-192.png
- public/pwa-512.png
- public/pwa-maskable-512.png
- public/apple-touch-icon.png
- src/pwa.d.ts
- src/components/PwaControls.tsx
- src/services/offlineDataset.ts
- tests/offlineDataset.test.mjs
- tests/verifyPwaUI.mjs
- artifacts/step-10-report.md

## Validation

- npm run build: passed; service worker generated; 17 precached assets (~358 KiB).
- npm run lint: passed, no warnings/errors.
- npm test: 70 passed, 0 failed (includes existing generator/backtest regressions).
- Production readiness browser suite: 48 cases, six pages × two lotteries × widths
  320/390/430/768. No page overflow or browser errors; visible controls satisfy
  44px width and height assertions. Expanded generator/backtest content checked.
- PWA browser suite: manifest fields, icon PNG dimensions, controlling worker,
  warm/cold offline reload, both cached archives, recovery, localStorage preservation,
  absence of cached API pages, simulated install events, iOS help/standalone hiding,
  and a real waiting-worker/update/reload cycle passed.
- Final compact navigation labels rechecked at all four widths after visual review.
- Representative 320px Settings and 430px History screenshots inspected.
- git diff --check passed. No commits, pushes, or deployment commands performed.

## Notes and limitations

- Browser validation used Edge with mobile viewports and simulated iOS identification;
  physical iPhone/Android installation dialogs have not been tested.
- Offline use requires an earlier successful online load and browser storage retention.
- Installed the requested PWA plugin and applied compatible npm audit patches
  (including Vite 8.3.5). Four low-severity transitive build-tool advisories remain
  in the Workbox/deepmerge chain. No forced breaking downgrade was applied.
- Update behavior follows the plugin's prompt workflow:
  https://vite-pwa-org.netlify.app/guide/prompt-for-update
