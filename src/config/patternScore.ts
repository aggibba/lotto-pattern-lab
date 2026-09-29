export const PATTERN_SCORE_CONFIG = {
  weights: { odd: 20, low: 20, sum: 20, spacing: 15, consecutive: 15, pair: 10 },
  sumBinWidth: 25,
  spacingBinWidth: 5,
} as const
export const SCORE_DISCLAIMER = 'Pattern Score measures similarity to historical drawing patterns. It does not represent the probability of winning.'
