import type { Drawing, LotteryRuleSet } from '../types/lottery.ts'
import type { AnalysisConfig, NumberAnalysisResult, NumberStatistics, StatisticsSortKey } from '../types/analysis.ts'
import { selectAnalysisDrawings } from './drawingSelection.ts'
import { calculateSelectedPatterns } from './patternStatistics.ts'
export { getCurrentRuleSet } from './drawingSelection.ts'
import { classifyNumber } from './classifications.ts'

function calculatePool(drawings: readonly Drawing[], rule: LotteryRuleSet, special: boolean): NumberStatistics[] {
  const min = special ? rule.specialBallMin : rule.mainBallMin
  const max = special ? rule.specialBallMax : rule.mainBallMax
  const stats: NumberStatistics[] = Array.from({ length: max - min + 1 }, (_, index) => ({
    number: min + index, appearances: 0, frequencyPercent: drawings.length ? 0 : null,
    lastDrawnDate: null, drawingsSinceLastAppearance: null, gapLowerBound: drawings.length,
    recent20: 0, recent50: 0, recent100: 0, statuses: [],
  }))
  drawings.forEach((drawing, index) => {
    for (const number of special ? [drawing.specialBall] : drawing.mainNumbers) {
      const stat = stats[number - min]
      stat.appearances++
      if (stat.lastDrawnDate === null) {
        stat.lastDrawnDate = drawing.drawDate
        stat.drawingsSinceLastAppearance = index
        stat.gapLowerBound = index
      }
      if (index < 20) stat.recent20++
      if (index < 50) stat.recent50++
      if (index < 100) stat.recent100++
    }
  })
  stats.forEach((stat) => {
    stat.frequencyPercent = drawings.length ? stat.appearances / drawings.length * 100 : null
    stat.statuses = classifyNumber(stat, drawings.length, stats.length, special ? 1 : rule.mainBallCount)
  })
  return stats
}
export function calculateNumberStatistics(drawings: readonly Drawing[], config: AnalysisConfig): NumberStatistics[] {
  const { selected, rule } = selectAnalysisDrawings(drawings, config)
  return calculatePool(selected, rule, false)
}
export function calculateSpecialBallStatistics(drawings: readonly Drawing[], config: AnalysisConfig): NumberStatistics[] {
  const { selected, rule } = selectAnalysisDrawings(drawings, config)
  return calculatePool(selected, rule, true)
}
export function calculateAnalysis(drawings: readonly Drawing[], config: AnalysisConfig): NumberAnalysisResult {
  const { selected, eligible, rule, warnings } = selectAnalysisDrawings(drawings, config)
  return {
    ruleSet: rule, period: config.period, drawingsAnalyzed: selected.length, currentEraCount: eligible.length,
    dataThrough: selected[0]?.drawDate ?? null, periodStart: selected.at(-1)?.drawDate ?? null,
    recentSampleSizes: { recent20: Math.min(20, selected.length), recent50: Math.min(50, selected.length), recent100: Math.min(100, selected.length) },
    mainNumbers: calculatePool(selected, rule, false), specialBalls: calculatePool(selected, rule, true), patterns: calculateSelectedPatterns(selected, rule), warnings,
  }
}
export function sortStatistics(stats: readonly NumberStatistics[], key: StatisticsSortKey, direction: 'asc' | 'desc'): NumberStatistics[] {
  const sign = direction === 'asc' ? 1 : -1
  return [...stats].sort((a, b) => {
    const left = key === 'drawingsSinceLastAppearance' ? a.gapLowerBound : a[key]
    const right = key === 'drawingsSinceLastAppearance' ? b.gapLowerBound : b[key]
    if (left === null || right === null) return left === right ? a.number - b.number : left === null ? 1 : -1
    return (left - right) * sign || a.number - b.number
  })
}
