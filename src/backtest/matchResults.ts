import type { Drawing } from '../types/lottery.ts'
import type { Strategy } from '../config/generator.ts'
import type { GeneratedCombination } from '../generator/generateCombinations.ts'
import type { StrategySummary, TestedTarget } from './backtestTypes.ts'
export function matchCombination(generated: Pick<GeneratedCombination, 'mainNumbers' | 'specialBall'>, target: Pick<Drawing, 'mainNumbers' | 'specialBall'>) {
  const winningMain = new Set(target.mainNumbers)
  return { mainMatches: generated.mainNumbers.filter(n => winningMain.has(n)).length, specialMatch: generated.specialBall === target.specialBall }
}
export function summarizeStrategy(targets: readonly TestedTarget[], strategy: Strategy): StrategySummary {
  const matches = targets.flatMap(t => t.batches.filter(b => b.strategy === strategy).flatMap(b => b.combinations))
  const mainDistribution = Array<number>(6).fill(0)
  matches.forEach(m => mainDistribution[m.mainMatches]++)
  return {
    strategy, combinations: matches.length,
    averageMainMatches: matches.length ? matches.reduce((sum, m) => sum + m.mainMatches, 0) / matches.length : null,
    mainDistribution, specialMatches: matches.filter(m => m.specialMatch).length,
    atLeast2: matches.filter(m => m.mainMatches >= 2).length,
    atLeast3: matches.filter(m => m.mainMatches >= 3).length,
    atLeast4: matches.filter(m => m.mainMatches >= 4).length,
  }
}
