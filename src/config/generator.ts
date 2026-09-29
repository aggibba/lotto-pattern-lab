export const GENERATOR_CONFIG = {
  trend: { recent20: 0.30, recent50: 0.25, recent100: 0.20, appearances: 0.20, gapLowerBound: 0.05 },
  baselineWeight: 1,
  trendStrength: 4,
  balancedCandidates: 200,
  maxAttemptsPerCombination: 100,
} as const
export const STRATEGIES = ['Random', 'Balanced', 'Trend Weighted'] as const
export type Strategy = typeof STRATEGIES[number]
