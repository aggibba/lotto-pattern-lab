import type { Drawing, Lottery, LotteryRuleSet } from '../types/lottery.ts'
import type { Strategy } from '../config/generator.ts'
import type { GeneratedCombination } from '../generator/generateCombinations.ts'
export const BACKTEST_VERSION = 'step6-v1'
export const BACKTEST_DISCLAIMER = 'Backtesting compares how generation strategies behaved against historical drawings using only information available before each drawing. Historical backtest results do not indicate future winning probability.'
export type WindowSize = 20 | 50 | 100
export type BacktestRange = { kind: 'last'; count: WindowSize } | { kind: 'custom'; start: string; end: string }
export interface BacktestConfig {
  lottery: Lottery
  strategy: Strategy | 'Compare All'
  trainingWindow: WindowSize
  combinationsPerTarget: 1 | 5 | 10 | 20
  range: BacktestRange
  asOfDate: string
}
export interface MatchedCombination { generated: GeneratedCombination; mainMatches: number; specialMatch: boolean }
export interface StrategyBatch { strategy: Strategy; seed: string; combinations: MatchedCombination[] }
export interface TestedTarget {
  target: Drawing
  rule: LotteryRuleSet
  trainingDates: string[]
  batches: StrategyBatch[]
}
export interface ExcludedTarget { targetDate: string; reason: 'Excluded — unverified historical rule set' | 'Excluded — insufficient prior history'; availableHistory: number | null; requiredHistory: number }
export interface StrategySummary {
  strategy: Strategy
  combinations: number
  averageMainMatches: number | null
  mainDistribution: number[]
  specialMatches: number
  atLeast2: number
  atLeast3: number
  atLeast4: number
}
export interface BacktestResult {
  version: string
  config: BacktestConfig
  targetsRequested: number
  targetsTested: number
  targetsExcluded: number
  combinationsGenerated: number
  targets: TestedTarget[]
  exclusions: ExcludedTarget[]
  summaries: StrategySummary[]
  warnings: string[]
}
export interface BacktestProgress { completed: number; total: number }
export interface BacktestOptions {
  signal?: AbortSignal
  onProgress?: (progress: BacktestProgress) => void
  // Injectable scheduler for tests or non-browser consumers; never changes RNG.
  yieldControl?: () => Promise<void>
}
