import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mkdir, writeFile } from 'node:fs/promises'
import { lotteries } from '../src/config/lotteries.ts'
import { fetchLotteryDataset } from '../src/services/nyOpenData.ts'

// Resolve locally installed Playwright, or a supplied NODE_PATH runtime.
const { chromium } = createRequire(import.meta.url)('playwright')
const asOfDate = new Date().toISOString().slice(0, 10)
const datasets = new Map()
for (const lottery of Object.values(lotteries)) datasets.set(lottery.id, await fetchLotteryDataset(lottery))
const browser = await chromium.launch({ headless: true, channel: 'msedge' })
const report = []
const errors = []
await mkdir('artifacts', { recursive: true })
try {
  const page = await browser.newPage({ locale: 'en-US' })
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(process.env.APP_URL ?? 'http://127.0.0.1:5173')
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 900 })
    for (const lottery of Object.values(lotteries)) {
      await page.getByLabel('LOTTERY', { exact: true }).selectOption(lottery.id)
      await page.locator('#common-pairs tbody tr').first().waitFor({ timeout: 60000 })
      const rule = lottery.ruleSets.find(r => r.effectiveFrom <= asOfDate && (!r.effectiveTo || asOfDate < r.effectiveTo))
      const eligible = datasets.get(lottery.id).drawings.filter(d => d.ruleVerification === 'verified' && d.ruleSetId === rule.id && d.drawDate <= asOfDate).sort((a, b) => b.drawDate.localeCompare(a.drawDate))
      for (const screen of ['Dashboard', 'Number Analysis']) {
        await page.getByRole('button', { name: screen, exact: true }).click()
        for (const period of ['20', '50', '100', 'current-era']) {
          await page.getByLabel('Analysis Period', { exact: true }).selectOption(period)
          const selected = period === 'current-era' ? eligible : eligible.slice(0, Number(period))
          const n = selected.length
          const row = (label, count) => [label, count.toLocaleString('en-US'), `${(count / n * 100).toFixed(2)}%`]
          // Deliberately do not import production aggregation or period selection.
          const pairs = []
          for (let a = rule.mainBallMin; a <= rule.mainBallMax; a++) for (let b = a + 1; b <= rule.mainBallMax; b++) {
            const count = selected.filter(d => d.mainNumbers.includes(a) && d.mainNumbers.includes(b)).length
            if (count) pairs.push({ a, b, count })
          }
          pairs.sort((a, b) => b.count - a.count || a.a - b.a || a.b - b.b)
          const expected = [pairs.slice(0, 20).map(p => row(`${p.a} + ${p.b}`, p.count))]
          const lowMax = Math.floor((rule.mainBallMin + rule.mainBallMax) / 2)
          for (const kind of ['odd', 'low']) expected.push(Array.from({ length: 6 }, (_, k) => row(`${k} ${kind} / ${5 - k} ${kind === 'odd' ? 'even' : 'high'}`, selected.filter(d => d.mainNumbers.filter(v => kind === 'odd' ? v % 2 : v <= lowMax).length === k).length)))
          const sums = selected.map(d => d.mainNumbers.reduce((a, b) => a + b, 0))
          expected.push([...new Set(sums)].sort((a, b) => a - b).map(sum => row(String(sum), sums.filter(v => v === sum).length)))
          const consecutive = selected.filter(d => d.mainNumbers.some(v => d.mainNumbers.includes(v + 1))).length
          expected.push([row('Included', consecutive), row('Not included', n - consecutive)])
          const actual = await page.locator('.pattern-table').evaluateAll(tables => tables.map(table => [...table.querySelectorAll('tbody tr')].map(tr => [...tr.children].map(cell => cell.textContent))))
          assert.deepEqual(actual, expected, `${width}/${lottery.id}/${screen}/${period}`)
          const denominators = await page.locator('.pattern-denominator').allTextContents()
          assert.equal(denominators.length, 2)
          assert.ok(denominators.every(text => text.includes(`${n.toLocaleString('en-US')} selected drawings`)))
          assert.ok((await page.getByRole('region', { name: 'Low / high composition', exact: true }).locator('..').textContent()).includes(`Low: 1–35; High: 36–${rule.mainBallMax}`))
          assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Page overflow at ${width}`)
          assert.ok(await page.locator('.pattern-table').evaluateAll(tables => tables.every(t => t.scrollWidth <= t.parentElement.clientWidth + 1)), `Pattern table clipped at ${width}`)
          report.push({ width, lottery: lottery.id, screen, period, drawings: n, topPair: expected[0][0], status: 'all displayed rows matched independent calculation' })
        }
      }
      await page.locator('.pattern-panels').screenshot({ path: `artifacts/patterns-${lottery.id}-${width}.png` })
    }
  }
  assert.deepEqual(errors, [])
  await writeFile('artifacts/pattern-ui-verification.json', JSON.stringify({ asOfDate, sources: [...datasets.values()].map(d => ({ lottery: d.lotteryId, dataThrough: d.dataThrough, retrievedAt: d.retrievedAt })), report }, null, 2))
  console.log(`PASS: ${report.length} viewport/lottery/screen/period combinations; all displayed rows, denominators, boundaries and overflow checks; no browser errors.`)
} finally {
  await browser.close()
}
