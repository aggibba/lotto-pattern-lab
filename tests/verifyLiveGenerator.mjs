import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { lotteries } from '../src/config/lotteries.ts'
import { fetchLotteryDataset } from '../src/services/nyOpenData.ts'
import { prepareGenerator, generateCombinations } from '../src/generator/generateCombinations.ts'
// Independent reference implementation: raw drawings, no production selection,
// pattern aggregation, structure, scoring helpers, or score configuration imports.
export function independentScore(main, raw, lottery, period, asOfDate) {
  const rule = lottery.ruleSets.find(r => r.effectiveFrom <= asOfDate && (!r.effectiveTo || asOfDate < r.effectiveTo))
  let selected = raw.filter(d => d.ruleVerification === 'verified' && d.ruleSetId === rule.id && d.drawDate <= asOfDate).sort((a, b) => b.drawDate.localeCompare(a.drawDate))
  if (period !== 'current-era') selected = selected.slice(0, Number(period))
  function features(nums) {
    const sorted = nums.toSorted((a, b) => a - b)
    const gaps = sorted.slice(1).map((n, i) => n - sorted[i])
    return [nums.reduce((n, x) => n + x % 2, 0), nums.reduce((n, x) => n + Number(x <= Math.floor((rule.mainBallMin + rule.mainBallMax) / 2)), 0), Math.floor(nums.reduce((a, b) => a + b, 0) / 25), Math.floor(gaps.reduce((a, b) => a + b, 0) / gaps.length / 5), Number(gaps.includes(1))]
  }
  const history = selected.map(d => features(d.mainNumbers)), query = features(main)
  const components = query.map((v, i) => {
    const frequencies = history.reduce((map, values) => map.set(values[i], (map.get(values[i]) ?? 0) + 1), new Map())
    return 100 * (frequencies.get(v) ?? 0) / Math.max(...frequencies.values())
  })
  let maxPair = 0
  for (let a = rule.mainBallMin; a <= rule.mainBallMax; a++) for (let b = a + 1; b <= rule.mainBallMax; b++) maxPair = Math.max(maxPair, selected.filter(d => d.mainNumbers.includes(a) && d.mainNumbers.includes(b)).length)
  let pairCounts = 0, nPairs = 0
  main.forEach((a, i) => main.slice(i + 1).forEach(b => { pairCounts += selected.filter(d => d.mainNumbers.includes(a) && d.mainNumbers.includes(b)).length; nPairs++ }))
  components.push(100 * pairCounts / nPairs / Math.max(1, maxPair))
  const weights = [20, 20, 20, 15, 15, 10]
  const contributions = components.map((v, i) => v * weights[i] / 100)
  return { score: Math.round(contributions.reduce((a, b) => a + b, 0) * 100) / 100, components, contributions, n: selected.length }
}
if (process.argv[1]?.endsWith('verifyLiveGenerator.mjs')) {
  const asOfDate = new Date().toISOString().slice(0, 10), report = [], datasets = []
  let seed = 20260928
  const rng = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296 }
  for (const lottery of Object.values(lotteries)) {
    const dataset = await fetchLotteryDataset(lottery)
    datasets.push(dataset)
    for (const period of ['20', '50', '100', 'current-era']) {
      const context = prepareGenerator(dataset.drawings, { lottery, period, asOfDate })
      for (const strategy of ['Random', 'Balanced', 'Trend Weighted']) {
        const generated = generateCombinations(context, strategy, 1, rng)[0]
        const independent = independentScore(generated.mainNumbers, dataset.drawings, lottery, period, asOfDate)
        assert.equal(generated.score, independent.score)
        generated.components.forEach((c, i) => assert.ok(Math.abs(c.score - independent.components[i]) < 1e-9))
        report.push({ lottery: lottery.id, period, strategy, generated, independent, mismatch: false })
      }
    }
    console.log(`${lottery.name}: all 4 periods × 3 strategies matched independently; data through ${dataset.dataThrough}`)
  }
  await mkdir('artifacts', { recursive: true })
  await writeFile('artifacts/generator-real-data.json', JSON.stringify({ asOfDate, sources: datasets.map(d => ({ lottery: d.lotteryId, dataThrough: d.dataThrough, retrievedAt: d.retrievedAt })), report }, null, 2))
  await writeFile('artifacts/generator-verification-datasets.json', JSON.stringify(datasets))
}
