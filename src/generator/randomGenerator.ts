import type { LotteryRuleSet } from '../types/lottery.ts'
export type RNG = () => number
export function unit(rng: RNG) {
  const value = rng()
  if (!Number.isFinite(value) || value < 0 || value >= 1) throw new Error('RNG must return a finite value in [0, 1).')
  return value
}
export function randomMain(rule: LotteryRuleSet, rng: RNG = Math.random) {
  const pool = Array.from({ length: rule.mainBallMax - rule.mainBallMin + 1 }, (_, i) => i + rule.mainBallMin)
  const result: number[] = []
  for (let i = 0; i < rule.mainBallCount; i++) result.push(pool.splice(Math.floor(unit(rng) * pool.length), 1)[0])
  return result.sort((a, b) => a - b)
}
export function randomSpecial(rule: LotteryRuleSet, rng: RNG = Math.random) {
  return rule.specialBallMin + Math.floor(unit(rng) * (rule.specialBallMax - rule.specialBallMin + 1))
}
export function randomGenerator(rule: LotteryRuleSet, rng: RNG = Math.random) {
  return { mainNumbers: randomMain(rule, rng), specialBall: randomSpecial(rule, rng) }
}
