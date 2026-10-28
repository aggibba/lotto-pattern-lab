export type LotteryId = 'powerball' | 'mega-millions'
export interface DataSource {
  id: string
  name: string
  datasetId: string
  apiUrl: string
  url: string
}
export interface LotteryRuleSet {
  id: string
  effectiveFrom: string
  effectiveTo: string | null // Exclusive; dates are YYYY-MM-DD.
  mainBallCount: number
  mainBallMin: number
  mainBallMax: number
  specialBallMin: number
  specialBallMax: number
  evidenceUrls: readonly string[]
  note?: string
}
export interface Lottery {
  id: LotteryId
  name: string
  specialBallName: string
  coverageStart: string
  coverageLabel: string
  source: DataSource
  ruleSets: readonly LotteryRuleSet[]
}
export interface Drawing {
  lotteryId: LotteryId
  drawDate: string
  mainNumbers: readonly [number, number, number, number, number]
  specialBall: number
  multiplier: number | null
  source: DataSource
  ruleSetId: string | null
  ruleVerification: 'verified' | 'unverified'
}
export interface LotteryDataset {
  cacheNotice?: string
  lotteryId: LotteryId
  drawings: readonly Drawing[] // Ascending official drawing date.
  source: DataSource
  earliestDate: string | null
  dataThrough: string | null
  retrievedAt: string
  warnings: readonly string[]
}
