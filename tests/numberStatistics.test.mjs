import test from 'node:test'
import assert from 'node:assert/strict'
import { powerball } from '../src/config/powerball.ts'
import { megaMillions } from '../src/config/megaMillions.ts'
import { calculateAnalysis, calculateNumberStatistics, calculateSpecialBallStatistics, sortStatistics } from '../src/analytics/numberStatistics.ts'
import { getHotNumbers, getColdNumbers, getOverdueNumbers } from '../src/analytics/classifications.ts'

// Synthetic normalized drawings strictly for deterministic tests, never UI data.
const config = { lottery: powerball, period: 'current-era', asOfDate: '2026-09-23' }
function draw(index, overrides = {}) {
  return { lotteryId: 'powerball', drawDate: new Date(Date.UTC(2026, 8, 22 - index)).toISOString().slice(0, 10), mainNumbers: [1, 2, 3, 4, 5], specialBall: 10, multiplier: null, source: powerball.source, ruleSetId: 'pb-2015', ruleVerification: 'verified', ...overrides }
}
const twenty = Array.from({ length: 20 }, (_, index) => draw(index, { mainNumbers: index === 1 ? [1, 2, 3, 4, 6] : [1, 2, 3, 4, 5] }))
const find = (stats, number) => stats.find((stat) => stat.number === number)

test('appearance count, frequency, last date, 0-based gaps, and recent 20', () => {
  const stats = calculateNumberStatistics([...twenty].reverse(), config)
  assert.equal(stats.length, 69)
  assert.equal(find(stats, 1).appearances, 20)
  assert.equal(find(stats, 1).frequencyPercent, 100)
  assert.equal(find(stats, 1).drawingsSinceLastAppearance, 0)
  assert.equal(find(stats, 6).appearances, 1)
  assert.equal(find(stats, 6).frequencyPercent, 5)
  assert.equal(find(stats, 6).lastDrawnDate, twenty[1].drawDate)
  assert.equal(find(stats, 6).drawingsSinceLastAppearance, 1)
  assert.equal(find(stats, 6).recent20, 1)
  assert.equal(find(stats, 7).lastDrawnDate, null)
  assert.equal(find(stats, 7).drawingsSinceLastAppearance, null)
  assert.equal(find(stats, 7).gapLowerBound, 20)
})
test('Hot, Cold, Overdue and deterministic ties; small samples suppress labels', () => {
  const stats = calculateNumberStatistics(twenty, config)
  assert.deepEqual(getHotNumbers(stats).map((stat) => stat.number), [1, 2, 3, 4, 5])
  assert.equal(getColdNumbers(stats)[0].number, 7)
  assert.deepEqual(find(stats, 7).statuses, ['Cold', 'Overdue'])
  assert.equal(getOverdueNumbers(stats)[0].number, 7)
  assert.ok(!find(stats, 6).statuses.includes('Overdue'))
  const nineteen = calculateNumberStatistics(twenty.slice(0, 19), config)
  assert.equal(nineteen.every((stat) => stat.statuses.length === 0), true)
})
test('Overdue exact boundary and capped lower bounds are separate from exact gaps', () => {
  const rows = twenty.map((row, index) => ({ ...row, mainNumbers: index === 14 ? [1, 2, 3, 4, 8] : row.mainNumbers }))
  const stats = calculateNumberStatistics(rows, config)
  assert.equal(find(stats, 8).drawingsSinceLastAppearance, 14)
  assert.ok(find(stats, 8).statuses.includes('Overdue'))
  assert.equal(sortStatistics(stats, 'drawingsSinceLastAppearance', 'desc')[0].gapLowerBound, 20)
})
test('special ball uses its own pool and appearance denominator', () => {
  const stats = calculateSpecialBallStatistics(twenty, config)
  assert.equal(stats.length, 26)
  assert.equal(find(stats, 10).appearances, 20)
  assert.equal(find(stats, 10).frequencyPercent, 100)
  assert.equal(find(stats, 1).appearances, 0)
  assert.equal(find(stats, 1).statuses.includes('Overdue'), false) // threshold 26, only 20 observed
  assert.equal(find(calculateNumberStatistics(twenty, config), 10).appearances, 0)
})
test('recent windows stay inside selection, actual denominators handle short archives', () => {
  const rows = Array.from({ length: 60 }, (_, index) => draw(index, { mainNumbers: index >= 20 ? [1, 2, 3, 4, 6] : [1, 2, 3, 4, 5] }))
  const all = calculateAnalysis(rows, config)
  assert.deepEqual(all.recentSampleSizes, { recent20: 20, recent50: 50, recent100: 60 })
  assert.equal(find(all.mainNumbers, 6).recent20, 0)
  assert.equal(find(all.mainNumbers, 6).recent50, 30)
  assert.equal(find(all.mainNumbers, 6).recent100, 40)
  assert.equal(find(all.mainNumbers, 6).frequencyPercent, 40 / 60 * 100)
  for (const [period, count] of [['20', 20], ['50', 50], ['100', 60]]) {
    const result = calculateAnalysis(rows, { ...config, period })
    assert.equal(result.drawingsAnalyzed, count)
    assert.equal(find(result.mainNumbers, 1).recent100, count)
  }
  const short = calculateAnalysis(rows.slice(0, 3), { ...config, period: '100' })
  assert.equal(find(short.mainNumbers, 1).frequencyPercent, 100)
  assert.equal(short.drawingsAnalyzed, 3)
  assert.equal(short.warnings.length, 1)
})
test('Mega Millions current rule boundary excludes older formats before windowing', () => {
  const rows = [
    draw(0, { lotteryId: 'mega-millions', drawDate: '2025-04-04', specialBall: 25, ruleSetId: 'mm-2017' }),
    draw(0, { lotteryId: 'mega-millions', drawDate: '2025-04-08', specialBall: 24, ruleSetId: 'mm-2025' }),
    draw(0, { lotteryId: 'mega-millions', drawDate: '2025-04-11', specialBall: 1, ruleSetId: 'mm-2025' }),
  ]
  const result = calculateAnalysis(rows, { lottery: megaMillions, period: '100', asOfDate: '2026-09-23' })
  assert.equal(result.currentEraCount, 2)
  assert.equal(result.drawingsAnalyzed, 2)
  assert.equal(result.specialBalls.length, 24)
  assert.equal(result.mainNumbers.length, 70)
  assert.equal(result.dataThrough, '2025-04-11')
  assert.equal(find(result.specialBalls, 24).drawingsSinceLastAppearance, 1)
  const old = calculateAnalysis(rows, { lottery: megaMillions, period: 'current-era', asOfDate: '2025-04-04' })
  assert.equal(old.drawingsAnalyzed, 1)
  assert.equal(old.specialBalls.length, 25)
})
test('Powerball old range excluded and unverified records explicitly reported', () => {
  const rows = [draw(0, { drawDate: '2015-10-03', ruleSetId: 'pb-2012', specialBall: 35 }), draw(0, { drawDate: '2015-10-07' }), draw(1, { ruleSetId: null, ruleVerification: 'unverified' })]
  const result = calculateAnalysis(rows, config)
  assert.equal(result.drawingsAnalyzed, 1)
  assert.match(result.warnings[0], /1 unverified/)
})
test('empty input returns no percentages or exact gaps, and clear warning', () => {
  const result = calculateAnalysis([], config)
  assert.equal(result.drawingsAnalyzed, 0)
  assert.equal(result.dataThrough, null)
  assert.equal(result.mainNumbers[0].frequencyPercent, null)
  assert.equal(result.mainNumbers[0].drawingsSinceLastAppearance, null)
  assert.deepEqual(result.mainNumbers[0].statuses, [])
  assert.match(result.warnings[0], /No verified/)
})
test('malformed inputs fail visibly; input order and values remain unchanged', () => {
  for (const bad of [null, {}, draw(0, { mainNumbers: [1, 1, 2, 3, 4] }), draw(0, { mainNumbers: [1, 2, 3, 4, 70] }), draw(0, { specialBall: 27 }), draw(0, { drawDate: '2026-02-30' }), draw(0, { ruleSetId: 'pb-2012' }), draw(0, { lotteryId: 'mega-millions' }), draw(0, { mainNumbers: ['1', 2, 3, 4, 5] })]) assert.throws(() => calculateAnalysis([bad], config))
  assert.throws(() => calculateAnalysis([twenty[0], twenty[0]], config), /Duplicate/)
  assert.throws(() => calculateAnalysis(twenty, { ...config, period: 'all-time' }), /Unknown/)
  const snapshot = JSON.stringify(twenty)
  calculateAnalysis(twenty, config)
  assert.equal(JSON.stringify(twenty), snapshot)
})
test('all requested numeric sort columns work both ways without mutating stats', () => {
  const stats = calculateNumberStatistics(twenty, config)
  for (const key of ['number', 'appearances', 'frequencyPercent', 'drawingsSinceLastAppearance', 'recent20', 'recent50', 'recent100']) {
    for (const direction of ['asc', 'desc']) {
      const rows = sortStatistics(stats, key, direction)
      const values = rows.map((row) => key === 'drawingsSinceLastAppearance' ? row.gapLowerBound : row[key])
      assert.ok(values.every((value, index) => !index || (direction === 'asc' ? value >= values[index - 1] : value <= values[index - 1])))
    }
  }
  assert.equal(stats[0].number, 1)
})
