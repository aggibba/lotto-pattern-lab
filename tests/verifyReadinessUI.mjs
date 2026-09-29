import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { writeFile, mkdir } from 'node:fs/promises'
const { chromium } = createRequire(import.meta.url)('playwright')
const browser = await chromium.launch({ headless: true, channel: 'msedge' })
const report = [], errors = []
await mkdir('artifacts', { recursive: true })
try {
  const page = await browser.newPage({ locale: 'en-US' })
  page.on('pageerror', e => errors.push(e.message))
  let requests = 0
  page.on('request', r => { if (r.url().includes('data.ny.gov')) requests++ })
  await page.goto(process.env.APP_URL ?? 'http://127.0.0.1:5173')
  const ready = () => page.waitForFunction(() => document.querySelector('.source-details')?.textContent.includes('historical drawings loaded'), null, { timeout: 60000 })
  await ready()
  await page.keyboard.press('Tab')
  assert.equal(await page.locator(':focus').textContent(), 'Skip to main content')
  await page.keyboard.press('Enter')
  assert.equal(await page.locator(':focus').getAttribute('id'), 'dashboard')
  assert.equal(await page.title(), 'Lotto Pattern Lab')
  assert.equal((await page.request.get(new URL('/favicon.svg', page.url()).href)).status(), 200)
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 900 })
    for (const lottery of ['powerball', 'mega-millions']) {
      await page.locator('#lottery').selectOption(lottery)
      for (const name of ['Dashboard', 'Number Analysis', 'Generator', 'Backtest', 'History', 'Settings']) {
        await page.getByRole('button', { name, exact: true }).click()
        if (name !== 'Settings') await ready()
        if (name === 'Generator') {
          await page.getByRole('button', { name: 'GENERATE NUMBERS', exact: true }).click()
          await page.locator('.combination-card').first().locator('summary').click()
        }
        if (name === 'Backtest') {
          await page.getByRole('button', { name: 'RUN BACKTEST', exact: true }).click()
          await page.getByRole('region', { name: 'Backtest results', exact: true }).waitFor({ timeout: 120000 })
          await page.locator('.backtest-target').first().locator('summary').first().click()
          await page.locator('.backtest-combination').first().waitFor()
        }
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${name}/${lottery}/${width} overflow`)
        await page.screenshot({ path: `artifacts/readiness-${lottery}-${name.replaceAll(' ', '-')}-${width}.png`, fullPage: true })
        report.push({ width, lottery, page: name, overflow: false })
      }
    }
  }
  await page.getByRole('button', { name: 'History', exact: true }).click(); await ready()
  const first = await page.locator('.history-card tbody th').first().textContent()
  const before = requests
  await page.getByRole('button', { name: 'Next drawings' }).click()
  assert.notEqual(await page.locator('.history-card tbody th').first().textContent(), first)
  await page.getByLabel('Sort', { exact: true }).selectOption('oldest')
  assert.equal(await page.locator('.history-card tbody th').first().textContent(), '2002-05-17')
  assert.equal(requests, before, 'Pagination/sort must use loaded archive')
  await page.getByRole('button', { name: 'Refresh Data', exact: true }).click(); await ready()
  assert.ok(requests > before, 'Refresh must reload source')
  await page.route('https://data.ny.gov/**', route => route.fulfill({ status: 503, body: 'Unavailable' }))
  await page.getByRole('button', { name: 'Refresh Data', exact: true }).click()
  await page.getByRole('alert').filter({ hasText: 'HTTP 503' }).waitFor()
  assert.equal(await page.locator('.history-card tbody tr').count(), 0)
  await page.unroute('https://data.ny.gov/**')
  await page.getByRole('button', { name: 'Retry loading' }).click(); await ready()
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await page.getByLabel('Default Lottery', { exact: true }).selectOption('mega-millions')
  await page.getByLabel('Default Analysis Period').selectOption('50')
  await page.getByLabel('Default Generator Strategy').selectOption('Balanced')
  await page.getByLabel('Default combinations').selectOption('10')
  await page.getByRole('button', { name: 'Save Settings' }).click()
  await page.reload(); await ready()
  assert.equal(await page.locator('#lottery').inputValue(), 'mega-millions')
  assert.equal(await page.getByLabel('Analysis Period', { exact: true }).inputValue(), '50')
  await page.getByRole('button', { name: 'Generator', exact: true }).click()
  assert.equal(await page.getByLabel('Generation Strategy').inputValue(), 'Balanced')
  assert.equal(await page.getByLabel('Number of combinations').inputValue(), '10')
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await page.getByRole('button', { name: 'Reset to Defaults' }).click()
  assert.equal(await page.getByLabel('Default Lottery', { exact: true }).inputValue(), 'powerball')
  await page.evaluate(() => { localStorage.setItem('lotto-pattern-lab.settings.v1', '{'); localStorage.setItem('lotto-pattern-lab.saved.v1', '{') })
  await page.reload(); await ready()
  assert.ok((await page.getByRole('alert').allTextContents()).some(t => t.includes('stored settings')))
  await page.getByRole('button', { name: 'Generator', exact: true }).click()
  assert.ok((await page.getByRole('alert').allTextContents()).some(t => t.includes('saved combinations')))
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await page.evaluate(() => { Storage.prototype.setItem = () => { throw new Error('Quota exceeded') } })
  await page.getByRole('button', { name: 'Save Settings' }).click()
  await page.getByRole('alert').filter({ hasText: 'could not be saved' }).waitFor()
  assert.deepEqual(errors, [])
  await writeFile('artifacts/readiness-ui-verification.json', JSON.stringify({ report, errors, historyCache: true, refreshRecovery: true, settingsPersistence: true, storageCorruption: true, storageWriteFailure: true }, null, 2))
  console.log(`PASS: ${report.length} page/lottery/viewport cases; history cache, refresh/failure/retry, settings persistence/reset, corrupt storage and write failure; no page errors.`)
} finally { await browser.close() }
