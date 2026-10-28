import test from 'node:test'
import assert from 'node:assert/strict'
import { lotteries } from '../src/config/lotteries.ts'
import { prepareGenerator, generateCombinations, canonicalCombination } from '../src/generator/generateCombinations.ts'
import { calculatePatternScore } from '../src/analytics/patternScore.ts'
import { highestPatternScore, MAX_SCORE_ATTEMPTS } from '../src/generator/highestPatternScore.ts'
import { seededRandom } from '../src/backtest/seededRandom.ts'
import { serializeSaved, deserializeSaved } from '../src/generator/savedCombinations.ts'

function context(lottery, period = '20') {
  const drawings = Array.from({ length: 100 }, (_, i) => ({ lotteryId: lottery.id, drawDate: new Date(Date.UTC(2026, 8, 28 - i)).toISOString().slice(0, 10), mainNumbers: [1, 2, 3, 4, 5], specialBall: 1, ruleSetId: lottery.ruleSets.at(-1).id, ruleVerification: 'verified', multiplier: null, source: lottery.source }))
  return prepareGenerator(drawings, { lottery, period, asOfDate: '2026-09-28' })
}
for (const lottery of Object.values(lotteries)) {
  test(`${lottery.id}: bounded search preserves score, rules, uniqueness and every remaining strategy result`, async () => {
    for (const period of ['20', '50', '100', 'current-era']) for (const strategy of ['Random', 'Balanced', 'Trend Weighted']) {
      const c = context(lottery, period), batch = generateCombinations(c, strategy, 20, seededRandom(strategy))
      const before = structuredClone(batch)
      let yields = 0
      const result = await highestPatternScore(c, batch, { maxAttempts: 64, rng: seededRandom('search'), yieldControl: async () => { yields++ } })
      assert.deepEqual(batch, before)
      assert.deepEqual(result.combinations.slice(1), batch.slice(1))
      const first = result.combinations[0]
      assert.ok(first.score >= Math.max(...batch.map(b => b.score)))
      assert.deepEqual(first.components, calculatePatternScore(first.mainNumbers, c.model).components)
      assert.equal(first.score, calculatePatternScore(first.mainNumbers, c.model).score)
      assert.equal(first.period, period)
      assert.equal(first.lottery, lottery.id)
      assert.equal(deserializeSaved(serializeSaved([first]))[0].selectionMethod, 'highest-pattern-score')
      assert.throws(() => serializeSaved([{ ...first, selectionMethod: 'invalid' }]), /Invalid saved/)
      assert.ok(first.specialBall >= c.analysis.ruleSet.specialBallMin && first.specialBall <= c.analysis.ruleSet.specialBallMax)
      assert.equal(new Set(result.combinations.map(b => canonicalCombination(b.mainNumbers, b.specialBall))).size, 20)
      assert.ok(result.attempts <= 64 && yields >= 1)
    }
  })
  test(`${lottery.id}: discovers genuine 100, resolves duplicate bonus, and exits early`, async () => {
    const c = context(lottery), batch = generateCombinations(c, 'Random', 5, seededRandom('batch'))
    // Zero RNG selects [1,2,3,4,5], the real 100-point structure in this fixture.
    const result = await highestPatternScore(c, batch, { rng: () => 0, yieldControl: async () => {} })
    assert.equal(result.combinations[0].score, 100)
    assert.equal(result.attempts, 1)
    const duplicate = [result.combinations[0], result.combinations[0]]
    const next = await highestPatternScore(c, duplicate, { rng: () => 0, yieldControl: async () => {} })
    assert.equal(next.attempts, 0)
    assert.notEqual(next.combinations[0].specialBall, next.combinations[1].specialBall)
  })
}
test('attempt limit, asynchronous cancellation and invalid limits', async () => {
  const c = context(lotteries.powerball), batch = generateCombinations(c, 'Random', 1, seededRandom('limit'))
  const limited = await highestPatternScore(c, batch, { maxAttempts: 1, rng: () => 0.99, yieldControl: async () => {} })
  assert.equal(limited.attempts, 1)
  assert.ok(limited.combinations[0].score < 100)
  const controller = new AbortController()
  await assert.rejects(highestPatternScore(c, batch, { signal: controller.signal, yieldControl: async () => controller.abort() }), /cancelled/)
  for (const maxAttempts of [0, -1, 1.5, MAX_SCORE_ATTEMPTS + 1]) await assert.rejects(highestPatternScore(c, batch, { maxAttempts }), /Invalid/)
})
