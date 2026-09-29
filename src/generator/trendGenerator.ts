import type { NumberStatistics } from '../types/analysis.ts'
import { GENERATOR_CONFIG } from '../config/generator.ts'
import { unit, type RNG } from './randomGenerator.ts'
export type GeneratorConfig = { trend: Record<'recent20' | 'recent50' | 'recent100' | 'appearances' | 'gapLowerBound', number>; baselineWeight: number; trendStrength: number; balancedCandidates: number; maxAttemptsPerCombination: number }
export function trendWeights(stats: readonly NumberStatistics[], config: GeneratorConfig = GENERATOR_CONFIG) {
  const keys = Object.keys(config.trend) as (keyof typeof config.trend)[]
  const maxima = Object.fromEntries(keys.map(key => [key, Math.max(1, ...stats.map(s => s[key]))]))
  return stats.map(s => ({ number: s.number, weight: config.baselineWeight + config.trendStrength * keys.reduce((v, key) => v + config.trend[key] * s[key] / maxima[key], 0) }))
}
export function weightedSample(weights: ReturnType<typeof trendWeights>, count: number, rng: RNG = Math.random) {
  const pool = [...weights], result: number[] = []
  for (let i = 0; i < count; i++) {
    let target = unit(rng) * pool.reduce((v, entry) => v + entry.weight, 0)
    let index = pool.length - 1
    for (let j = 0; j < pool.length; j++) { target -= pool[j].weight; if (target < 0) { index = j; break } }
    result.push(pool.splice(index, 1)[0].number)
  }
  return result.sort((a, b) => a - b)
}
