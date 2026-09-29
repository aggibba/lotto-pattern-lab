import type { PatternAnalysisResult, PatternCount } from '../types/patterns'
import { PATTERN_CONFIG } from '../config/patterns'
import { Card } from './Card'

const percentage = (value: number | null) => value === null ? '—' : `${value.toFixed(2)}%`
function Distribution({ title, description, rows, label }: { title: string; description: string; rows: readonly (PatternCount & { label: string })[]; label: string }) {
  return <section className="pattern-distribution">
    <h4>{title}</h4><p>{description}</p>
    <div className="pattern-scroll" tabIndex={0} role="region" aria-label={title}>
      <table className="pattern-table"><thead><tr><th scope="col">{label}</th><th scope="col">Drawings</th><th scope="col">% of period</th></tr></thead>
        <tbody>{rows.map((row) => <tr key={row.label}><th scope="row">{row.label}</th><td>{row.count.toLocaleString()}</td><td>{percentage(row.percent)}</td></tr>)}</tbody>
      </table>
      {!rows.length && <p className="empty-analysis">No observed values in this selection.</p>}
    </div>
  </section>
}
export function PatternPanels({ patterns }: { patterns: PatternAnalysisResult | null }) {
  return <div className="pattern-panels">
    <div id="common-pairs"><Card title="Common Pairs">
      <p>Main numbers only · Top {PATTERN_CONFIG.commonPairLimit} observed pairs.</p>
      <p>Unordered pairs: each pair is counted once per drawing. Sorted by count descending, then first number and second number ascending.</p>
      <p className="pattern-denominator">Denominator: {patterns?.drawingsAnalyzed.toLocaleString() ?? '—'} selected drawings. Rate = count ÷ selected drawings × 100.</p>
      {patterns?.commonPairs.length ? <div className="pair-scroll" tabIndex={0} role="region" aria-label="Top common pairs">
        <table className="pattern-table"><thead><tr><th scope="col">Pair</th><th scope="col">Drawings</th><th scope="col">% of period</th></tr></thead>
          <tbody>{patterns.commonPairs.slice(0, PATTERN_CONFIG.commonPairLimit).map((pair) => <tr key={pair.numbers.join('-')}><th scope="row">{pair.numbers[0]} + {pair.numbers[1]}</th><td>{pair.count.toLocaleString()}</td><td>{percentage(pair.percent)}</td></tr>)}</tbody>
        </table>
      </div> : <p className="empty-analysis">{patterns ? 'No observed pairs in this selection.' : 'Waiting for validated drawing data.'}</p>}
      <p>One five-number drawing contributes 10 distinct pairs. Pair percentages do not sum to 100%.</p>
    </Card></div>
    <Card title="Pattern Overview">
      <p>Main numbers only. Each drawing contributes once to each distribution below. Percentages are rounded to two decimal places, so totals may differ slightly from 100%.</p>
      <p className="pattern-denominator">Denominator: {patterns?.drawingsAnalyzed.toLocaleString() ?? '—'} selected drawings. Rate = category count ÷ selected drawings × 100.</p>
      {patterns ? <>
        <Distribution title="Odd / even composition" description="Count odd and even main numbers in each drawing." label="Odd / Even" rows={patterns.oddEven.map((row) => ({ ...row, label: `${row.first} odd / ${row.second} even` }))} />
        <Distribution title="Low / high composition" description={`Low: ${patterns.mainMin}–${patterns.lowMax}; High: ${patterns.lowMax + 1}–${patterns.mainMax}. Boundary = floor((${patterns.mainMin} + ${patterns.mainMax}) ÷ 2) = ${patterns.lowMax}.`} label="Low / High" rows={patterns.lowHigh.map((row) => ({ ...row, label: `${row.first} low / ${row.second} high` }))} />
        <Distribution title="Main-number sum" description={`Exact sum of the ${patterns.mainBallCount} main numbers. Observed sums are listed in ascending order; unlisted sums have zero drawings.`} label="Exact sum" rows={patterns.sums.map((row) => ({ ...row, label: String(row.sum) }))} />
        <Distribution title="Consecutive numbers" description="Included means at least one main-number pair differs by 1. Multiple pairs or longer runs still count as one drawing. No wraparound." label="Contains consecutive pair" rows={[{ ...patterns.consecutive.included, label: 'Included' }, { ...patterns.consecutive.absent, label: 'Not included' }]} />
      </> : <p className="empty-analysis">Waiting for validated drawing data.</p>}
      <p className="pattern-note">Historical frequencies describe past drawings. They do not increase or indicate future winning probability.</p>
    </Card>
  </div>
}
