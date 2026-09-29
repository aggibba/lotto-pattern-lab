# Step 6 — Historical Backtest

Completed 2026-09-28. Backtest navigation is enabled. No automatic run occurs on
page load. The engine calls the same Step 5 prepareGenerator, generateCombinations,
and Pattern Score implementation; no generator, scoring, or Step 3/4 formulas changed.

## 1. Files created

- src/backtest/backtestTypes.ts
- src/backtest/historicalData.ts
- src/backtest/seededRandom.ts
- src/backtest/matchResults.ts
- src/backtest/backtestEngine.ts
- src/components/Backtest.tsx
- tests/backtest.test.mjs
- tests/verifyLiveBacktest.mjs
- tests/verifyBacktestUI.mjs
- artifacts/backtest-real-data.json
- artifacts/backtest-verification-datasets.json
- artifacts/backtest-ui-verification.json
- artifacts/backtest-comparison-powerball-320.png
- artifacts/backtest-comparison-powerball-390.png
- artifacts/backtest-comparison-mega-millions-320.png
- artifacts/backtest-comparison-mega-millions-390.png
- artifacts/backtest-details-powerball-320.png
- artifacts/backtest-details-powerball-390.png
- artifacts/backtest-details-mega-millions-320.png
- artifacts/backtest-details-mega-millions-390.png
- artifacts/step-6-report.md

## 2. Files modified

- src/App.tsx: enabled Backtest navigation and page state.
- src/components/LotteryWorkspace.tsx: connected the page to the loaded dataset;
  historical explanation; avoids irrelevant current-era analytics on Backtest.
- src/App.css: responsive controls, comparison scroll region, summaries, details,
  date inputs, exclusions, and pagination.
- package.json: test:backtest:live and test:backtest:ui commands.
- README.md: Step 6 usage, exact window policy, and verification instructions.
- Existing Step 4/5 verification artifacts were refreshed by their existing scripts:
  pattern-ui-verification.json, six patterns-*.png, generator-real-data.json,
  generator-verification-datasets.json, generator-ui-verification.json, and four
  generator-*.png mobile screenshots.
- dist/: rebuilt production output.

The validated src/generator/*, src/analytics/*, and statistical configuration files
were not modified for Step 6. No dependency was added.

## 3. Exact look-ahead prevention mechanism

For target T, getHistoricalTrainingData filters normalized rows to:

- The same lottery.
- drawDate strictly less than T.drawDate.
- Verified assignment to the historical rule active at T.
- Dates on or after that rule's effectiveFrom.

Only after those filters does it sort newest-first and take exactly 20/50/100 rows.
If fewer are available, the target is excluded. Since T lies before that rule's
exclusive effectiveTo, every selected earlier row is inside the same rule interval.

The resulting training-only array is the sole drawing input to Step 5
prepareGenerator. Its asOfDate is T, to resolve historical rule metadata, but the
array never contains T or later rows. The full archive and actual target numbers
are not passed to generator or scoring functions. An additional engine assertion
checks the prepared context has the exact required count and all dates < T.

That one prepared context supplies frequency, recent counts, gap/classifications,
pairs, pattern distributions, Balanced sampling, Trend Weighted weights, and
Pattern Score reference data. It is reused for all strategies. Target winning
numbers enter only the separate match calculation after generation.

## 4. Historical rule handling

getCurrentRuleSet(lottery, target.drawDate) resolves the verified rule active on the
historical date. Target ruleVerification and ruleSetId must agree. Missing or
unverified configuration yields the exact reason:

“Excluded — unverified historical rule set”

Training never borrows from an earlier rule era. This preserves the Step 5 selection
semantics and avoids mixing incompatible ranges. A target at the beginning of an
era is skipped until a complete same-era training window exists, with reason
“Excluded — insufficient prior history” and available/required counts.

Actual historical-rule verification also passed:

| Lottery | Target | Rule | Main range | Special range | Generated |
|---|---|---|---|---|---:|
| Powerball | 2015-10-03 | pb-2012 | 1–59 | 1–35 | 30 |
| Mega Millions | 2025-04-04 | mm-2017 | 1–70 | 1–25 | 30 |

No today's-range substitution occurred. Invalid normalized records, duplicate dates,
mixed lotteries, and out-of-rule numbers fail visibly rather than enter analytics.

## 5. Seeded RNG implementation

Version: step6-v1.

Each target/strategy batch has this stable JSON seed:

`[version, lotteryId, targetDate, strategy, trainingWindow, combinationsPerTarget]`

The string is hashed using 32-bit FNV-1a: initial state 2166136261; for each UTF-16
code unit, XOR then Math.imul by 16777619, unsigned 32-bit. Mulberry32 expands it:
add 0x6D2B79F5 to the 32-bit state and perform the standard xor-shift/Math.imul mixing;
the unsigned result divided by 2^32 is in [0, 1).

The RNG is passed directly to Step 5 generateCombinations. Combination order and
retry draws consume that deterministic stream. There is one seed per batch, not
an independent seed per combination. Compare All is not part of the seed, so a
strategy's standalone run matches its Compare All batch. Target-range choice is
also omitted, preserving a shared target's batch across range selections.

Step 5's generatedAt parameter is set deterministically to target-date midnight
UTC; this is simulation metadata, not the actual wall-clock run time. Normal
Generator usage continues using Math.random and real timestamps unchanged.

## 6. Metrics and denominators

Targets Requested = actual archived target records selected by last-N or inclusive
custom date range, on/before asOfDate. If fewer than N exist, a warning reports the
shortfall; no nonexistent drawings are manufactured.

Targets Tested + Targets Excluded = Targets Requested. Exclusions are counted once
per target, not once per strategy. Combinations Generated totals all selected
strategies; skipped targets contribute no combinations.

For each generated combination, main matches = count of generated MAIN numbers
present in target MAIN numbers. Special match = exact equality of the separately
stored special balls. The special ball never contributes to main matches, even if
its numeric value appears in either main pool.

For each strategy, N = that strategy's generated/tested combination count:

- Average Main Numbers Matched = sum of main matches / N.
- Distribution 0–5 = count and count/N × 100 for each exact main-match count.
- Special Ball Matches = count and count/N × 100.
- At Least 2/3/4 Main = threshold count and count/N × 100.
- Comparison shows average, 2+/3+/4+ percentages, 5-main count, special percentage,
  and total combinations. All columns use their own displayed N.

A zero denominator displays “—” for percentages and averages, with zero counts.
Percentages display two decimals, averages four decimals. Full precision is retained
in the result. Each target occurrence is a separate trial; the same combination on
different target dates is permitted. Duplicate complete combinations within one
batch use the unchanged Step 5 canonical Set/retry guard.

## 7. Tests passed

59/59 unit tests: 19 new backtest tests and all 40 existing Step 2–5 tests.

New coverage: strict target/future exclusion; exact 20/50/100 windows; valid-history
filtering; insufficient/empty history; historical ranges; era boundary; missing and
unverified rules; seeded determinism; independent main/special matches; full-result
replay; all three strategy paths; standalone/Compare All parity; unique batches;
unchanged generations/scores after target/future poisoning; no engine fetch calls;
progress/cancellation; invalid ranges and malformed input.

All existing live regression scripts passed:

- verifyLiveData.mjs
- verifyLiveAnalysis.mjs
- verifyLivePatterns.mjs
- verifyLiveGenerator.mjs

Existing browser regressions passed: 48 Dashboard/Number Analysis/pattern cases and
48 Generator cases, including Saved Combinations, storage reload, deletion, and
mobile overflow. New Backtest UI verification passed as described below.

## 8. Independent anti-look-ahead audit

Each row below used exactly 100 training drawings, all three strategies, and
10 generated combinations per strategy. Every MAX(training date) is strictly
less than target date.

| Lottery | Target date | First training date | Last training date | Strategies | Mismatches |
|---|---|---|---|---:|---:|
| Powerball | 2026-08-12 | 2025-12-22 | 2026-08-10 | 3 | 0 |
| Powerball | 2026-09-02 | 2026-01-12 | 2026-08-31 | 3 | 0 |
| Powerball | 2026-09-26 | 2026-02-04 | 2026-09-23 | 3 | 0 |
| Mega Millions | 2026-07-21 | 2025-08-05 | 2026-07-17 | 3 | 0 |
| Mega Millions | 2026-08-21 | 2025-09-05 | 2026-08-18 | 3 | 0 |
| Mega Millions | 2026-09-25 | 2025-10-10 | 2026-09-22 | 3 | 0 |

Independent raw-data calculations matched every training date, main/special
appearance and recent count, frequency, gap, last appearance, Hot/Cold/Overdue
label, unordered pair, odd/even count, low/high count, sum distribution, consecutive
count, score-reference sum/spacing bin, and normalized trend weight.

All 180 generated Pattern Scores and components across those targets matched the
independent Step 5 reference scorer. Replacing ALL target/future numbers with other
valid numbers left every generated combination, score, and component unchanged
for each of the three strategies. Actual match outcomes may change, as expected.
No target or future drawing enters any generator-side reference data.

Evidence: tests/verifyLiveBacktest.mjs and artifacts/backtest-real-data.json.
The independent summary does not call the production match/summary helpers. The
independent scorer does not call production selection/structure/scoring helpers.

## 9. Independent Powerball verification

Fresh NY Open Data archive: 1,998 drawings, through 2026-09-26.
Configuration: Previous 100 / Last 20 targets / 10 combinations / Compare All.
Target dates: 2026-08-12 through 2026-09-26.

20 requested, 20 tested, 0 excluded, 600 total combinations; 200 per strategy.
Independent target count, combination count, every match count, average, threshold,
exact-match histogram, and special count matched. Zero mismatches.

## 10. Independent Mega Millions verification

Fresh NY Open Data archive: 2,540 drawings, through 2026-09-25.
Configuration: Previous 100 / Last 20 targets / 10 combinations / Compare All.
Target dates: 2026-07-21 through 2026-09-25.

20 requested, 20 tested, 0 excluded, 600 total combinations; 200 per strategy.
Independent target count, combination count, every match count, average, threshold,
exact-match histogram, and special count matched. Zero mismatches.

## 11. Observed strategy results

Every row's denominator is 200 generated combinations. Random is the baseline.

| Lottery | Strategy | Average main | 2+ main | 3+ main | 4+ main | 5 main | Special match |
|---|---|---:|---:|---:|---:|---:|---:|
| Powerball | Random | 0.3950 | 5 (2.50%) | 0 (0.00%) | 0 (0.00%) | 0 | 5 (2.50%) |
| Powerball | Balanced | 0.3500 | 8 (4.00%) | 2 (1.00%) | 0 (0.00%) | 0 | 11 (5.50%) |
| Powerball | Trend Weighted | 0.3550 | 8 (4.00%) | 2 (1.00%) | 0 (0.00%) | 0 | 12 (6.00%) |
| Mega Millions | Random | 0.2950 | 6 (3.00%) | 0 (0.00%) | 0 (0.00%) | 0 | 10 (5.00%) |
| Mega Millions | Balanced | 0.3250 | 8 (4.00%) | 1 (0.50%) | 0 (0.00%) | 0 | 9 (4.50%) |
| Mega Millions | Trend Weighted | 0.3300 | 8 (4.00%) | 0 (0.00%) | 0 (0.00%) | 0 | 12 (6.00%) |

Exact main-match distributions, ordered 0/1/2/3/4/5:

| Lottery | Random | Balanced | Trend Weighted |
|---|---|---|---|
| Powerball | 126 / 69 / 5 / 0 / 0 / 0 | 140 / 52 / 6 / 2 / 0 / 0 | 139 / 53 / 6 / 2 / 0 / 0 |
| Mega Millions | 147 / 47 / 6 / 0 / 0 / 0 | 144 / 48 / 7 / 1 / 0 / 0 | 142 / 50 / 8 / 0 / 0 / 0 |

Backtesting compares how generation strategies behaved against historical drawings
using only information available before each drawing. Historical backtest results
do not indicate future winning probability. No significance testing was performed;
no strategy is labelled a winner, best, superior, or recommended.

## 12. Reproducibility verification

Both real-data representative runs were executed twice and full results deep-compared:
identical targets, exclusions, training dates, seeds, generated combinations,
generation-time Pattern Scores/components, match outcomes, summaries, and metadata.
Unit tests also confirm input order and scheduler changes do not change results,
and standalone strategy output equals its corresponding Compare All output.

## 13. Mobile and performance verification

Both lotteries at 320px and 390px passed: no horizontal PAGE overflow. Comparison
tables scroll inside their own keyboard-focusable container. Target detail cards,
lottery balls, scores, training date audit, and strategy batches remain readable.
Target lists paginate in groups of 10, with combinations mounted only on expansion.
Screenshots were captured for each lottery/width; 320px Powerball details and
390px Mega Millions comparison were visually inspected.

All displayed comparison/summary values and the first target's 30 combination
match/score values were checked against independently verified real-data results.
Additional checks passed for individual strategies, all training-window sizes,
all combination sizes across the tests, last-20/50/100 ranges, custom era-boundary
exclusions, invalid custom dates, no automatic run, no backtest API requests,
pagination, and cancellation. An initial test assertion ran before the native
<details> toggle rendered lazy content; the test now waits for that content.

The specified 100 targets × 3 strategies × 20 combinations workload produced 6,000
combinations with event-loop heartbeats continuing throughout. Initial measured
run: 6.248 seconds, 363 heartbeat ticks, maximum gap 85.3 ms. Processing yields
before work, after each target/strategy batch, and after each target. Cancellation
is checked at those boundaries. The final rerun measurement is recorded in
artifacts/backtest-ui-verification.json; timings are machine/run dependent.

## 14. Build

npm run build passed: TypeScript plus Vite production build (54 modules).

## 15. Lint

npm run lint passed with no findings.

## 16. Remaining limitations and scope

- A single reproducible seeded run measures historical behavior; it is not a
  statistical significance test, confidence interval, or predictive claim.
- Full same-era training is required. Early targets after rule changes are excluded
  even if the previous era contains ample drawings. This is explicit in the UI.
- Multi-era custom ranges can aggregate trials with different historical pool sizes;
  target details expose those rules. No era-normalized significance analysis is added.
- Reproduction requires identical normalized data, generator/scoring code, rule
  configuration, and backtest version. Archive corrections can change results.
- Existing generator retry-limit errors abort a run visibly rather than silently
  drop a strategy's batch and break comparison parity.
- Large custom ranges take more time and memory. Chunking, progress, cancellation,
  lazy details, and pagination keep the requested workload responsive; there is no
  persistent job queue. Navigating away cancels the current run.
- Backtest results live in page memory and reset on navigation, dataset refresh,
  or settings changes. Existing Generator saves still use localStorage unchanged.
- RNG is deterministic simulation randomness, not cryptographic randomness.
- No automated scheduling, backend/database, purchasing, or significance testing
  was added. No statistical formula was changed to improve observed results.

Stopped after Step 6; further work awaits approval.
