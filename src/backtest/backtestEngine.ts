import type { Drawing } from '../types/lottery.ts'
import { STRATEGIES } from '../config/generator.ts'
import { prepareGenerator, generateCombinations } from '../generator/generateCombinations.ts'
import { getHistoricalTrainingData, selectBacktestTargets, validateBacktestDrawings, verifiedHistoricalRule } from './historicalData.ts'
import { seededRandom } from './seededRandom.ts'
import { matchCombination, summarizeStrategy } from './matchResults.ts'
import { BACKTEST_VERSION, type BacktestConfig, type BacktestOptions, type BacktestResult, type TestedTarget, type ExcludedTarget } from './backtestTypes.ts'
export async function runBacktest(drawings: readonly Drawing[], config: BacktestConfig, options: BacktestOptions = {}): Promise<BacktestResult> {
  if (![20, 50, 100].includes(config.trainingWindow) || ![1, 5, 10, 20].includes(config.combinationsPerTarget) || (config.strategy !== 'Compare All' && !STRATEGIES.includes(config.strategy))) throw new Error('Invalid backtest configuration.')
  const yieldControl = options.yieldControl ?? (() => new Promise<void>(resolve => setTimeout(resolve, 0)))
  const checkCancelled = () => { if (options.signal?.aborted) throw new Error('Backtest cancelled.') }
  checkCancelled()
  validateBacktestDrawings(drawings, config.lottery)
  const requested = selectBacktestTargets(drawings, config)
  const strategies = config.strategy === 'Compare All' ? [...STRATEGIES] : [config.strategy]
  const targets: TestedTarget[] = [], exclusions: ExcludedTarget[] = [], warnings: string[] = []
  if (config.range.kind === 'last' && requested.length < config.range.count) warnings.push(`Only ${requested.length} target drawings are available for the requested last ${config.range.count}.`)
  if (!requested.length) warnings.push('No target drawings are available in this range.')
  options.onProgress?.({ completed: 0, total: requested.length })
  await yieldControl()
  for (const target of requested) {
    checkCancelled()
    const rule = verifiedHistoricalRule(target, config.lottery)
    if (!rule) exclusions.push({ targetDate: target.drawDate, reason: 'Excluded — unverified historical rule set', availableHistory: null, requiredHistory: config.trainingWindow })
    else {
      const training = getHistoricalTrainingData(drawings, target, config.lottery, config.trainingWindow)
      if (training.length !== config.trainingWindow) exclusions.push({ targetDate: target.drawDate, reason: 'Excluded — insufficient prior history', availableHistory: training.length, requiredHistory: config.trainingWindow })
      else {
        // No target numbers, future data, or full archive are passed to Step 5.
        // asOfDate resolves the target's historical rules; the only rows supplied
        // have strictly earlier dates, already restricted to that same era.
        const context = prepareGenerator(training, { lottery: config.lottery, period: String(config.trainingWindow) as '20' | '50' | '100', asOfDate: target.drawDate })
        if (context.selected.length !== config.trainingWindow || context.selected.some(d => d.drawDate >= target.drawDate)) throw new Error('Historical training boundary violation.')
        const tested: TestedTarget = { target, rule, trainingDates: context.selected.map(d => d.drawDate), batches: [] }
        for (const strategy of strategies) {
          checkCancelled()
          const seed = JSON.stringify([BACKTEST_VERSION, config.lottery.id, target.drawDate, strategy, config.trainingWindow, config.combinationsPerTarget])
          const generated = generateCombinations(context, strategy, config.combinationsPerTarget, seededRandom(seed), undefined, `${target.drawDate}T00:00:00.000Z`)
          tested.batches.push({ strategy, seed, combinations: generated.map(g => ({ generated: g, ...matchCombination(g, target) })) })
          await yieldControl()
        }
        targets.push(tested)
      }
    }
    options.onProgress?.({ completed: targets.length + exclusions.length, total: requested.length })
    await yieldControl()
  }
  checkCancelled()
  const summaries = strategies.map(s => summarizeStrategy(targets, s))
  return { version: BACKTEST_VERSION, config, targetsRequested: requested.length, targetsTested: targets.length, targetsExcluded: exclusions.length, combinationsGenerated: summaries.reduce((sum, s) => sum + s.combinations, 0), targets, exclusions, summaries, warnings }
}
