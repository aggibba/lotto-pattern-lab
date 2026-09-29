// Uses the Vite development server to load the real boundary in an isolated root.
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
const { chromium } = createRequire(import.meta.url)('playwright')
const browser = await chromium.launch({ headless: true, channel: 'msedge' })
try {
  const page = await browser.newPage()
  await page.goto(process.env.APP_URL ?? 'http://127.0.0.1:5173')
  await page.evaluate(async () => {
    const ReactModule = await import('/node_modules/.vite/deps/react.js')
    const React = ReactModule.default ?? ReactModule
    const domModule = await import('/node_modules/.vite/deps/react-dom_client.js')
    const { createRoot } = domModule.default ?? domModule
    const { ErrorBoundary } = await import('/src/components/ErrorBoundary.tsx')
    const host = document.createElement('div'); host.id = 'boundary-test'; document.body.append(host)
    const root = createRoot(host)
    function Broken() { throw new Error('Private implementation details') }
    root.render(React.createElement(ErrorBoundary, { resetKey: 'broken' }, React.createElement(Broken)))
    window.recoverBoundary = () => root.render(React.createElement(ErrorBoundary, { resetKey: 'healthy' }, React.createElement('p', null, 'Healthy page')))
  })
  await page.locator('#boundary-test').getByRole('alert').waitFor()
  assert.ok(!(await page.locator('#boundary-test').textContent()).includes('Private implementation details'))
  await page.evaluate(() => window.recoverBoundary())
  await page.locator('#boundary-test').getByText('Healthy page').waitFor()
  console.log('PASS: real render failure shows safe fallback; changing page recovers; internal error text is hidden.')
} finally { await browser.close() }
