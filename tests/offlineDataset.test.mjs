import test from 'node:test'
import assert from 'node:assert/strict'
import { lotteries } from '../src/config/lotteries.ts'
import { parseDrawing } from '../src/utils/drawingValidation.ts'
import { validateSnapshot, saveOfflineDataset, readOfflineDataset } from '../src/services/offlineDataset.ts'

function snapshot(id) {
  const lottery = lotteries[id]
  const drawings = [lottery.coverageStart, '2026-10-26'].map(date => parseDrawing({ draw_date: date, winning_numbers: id === 'powerball' ? '1 2 3 4 5 6' : '1 2 3 4 5', mega_ball: '6' }, lottery))
  return { version: 1, dataset: { lotteryId: id, drawings, earliestDate: lottery.coverageStart, dataThrough: '2026-10-26', retrievedAt: '2026-10-27T00:00:00Z', source: lottery.source, warnings: [] } }
}
for (const id of Object.keys(lotteries)) test(`${id}: offline archive is revalidated without changing original dates or numbers`, () => {
  const original = snapshot(id), restored = validateSnapshot(original, id)
  assert.deepEqual(restored.drawings, original.dataset.drawings)
  assert.equal(restored.retrievedAt, original.dataset.retrievedAt)
  assert.equal(restored.dataThrough, original.dataset.dataThrough)
  for (const mutation of [s => { s.version = 2 }, s => { s.dataset.lotteryId = 'invalid' }, s => { s.dataset.drawings[0].mainNumbers = [1, 1, 2, 3, 4] }, s => { s.dataset.dataThrough = '2000-01-01' }, s => { s.dataset.drawings.reverse() }, s => { s.dataset.retrievedAt = 'bad' }]) {
    const changed = structuredClone(original); mutation(changed)
    assert.throws(() => validateSnapshot(changed, id))
  }
})
test('offline cache stores complete snapshots; corrupt/denied storage fails safely', async () => {
  const previousCache = globalThis.caches, previousLocation = globalThis.location
  const entries = new Map()
  globalThis.location = { origin: 'https://example.test' }
  globalThis.caches = { open: async () => ({ put: async (key, value) => entries.set(key, value), match: async key => entries.get(key)?.clone() }) }
  try {
    await saveOfflineDataset(snapshot('powerball').dataset)
    assert.equal((await readOfflineDataset('powerball')).drawings.length, 2)
    entries.set('https://example.test/offline-archive/powerball', new Response('broken'))
    assert.equal(await readOfflineDataset('powerball'), null)
    globalThis.caches.open = async () => { throw new Error('Denied') }
    await saveOfflineDataset(snapshot('powerball').dataset)
    assert.equal(await readOfflineDataset('powerball'), null)
  } finally {
    if (previousCache === undefined) delete globalThis.caches; else globalThis.caches = previousCache
    if (previousLocation === undefined) delete globalThis.location; else globalThis.location = previousLocation
  }
})
