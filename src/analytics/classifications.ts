import { CLASSIFICATION_RULES } from '../config/analysis.ts'
import type { NumberStatistics, NumberStatus } from '../types/analysis.ts'

export function classificationThresholds(drawings: number, rangeSize: number, ballsPerDrawing: number) {
  const average = drawings * ballsPerDrawing / rangeSize
  return {
    hot: average * CLASSIFICATION_RULES.hotAverageMultiple,
    cold: average * CLASSIFICATION_RULES.coldAverageMultiple,
    overdue: Math.ceil(rangeSize / ballsPerDrawing * CLASSIFICATION_RULES.overdueGapMultiple),
    enabled: drawings >= CLASSIFICATION_RULES.minimumDrawings,
  }
}
export function classifyNumber(stat: NumberStatistics, drawings: number, rangeSize: number, ballsPerDrawing: number): NumberStatus[] {
  const thresholds = classificationThresholds(drawings, rangeSize, ballsPerDrawing)
  if (!thresholds.enabled) return []
  const labels: NumberStatus[] = []
  if (stat.appearances >= thresholds.hot) labels.push('Hot')
  if (stat.appearances <= thresholds.cold) labels.push('Cold')
  if (stat.gapLowerBound >= thresholds.overdue) labels.push('Overdue')
  return labels
}
export function getHotNumbers(stats: readonly NumberStatistics[]): NumberStatistics[] {
  return stats.filter((stat) => stat.statuses.includes('Hot')).sort((a, b) => b.appearances - a.appearances || a.number - b.number)
}
export function getColdNumbers(stats: readonly NumberStatistics[]): NumberStatistics[] {
  return stats.filter((stat) => stat.statuses.includes('Cold')).sort((a, b) => a.appearances - b.appearances || a.number - b.number)
}
export function getOverdueNumbers(stats: readonly NumberStatistics[]): NumberStatistics[] {
  return stats.filter((stat) => stat.statuses.includes('Overdue')).sort((a, b) => b.gapLowerBound - a.gapLowerBound || a.number - b.number)
}
