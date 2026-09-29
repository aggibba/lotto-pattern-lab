import type { PatternAnalysisResult } from './patterns.ts'
import type { AnalysisPeriod } from '../config/analysis.ts'
import type { Lottery, LotteryRuleSet } from './lottery.ts'
export type NumberStatus = 'Hot' | 'Cold' | 'Overdue'
export interface NumberStatistics {
  number: number
  appearances: number
  frequencyPercent: number | null
  lastDrawnDate: string | null
  drawingsSinceLastAppearance: number | null
  // When never seen in the selected window, only this lower bound is known.
  gapLowerBound: number
  recent20: number
  recent50: number
  recent100: number
  statuses: readonly NumberStatus[]
}
export interface AnalysisConfig {
  lottery: Lottery
  period: AnalysisPeriod
  asOfDate: string // Explicit date keeps calculations deterministic/reusable.
}
export interface NumberAnalysisResult {
  ruleSet: LotteryRuleSet
  period: AnalysisPeriod
  drawingsAnalyzed: number
  currentEraCount: number
  dataThrough: string | null
  periodStart: string | null
  recentSampleSizes: { recent20: number; recent50: number; recent100: number }
  mainNumbers: readonly NumberStatistics[]
  specialBalls: readonly NumberStatistics[]
  patterns: PatternAnalysisResult
  warnings: readonly string[]
}
export type StatisticsSortKey = 'number' | 'appearances' | 'frequencyPercent' | 'drawingsSinceLastAppearance' | 'recent20' | 'recent50' | 'recent100'
