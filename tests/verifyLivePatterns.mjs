import assert from 'node:assert/strict'
import { lotteries } from '../src/config/lotteries.ts'
import { fetchLotteryDataset } from '../src/services/nyOpenData.ts'
import { calculateAnalysis } from '../src/analytics/numberStatistics.ts'
const asOfDate = new Date().toISOString().slice(0, 10)
for (const lottery of Object.values(lotteries)) {
  const dataset = await fetchLotteryDataset(lottery)
  for (const period of ['20', '50', '100', 'current-era']) {
    const analysis = calculateAnalysis(dataset.drawings, { lottery, period, asOfDate })
    const rule = analysis.ruleSet
    const era = dataset.drawings.filter((d) => d.ruleVerification === 'verified' && d.ruleSetId === rule.id && d.drawDate <= asOfDate).sort((a, b) => b.drawDate.localeCompare(a.drawDate))
    const selected = period === 'current-era' ? era : era.slice(0, Number(period))
    const result = analysis.patterns
    const n = selected.length
    // Independent pair enumeration over the entire valid range, not per-draw combinations.
    const pairs = []
    for (let a = rule.mainBallMin; a <= rule.mainBallMax; a++) for (let b = a + 1; b <= rule.mainBallMax; b++) {
      const count = selected.filter((d) => d.mainNumbers.includes(a) && d.mainNumbers.includes(b)).length
      if (count) pairs.push({ numbers: [a, b], count, percent: count / n * 100 })
    }
    pairs.sort((a, b) => b.count - a.count || a.numbers[0] - b.numbers[0] || a.numbers[1] - b.numbers[1])
    assert.deepEqual(result.commonPairs, pairs)
    const boundary = Math.floor((rule.mainBallMin + rule.mainBallMax) / 2)
    for (let k = 0; k <= 5; k++) {
      const odd = selected.filter((d) => d.mainNumbers.reduce((a, b) => a + b % 2, 0) === k).length
      const low = selected.filter((d) => d.mainNumbers.reduce((a, b) => a + Number(b <= boundary), 0) === k).length
      assert.equal(result.oddEven[k].count, odd)
      assert.equal(result.oddEven[k].percent, odd / n * 100)
      assert.equal(result.lowHigh[k].count, low)
      assert.equal(result.lowHigh[k].percent, low / n * 100)
    }
    const sums = selected.map((d) => d.mainNumbers.reduce((a, b) => a + b, 0))
    const independentSums = [...new Set(sums)].sort((a, b) => a - b).map((sum) => ({ sum, count: sums.filter((s) => s === sum).length, percent: sums.filter((s) => s === sum).length / n * 100 }))
    assert.deepEqual(result.sums, independentSums)
    const included = selected.filter((d) => d.mainNumbers.some((a) => d.mainNumbers.includes(a + 1))).length
    assert.equal(result.consecutive.included.count, included)
    assert.equal(result.consecutive.included.percent, included / n * 100)
    assert.equal(result.consecutive.absent.count, n - included)
    assert.equal(result.consecutive.absent.percent, (n - included) / n * 100)
    console.log(JSON.stringify({ lottery: lottery.id, period, n, topPair: result.commonPairs[0], odd3: result.oddEven[3], low3: result.lowHigh[3], firstSum: result.sums[0], consecutive: result.consecutive.included, status: 'all pair and distribution counts independently matched' }))
  }
}
