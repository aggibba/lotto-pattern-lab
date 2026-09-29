import type { Drawing } from '../types/lottery.ts'
import type { AnalysisConfig } from '../types/analysis.ts'
import { calculateAnalysis } from '../analytics/numberStatistics.ts'
import { selectAnalysisDrawings } from '../analytics/drawingSelection.ts'
import { calculatePatternScore, createScoreModel, type ScoreConfig } from '../analytics/patternScore.ts'
import { PATTERN_SCORE_CONFIG } from '../config/patternScore.ts'
import { GENERATOR_CONFIG, STRATEGIES, type Strategy } from '../config/generator.ts'
import { randomGenerator, randomSpecial, type RNG } from './randomGenerator.ts'
import { balancedGenerator } from './balancedGenerator.ts'
import { trendWeights, weightedSample, type GeneratorConfig } from './trendGenerator.ts'
export const canonicalCombination = (main: readonly number[], special: number) => `${[...main].sort((a, b) => a - b).join(',')}|${special}`
export function prepareGenerator(drawings: readonly Drawing[], selection: AnalysisConfig, scoreConfig: ScoreConfig = PATTERN_SCORE_CONFIG) {
  const analysis = calculateAnalysis(drawings, selection)
  const { selected } = selectAnalysisDrawings(drawings, selection)
  return { analysis, selected, selection, model: createScoreModel(selected, analysis.ruleSet, analysis.patterns, scoreConfig) }
}
export function generateCombinations(context: ReturnType<typeof prepareGenerator>, strategy: Strategy, count: number, rng: RNG = Math.random, config: GeneratorConfig = GENERATOR_CONFIG, generatedAt = new Date().toISOString()) {
  if (!STRATEGIES.includes(strategy) || ![1, 5, 10, 20].includes(count)) throw new Error('Invalid generation request.')
  if (!Number.isSafeInteger(config.maxAttemptsPerCombination) || config.maxAttemptsPerCombination < 1 || !Number.isSafeInteger(config.balancedCandidates) || config.balancedCandidates < 1 || !Number.isFinite(config.baselineWeight) || config.baselineWeight <= 0 || !Number.isFinite(config.trendStrength) || config.trendStrength < 0 || Object.values(config.trend).some(w => !Number.isFinite(w) || w < 0)) throw new Error('Invalid generator configuration.')
  const { analysis, model, selected } = context, rule = analysis.ruleSet
  const mainWeights = strategy === 'Trend Weighted' ? trendWeights(analysis.mainNumbers, config) : []
  const specialWeights = strategy === 'Trend Weighted' ? trendWeights(analysis.specialBalls, config) : []
  const results = [], seen = new Set<string>()
  for (let attempt = 0; results.length < count && attempt < count * config.maxAttemptsPerCombination; attempt++) {
    const combination = strategy === 'Random' ? randomGenerator(rule, rng) : strategy === 'Balanced' ? { mainNumbers: balancedGenerator(selected, rule, rng, config.balancedCandidates), specialBall: randomSpecial(rule, rng) } : { mainNumbers: weightedSample(mainWeights, rule.mainBallCount, rng), specialBall: weightedSample(specialWeights, 1, rng)[0] }
    const key = canonicalCombination(combination.mainNumbers, combination.specialBall)
    if (seen.has(key)) continue
    seen.add(key)
    results.push({ ...combination, lottery: context.selection.lottery.id, strategy, period: context.selection.period, generatedAt, ...calculatePatternScore(combination.mainNumbers, model) })
  }
  if (results.length !== count) throw new Error('Unique batch retry limit reached. Try generating again or select fewer combinations.')
  return results
}
export type GeneratedCombination = ReturnType<typeof generateCombinations>[number]
