import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFile, writeFile } from 'node:fs/promises'
const { chromium } = createRequire(import.meta.url)('playwright')
const reference = JSON.parse(await readFile('artifacts/backtest-real-data.json', 'utf8'))
const browser = await chromium.launch({ headless: true, channel: 'msedge' })
const report = [], errors = [], requests = []
try {
  const page = await browser.newPage({ locale: 'en-US' })
  page.on('pageerror', e => errors.push(e.message))
  page.on('request', r => { if (r.url().includes('data.ny.gov')) requests.push(r.url()) })
  await page.goto(process.env.APP_URL ?? 'http://127.0.0.1:5173')
  await page.getByRole('button', { name: 'Backtest', exact: true }).click()
  await page.waitForFunction(() => !document.querySelector('.backtest-controls button')?.disabled)
  assert.equal(await page.getByRole('region', { name: 'Backtest results', exact: true }).count(), 0, 'No automatic run')
  async function run() {
    await page.getByRole('button', { name: 'RUN BACKTEST', exact: true }).click()
    await page.getByRole('region', { name: 'Backtest results', exact: true }).waitFor({ timeout: 120000 })
  }
  async function noOverflow() {
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Page overflow')
    assert.ok(await page.locator('.backtest-target, .backtest-combination').evaluateAll(items => items.every(i => i.scrollWidth <= i.clientWidth + 1)), 'Target detail overflow')
  }
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 900 })
    for (const lottery of ['powerball', 'mega-millions']) {
      await page.getByLabel('Backtest Lottery', { exact: true }).selectOption(lottery)
      await page.waitForFunction(() => !document.querySelector('.backtest-controls button')?.disabled)
      await page.getByLabel('Backtest Strategy', { exact: true }).selectOption('Compare All')
      await page.getByLabel('Historical analysis window', { exact: true }).selectOption('100')
      await page.getByLabel('Combinations per historical drawing', { exact: true }).selectOption('10')
      await page.getByLabel('Backtest range', { exact: true }).selectOption('20')
      const before = requests.length
      await run()
      assert.equal(requests.length, before, 'Backtesting must not refetch')
      const expected = reference.report.find(r => r.lottery === lottery).result
      const totals = await page.locator('.backtest-totals .metric').allTextContents()
      assert.deepEqual(totals, ['20', '20', '0', '600'])
      const table = await page.locator('.backtest-comparison tbody tr').evaluateAll(rows => rows.map(r => [...r.querySelectorAll('td')].map(c => c.textContent)))
      const pct = (n, total) => `${(n / total * 100).toFixed(2)}%`
      assert.deepEqual(table, [expected.summaries.map(s => s.averageMainMatches.toFixed(4)), expected.summaries.map(s => pct(s.atLeast2, s.combinations)), expected.summaries.map(s => pct(s.atLeast3, s.combinations)), expected.summaries.map(s => pct(s.atLeast4, s.combinations)), expected.summaries.map(s => String(s.mainDistribution[5])), expected.summaries.map(s => pct(s.specialMatches, s.combinations)), ['200', '200', '200']])
      for (const summary of expected.summaries) {
        const values = await page.getByRole('region', { name: `${summary.strategy} summary`, exact: true }).locator('dd').allTextContents()
        assert.deepEqual(values, [summary.averageMainMatches.toFixed(4), ...summary.mainDistribution.map(n => `${n} (${pct(n, 200)})`), ...[summary.specialMatches, summary.atLeast2, summary.atLeast3, summary.atLeast4].map(n => `${n} (${pct(n, 200)})`)])
      }
      await page.locator('.backtest-target').first().locator('summary').first().click()
      const cards = page.locator('.backtest-target').first().locator('.backtest-combination')
      await cards.first().waitFor()
      assert.equal(await cards.count(), 30)
      const allExpected = expected.targets[0].batches.flatMap(b => b.combinations)
      const displayed = await cards.allTextContents()
      allExpected.forEach((m, i) => {
        assert.ok(displayed[i].includes(`Main Matches: ${m.mainMatches}`))
        assert.ok(displayed[i].includes(`Special Ball Match: ${m.specialMatch ? 'Yes' : 'No'}`))
        assert.ok(displayed[i].includes(`${m.generated.score.toFixed(2)} / 100`))
      })
      await noOverflow()
      await page.locator('.backtest-table-scroll').screenshot({ path: `artifacts/backtest-comparison-${lottery}-${width}.png` })
      await page.locator('.backtest-target').first().locator('summary').first().scrollIntoViewIfNeeded()
      await page.screenshot({ path: `artifacts/backtest-details-${lottery}-${width}.png` })
      await page.getByRole('button', { name: 'Next targets' }).click()
      assert.ok((await page.locator('.backtest-target').first().textContent()).includes(expected.targets[10].target.drawDate))
      report.push({ width, lottery, config: 'Previous 100 / Last 20 / 10 / Compare All', matchesIndependentReference: true, overflow: false, details: 30, pagination: true })
    }
  }
  // Additional controls, single strategies, and shortened/no-history custom ranges.
  for (const [strategy, window, count, range] of [['Random', '20', '1', '50'], ['Balanced', '50', '5', '20'], ['Trend Weighted', '100', '20', '100']]) {
    await page.getByLabel('Backtest Strategy', { exact: true }).selectOption(strategy)
    await page.getByLabel('Historical analysis window', { exact: true }).selectOption(window)
    await page.getByLabel('Combinations per historical drawing', { exact: true }).selectOption(count)
    await page.getByLabel('Backtest range', { exact: true }).selectOption(range)
    await run(); await noOverflow()
    assert.equal(await page.locator('.backtest-strategy-summary').count(), 1)
    report.push({ strategy, window, count, range, status: 'single-strategy controls passed' })
  }
  await page.getByLabel('Backtest range', { exact: true }).selectOption('custom')
  await page.getByLabel('Start date', { exact: true }).fill('2025-04-08')
  await page.getByLabel('End date', { exact: true }).fill('2025-04-11')
  await run()
  assert.deepEqual(await page.locator('.backtest-totals .metric').allTextContents(), ['2', '0', '2', '0'])
  await page.locator('.backtest-exclusions summary').click()
  assert.match(await page.locator('.backtest-exclusions').textContent(), /insufficient prior history/)
  await noOverflow()
  await page.getByLabel('Start date', { exact: true }).fill('2026-09-28')
  await page.getByLabel('End date', { exact: true }).fill('2026-09-01')
  await page.getByRole('button', { name: 'RUN BACKTEST', exact: true }).click()
  await page.getByRole('alert').filter({ hasText: 'Custom dates' }).waitFor()
  // Full specified workload: 100 × 3 × 20. Measure heartbeat gaps during processing.
  await page.getByLabel('Backtest Lottery', { exact: true }).selectOption('powerball')
  await page.getByLabel('Backtest Strategy', { exact: true }).selectOption('Compare All')
  await page.getByLabel('Historical analysis window', { exact: true }).selectOption('100')
  await page.getByLabel('Backtest range', { exact: true }).selectOption('100')
  await page.getByLabel('Combinations per historical drawing', { exact: true }).selectOption('20')
  await page.evaluate(() => { window.backtestTicks = []; let last = performance.now(); window.backtestTimer = setInterval(() => { const now = performance.now(); window.backtestTicks.push(now - last); last = now }, 10) })
  const started = Date.now()
  await run()
  const elapsedMs = Date.now() - started
  const heartbeat = await page.evaluate(() => { clearInterval(window.backtestTimer); return { ticks: window.backtestTicks.length, maxGapMs: Math.max(...window.backtestTicks) } })
  assert.deepEqual(await page.locator('.backtest-totals .metric').allTextContents(), ['100', '100', '0', '6,000'])
  assert.ok(heartbeat.ticks > 10, 'Event loop must yield while processing')
  await noOverflow()
  await page.getByRole('button', { name: 'RUN BACKTEST', exact: true }).click()
  await page.getByRole('button', { name: 'Cancel Backtest', exact: true }).click()
  await page.getByRole('alert').filter({ hasText: 'Backtest cancelled.' }).waitFor()
  assert.deepEqual(errors, [])
  await writeFile('artifacts/backtest-ui-verification.json', JSON.stringify({ report, exclusions: true, invalidDates: true, cancellation: true, noAutomaticRun: true, performance: { combinations: 6000, elapsedMs, ...heartbeat }, errors }, null, 2))
  console.log(JSON.stringify({ status: 'PASS', mobileCases: 4, additionalControlCases: 3, elapsedMs, heartbeat, cancellation: true, errors }))
} finally { await browser.close() }
