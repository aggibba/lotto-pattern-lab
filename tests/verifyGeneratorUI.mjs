import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFile, writeFile } from 'node:fs/promises'
import { lotteries } from '../src/config/lotteries.ts'
import { independentScore } from './verifyLiveGenerator.mjs'
const { chromium } = createRequire(import.meta.url)('playwright')
const datasets = JSON.parse(await readFile('artifacts/generator-verification-datasets.json', 'utf8'))
const asOfDate = new Date().toISOString().slice(0, 10)
const browser = await chromium.launch({ headless: true, channel: 'msedge' })
const report = [], errors = [], requests = []
try {
  const page = await browser.newPage()
  page.on('pageerror', e => errors.push(e.message))
  page.on('request', r => { if (r.url().includes('data.ny.gov')) requests.push(r.url()) })
  await page.goto(process.env.APP_URL ?? 'http://127.0.0.1:5173')
  await page.getByRole('button', { name: 'Generate Numbers', exact: true }).click()
  await page.getByRole('button', { name: 'GENERATE NUMBERS', exact: true }).waitFor()
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 900 })
    for (const lottery of Object.values(lotteries)) {
      await page.locator('.generator-controls').getByLabel('Lottery', { exact: true }).selectOption(lottery.id)
      await page.waitForFunction(() => !document.querySelector('.generator-controls button')?.disabled, { timeout: 60000 })
      const loadedRequests = requests.length
      for (const period of ['20', '50', '100', 'current-era']) {
        await page.getByLabel('Analysis Period', { exact: true }).selectOption(period)
        for (const strategy of ['Random', 'Balanced', 'Trend Weighted']) {
          await page.getByLabel('Generation Strategy').selectOption(strategy)
          await page.getByLabel('Number of combinations').selectOption('5')
          await page.getByRole('button', { name: 'GENERATE NUMBERS', exact: true }).click()
          assert.equal(await page.locator('.combination-card').count(), 5)
          const card = page.locator('.combination-card').first()
          await card.getByText('Score Details', { exact: true }).click()
          const main = (await card.locator('.ball-row .lottery-ball').allTextContents()).map(Number)
          const expected = independentScore(main, datasets.find(d => d.lotteryId === lottery.id).drawings, lottery, period, asOfDate)
          assert.equal(await card.locator('h4').textContent(), `Pattern Score: ${expected.score.toFixed(2)} / 100`)
          const scores = await card.locator('.score-breakdown > div').allTextContents()
          expected.components.forEach((v, i) => assert.ok(scores[i].includes(`Score ${v.toFixed(2)} / 100`)))
          await card.getByRole('button', { name: 'Save Combination', exact: true }).click()
          assert.equal(await page.locator('.saved-card').count(), 1)
          await card.getByRole('button', { name: 'Generate Again', exact: true }).click()
          const keys = await page.locator('.combination-card').evaluateAll(cards => cards.map(c => c.querySelector('.ball-row').textContent + '|' + c.querySelector('.special-line').textContent))
          assert.equal(new Set(keys).size, 5)
          assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `overflow ${width}/${lottery.id}/${period}/${strategy}`)
          assert.ok(await page.locator('.ball-row, .score-breakdown, .saved-card').evaluateAll(elements => elements.every(e => e.getBoundingClientRect().right <= innerWidth && e.scrollWidth <= e.clientWidth + 1)))
          if (period === 'current-era' && strategy === 'Trend Weighted') await page.locator('.generator-page').screenshot({ path: `artifacts/generator-${lottery.id}-${width}.png` })
          await page.getByRole('button', { name: 'Delete saved combination' }).click()
          assert.equal(await page.locator('.saved-card').count(), 0)
          report.push({ width, lottery: lottery.id, period, strategy, displayedScore: expected.score, status: 'score independently matched; generate, details, save, regenerate, delete, overflow passed' })
        }
      }
      assert.equal(requests.length, loadedRequests, 'Changing analysis period must not refetch')
    }
  }
  const requestsBefore = requests.length
  await page.locator('.generator-controls').getByLabel('Lottery', { exact: true }).selectOption('powerball')
  await page.getByRole('button', { name: 'GENERATE NUMBERS', exact: true }).click()
  await page.locator('.combination-card').first().getByRole('button', { name: 'Save Combination', exact: true }).click()
  assert.equal(requests.length, requestsBefore, 'Switching back to a loaded lottery must not refetch')
  await page.reload()
  await page.getByRole('button', { name: 'Generator', exact: true }).click()
  assert.equal(await page.locator('.saved-card').count(), 1)
  await page.getByRole('button', { name: 'Delete saved combination' }).click()
  // Reload requests are expected; switching to an already loaded lottery before reload was served by session cache.
  assert.ok(requestsBefore > 0)
  assert.deepEqual(errors, [])
  await writeFile('artifacts/generator-ui-verification.json', JSON.stringify({ asOfDate, report, errors, persistedAcrossReload: true }, null, 2))
  console.log(`PASS: ${report.length} mobile lottery/period/strategy checks; independent displayed scores, storage persistence, no page overflow or browser errors.`)
} finally { await browser.close() }
