import type { Drawing, Lottery } from '../types/lottery.ts'

export function parseDrawDate(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:T00:00:00(?:\.000)?)?$/.test(value)) throw new Error('Invalid drawing date')
  const date = value.slice(0, 10)
  const timestamp = Date.parse(`${date}T00:00:00Z`)
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== date) throw new Error('Invalid calendar date')
  return date
}
function integer(value: unknown): number {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) throw new Error('Missing or invalid integer')
  const result = Number(value)
  if (!Number.isSafeInteger(result) || result < 1) throw new Error('Invalid positive integer')
  return result
}
export function parseDrawing(raw: unknown, lottery: Lottery): Drawing {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Invalid drawing row')
  const row = raw as Record<string, unknown>
  const drawDate = parseDrawDate(row.draw_date)
  if (typeof row.winning_numbers !== 'string') throw new Error('Missing winning numbers')
  const numbers = row.winning_numbers.trim().split(/\s+/).map(integer)
  if (numbers.length !== (lottery.id === 'powerball' ? 6 : 5)) throw new Error('Incorrect number of balls')
  const main = numbers.slice(0, 5).sort((a, b) => a - b)
  if (new Set(main).size !== 5) throw new Error('Duplicate main numbers')
  const specialBall = lottery.id === 'powerball' ? numbers[5] : integer(row.mega_ball)
  const rules = lottery.ruleSets.filter((rule) => drawDate >= rule.effectiveFrom && (!rule.effectiveTo || drawDate < rule.effectiveTo))
  if (rules.length > 1) throw new Error('Overlapping rule sets')
  const rule = rules[0]
  if (rule && (main.length !== rule.mainBallCount || main.some((n) => n < rule.mainBallMin || n > rule.mainBallMax) || specialBall < rule.specialBallMin || specialBall > rule.specialBallMax)) throw new Error(`Numbers outside ${rule.id} ranges`)
  const multiplier = row.multiplier == null || row.multiplier === '' ? null : integer(row.multiplier)
  if (multiplier !== null && ![2, 3, 4, 5, 10].includes(multiplier)) throw new Error('Invalid multiplier')
  if (lottery.id === 'mega-millions' && multiplier !== null && (multiplier === 10 || drawDate >= '2025-04-08')) throw new Error('Unexpected drawing-level Mega Millions multiplier')
  return { lotteryId: lottery.id, drawDate, mainNumbers: main as unknown as Drawing['mainNumbers'], specialBall, multiplier, source: lottery.source, ruleSetId: rule?.id ?? null, ruleVerification: rule ? 'verified' : 'unverified' }
}
