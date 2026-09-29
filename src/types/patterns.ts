export interface PatternCount {
  count: number
  percent: number | null
}
export interface CompositionCount extends PatternCount {
  first: number
  second: number
}
export interface PairCount extends PatternCount {
  numbers: readonly [number, number]
}
export interface SumCount extends PatternCount {
  sum: number
}
export interface PatternAnalysisResult {
  drawingsAnalyzed: number
  lowMax: number
  mainMin: number
  mainMax: number
  mainBallCount: number
  commonPairs: readonly PairCount[]
  oddEven: readonly CompositionCount[]
  lowHigh: readonly CompositionCount[]
  sums: readonly SumCount[]
  consecutive: { included: PatternCount; absent: PatternCount }
}
