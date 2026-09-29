import type { Drawing, Lottery } from '../types/lottery.ts'
import { getCurrentRuleSet } from '../analytics/drawingSelection.ts'
import { parseDrawDate } from '../utils/drawingValidation.ts'
import type { BacktestConfig, WindowSize } from './backtestTypes.ts'
export function verifiedHistoricalRule(target: Drawing, lottery: Lottery) {
  if (target.lotteryId !== lottery.id || target.ruleVerification !== 'verified') return null
  try {
    const rule = getCurrentRuleSet(lottery, target.drawDate)
    return target.ruleSetId === rule.id ? rule : null
  } catch { return null }
}
export function validateBacktestDrawings(drawings: readonly Drawing[], lottery: Lottery) {
  const dates = new Set<string>()
  for (const d of drawings) {
    if (!d || d.lotteryId !== lottery.id || typeof d.drawDate !== 'string' || d.drawDate.length !== 10 || parseDrawDate(d.drawDate) !== d.drawDate || dates.has(d.drawDate)) throw new Error('Backtest requires unique normalized dates from one lottery.')
    dates.add(d.drawDate)
    if (!Array.isArray(d.mainNumbers) || d.mainNumbers.length !== 5 || new Set(d.mainNumbers).size !== 5 || ![...d.mainNumbers, d.specialBall].every(n => Number.isSafeInteger(n) && n > 0) || !['verified', 'unverified'].includes(d.ruleVerification)) throw new Error('Malformed normalized backtest drawing.')
    const rule = verifiedHistoricalRule(d, lottery)
    if (rule && (d.mainNumbers.some(n => n < rule.mainBallMin || n > rule.mainBallMax) || d.specialBall < rule.specialBallMin || d.specialBall > rule.specialBallMax)) throw new Error('Drawing is outside its verified historical rule ranges.')
  }
}
// The only data boundary into Step 5: target and future rows are removed BEFORE
// analytics, generation, scoring, or a window is prepared. Era changes never mix.
export function getHistoricalTrainingData(drawings: readonly Drawing[], target: Drawing, lottery: Lottery, window: WindowSize): Drawing[] {
  if (![20, 50, 100].includes(window)) throw new Error('Invalid historical training window.')
  const rule = verifiedHistoricalRule(target, lottery)
  if (!rule) return []
  return drawings.filter(d => d.lotteryId === lottery.id && d.drawDate < target.drawDate && d.drawDate >= rule.effectiveFrom && d.ruleVerification === 'verified' && d.ruleSetId === rule.id)
    .sort((a, b) => b.drawDate.localeCompare(a.drawDate)).slice(0, window)
}
export function selectBacktestTargets(drawings: readonly Drawing[], config: BacktestConfig) {
  if (config.asOfDate.length !== 10 || parseDrawDate(config.asOfDate) !== config.asOfDate) throw new Error('Invalid backtest as-of date.')
  const eligible = drawings.filter(d => d.drawDate <= config.asOfDate).sort((a, b) => a.drawDate.localeCompare(b.drawDate))
  if (config.range.kind === 'last') {
    if (![20, 50, 100].includes(config.range.count)) throw new Error('Invalid target range.')
    return eligible.slice(-config.range.count)
  }
  if (config.range.kind !== 'custom') throw new Error('Invalid target range.')
  const { start, end } = config.range
  if (start.length !== 10 || end.length !== 10 || parseDrawDate(start) !== start || parseDrawDate(end) !== end || start > end || end > config.asOfDate) throw new Error('Custom dates must be valid, ordered, and no later than the as-of date.')
  return eligible.filter(d => d.drawDate >= start && d.drawDate <= end)
}
