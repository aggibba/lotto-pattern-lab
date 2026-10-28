import { calculatePatternScore } from '../analytics/patternScore.ts'
import { canonicalCombination, type GeneratedCombination, type prepareGenerator } from './generateCombinations.ts'
import { randomMain, randomSpecial, unit, type RNG } from './randomGenerator.ts'

export const MAX_SCORE_ATTEMPTS = 5000
// Optimize only slot zero. Remaining strategy-generated combinations are untouched.
export async function highestPatternScore(context: ReturnType<typeof prepareGenerator>, batch: GeneratedCombination[], options: { signal?: AbortSignal; rng?: RNG; maxAttempts?: number; yieldControl?: () => Promise<void> } = {}) {
  const { signal, rng = Math.random, maxAttempts = MAX_SCORE_ATTEMPTS, yieldControl = () => new Promise<void>(resolve => setTimeout(resolve, 0)) } = options
  if (!batch.length || !Number.isSafeInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > MAX_SCORE_ATTEMPTS) throw new Error('Invalid bounded search request.')
  const check = () => { if (signal?.aborted) throw new Error('Search cancelled.') }
  check()
  const rule = context.analysis.ruleSet
  let bestMain = batch[0].mainNumbers
  let best = calculatePatternScore(bestMain, context.model)
  for (const item of batch.slice(1)) {
    const score = calculatePatternScore(item.mainNumbers, context.model)
    if (score.score > best.score) { bestMain = item.mainNumbers; best = score }
  }
  let attempts = 0
  await yieldControl()
  while (attempts < maxAttempts && best.score < 100) {
    check()
    const started = performance.now()
    for (let chunk = 0; chunk < 32 && attempts < maxAttempts && best.score < 100; chunk++) {
      attempts++
      // Random restarts explore broadly; single-number mutations refine the best fit.
      let main = randomMain(rule, rng)
      if (attempts % 2 === 0) {
        main = [...bestMain]
        const index = Math.floor(unit(rng) * main.length)
        const available = Array.from({ length: rule.mainBallMax - rule.mainBallMin + 1 }, (_, i) => i + rule.mainBallMin).filter(n => !main.includes(n))
        if (available.length) main[index] = available[Math.floor(unit(rng) * available.length)]
        main.sort((a, b) => a - b)
      }
      const score = calculatePatternScore(main, context.model)
      if (score.score > best.score) { bestMain = main; best = score }
      if (performance.now() - started >= 8) break
    }
    await yieldControl()
  }
  check()
  const occupied = new Set(batch.slice(1).map(item => canonicalCombination(item.mainNumbers, item.specialBall)))
  const start = randomSpecial(rule, rng)
  const pool = rule.specialBallMax - rule.specialBallMin + 1
  for (let offset = 0; offset < pool; offset++) {
    const specialBall = rule.specialBallMin + (start - rule.specialBallMin + offset) % pool
    if (!occupied.has(canonicalCombination(bestMain, specialBall))) return { combinations: [{ ...batch[0], selectionMethod: 'highest-pattern-score' as const, mainNumbers: bestMain, specialBall, ...best }, ...batch.slice(1)], attempts }
  }
  throw new Error('No unique special ball is available for the highest-scoring candidate.')
}
