import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { lotteries } from '../src/config/lotteries.ts'
import { runBacktest } from '../src/backtest/backtestEngine.ts'
import { getHistoricalTrainingData, verifiedHistoricalRule } from '../src/backtest/historicalData.ts'
import { seededRandom } from '../src/backtest/seededRandom.ts'
import { matchCombination } from '../src/backtest/matchResults.ts'
import { prepareGenerator, generateCombinations, canonicalCombination } from '../src/generator/generateCombinations.ts'
const fast = { yieldControl: async () => {} }
function rows(lottery = lotteries.powerball, start = '2026-01-01', n = 125, rule = lottery.ruleSets.at(-1)) {
  return Array.from({ length: n }, (_, i) => ({ lotteryId: lottery.id, drawDate: new Date(Date.parse(start) + i * 86400000).toISOString().slice(0, 10), mainNumbers: i % 2 ? [10, 21, 32, 43, 54] : [1, 2, 3, 4, 5], specialBall: i % 2 ? 1 : 12, ruleSetId: rule.id, ruleVerification: 'verified', multiplier: null, source: lottery.source }))
}
const config = (patch = {}) => ({ lottery: lotteries.powerball, strategy: 'Compare All', trainingWindow: 100, combinationsPerTarget: 5, range: { kind: 'last', count: 20 }, asOfDate: '2026-09-28', ...patch })
const single = (date, patch = {}) => config({ range: { kind: 'custom', start: date, end: date }, ...patch })
test('training excludes target and all future data at the reusable boundary', () => {
  const data = rows(), target = data[110]
  const training = getHistoricalTrainingData(data, target, lotteries.powerball, 100)
  assert.equal(training.length, 100)
  assert.ok(training.every(d => d.drawDate < target.drawDate))
  assert.ok(!training.some(d => d.drawDate === target.drawDate))
  assert.equal(training[0].drawDate, data[109].drawDate)
  assert.equal(training.at(-1).drawDate, data[10].drawDate)
})
for (const window of [20, 50, 100]) test(`exact previous ${window} valid drawings, order-independent and input immutable`, () => {
  const data = rows(), snapshot = JSON.stringify(data)
  const expected = data.slice(120 - window, 120).toReversed().map(d => d.drawDate)
  assert.deepEqual(getHistoricalTrainingData(data.toReversed(), data[120], lotteries.powerball, window).map(d => d.drawDate), expected)
  assert.equal(JSON.stringify(data), snapshot)
})
test('unverified prior records are omitted before counting the exact training window', () => {
  const data = rows(); data[119] = { ...data[119], ruleVerification: 'unverified', ruleSetId: null }
  const training = getHistoricalTrainingData(data, data[120], lotteries.powerball, 20)
  assert.equal(training.length, 20)
  assert.equal(training[0].drawDate, data[118].drawDate)
  assert.equal(training.at(-1).drawDate, data[99].drawDate)
})
test('insufficient prior history, empty input, unavailable requested targets, and zero denominators', async () => {
  const result = await runBacktest(rows().slice(0, 20), config(), fast)
  assert.equal(result.targetsTested, 0)
  assert.equal(result.targetsExcluded, 20)
  assert.equal(result.exclusions[19].availableHistory, 19)
  assert.ok(result.exclusions.every(e => e.reason.includes('insufficient')))
  assert.equal(result.combinationsGenerated, 0)
  assert.ok(result.summaries.every(s => s.averageMainMatches === null && s.combinations === 0))
  const empty = await runBacktest([], config(), fast)
  assert.equal(empty.targetsRequested, 0)
  assert.equal(empty.targetsExcluded, 0)
  assert.equal(empty.warnings.length, 2)
})
for (const [id, ruleIndex, start, mainMax, specialMax] of [['powerball', 1, '2014-01-01', 59, 35], ['mega-millions', 2, '2016-01-01', 75, 15]]) test(`${id}: historical rule ranges, same Step 5 generator and scorer`, async () => {
  const lottery = lotteries[id], rule = lottery.ruleSets[ruleIndex], data = rows(lottery, start, 125, rule)
  const result = await runBacktest(data, single(data.at(-1).drawDate, { lottery }), fast)
  const target = result.targets[0]
  assert.equal(target.rule.id, rule.id)
  assert.equal(target.rule.mainBallMax, mainMax)
  assert.equal(target.rule.specialBallMax, specialMax)
  const training = data.filter(d => target.trainingDates.includes(d.drawDate))
  const context = prepareGenerator(training, { lottery, period: '100', asOfDate: target.target.drawDate })
  for (const batch of target.batches) {
    const expected = generateCombinations(context, batch.strategy, 5, seededRandom(batch.seed), undefined, `${target.target.drawDate}T00:00:00.000Z`)
    assert.deepEqual(batch.combinations.map(m => m.generated), expected)
    assert.ok(expected.every(g => g.mainNumbers.every(n => n <= mainMax) && g.specialBall <= specialMax))
  }
})
test('new rule-era boundary does not borrow prior-era records', async () => {
  const lottery = lotteries['mega-millions']
  const old = rows(lottery, '2024-10-01', 125, lottery.ruleSets[3])
  const recent = rows(lottery, '2025-04-08', 2)
  const result = await runBacktest([...old, ...recent], single(recent[1].drawDate, { lottery, trainingWindow: 20 }), fast)
  assert.equal(result.targetsTested, 0)
  assert.equal(result.exclusions[0].availableHistory, 1)
})
test('unverified rules and missing historical configuration are excluded, never guessed', async () => {
  const data = rows()
  const unverified = { ...data.at(-1), ruleVerification: 'unverified', ruleSetId: null }
  const result = await runBacktest([...data.slice(0, -1), unverified], single(unverified.drawDate), fast)
  assert.equal(result.targetsExcluded, 1)
  assert.equal(result.exclusions[0].reason, 'Excluded — unverified historical rule set')
  const missing = { ...lotteries.powerball, ruleSets: lotteries.powerball.ruleSets.slice(0, -1) }
  assert.equal(verifiedHistoricalRule(data[124], missing), null)
  const unknown = await runBacktest(data, single(data[124].drawDate, { lottery: missing }), fast)
  assert.equal(unknown.targetsExcluded, 1)
})
test('seeded RNG is stable, distinct across seeds, bounded, and has a fixed reference vector', () => {
  const a = seededRandom('step6-test'), b = seededRandom('step6-test'), c = seededRandom('different')
  const left = Array.from({ length: 100 }, a), right = Array.from({ length: 100 }, b)
  assert.deepEqual(left, right)
  assert.notDeepEqual(left, Array.from({ length: 100 }, c))
  assert.ok(left.every(n => n >= 0 && n < 1))
  // Independently derived FNV-1a hash for empty seed is its offset basis.
  let s = 2166136261 + 0x6D2B79F5 | 0
  let t = Math.imul(s ^ s >>> 15, s | 1)
  t ^= t + Math.imul(t ^ t >>> 7, t | 61)
  assert.equal(seededRandom('')(), ((t ^ t >>> 14) >>> 0) / 4294967296)
})
test('match counts keep main and special pools separate, including equal-valued balls', () => {
  const actual = { mainNumbers: [1, 2, 3, 4, 5], specialBall: 12 }
  assert.deepEqual(matchCombination({ mainNumbers: [1, 6, 7, 8, 12], specialBall: 2 }, actual), { mainMatches: 1, specialMatch: false })
  assert.deepEqual(matchCombination({ mainNumbers: [1, 2, 3, 4, 5], specialBall: 12 }, actual), { mainMatches: 5, specialMatch: true })
  assert.deepEqual(matchCombination({ mainNumbers: [6, 7, 8, 9, 10], specialBall: 12 }, actual), { mainMatches: 0, specialMatch: true })
})
test('same configuration and data produce identical full results, independent of order and scheduling', async () => {
  const data = rows(), options = single(data.at(-1).drawDate)
  const a = await runBacktest(data, options, fast)
  const b = await runBacktest(data.toReversed(), options)
  assert.deepEqual(a, b)
})
for (const strategy of ['Random', 'Balanced', 'Trend Weighted']) test(`${strategy} backtest and Compare All share targets, windows, seeds and unique complete batches`, async () => {
  const data = rows(), options = single(data.at(-1).drawDate, { combinationsPerTarget: 20 })
  const all = await runBacktest(data, options, fast)
  const one = await runBacktest(data, { ...options, strategy }, fast)
  assert.deepEqual(all.targets.map(t => [t.target.drawDate, t.trainingDates]), one.targets.map(t => [t.target.drawDate, t.trainingDates]))
  const batch = all.targets[0].batches.find(b => b.strategy === strategy)
  assert.deepEqual(batch, one.targets[0].batches[0])
  assert.equal(batch.combinations.length, 20)
  assert.equal(new Set(batch.combinations.map(c => canonicalCombination(c.generated.mainNumbers, c.generated.specialBall))).size, 20)
  assert.equal(one.summaries[0].mainDistribution.reduce((a, b) => a + b, 0), 20)
  assert.equal(all.combinationsGenerated, 60)
})
test('changing target and future numbers cannot change any strategy generation or Pattern Score', async () => {
  const data = rows(), target = data[115], options = single(target.drawDate)
  const changed = data.map(d => d.drawDate >= target.drawDate ? { ...d, mainNumbers: [20, 30, 40, 50, 60], specialBall: 26 } : d)
  const a = await runBacktest(data, options, fast), b = await runBacktest(changed, options, fast)
  assert.deepEqual(a.targets[0].trainingDates, b.targets[0].trainingDates)
  a.targets[0].batches.forEach((batch, i) => assert.deepEqual(batch.combinations.map(m => m.generated), b.targets[0].batches[i].combinations.map(m => m.generated)))
})
test('engine never fetches; progress, cancellation, and custom date validation', async () => {
  const data = rows(), options = single(data[124].drawDate)
  const originalFetch = globalThis.fetch
  globalThis.fetch = () => { throw new Error('Unexpected API request') }
  try {
    const progress = []
    await runBacktest(data, options, { ...fast, onProgress: p => progress.push(p) })
    assert.deepEqual(progress, [{ completed: 0, total: 1 }, { completed: 1, total: 1 }])
  } finally { globalThis.fetch = originalFetch }
  const abort = new AbortController()
  await assert.rejects(runBacktest(data, options, { signal: abort.signal, yieldControl: async () => abort.abort() }), /cancelled/)
  await assert.rejects(runBacktest(data, { ...options, range: { kind: 'custom', start: '2026-05-01', end: '2026-01-01' } }, fast), /Custom dates/)
  for (const name of ['backtestEngine', 'historicalData', 'seededRandom', 'matchResults']) assert.doesNotMatch(await readFile(`src/backtest/${name}.ts`, 'utf8'), /\bfetch\s*\(|nyOpenData|drawingRepository/)
})
test('duplicate dates, mixed lotteries, and out-of-rule input fail visibly', async () => {
  const data = rows()
  await assert.rejects(runBacktest([...data, data[0]], config(), fast), /unique/)
  await assert.rejects(runBacktest([{ ...data[0], lotteryId: 'mega-millions' }], config(), fast), /one lottery/)
  await assert.rejects(runBacktest([{ ...data[0], specialBall: 99 }], config(), fast), /ranges/)
})
