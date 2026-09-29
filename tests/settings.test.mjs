import test from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_SETTINGS, deserializeSettings, serializeSettings, readSettings } from '../src/config/settings.ts'

test('settings defaults and supported preferences round trip', () => {
  assert.deepEqual(deserializeSettings(null), DEFAULT_SETTINGS)
  for (const lottery of ['powerball', 'mega-millions']) for (const period of ['20', '50', '100', 'current-era']) for (const strategy of ['Random', 'Balanced', 'Trend Weighted']) for (const count of [1, 5, 10, 20]) {
    const settings = { lottery, period, strategy, count }
    assert.deepEqual(deserializeSettings(serializeSettings(settings)), settings)
  }
})
test('malformed, old, missing, and invalid settings are rejected', () => {
  for (const text of ['{', 'null', '[]', '{}', JSON.stringify({ version: 0, settings: DEFAULT_SETTINGS })]) assert.throws(() => deserializeSettings(text))
  for (const [key, value] of [['lottery', '__proto__'], ['period', 'all'], ['strategy', 'Predict'], ['count', 2], ['count', '5'], ['lottery', null]]) assert.throws(() => serializeSettings({ ...DEFAULT_SETTINGS, [key]: value }))
  for (const key of Object.keys(DEFAULT_SETTINGS)) { const partial = { ...DEFAULT_SETTINGS }; delete partial[key]; assert.throws(() => serializeSettings(partial)) }
})
test('unavailable browser storage falls back safely', () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('Access denied') } })
  try { assert.deepEqual(readSettings().settings, DEFAULT_SETTINGS); assert.ok(readSettings().error) }
  finally { if (previous) Object.defineProperty(globalThis, 'localStorage', previous); else delete globalThis.localStorage }
})
