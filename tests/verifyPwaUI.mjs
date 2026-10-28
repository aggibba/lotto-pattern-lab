import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFile, writeFile } from 'node:fs/promises'
const { chromium } = createRequire(import.meta.url)('playwright')
const url = process.env.APP_URL ?? 'http://127.0.0.1:4180'
const browser = await chromium.launch({ headless: true, channel: 'msedge' })
try {
  const context = await browser.newContext()
  const page = await context.newPage()
  const errors = []; page.on('pageerror', e => errors.push(e.message))
  await page.goto(url)
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload()
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null)
  const manifest = await (await page.request.get(`${url}/manifest.webmanifest`)).json()
  assert.equal(manifest.name, 'Lotto Pattern Lab'); assert.equal(manifest.short_name, 'Lotto Lab')
  assert.equal(manifest.display, 'standalone'); assert.equal(manifest.start_url, '/')
  assert.ok(manifest.icons.some(i => i.purpose === 'maskable'))
  for (const icon of [...manifest.icons, { src: '/apple-touch-icon.png', sizes: '180x180' }]) {
    const response = await page.request.get(url + icon.src), png = await response.body()
    assert.equal(response.status(), 200)
    assert.equal(`${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`, icon.sizes)
  }
  const ready = () => page.waitForFunction(() => document.querySelector('.source-details')?.textContent.includes('historical drawings loaded'), null, { timeout: 60000 })
  for (const lottery of ['powerball', 'mega-millions']) { await page.locator('#lottery').selectOption(lottery); await ready() }
  await page.evaluate(() => localStorage.setItem('pwa-preservation-test', 'keep'))
  await context.setOffline(true)
  await page.reload(); await ready()
  await page.getByRole('alert').filter({ hasText: 'previously saved archive' }).waitFor()
  await page.getByText('You are offline.', { exact: false }).waitFor()
  for (const lottery of ['powerball', 'mega-millions']) {
    await page.locator('#lottery').selectOption(lottery); await ready()
    await page.getByRole('button', { name: 'History', exact: true }).click()
    assert.equal(await page.locator('.history-card tbody tr').count(), 25)
    await page.getByRole('button', { name: 'Refresh Data', exact: true }).click(); await ready()
    await page.getByRole('alert').filter({ hasText: 'previously saved archive' }).waitFor()
  }
  assert.equal(await page.evaluate(() => localStorage.getItem('pwa-preservation-test')), 'keep')
  const keys = await page.evaluate(async () => (await caches.keys()).filter(k => k.startsWith('workbox')).flatMap(k => [k]))
  assert.ok(keys.length)
  const cachedUrls = await page.evaluate(async () => (await Promise.all((await caches.keys()).map(async k => (await (await caches.open(k)).keys()).map(r => r.url)))).flat())
  assert.ok(!cachedUrls.some(u => u.includes('data.ny.gov')), 'No API pages or error responses cached by SW')
  await page.evaluate(() => caches.delete('lotto-validated-archives-v1'))
  await page.reload()
  await page.getByRole('alert').filter({ hasText: 'Offline' }).waitFor()
  assert.equal(await page.locator('.combination-card').count(), 0)
  await context.setOffline(false)
  await page.getByRole('button', { name: 'Retry loading' }).click(); await ready()
  await page.evaluate(() => {
    const event = new Event('beforeinstallprompt', { cancelable: true })
    event.prompt = async () => { window.installRequested = true }
    event.userChoice = Promise.resolve({ outcome: 'accepted' })
    window.dispatchEvent(event)
  })
  await page.getByText('Install Lotto Lab', { exact: true }).click()
  await page.getByRole('button', { name: 'Install app', exact: true }).click()
  assert.equal(await page.evaluate(() => window.installRequested), true)
  await page.evaluate(() => window.dispatchEvent(new Event('appinstalled')))
  assert.equal(await page.locator('.install-help').count(), 0)
  const ios = await browser.newContext({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1', viewport: { width: 390, height: 844 } })
  const iosPage = await ios.newPage(); await iosPage.goto(url)
  await iosPage.getByText('Install Lotto Lab', { exact: true }).click()
  await iosPage.getByText('In Safari: Share > Add to Home Screen.', { exact: false }).waitFor()
  await iosPage.addInitScript(() => Object.defineProperty(navigator, 'standalone', { value: true }))
  await iosPage.reload(); assert.equal(await iosPage.locator('.install-help').count(), 0)
  await ios.close()
  // Exercise a real waiting worker using a temporary change to generated output only.
  const sw = await readFile('dist/sw.js', 'utf8')
  try {
    await writeFile('dist/sw.js', `${sw}\n// update verification ${Date.now()}\n`)
    await page.evaluate(async () => (await navigator.serviceWorker.getRegistration()).update())
    await page.getByRole('button', { name: 'Update and reload' }).waitFor({ timeout: 30000 })
    await Promise.all([page.waitForEvent('load'), page.getByRole('button', { name: 'Update and reload' }).click()])
    assert.equal(await page.evaluate(() => localStorage.getItem('pwa-preservation-test')), 'keep')
  } finally { await writeFile('dist/sw.js', sw) }
  assert.deepEqual(errors, [])
  console.log('PASS: manifest/icons, controlling SW, warm/cold offline reload, both archives, online recovery, storage preservation, install UX, iOS guidance/standalone hiding, and real SW update.')
} finally { await browser.close() }
