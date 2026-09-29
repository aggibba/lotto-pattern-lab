import type { LotteryId } from '../types/lottery.ts'
import { ANALYSIS_PERIODS, type AnalysisPeriod } from './analysis.ts'
import { STRATEGIES, type Strategy } from './generator.ts'

export interface Settings { lottery: LotteryId; period: AnalysisPeriod; strategy: Strategy; count: number }
export const SETTINGS_KEY = 'lotto-pattern-lab.settings.v1'
export const DEFAULT_SETTINGS: Settings = { lottery: 'powerball', period: '100', strategy: 'Random', count: 5 }
export function deserializeSettings(text: string | null): Settings {
  if (text === null) return { ...DEFAULT_SETTINGS }
  const envelope = JSON.parse(text)
  const s = envelope?.settings
  if (envelope?.version !== 1 || !s || !['powerball', 'mega-millions'].includes(s.lottery) || !ANALYSIS_PERIODS.some(p => p.value === s.period) || !STRATEGIES.includes(s.strategy) || ![1, 5, 10, 20].includes(s.count)) throw new Error('Stored settings are invalid or incompatible. Defaults are in use.')
  return { lottery: s.lottery, period: s.period, strategy: s.strategy, count: s.count }
}
export function readSettings(): { settings: Settings; error: string } {
  try { return { settings: deserializeSettings(localStorage.getItem(SETTINGS_KEY)), error: '' } }
  catch { return { settings: { ...DEFAULT_SETTINGS }, error: 'Could not read stored settings. Defaults are in use; save settings to replace invalid data.' } }
}
export function serializeSettings(settings: Settings): string {
  const text = JSON.stringify({ version: 1, settings })
  deserializeSettings(text)
  return text
}
