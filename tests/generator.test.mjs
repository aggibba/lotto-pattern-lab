import test from 'node:test'
import assert from 'node:assert/strict'
import { lotteries } from '../src/config/lotteries.ts'
import { prepareGenerator, generateCombinations, canonicalCombination } from '../src/generator/generateCombinations.ts'
import { randomGenerator } from '../src/generator/randomGenerator.ts'
import { trendWeights } from '../src/generator/trendGenerator.ts'
import { calculatePatternScore } from '../src/analytics/patternScore.ts'
import { PATTERN_SCORE_CONFIG } from '../src/config/patternScore.ts'
import { GENERATOR_CONFIG } from '../src/config/generator.ts'
import { serializeSaved, deserializeSaved } from '../src/generator/savedCombinations.ts'
function rng(seed = 7) { return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296 } }
function rows(lottery) { return Array.from({ length: 120 }, (_, i) => ({ lotteryId: lottery.id, drawDate: new Date(Date.UTC(2026, 8, 27 - i)).toISOString().slice(0, 10), mainNumbers: i % 2 ? [10, 21, 32, 43, 54] : [1, 2, 3, 4, 5], specialBall: i % 2 ? 1 : 12, ruleSetId: lottery.ruleSets.at(-1).id, ruleVerification: 'verified', multiplier: null, source: lottery.source })) }
const config = lottery => ({ lottery, period: '100', asOfDate: '2026-09-28' })
for (const lottery of Object.values(lotteries)) {
  for (const strategy of ['Random', 'Balanced', 'Trend Weighted']) test(`${lottery.id} ${strategy}: valid pools, count, uniqueness, score bounds and special separation`, () => {
    const c = prepareGenerator(rows(lottery), config(lottery))
    const results = generateCombinations(c, strategy, 20, rng())
    assert.equal(new Set(results.map(r => canonicalCombination(r.mainNumbers, r.specialBall))).size, 20)
    for (const r of results) {
      assert.equal(r.mainNumbers.length, c.analysis.ruleSet.mainBallCount)
      assert.equal(new Set(r.mainNumbers).size, r.mainNumbers.length)
      assert.ok(r.mainNumbers.every(n => n >= c.analysis.ruleSet.mainBallMin && n <= c.analysis.ruleSet.mainBallMax))
      assert.ok(r.specialBall >= c.analysis.ruleSet.specialBallMin && r.specialBall <= c.analysis.ruleSet.specialBallMax)
      assert.ok(r.score >= 0 && r.score <= 100)
    }
  })
  test(`${lottery.id}: selection windows, future exclusion, era boundary`, () => {
    const oldRule = lottery.ruleSets.at(-2)
    const old = { ...rows(lottery)[0], drawDate: oldRule.effectiveFrom, ruleSetId: oldRule.id }
    const future = { ...rows(lottery)[0], drawDate: '2026-09-29' }
    for (const [period, size] of [['20', 20], ['50', 50], ['100', 100], ['current-era', 120]]) {
      const c = prepareGenerator([...rows(lottery), old, future], { ...config(lottery), period })
      assert.equal(c.selected.length, size)
      assert.ok(c.selected.every(d => d.ruleSetId === lottery.ruleSets.at(-1).id && d.drawDate <= '2026-09-28'))
      assert.ok(c.analysis.mainNumbers.every(s => s.recent100 <= size))
    }
  })
}
const lottery = lotteries.powerball
const context = () => prepareGenerator(rows(lottery), config(lottery))
test('Random ignores all trend weights and statistics; equal-weight sampling permits main/special equality', () => {
  const c = context(), changed = { ...c, analysis: { ...c.analysis, mainNumbers: [], specialBalls: [] } }
  assert.deepEqual(generateCombinations(c, 'Random', 5, rng(), GENERATOR_CONFIG, '2026-09-28T00:00:00Z'), generateCombinations(changed, 'Random', 5, rng(), { ...GENERATOR_CONFIG, trendStrength: 999 }, '2026-09-28T00:00:00Z'))
  assert.deepEqual(randomGenerator(c.analysis.ruleSet, () => 0), { mainNumbers: [1, 2, 3, 4, 5], specialBall: 1 })
  for (let i = 0; i < 69; i++) assert.ok(randomGenerator(c.analysis.ruleSet, () => (i + .5) / 69).mainNumbers.includes(i + 1))
})
test('maximum retry guard terminates duplicate batch and rejects invalid RNG/config', () => {
  let calls = 0
  assert.throws(() => generateCombinations(context(), 'Random', 5, () => { calls++; return 0 }, { ...GENERATOR_CONFIG, maxAttemptsPerCombination: 2 }), /retry limit/)
  assert.equal(calls, 60)
  for (const n of [-1, 1, NaN, Infinity]) assert.throws(() => randomGenerator(context().analysis.ruleSet, () => n), /RNG/)
  assert.throws(() => generateCombinations(context(), 'Random', 1, rng(), { ...GENERATOR_CONFIG, balancedCandidates: 0 }), /configuration/)
})
test('score determinism, permutation invariance, component sums, and no special-ball contamination', () => {
  const c = context(), main = [1, 2, 3, 4, 5]
  const score = calculatePatternScore(main, c.model)
  assert.deepEqual(score, calculatePatternScore([...main].reverse(), c.model))
  const changed = prepareGenerator(rows(lottery).map(d => ({ ...d, specialBall: 26 })), config(lottery))
  assert.deepEqual(score, calculatePatternScore(main, changed.model))
  assert.equal(Object.values(PATTERN_SCORE_CONFIG.weights).reduce((a, b) => a + b, 0), 100)
  assert.equal(score.score, Math.round(score.components.reduce((a, b) => a + b.contribution, 0) * 100) / 100)
  assert.throws(() => prepareGenerator(rows(lottery), config(lottery), { ...PATTERN_SCORE_CONFIG, weights: { ...PATTERN_SCORE_CONFIG.weights, pair: 11 } }), /100%/)
})
test('trend formula normalizes each metric independently per pool', () => {
  const c = context()
  for (const stats of [c.analysis.mainNumbers, c.analysis.specialBalls]) {
    const actual = trendWeights(stats)
    stats.forEach((s, i) => {
      const expected = 1 + 4 * Object.entries(GENERATOR_CONFIG.trend).reduce((sum, [key, coefficient]) => sum + coefficient * s[key] / Math.max(1, ...stats.map(x => x[key])), 0)
      assert.equal(actual[i].weight, expected)
      assert.ok(actual[i].weight >= 1 && actual[i].weight <= 5)
    })
  }
})
test('saved round trip, empty storage, corruption and invalid values', () => {
  const result = generateCombinations(context(), 'Random', 1, rng(), GENERATOR_CONFIG, '2026-09-28T00:00:00Z')
  const text = serializeSaved(result)
  assert.equal(serializeSaved(deserializeSaved(text)), text)
  assert.deepEqual(deserializeSaved(null), [])
  for (const text of ['x', '{}', '{"version":1,"items":[null]}']) assert.throws(() => deserializeSaved(text))
  for (const patch of [{ score: 101 }, { specialBall: 27 }, { mainNumbers: [1, 1, 2, 3, 4] }, { lottery: '__proto__' }, { generatedAt: 'invalid' }]) assert.throws(() => serializeSaved([{ ...result[0], ...patch }]))
})
test('empty history fails explicitly instead of fabricating a score', () => assert.throws(() => prepareGenerator([], config(lottery)), /requires selected/))
test('Balanced samples varied historical structures and ignores special-ball history', () => {
  const c = context()
  const changed = prepareGenerator(rows(lottery).map(d => ({ ...d, specialBall: 26 })), config(lottery))
  const a = generateCombinations(c, 'Balanced', 20, rng(), GENERATOR_CONFIG, '2026-09-28T00:00:00Z')
  const b = generateCombinations(changed, 'Balanced', 20, rng(), GENERATOR_CONFIG, '2026-09-28T00:00:00Z')
  assert.deepEqual(a, b)
  assert.ok(new Set(a.map(r => `${r.facts.odd}:${r.facts.low}:${r.facts.consecutive}`)).size > 1)
})
test('Random uses supplied rule ranges, including shifted minima and main count', () => {
  const rule = { ...context().analysis.ruleSet, mainBallMin: 10, mainBallMax: 14, mainBallCount: 3, specialBallMin: 11, specialBallMax: 11 }
  for (const r of [randomGenerator(rule, () => 0), randomGenerator(rule, () => .999999)]) {
    assert.equal(r.mainNumbers.length, 3)
    assert.ok(r.mainNumbers.every(n => n >= 10 && n <= 14))
    assert.equal(r.specialBall, 11)
  }
})
