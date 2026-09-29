import type { Drawing, LotteryRuleSet } from '../types/lottery.ts'
import type { PatternAnalysisResult } from '../types/patterns.ts'
import { PATTERN_SCORE_CONFIG } from '../config/patternScore.ts'

export type ScoreConfig = { weights: Record<'odd' | 'low' | 'sum' | 'spacing' | 'consecutive' | 'pair', number>; sumBinWidth: number; spacingBinWidth: number }
export function structure(numbers: readonly number[], rule: LotteryRuleSet) {
  const main = [...numbers].sort((a, b) => a - b)
  if (main.length !== rule.mainBallCount || new Set(main).size !== main.length || main.some(n => !Number.isInteger(n) || n < rule.mainBallMin || n > rule.mainBallMax)) throw new Error('Invalid main-number combination.')
  return {
    odd: main.filter(n => n % 2).length,
    low: main.filter(n => n <= Math.floor((rule.mainBallMin + rule.mainBallMax) / 2)).length,
    sum: main.reduce((a, b) => a + b, 0),
    spacing: (main.at(-1)! - main[0]) / (main.length - 1),
    consecutive: main.some((n, i) => i > 0 && n === main[i - 1] + 1),
  }
}
export function createScoreModel(drawings: readonly Drawing[], rule: LotteryRuleSet, patterns: PatternAnalysisResult, config: ScoreConfig = PATTERN_SCORE_CONFIG) {
  if (!drawings.length) throw new Error('Pattern scoring requires selected historical drawings.')
  if (Object.values(config.weights).some(w => !Number.isFinite(w) || w < 0) || Math.abs(Object.values(config.weights).reduce((a, b) => a + b, 0) - 100) > 1e-9 || !Number.isFinite(config.sumBinWidth) || config.sumBinWidth <= 0 || !Number.isFinite(config.spacingBinWidth) || config.spacingBinWidth <= 0) throw new Error('Invalid Pattern Score configuration; weights must total 100%.')
  const sum = new Map<number, number>(), spacing = new Map<number, number>()
  patterns.sums.forEach(s => { const bin = Math.floor(s.sum / config.sumBinWidth); sum.set(bin, (sum.get(bin) ?? 0) + s.count) })
  drawings.forEach(d => { const bin = Math.floor(structure(d.mainNumbers, rule).spacing / config.spacingBinWidth); spacing.set(bin, (spacing.get(bin) ?? 0) + 1) })
  return { rule, config, patterns, sum, spacing, pairs: new Map(patterns.commonPairs.map(p => [p.numbers.join(':'), p.count])) }
}
export type ScoreModel = ReturnType<typeof createScoreModel>
const fit = (count: number, counts: number[]) => 100 * count / Math.max(1, ...counts)
export function calculatePatternScore(numbers: readonly number[], model: ScoreModel) {
  const facts = structure(numbers, model.rule), p = model.patterns
  const main = [...numbers].sort((a, b) => a - b)
  let pairTotal = 0, pairCount = 0
  for (let i = 0; i < main.length; i++) for (let j = i + 1; j < main.length; j++) { pairTotal += model.pairs.get(`${main[i]}:${main[j]}`) ?? 0; pairCount++ }
  const scores = {
    odd: fit(p.oddEven[facts.odd].count, p.oddEven.map(c => c.count)),
    low: fit(p.lowHigh[facts.low].count, p.lowHigh.map(c => c.count)),
    sum: fit(model.sum.get(Math.floor(facts.sum / model.config.sumBinWidth)) ?? 0, [...model.sum.values()]),
    spacing: fit(model.spacing.get(Math.floor(facts.spacing / model.config.spacingBinWidth)) ?? 0, [...model.spacing.values()]),
    consecutive: fit((facts.consecutive ? p.consecutive.included : p.consecutive.absent).count, [p.consecutive.included.count, p.consecutive.absent.count]),
    pair: fit(pairTotal / pairCount, [...model.pairs.values()]),
  }
  const components = (Object.keys(scores) as (keyof typeof scores)[]).map(key => ({ key, score: scores[key], weight: model.config.weights[key], contribution: scores[key] * model.config.weights[key] / 100 }))
  return { score: Math.round(components.reduce((total, c) => total + c.contribution, 0) * 100) / 100, components, facts }
}
