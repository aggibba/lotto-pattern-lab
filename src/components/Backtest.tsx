import { useEffect, useRef, useState } from 'react'
import type { Lottery, LotteryDataset, LotteryId } from '../types/lottery'
import { lotteries } from '../config/lotteries'
import { STRATEGIES } from '../config/generator'
import { SCORE_DISCLAIMER } from '../config/patternScore'
import { runBacktest } from '../backtest/backtestEngine'
import { BACKTEST_DISCLAIMER, type BacktestConfig, type BacktestResult, type StrategySummary, type TestedTarget, type WindowSize } from '../backtest/backtestTypes'
const percent = (n: number, total: number) => total ? `${(n / total * 100).toFixed(2)}%` : '—'
const counted = (n: number, total: number) => `${n.toLocaleString()} (${percent(n, total)})`
function TargetDetails({ tested, lottery }: { tested: TestedTarget; lottery: Lottery }) {
  const [expanded, setExpanded] = useState(false)
  return <details className="card backtest-target" onToggle={e => setExpanded(e.currentTarget.open)}>
    <summary>Target {tested.target.drawDate} · {tested.batches.length} {tested.batches.length === 1 ? 'strategy' : 'strategies'}</summary>
    {expanded && <div>
      <h4>Actual Winning Numbers</h4><div className="ball-row">{tested.target.mainNumbers.map(n => <span className="lottery-ball" key={n}>{String(n).padStart(2, '0')}</span>)}</div>
      <p>Actual {lottery.specialBallName}: <strong>{tested.target.specialBall}</strong></p>
      <p>Training Window: previous {tested.trainingDates.length} verified drawings in this rule era, {tested.trainingDates.at(-1)} through {tested.trainingDates[0]}. Every training date is strictly before {tested.target.drawDate}.</p>
      <p>Historical rules: {tested.rule.id} · Main {tested.rule.mainBallMin}–{tested.rule.mainBallMax} · {lottery.specialBallName} {tested.rule.specialBallMin}–{tested.rule.specialBallMax}.</p>
      <details><summary>Audit training dates</summary><p className="training-dates">{tested.trainingDates.join(', ')}</p></details>
      {tested.batches.map(batch => <section key={batch.strategy} className="backtest-batch"><h4>{batch.strategy}</h4><details><summary>Reproducibility seed</summary><p>{batch.seed}</p></details>
        <div className="backtest-combinations">{batch.combinations.map((match, i) => <div className="backtest-combination" key={i}>
          <strong>Combination {i + 1}</strong><div className="ball-row">{match.generated.mainNumbers.map(n => <span className="lottery-ball" key={n}>{String(n).padStart(2, '0')}</span>)}</div>
          <p>{lottery.specialBallName}: {match.generated.specialBall}</p><p>Main Matches: <strong>{match.mainMatches}</strong> · Special Ball Match: <strong>{match.specialMatch ? 'Yes' : 'No'}</strong></p>
          <p>Pattern Score at generation time: <strong>{match.generated.score.toFixed(2)} / 100</strong></p><p>{SCORE_DISCLAIMER}</p>
        </div>)}</div>
      </section>)}
    </div>}
  </details>
}
function StrategyMetrics({ summary }: { summary: StrategySummary }) {
  const n = summary.combinations
  return <section className="card backtest-strategy-summary" aria-label={`${summary.strategy} summary`}>
    <h3>{summary.strategy}</h3><p>Denominator: {n.toLocaleString()} generated combinations for this strategy, including each combination tested against each target.</p>
    <dl className="combination-facts"><div><dt>Average Main Numbers Matched</dt><dd>{summary.averageMainMatches?.toFixed(4) ?? '—'}</dd></div>
      {summary.mainDistribution.map((count, i) => <div key={i}><dt>{i} main {i === 1 ? 'match' : 'matches'}</dt><dd>{counted(count, n)}</dd></div>)}
      <div><dt>Special Ball Matches</dt><dd>{counted(summary.specialMatches, n)}</dd></div>
      <div><dt>At Least 2 Main</dt><dd>{counted(summary.atLeast2, n)}</dd></div><div><dt>At Least 3 Main</dt><dd>{counted(summary.atLeast3, n)}</dd></div><div><dt>At Least 4 Main</dt><dd>{counted(summary.atLeast4, n)}</dd></div>
    </dl>
  </section>
}
function Results({ result, lottery }: { result: BacktestResult; lottery: Lottery }) {
  const [page, setPage] = useState(0)
  const pages = Math.ceil(result.targets.length / 10)
  const rows: [string, (s: StrategySummary) => string][] = [
    ['Average Main Matches', s => s.averageMainMatches?.toFixed(4) ?? '—'],
    ['2+ Main %', s => percent(s.atLeast2, s.combinations)], ['3+ Main %', s => percent(s.atLeast3, s.combinations)], ['4+ Main %', s => percent(s.atLeast4, s.combinations)],
    ['5 Main count', s => String(s.mainDistribution[5])], ['Special Ball Match %', s => percent(s.specialMatches, s.combinations)], ['Total combinations', s => s.combinations.toLocaleString()],
  ]
  return <section aria-label="Backtest results" className="backtest-results">
    <h3>Observed historical results</h3><p>{lottery.name} · {result.config.strategy} · Previous {result.config.trainingWindow} drawings · {result.config.combinationsPerTarget} combinations per target per strategy · {result.config.range.kind === 'last' ? `Last ${result.config.range.count} drawings` : `${result.config.range.start} through ${result.config.range.end}`} · {result.version}</p>
    {result.warnings.map(w => <p className="analysis-warning" key={w}>{w}</p>)}
    <div className="summary-grid backtest-totals">{[['Targets Requested', result.targetsRequested], ['Targets Tested', result.targetsTested], ['Targets Excluded', result.targetsExcluded], ['Combinations Generated', result.combinationsGenerated]].map(([label, value]) => <div className="card" key={label}><h3>{label}</h3><div className="metric">{Number(value).toLocaleString()}</div></div>)}</div>
    <p>Targets Requested counts actual archived drawings selected by this range. Tested + excluded = requested. Combinations Generated totals all selected strategies; excluded targets generate none.</p>
    {result.summaries.length > 1 && <div className="card"><h3>Strategy comparison</h3><p>Random is the baseline. Each strategy uses the same tested targets and training windows. Percentages use that column’s total combinations. Scroll the table to see every strategy.</p><div className="backtest-table-scroll" role="region" aria-label="Strategy comparison table" tabIndex={0}><table className="pattern-table backtest-comparison"><thead><tr><th scope="col">Metric</th>{result.summaries.map(s => <th scope="col" key={s.strategy}>{s.strategy}</th>)}</tr></thead><tbody>{rows.map(([label, value]) => <tr key={label}><th scope="row">{label}</th>{result.summaries.map(s => <td key={s.strategy}>{value(s)}</td>)}</tr>)}</tbody></table></div></div>}
    <div className="combination-grid">{result.summaries.map(s => <StrategyMetrics summary={s} key={s.strategy} />)}</div>
    {!!result.exclusions.length && <details className="backtest-exclusions"><summary>Excluded targets ({result.exclusions.length})</summary><ul>{result.exclusions.map(e => <li key={e.targetDate}>{e.targetDate}: {e.reason}{e.availableHistory !== null && ` (${e.availableHistory} available; ${e.requiredHistory} required in the same rule era)`}</li>)}</ul></details>}
    <h3>Target drawing details</h3><p>Pattern Scores use only the training window available before each target. Expand a target to inspect its generated combinations and matches.</p>
    {result.targets.slice(page * 10, (page + 1) * 10).map(t => <TargetDetails tested={t} lottery={lottery} key={t.target.drawDate} />)}
    {pages > 1 && <div className="backtest-pagination"><button disabled={page === 0} onClick={() => setPage(page - 1)}>Previous targets</button><span>Page {page + 1} of {pages}</span><button disabled={page + 1 === pages} onClick={() => setPage(page + 1)}>Next targets</button></div>}
  </section>
}
export function Backtest({ lottery, dataset, onLotteryChange }: { lottery: Lottery; dataset: LotteryDataset | null; onLotteryChange: (id: LotteryId) => void }) {
  const [strategy, setStrategy] = useState<BacktestConfig['strategy']>('Compare All')
  const [window, setWindow] = useState<WindowSize>(100)
  const [count, setCount] = useState<BacktestConfig['combinationsPerTarget']>(10)
  const [range, setRange] = useState('20')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState({ completed: 0, total: 0 })
  const [result, setResult] = useState<BacktestResult | null>(null)
  const [error, setError] = useState('')
  const controller = useRef<AbortController | null>(null)
  useEffect(() => () => { controller.current?.abort(); controller.current = null }, [])
  async function run() {
    if (!dataset || running) return
    const active = new AbortController()
    controller.current = active
    setRunning(true); setError(''); setResult(null); setProgress({ completed: 0, total: 0 })
    try {
      const value = await runBacktest(dataset.drawings, { lottery, strategy, trainingWindow: window, combinationsPerTarget: count, range: range === 'custom' ? { kind: 'custom', start, end } : { kind: 'last', count: Number(range) as WindowSize }, asOfDate: new Date().toISOString().slice(0, 10) }, { signal: active.signal, onProgress: setProgress })
      if (controller.current === active) setResult(value)
    } catch (e) { if (controller.current === active) setError(e instanceof Error ? e.message : 'Backtest failed.') }
    finally { if (controller.current === active) { setRunning(false); controller.current = null } }
  }
  return <section className="backtest-page" aria-label="Historical Backtest">
    <p className="statistical-disclaimer">{BACKTEST_DISCLAIMER}</p><p>Lottery drawings are independent. Random is the baseline. Historical differences are descriptive and are not evidence of improved future odds.</p>
    <form onSubmit={e => { e.preventDefault(); void run() }} onChange={() => { setResult(null); setError('') }}>
      <fieldset disabled={running} className="card generator-controls backtest-controls"><legend className="sr-only">Backtest settings</legend>
        <label>Lottery<select aria-label="Backtest Lottery" value={lottery.id} onChange={e => onLotteryChange(e.target.value as LotteryId)}>{Object.values(lotteries).map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select></label>
        <label>Strategy<select aria-label="Backtest Strategy" value={strategy} onChange={e => setStrategy(e.target.value as BacktestConfig['strategy'])}>{[...STRATEGIES, 'Compare All'].map(s => <option key={s}>{s}</option>)}</select></label>
        <label>Historical analysis window<select aria-label="Historical analysis window" value={window} onChange={e => setWindow(Number(e.target.value) as WindowSize)}>{[20, 50, 100].map(n => <option value={n} key={n}>Previous {n} Drawings</option>)}</select></label>
        <label>Combinations per historical drawing<select aria-label="Combinations per historical drawing" value={count} onChange={e => setCount(Number(e.target.value) as BacktestConfig['combinationsPerTarget'])}>{[1, 5, 10, 20].map(n => <option key={n}>{n}</option>)}</select></label>
        <label>Backtest range<select aria-label="Backtest range" value={range} onChange={e => setRange(e.target.value)}>{[20, 50, 100].map(n => <option value={n} key={n}>Last {n} Drawings</option>)}<option value="custom">Custom</option></select></label>
        {range === 'custom' && <div className="custom-backtest-dates"><label>Start date<input aria-label="Start date" type="date" required value={start} onChange={e => setStart(e.target.value)} /></label><label>End date<input aria-label="End date" type="date" required value={end} onChange={e => setEnd(e.target.value)} /></label></div>}
        <button className="generate-button" disabled={!dataset} type="submit">RUN BACKTEST</button>
      </fieldset>
    </form>
    <p>Training uses exactly the selected number of immediately preceding verified drawings in the target’s rule era. Targets with insufficient history or unverified rules are excluded and listed. Custom dates are inclusive.</p>
    <div role="status" aria-live="polite">{running ? `Running Backtest... ${progress.completed} / ${progress.total} targets processed` : result ? `Backtest complete. ${result.targetsTested} targets tested.` : 'Ready when you are. Backtests run only when requested.'}</div>
    {running && <button className="retry-button" onClick={() => controller.current?.abort()}>Cancel Backtest</button>}
    {error && <p className="notice" role="alert">{error}</p>}
    {result && <Results result={result} lottery={lottery} />}
  </section>
}
