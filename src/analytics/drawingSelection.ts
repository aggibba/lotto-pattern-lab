import { ANALYSIS_PERIODS } from '../config/analysis.ts'
import type { Drawing, Lottery, LotteryRuleSet } from '../types/lottery.ts'
import type { AnalysisConfig } from '../types/analysis.ts'
import { parseDrawDate } from '../utils/drawingValidation.ts'

function dateOnly(value: unknown): string {
  if (typeof value !== 'string' || value.length !== 10) throw new Error('Analytics requires date-only YYYY-MM-DD drawing dates.')
  return parseDrawDate(value)
}
function containsDate(rule: LotteryRuleSet, date: string) {
  return date >= rule.effectiveFrom && (rule.effectiveTo === null || date < rule.effectiveTo)
}
function validateRules(lottery: Lottery) {
  if (!Array.isArray(lottery.ruleSets) || !lottery.ruleSets.length) throw new Error('No verified rule sets are configured.')
  const ids = new Set<string>()
  const sorted = [...lottery.ruleSets].sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom))
  sorted.forEach((rule, index) => {
    dateOnly(rule.effectiveFrom)
    if (rule.effectiveTo !== null) dateOnly(rule.effectiveTo)
    if (ids.has(rule.id) || !rule.id || !rule.evidenceUrls?.length || rule.mainBallCount !== 5 ||
      ![rule.mainBallMin, rule.mainBallMax, rule.specialBallMin, rule.specialBallMax].every((n) => Number.isSafeInteger(n) && n > 0) ||
      rule.mainBallMax - rule.mainBallMin + 1 < rule.mainBallCount || rule.specialBallMax < rule.specialBallMin ||
      (rule.effectiveTo !== null && rule.effectiveTo <= rule.effectiveFrom)) throw new Error('Invalid or unverified rule configuration.')
    if (index > 0 && (sorted[index - 1].effectiveTo === null || sorted[index - 1].effectiveTo! > rule.effectiveFrom)) throw new Error('Overlapping rule configuration.')
    ids.add(rule.id)
  })
}
export function getCurrentRuleSet(lottery: Lottery, asOfDate: string): LotteryRuleSet {
  validateRules(lottery)
  const matches = lottery.ruleSets.filter((rule) => containsDate(rule, dateOnly(asOfDate)))
  if (matches.length !== 1) throw new Error('A verified current rule era is unavailable for this date.')
  return matches[0]
}
export function selectAnalysisDrawings(drawings: readonly Drawing[], config: AnalysisConfig) {
  const rule = getCurrentRuleSet(config.lottery, config.asOfDate)
  const period = ANALYSIS_PERIODS.find((item) => item.value === config.period)
  if (!period) throw new Error('Unknown analysis period.')
  if (!Array.isArray(drawings)) throw new Error('Drawing input must be an array.')
  const seen = new Set<string>()
  let unverified = 0
  const eligible: Drawing[] = []
  for (const drawing of drawings) {
    if (!drawing || typeof drawing !== 'object' || drawing.lotteryId !== config.lottery.id) throw new Error('Invalid drawing or mixed lottery input.')
    const date = dateOnly(drawing.drawDate)
    if (seen.has(date)) throw new Error(`Duplicate analytics drawing date: ${date}.`)
    seen.add(date)
    if (!Array.isArray(drawing.mainNumbers) || drawing.mainNumbers.length !== 5 || new Set(drawing.mainNumbers).size !== 5 ||
      ![...drawing.mainNumbers, drawing.specialBall].every((n) => Number.isSafeInteger(n) && n > 0)) throw new Error(`Malformed numbers for ${date}.`)
    if (drawing.ruleVerification !== 'verified' && drawing.ruleVerification !== 'unverified') throw new Error(`Missing rule verification for ${date}.`)
    if (drawing.ruleVerification === 'unverified') { if (date <= config.asOfDate) unverified++; continue }
    const assigned = config.lottery.ruleSets.find((item) => item.id === drawing.ruleSetId)
    if (!assigned || !containsDate(assigned, date)) throw new Error(`Invalid rule assignment for ${date}.`)
    if (drawing.mainNumbers.some((n: number) => n < assigned.mainBallMin || n > assigned.mainBallMax) || drawing.specialBall < assigned.specialBallMin || drawing.specialBall > assigned.specialBallMax) throw new Error(`Out-of-range numbers for ${date}.`)
    if (date <= config.asOfDate && assigned.id === rule.id) eligible.push(drawing)
  }
  eligible.sort((a, b) => b.drawDate.localeCompare(a.drawDate))
  const selected = period.limit === null ? eligible : eligible.slice(0, period.limit)
  const warnings: string[] = []
  if (unverified) warnings.push(`${unverified} unverified drawings excluded from analysis.`)
  if (!selected.length) warnings.push('No verified drawings are available in the current rule era. Frequencies and gaps are unavailable.')
  else if (period.limit !== null && selected.length < period.limit) warnings.push(`Only ${selected.length} current-era drawings are available; the requested ${period.limit}-drawing window is shortened.`)
  return { rule, eligible, selected, warnings }
}
