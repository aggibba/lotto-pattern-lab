import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import { lotteries } from '../src/config/lotteries.ts'
import { fetchLotteryDataset } from '../src/services/nyOpenData.ts'
import { runBacktest } from '../src/backtest/backtestEngine.ts'
import { prepareGenerator } from '../src/generator/generateCombinations.ts'
import { trendWeights } from '../src/generator/trendGenerator.ts'
import { independentScore } from './verifyLiveGenerator.mjs'
const asOfDate = new Date().toISOString().slice(0, 10)
const fast = { yieldControl: async () => {} }
// Independent summary: actual intersections counted directly, no match or summary helper.
export function independentlyVerify(result, raw) {
  const expectedTargets = raw.filter(d => d.drawDate <= result.config.asOfDate).sort((a, b) => a.drawDate.localeCompare(b.drawDate))
  const selected = result.config.range.kind === 'last' ? expectedTargets.slice(-result.config.range.count) : expectedTargets.filter(d => d.drawDate >= result.config.range.start && d.drawDate <= result.config.range.end)
  assert.equal(result.targetsRequested, selected.length)
  assert.equal(result.targetsTested + result.targetsExcluded, selected.length)
  let allCount = 0
  const summaries = result.summaries.map(s => {
    const histogram = [0, 0, 0, 0, 0, 0]
    let count = 0, mainTotal = 0, specialTotal = 0
    for (const target of result.targets) {
      const actual = raw.find(d => d.drawDate === target.target.drawDate)
      const batch = target.batches.find(b => b.strategy === s.strategy)
      assert.equal(batch.combinations.length, result.config.combinationsPerTarget)
      for (const match of batch.combinations) {
        const hits = actual.mainNumbers.reduce((n, number) => n + Number(match.generated.mainNumbers.indexOf(number) !== -1), 0)
        const special = Number(actual.specialBall === match.generated.specialBall)
        assert.equal(match.mainMatches, hits)
        assert.equal(Number(match.specialMatch), special)
        histogram[hits]++; count++; mainTotal += hits; specialTotal += special
      }
    }
    assert.equal(s.combinations, count)
    assert.deepEqual(s.mainDistribution, histogram)
    assert.equal(s.averageMainMatches, count ? mainTotal / count : null)
    assert.equal(s.specialMatches, specialTotal)
    assert.equal(s.atLeast2, histogram.slice(2).reduce((a, b) => a + b, 0))
    assert.equal(s.atLeast3, histogram.slice(3).reduce((a, b) => a + b, 0))
    assert.equal(s.atLeast4, histogram.slice(4).reduce((a, b) => a + b, 0))
    allCount += count
    return { ...s, independentMatch: true }
  })
  assert.equal(result.combinationsGenerated, allCount)
  return summaries
}
function auditContext(context, prior, rule) {
  const p = context.analysis.patterns
  for (const [special, stats] of [[false, context.analysis.mainNumbers], [true, context.analysis.specialBalls]]) {
    const calculated = stats.map(s => {
      const positions = prior.map((d, i) => (special ? d.specialBall === s.number : d.mainNumbers.includes(s.number)) ? i : -1).filter(i => i >= 0)
      return { number: s.number, appearances: positions.length, recent20: positions.filter(i => i < 20).length, recent50: positions.filter(i => i < 50).length, recent100: positions.filter(i => i < 100).length, gapLowerBound: positions[0] ?? prior.length }
    })
    const weights = trendWeights(stats)
    stats.forEach((s, i) => {
      for (const key of ['appearances', 'recent20', 'recent50', 'recent100', 'gapLowerBound']) assert.equal(s[key], calculated[i][key])
      const poolSize = special ? rule.specialBallMax - rule.specialBallMin + 1 : rule.mainBallMax - rule.mainBallMin + 1
      const average = prior.length * (special ? 1 : rule.mainBallCount) / poolSize
      const statuses = []
      if (calculated[i].appearances >= 1.5 * average) statuses.push('Hot')
      if (calculated[i].appearances <= .5 * average) statuses.push('Cold')
      if (calculated[i].gapLowerBound >= Math.ceil(poolSize / (special ? 1 : rule.mainBallCount))) statuses.push('Overdue')
      assert.deepEqual(s.statuses, statuses)
      assert.equal(s.frequencyPercent, calculated[i].appearances / prior.length * 100)
      assert.equal(s.lastDrawnDate, calculated[i].gapLowerBound < prior.length ? prior[calculated[i].gapLowerBound].drawDate : null)
      const expectedWeight = 1 + 4 * [['recent20', .30], ['recent50', .25], ['recent100', .20], ['appearances', .20], ['gapLowerBound', .05]].reduce((sum, [key, w]) => sum + w * calculated[i][key] / Math.max(1, ...calculated.map(x => x[key])), 0)
      assert.ok(Math.abs(weights[i].weight - expectedWeight) < 1e-12)
    })
  }
  const low = Math.floor((rule.mainBallMin + rule.mainBallMax) / 2)
  for (let k = 0; k <= rule.mainBallCount; k++) {
    assert.equal(p.oddEven[k].count, prior.filter(d => d.mainNumbers.filter(n => n % 2).length === k).length)
    assert.equal(p.lowHigh[k].count, prior.filter(d => d.mainNumbers.filter(n => n <= low).length === k).length)
  }
  const sums = prior.map(d => d.mainNumbers.reduce((a, b) => a + b, 0))
  assert.deepEqual(p.sums.map(s => [s.sum, s.count]), [...new Set(sums)].sort((a, b) => a - b).map(sum => [sum, sums.filter(n => n === sum).length]))
  assert.equal(p.consecutive.included.count, prior.filter(d => d.mainNumbers.some(n => d.mainNumbers.includes(n + 1))).length)
  const sumBins = new Map(), spacingBins = new Map()
  prior.forEach(d => {
    const sorted = [...d.mainNumbers].sort((a, b) => a - b)
    const sumBin = Math.floor(sorted.reduce((a, b) => a + b, 0) / 25)
    let gapTotal = 0
    for (let i = 1; i < sorted.length; i++) gapTotal += sorted[i] - sorted[i - 1]
    const spacingBin = Math.floor(gapTotal / (sorted.length - 1) / 5)
    sumBins.set(sumBin, (sumBins.get(sumBin) ?? 0) + 1)
    spacingBins.set(spacingBin, (spacingBins.get(spacingBin) ?? 0) + 1)
  })
  const ordered = m => [...m].sort(([a], [b]) => a - b)
  assert.deepEqual(ordered(context.model.sum), ordered(sumBins))
  assert.deepEqual(ordered(context.model.spacing), ordered(spacingBins))
  const pairs = []
  for (let a = rule.mainBallMin; a <= rule.mainBallMax; a++) for (let b = a + 1; b <= rule.mainBallMax; b++) {
    const count = prior.filter(d => d.mainNumbers.includes(a) && d.mainNumbers.includes(b)).length
    if (count) pairs.push({ numbers: [a, b], count, percent: count / prior.length * 100 })
  }
  pairs.sort((a, b) => b.count - a.count || a.numbers[0] - b.numbers[0] || a.numbers[1] - b.numbers[1])
  assert.deepEqual(p.commonPairs, pairs)
}
if (process.argv[1]?.endsWith('verifyLiveBacktest.mjs')) {
  const report = [], audits = [], datasets = [], historical = []
  for (const lottery of Object.values(lotteries)) {
    const dataset = await fetchLotteryDataset(lottery)
    datasets.push(dataset)
    const config = { lottery, strategy: 'Compare All', trainingWindow: 100, combinationsPerTarget: 10, range: { kind: 'last', count: 20 }, asOfDate }
    const result = await runBacktest(dataset.drawings, config, fast)
    assert.equal(result.targetsRequested, 20)
    assert.equal(result.targetsTested, 20)
    assert.equal(result.targetsExcluded, 0)
    assert.equal(result.combinationsGenerated, 600)
    const summaries = independentlyVerify(result, dataset.drawings)
    const replay = await runBacktest(dataset.drawings, config, fast)
    assert.deepEqual(replay, result)
    for (const tested of [result.targets[0], result.targets[9], result.targets[19]]) {
      const rule = lottery.ruleSets.find(r => tested.target.drawDate >= r.effectiveFrom && (!r.effectiveTo || tested.target.drawDate < r.effectiveTo))
      const prior = dataset.drawings.filter(d => d.ruleVerification === 'verified' && d.ruleSetId === rule.id && d.drawDate < tested.target.drawDate && d.drawDate >= rule.effectiveFrom).sort((a, b) => b.drawDate.localeCompare(a.drawDate)).slice(0, 100)
      assert.equal(prior.length, 100)
      assert.deepEqual(tested.trainingDates, prior.map(d => d.drawDate))
      assert.ok(prior.every(d => d.drawDate < tested.target.drawDate))
      const context = prepareGenerator(prior, { lottery, period: '100', asOfDate: tested.target.drawDate })
      auditContext(context, prior, rule)
      for (const batch of tested.batches) for (const m of batch.combinations) {
        const reference = independentScore(m.generated.mainNumbers, prior, lottery, '100', tested.target.drawDate)
        assert.equal(m.generated.score, reference.score)
        m.generated.components.forEach((c, i) => assert.ok(Math.abs(c.score - reference.components[i]) < 1e-9))
      }
      const poisoned = dataset.drawings.map(d => d.drawDate >= tested.target.drawDate ? { ...d, mainNumbers: [1, 3, 5, 7, 9], specialBall: 1 } : d)
      const isolated = await runBacktest(poisoned, { ...config, range: { kind: 'custom', start: tested.target.drawDate, end: tested.target.drawDate } }, fast)
      tested.batches.forEach((b, i) => assert.deepEqual(b.combinations.map(m => m.generated), isolated.targets[0].batches[i].combinations.map(m => m.generated)))
      audits.push({ lottery: lottery.id, target: tested.target.drawDate, minTrainingDate: prior.at(-1).drawDate, maxTrainingDate: prior[0].drawDate, trainingCount: prior.length, strategies: tested.batches.map(b => b.strategy), checks: 'strict date boundary; exact training dates; all main/special frequency/recent/gap inputs; every pair and structural count; trend weights; 30 independent Pattern Scores; unchanged generations after target/future poisoning', mismatches: 0 })
    }
    // A real target from an older verified matrix proves historical range use.
    const oldRule = lottery.ruleSets.at(-2)
    const oldTarget = dataset.drawings.filter(d => d.ruleSetId === oldRule.id).at(-1)
    const old = await runBacktest(dataset.drawings, { ...config, range: { kind: 'custom', start: oldTarget.drawDate, end: oldTarget.drawDate } }, fast)
    assert.equal(old.targets[0].rule.id, oldRule.id)
    independentlyVerify(old, dataset.drawings)
    historical.push({ lottery: lottery.id, target: oldTarget.drawDate, rule: oldRule.id, mainMax: oldRule.mainBallMax, specialMax: oldRule.specialBallMax, combinations: old.combinationsGenerated })
    report.push({ lottery: lottery.id, dataThrough: dataset.dataThrough, result, independent: summaries, reproducible: true, mismatches: 0 })
    console.log(JSON.stringify({ lottery: lottery.id, targets: result.targetsTested, combinations: result.combinationsGenerated, summaries, reproducible: true }))
  }
  await writeFile('artifacts/backtest-real-data.json', JSON.stringify({ asOfDate, report, audits, historical }, null, 2))
  await writeFile('artifacts/backtest-verification-datasets.json', JSON.stringify(datasets))
  console.log(`PASS: ${report.length} representative backtests; ${audits.length} audited targets × 3 strategies; zero mismatches.`)
}
