import type { Drawing, LotteryRuleSet } from '../types/lottery.ts'
import { structure } from '../analytics/patternScore.ts'
import { randomMain, unit, type RNG } from './randomGenerator.ts'
import { GENERATOR_CONFIG } from '../config/generator.ts'
export function balancedGenerator(drawings: readonly Drawing[], rule: LotteryRuleSet, rng: RNG = Math.random, candidates: number = GENERATOR_CONFIG.balancedCandidates) {
  const target = structure(drawings[Math.floor(unit(rng) * drawings.length)].mainNumbers, rule)
  let best: number[] = [], bestDistance = Infinity
  const range = rule.mainBallMax - rule.mainBallMin
  for (let i = 0; i < candidates; i++) {
    const main = randomMain(rule, rng), s = structure(main, rule)
    const distance = Math.abs(s.odd - target.odd) / rule.mainBallCount + Math.abs(s.low - target.low) / rule.mainBallCount + Math.abs(s.sum - target.sum) / (range * rule.mainBallCount) + Math.abs(s.spacing - target.spacing) / (range / (rule.mainBallCount - 1)) + Number(s.consecutive !== target.consecutive)
    if (distance < bestDistance) { best = main; bestDistance = distance }
  }
  return best
}
