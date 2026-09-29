import assert from 'node:assert/strict'
import { lotteries } from '../src/config/lotteries.ts'
import { fetchLotteryDataset } from '../src/services/nyOpenData.ts'
import { calculateAnalysis } from '../src/analytics/numberStatistics.ts'
const asOfDate = new Date().toISOString().slice(0, 10)
for (const lottery of Object.values(lotteries)) {
  const dataset = await fetchLotteryDataset(lottery)
  const analysis = calculateAnalysis(dataset.drawings, { lottery, period: 'current-era', asOfDate })
  // Independent direct filtering checks each number against the normalized feed.
  const era = dataset.drawings.filter((d) => d.ruleVerification === 'verified' && d.ruleSetId === analysis.ruleSet.id && d.drawDate <= asOfDate).sort((a, b) => b.drawDate.localeCompare(a.drawDate))
  for (const period of ['20', '50', '100', 'current-era']) {
    const result = calculateAnalysis(dataset.drawings, { lottery, period, asOfDate })
    const selection = period === 'current-era' ? era : era.slice(0, Number(period))
    for (const [stats, special] of [[result.mainNumbers, false], [result.specialBalls, true]]) {
      for (const stat of stats) {
        const matches = (d) => special ? d.specialBall === stat.number : d.mainNumbers.includes(stat.number)
        assert.equal(stat.appearances, selection.filter(matches).length)
        assert.equal(stat.frequencyPercent, stat.appearances / selection.length * 100)
        const index = selection.findIndex(matches)
        assert.equal(stat.drawingsSinceLastAppearance, index < 0 ? null : index)
        assert.equal(stat.lastDrawnDate, index < 0 ? null : selection[index].drawDate)
        for (const window of [20, 50, 100]) assert.equal(stat[`recent${window}`], selection.slice(0, window).filter(matches).length)
      }
    }
  }
  console.log(JSON.stringify({ lottery: lottery.name, era: analysis.ruleSet.id, currentEraCount: analysis.currentEraCount, earliest: analysis.periodStart, latest: analysis.dataThrough, examples: analysis.mainNumbers.filter((stat) => [1, 2, 3].includes(stat.number)), warnings: analysis.warnings, independentChecks: 'passed: all numbers, both pools, all four periods' }, null, 2))
}
