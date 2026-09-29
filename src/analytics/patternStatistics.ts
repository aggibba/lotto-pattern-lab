import type { Drawing, LotteryRuleSet } from '../types/lottery.ts'
import type { AnalysisConfig } from '../types/analysis.ts'
import type { PatternAnalysisResult, PairCount } from '../types/patterns.ts'
import { selectAnalysisDrawings } from './drawingSelection.ts'

// Internal aggregation for the already validated common analysis selection.
// Public callers with normalized data should use calculatePatternStatistics below.
export function calculateSelectedPatterns(drawings: readonly Drawing[], rule: LotteryRuleSet): PatternAnalysisResult {
  const n = drawings.length
  const lowMax = Math.floor((rule.mainBallMin + rule.mainBallMax) / 2)
  const odd = Array<number>(rule.mainBallCount + 1).fill(0)
  const low = Array<number>(rule.mainBallCount + 1).fill(0)
  const sums = new Map<number, number>()
  const pairs = new Map<string, PairCount>()
  let consecutive = 0
  const percent = (count: number) => n ? count / n * 100 : null
  for (const drawing of drawings) {
    const main = [...drawing.mainNumbers].sort((a, b) => a - b)
    odd[main.filter((number) => number % 2 !== 0).length]++
    low[main.filter((number) => number <= lowMax).length]++
    const sum = main.reduce((total, number) => total + number, 0)
    sums.set(sum, (sums.get(sum) ?? 0) + 1)
    if (main.some((number, index) => index > 0 && number === main[index - 1] + 1)) consecutive++
    for (let i = 0; i < main.length; i++) {
      for (let j = i + 1; j < main.length; j++) {
        const key = `${main[i]}:${main[j]}`
        const pair = pairs.get(key) ?? { numbers: [main[i], main[j]], count: 0, percent: null }
        pair.count++
        pairs.set(key, pair)
      }
    }
  }
  return {
    drawingsAnalyzed: n, lowMax, mainMin: rule.mainBallMin, mainMax: rule.mainBallMax, mainBallCount: rule.mainBallCount,
    commonPairs: [...pairs.values()].map((pair) => ({ ...pair, percent: percent(pair.count) }))
      .sort((a, b) => b.count - a.count || a.numbers[0] - b.numbers[0] || a.numbers[1] - b.numbers[1]),
    oddEven: odd.map((count, first) => ({ first, second: rule.mainBallCount - first, count, percent: percent(count) })),
    lowHigh: low.map((count, first) => ({ first, second: rule.mainBallCount - first, count, percent: percent(count) })),
    sums: [...sums].sort(([a], [b]) => a - b).map(([sum, count]) => ({ sum, count, percent: percent(count) })),
    consecutive: { included: { count: consecutive, percent: percent(consecutive) }, absent: { count: n - consecutive, percent: percent(n - consecutive) } },
  }
}
export function calculatePatternStatistics(drawings: readonly Drawing[], config: AnalysisConfig): PatternAnalysisResult {
  const { selected, rule } = selectAnalysisDrawings(drawings, config)
  return calculateSelectedPatterns(selected, rule)
}
