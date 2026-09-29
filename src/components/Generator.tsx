import type { Settings } from '../config/settings'
import { useMemo, useState } from 'react'
import type { Lottery, LotteryDataset, LotteryId } from '../types/lottery'
import type { AnalysisPeriod } from '../config/analysis'
import { ANALYSIS_PERIODS } from '../config/analysis'
import { lotteries } from '../config/lotteries'
import { STRATEGIES, type Strategy } from '../config/generator'
import { SCORE_DISCLAIMER } from '../config/patternScore'
import { generateCombinations, prepareGenerator, canonicalCombination, type GeneratedCombination } from '../generator/generateCombinations'
import { deserializeSaved, serializeSaved, STORAGE_KEY, type SavedCombination } from '../generator/savedCombinations'
import { AnalysisPeriodSelect } from './AnalysisControls'
const labels = { odd: 'Odd / Even Fit', low: 'Low / High Fit', sum: 'Sum Fit', spacing: 'Spacing Fit', consecutive: 'Consecutive Fit', pair: 'Pair Fit' }
function Balls({ item }: { item: SavedCombination }) {
  return <><div className="ball-row" aria-label={`Main numbers ${item.mainNumbers.join(', ')}`}>{item.mainNumbers.map(n => <span className="lottery-ball" key={n}>{String(n).padStart(2, '0')}</span>)}</div><div className="special-line">{lotteries[item.lottery].specialBallName}: <span className="lottery-ball special">{String(item.specialBall).padStart(2, '0')}</span></div></>
}
function readSaved() {
  try { return { items: deserializeSaved(localStorage.getItem(STORAGE_KEY)), error: '' } }
  catch (error) { return { items: [] as SavedCombination[], error: `Could not read saved combinations: ${error instanceof Error ? error.message : 'Storage unavailable'}` } }
}
export function Generator({ lottery, dataset, period, onPeriodChange, onLotteryChange, defaults }: { defaults: Settings; lottery: Lottery; dataset: LotteryDataset | null; period: AnalysisPeriod; onPeriodChange: (p: AnalysisPeriod) => void; onLotteryChange: (id: LotteryId) => void }) {
  const [strategy, setStrategy] = useState<Strategy>(defaults.strategy)
  const [count, setCount] = useState(defaults.count)
  const [results, setResults] = useState<GeneratedCombination[]>([])
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(readSaved)
  const prepared = useMemo(() => {
    if (!dataset) return { context: null, error: '' }
    try { return { context: prepareGenerator(dataset.drawings, { lottery, period, asOfDate: new Date().toISOString().slice(0, 10) }), error: '' } }
    catch (e) { return { context: null, error: e instanceof Error ? e.message : 'Generator unavailable' } }
  }, [dataset, lottery, period])
  function generate(index?: number) {
    if (!prepared.context) return
    try {
      if (index === undefined) setResults(generateCombinations(prepared.context, strategy, count))
      else {
        const others = new Set(results.filter((_, i) => i !== index).map(r => canonicalCombination(r.mainNumbers, r.specialBall)))
        let replacement: GeneratedCombination | undefined
        for (let attempt = 0; attempt < 100; attempt++) {
          const candidate = generateCombinations(prepared.context, results[index].strategy, 1)[0]
          if (!others.has(canonicalCombination(candidate.mainNumbers, candidate.specialBall))) { replacement = candidate; break }
        }
        if (!replacement) throw new Error('Unique replacement retry limit reached. Try again.')
        setResults(results.map((r, i) => i === index ? replacement! : r))
      }
      setError('')
    } catch (e) { setError(e instanceof Error ? e.message : 'Generation failed.') }
  }
  function persist(items: SavedCombination[]) {
    try { localStorage.setItem(STORAGE_KEY, serializeSaved(items)); setSaved({ items, error: '' }); setError('') }
    catch (e) { setError(`Could not save changes: ${e instanceof Error ? e.message : 'Storage unavailable'}`) }
  }
  return <section className="generator-page" aria-label="Number Generator">
    <div className="card generator-controls">
      <label>Lottery<select aria-label="Lottery" value={lottery.id} onChange={e => onLotteryChange(e.target.value as LotteryId)}>{Object.values(lotteries).map(l => <option value={l.id} key={l.id}>{l.name}</option>)}</select></label>
      <div><span>Analysis Period</span><AnalysisPeriodSelect value={period} onChange={p => { onPeriodChange(p); setResults([]) }} /></div>
      <label>Generation Strategy<select aria-label="Generation Strategy" value={strategy} onChange={e => setStrategy(e.target.value as Strategy)}>{STRATEGIES.map(s => <option key={s}>{s}</option>)}</select></label>
      <label>Number of combinations<select aria-label="Number of combinations" value={count} onChange={e => setCount(Number(e.target.value))}>{[1, 5, 10, 20].map(n => <option key={n}>{n}</option>)}</select></label>
      <button className="generate-button" disabled={!prepared.context} onClick={() => generate()}>GENERATE NUMBERS</button>
    </div>
    <div className="analysis-explanation"><p className="statistical-disclaimer">Lottery drawings are random and independent. Trend Weighted assigns more sampling weight to stronger historical metrics; it does not increase the chance of winning.</p>
      <p>Random samples every valid number equally. Balanced samples historical structures and selects the closest of 200 random candidates. Special balls are sampled separately.</p>
      {prepared.context && <p>{prepared.context.analysis.drawingsAnalyzed} selected drawings · {prepared.context.analysis.periodStart} through {prepared.context.analysis.dataThrough} · Verified era begins {prepared.context.analysis.ruleSet.effectiveFrom}.</p>}
      {prepared.context?.analysis.warnings.map(w => <p key={w}>{w}</p>)}
      <details><summary>Scoring and trend method</summary><p>Trend sampling weight = 1 + 4 × (30% recent 20 + 25% recent 50 + 20% recent 100 + 20% selected frequency + 5% observed gap). Each input is divided by its pool maximum (at least 1). Recent windows and observed gap lower bounds stay inside the selected period. Main and special pools are normalized separately.</p><p>Pattern components use frequency relative to the most common category: odd/even 20%, low/high 20%, sum bins of 25 points 20%, average adjacent spacing bins of 5 points 15%, consecutive yes/no 15%, and mean pair frequency relative to the most common pair 10%. Bins start at zero. Spacing = (largest − smallest) / (main count − 1). Unobserved categories score zero. The weighted sum is rounded to two decimals.</p></details>
    </div>
    {(error || prepared.error || saved.error) && <p className="notice" role="alert">{error || prepared.error || saved.error}</p>}
    <p role="status">{results.length ? `${results.length} combinations generated.` : 'Choose your settings and generate a batch.'}</p>
    <div className="combination-grid">{results.map((r, i) => <article className="card combination-card" key={i} aria-label={`Combination ${i + 1}`}>
      <h3>Combination {i + 1}</h3><Balls item={r} />
      <h4>Pattern Score: {r.score.toFixed(2)} / 100</h4><p>{SCORE_DISCLAIMER}</p>
      <dl className="combination-facts"><div><dt>Odd / Even</dt><dd>{r.facts.odd} / {r.mainNumbers.length - r.facts.odd}</dd></div><div><dt>Low / High</dt><dd>{r.facts.low} / {r.mainNumbers.length - r.facts.low}</dd></div><div><dt>Sum</dt><dd>{r.facts.sum}</dd></div><div><dt>Consecutive numbers</dt><dd>{r.facts.consecutive ? 'Yes' : 'No'}</dd></div><div><dt>Strategy</dt><dd>{r.strategy}</dd></div></dl>
      <details><summary>Score Details</summary><div className="score-breakdown">{r.components.map(c => <div key={c.key}><strong>{labels[c.key]}</strong><span>Score {c.score.toFixed(2)} / 100 · Weight {c.weight}%</span><span>Weighted contribution: {c.contribution.toFixed(2)} points</span></div>)}</div><p>Contributions are displayed rounded; the total uses full precision.</p></details>
      <div className="combination-actions"><button onClick={() => persist([...saved.items, r])} disabled={!!saved.error || saved.items.some(s => s.lottery === r.lottery && s.generatedAt === r.generatedAt && canonicalCombination(s.mainNumbers, s.specialBall) === canonicalCombination(r.mainNumbers, r.specialBall))}>Save Combination</button><button onClick={() => generate(i)}>Generate Again</button></div>
    </article>)}</div>
    <h3 className="saved-heading">Saved Combinations</h3><p>Stored only in this browser. Scores are snapshots from the analysis used when generated.</p>
    {!saved.items.length && <p>No saved combinations.</p>}
    <div className="combination-grid">{saved.items.map((s, i) => <article className="card saved-card" key={i}><h3>{lotteries[s.lottery].name}</h3><Balls item={s} /><h4>Pattern Score: {s.score.toFixed(2)} / 100</h4><p>{SCORE_DISCLAIMER}</p><p>{s.strategy} · {ANALYSIS_PERIODS.find(p => p.value === s.period)?.label}</p><p>{new Date(s.generatedAt).toLocaleString()}</p><button onClick={() => persist(saved.items.filter((_, index) => index !== i))}>Delete saved combination</button></article>)}</div>
  </section>
}
