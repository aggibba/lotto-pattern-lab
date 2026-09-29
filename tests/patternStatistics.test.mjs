import test from 'node:test'
import assert from 'node:assert/strict'
import { powerball } from '../src/config/powerball.ts'
import { megaMillions } from '../src/config/megaMillions.ts'
import { calculatePatternStatistics } from '../src/analytics/patternStatistics.ts'
import { calculateAnalysis } from '../src/analytics/numberStatistics.ts'
const config = { lottery: powerball, period: 'current-era', asOfDate: '2026-09-23' }
function drawing(index, mainNumbers, extra = {}) {
  return { lotteryId: 'powerball', drawDate: new Date(Date.UTC(2026, 8, 22 - index)).toISOString().slice(0, 10), mainNumbers, specialBall: 26, multiplier: null, source: powerball.source, ruleSetId: 'pb-2015', ruleVerification: 'verified', ...extra }
}
test('unordered main pairs count once per draw, exclude special ball, and sort numeric ties', () => {
  const rows = [drawing(0, [5, 4, 3, 2, 1]), drawing(1, [1, 2, 7, 9, 11])]
  const result = calculatePatternStatistics(rows, config)
  assert.deepEqual(result.commonPairs[0], { numbers: [1, 2], count: 2, percent: 100 })
  assert.deepEqual(result.commonPairs[1], { numbers: [1, 3], count: 1, percent: 50 })
  assert.equal(result.commonPairs.some((p) => p.numbers.includes(26)), false)
  assert.equal(result.commonPairs.reduce((sum, p) => sum + p.count, 0), 20)
  assert.deepEqual(result.commonPairs.filter((p) => p.numbers[0] === 1).map((p) => p.numbers[1]), [2, 3, 4, 5, 7, 9, 11])
  assert.deepEqual(rows[0].mainNumbers, [5, 4, 3, 2, 1])
})
test('odd/even extremes, exact sums, multiple consecutive pairs count as one drawing', () => {
  const result = calculatePatternStatistics([drawing(0, [1, 3, 5, 7, 9]), drawing(1, [2, 4, 6, 8, 10]), drawing(2, [5, 4, 3, 2, 1])], config)
  assert.equal(result.oddEven[5].count, 1)
  assert.equal(result.oddEven[0].count, 1)
  assert.equal(result.oddEven[3].count, 1)
  assert.equal(result.consecutive.included.count, 1)
  assert.equal(result.consecutive.absent.count, 2)
  assert.deepEqual(result.sums.map((row) => row.sum), [15, 25, 30])
  for (const distribution of [result.oddEven, result.lowHigh, result.sums, Object.values(result.consecutive)]) {
    assert.equal(distribution.reduce((sum, row) => sum + row.count, 0), 3)
    assert.ok(Math.abs(distribution.reduce((sum, row) => sum + row.percent, 0) - 100) < 1e-10)
  }
})
test('low/high boundary includes 35 and excludes 36 for both lotteries', () => {
  const main = [1, 34, 35, 36, 69]
  const pb = calculatePatternStatistics([drawing(0, main)], config)
  const mm = calculatePatternStatistics([drawing(0, [1, 34, 35, 36, 70], { lotteryId: 'mega-millions', specialBall: 24, ruleSetId: 'mm-2025' })], { ...config, lottery: megaMillions })
  for (const result of [pb, mm]) { assert.equal(result.lowMax, 35); assert.equal(result.lowHigh[3].count, 1); assert.equal(result.lowHigh[3].second, 2) }
  const extremes = calculatePatternStatistics([drawing(0, [1, 2, 3, 4, 5]), drawing(1, [65, 66, 67, 68, 69])], config)
  assert.equal(extremes.lowHigh[5].count, 1)
  assert.equal(extremes.lowHigh[0].count, 1)
  assert.deepEqual(extremes.sums.map((row) => row.sum), [15, 335])
})
test('no wraparound or special-ball adjacency included', () => {
  const result = calculatePatternStatistics([drawing(0, [1, 10, 30, 50, 69], { specialBall: 2 })], config)
  assert.equal(result.consecutive.included.count, 0)
  assert.equal(result.consecutive.absent.percent, 100)
})
test('all four periods share Step 3 selection, boundaries, denominator and exclusions', () => {
  const rows = Array.from({ length: 105 }, (_, i) => drawing(i, [1, 3, 5, 7, 9]))
  rows.push(drawing(0, [1, 3, 5, 7, 9], { drawDate: '2015-10-03', ruleSetId: 'pb-2012' }))
  for (const [period, n] of [['20', 20], ['50', 50], ['100', 100], ['current-era', 105]]) {
    const result = calculatePatternStatistics([...rows].reverse(), { ...config, period })
    assert.equal(result.drawingsAnalyzed, n)
    assert.equal(result.commonPairs[0].count, n)
    assert.equal(result.commonPairs[0].percent, 100)
    assert.deepEqual(result, calculateAnalysis(rows, { ...config, period }).patterns)
  }
  const mmRows = [drawing(0, [1, 3, 5, 7, 9], { lotteryId: 'mega-millions', drawDate: '2025-04-04', ruleSetId: 'mm-2017', specialBall: 25 }), drawing(1, [1, 3, 5, 7, 9], { lotteryId: 'mega-millions', drawDate: '2025-04-08', ruleSetId: 'mm-2025', specialBall: 24 })]
  assert.equal(calculatePatternStatistics(mmRows, { ...config, lottery: megaMillions }).drawingsAnalyzed, 1)
})
test('short and empty samples never divide by requested window size or fabricate pairs', () => {
  const one = calculatePatternStatistics([drawing(0, [1, 2, 3, 4, 5])], { ...config, period: '100' })
  assert.equal(one.drawingsAnalyzed, 1)
  assert.equal(one.commonPairs.length, 10)
  assert.equal(one.commonPairs[0].percent, 100)
  const empty = calculatePatternStatistics([], config)
  assert.deepEqual(empty.commonPairs, [])
  assert.deepEqual(empty.sums, [])
  assert.equal(empty.oddEven[0].percent, null)
  assert.equal(empty.consecutive.included.percent, null)
})
test('malformed, duplicate, wrong-game, and out-of-range inputs are rejected', () => {
  for (const rows of [[null], [drawing(0, [1, 1, 2, 3, 4])], [drawing(0, [1, 2, 3, 4, 70])], [drawing(0, [1, 2, 3, 4, 5]), drawing(0, [1, 2, 3, 4, 6])], [drawing(0, [1, 2, 3, 4, 5], { lotteryId: 'mega-millions' })]]) assert.throws(() => calculatePatternStatistics(rows, config))
})

test('special balls overlapping main numbers do not change any pattern', () => {
  for (const lottery of [powerball, megaMillions]) {
    const extra = { lotteryId: lottery.id, ruleSetId: lottery.ruleSets.at(-1).id }
    const baseline = [drawing(0, [1, 2, 3, 4, 5], { ...extra, specialBall: 1 })]
    const changed = [drawing(0, [1, 2, 3, 4, 5], { ...extra, specialBall: 24 })]
    assert.deepEqual(calculatePatternStatistics(baseline, { ...config, lottery }), calculatePatternStatistics(changed, { ...config, lottery }))
  }
})

test('future and unverified draws are excluded before applying the period limit', () => {
  const rows = [drawing(0, [1, 3, 5, 7, 9]), drawing(1, [2, 4, 6, 8, 10], { drawDate: '2026-09-24' }), drawing(2, [10, 20, 30, 40, 50], { ruleVerification: 'unverified', ruleSetId: null })]
  const result = calculatePatternStatistics(rows, { ...config, period: '20' })
  assert.equal(result.drawingsAnalyzed, 1)
  assert.equal(result.oddEven[5].percent, 100)
  assert.equal(result.commonPairs.length, 10)
})
