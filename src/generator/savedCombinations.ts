import { lotteries } from '../config/lotteries.ts'
import { ANALYSIS_PERIODS } from '../config/analysis.ts'
import { STRATEGIES } from '../config/generator.ts'
import { getCurrentRuleSet } from '../analytics/drawingSelection.ts'
import { structure } from '../analytics/patternScore.ts'
import type { GeneratedCombination } from './generateCombinations.ts'
export const STORAGE_KEY = 'lotto-pattern-lab.saved.v1'
export type SavedCombination = Pick<GeneratedCombination, 'lottery' | 'mainNumbers' | 'specialBall' | 'strategy' | 'score' | 'period' | 'generatedAt'>
export function deserializeSaved(text: string | null): SavedCombination[] {
  if (text === null) return []
  const envelope = JSON.parse(text)
  if (envelope?.version !== 1 || !Array.isArray(envelope.items)) throw new Error('Saved combinations have an unsupported format.')
  for (const item of envelope.items) {
    if (!item || !Object.hasOwn(lotteries, item.lottery) || !STRATEGIES.includes(item.strategy) || !ANALYSIS_PERIODS.some(p => p.value === item.period) || typeof item.generatedAt !== 'string' || !Number.isFinite(Date.parse(item.generatedAt)) || typeof item.score !== 'number' || !Number.isFinite(item.score) || item.score < 0 || item.score > 100 || !Array.isArray(item.mainNumbers)) throw new Error('Saved combination data is invalid.')
    const rule = getCurrentRuleSet(lotteries[item.lottery as keyof typeof lotteries], item.generatedAt.slice(0, 10))
    structure(item.mainNumbers, rule)
    if (!Number.isInteger(item.specialBall) || item.specialBall < rule.specialBallMin || item.specialBall > rule.specialBallMax) throw new Error('Saved special ball is invalid.')
  }
  return envelope.items
}
export function serializeSaved(items: readonly SavedCombination[]) {
  const text = JSON.stringify({ version: 1, items: items.map(({ lottery, mainNumbers, specialBall, strategy, score, period, generatedAt }) => ({ lottery, mainNumbers, specialBall, strategy, score, period, generatedAt })) })
  deserializeSaved(text)
  return text
}
