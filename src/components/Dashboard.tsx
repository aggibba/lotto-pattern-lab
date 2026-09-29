import type { Lottery, LotteryDataset } from '../types/lottery'
import type { NumberAnalysisResult } from '../types/analysis'
import type { AnalysisPeriod } from '../config/analysis'
import { CLASSIFICATION_RULES } from '../config/analysis'
import { getColdNumbers, getHotNumbers, getOverdueNumbers } from '../analytics/classifications'
import { Card } from './Card'
import { AnalysisExplanation, AnalysisPeriodSelect } from './AnalysisControls'
import { NumberFrequency } from './NumberFrequency'
import { PatternPanels } from './PatternPanels'
import { PATTERN_CONFIG } from '../config/patterns'

export function Dashboard({ lottery, dataset, analysis, period, onPeriodChange, onGenerate }: { lottery: Lottery; dataset: LotteryDataset | null; analysis: NumberAnalysisResult | null; period: AnalysisPeriod; onPeriodChange: (value: AnalysisPeriod) => void; onGenerate: () => void }) {
  const latest = dataset?.drawings.at(-1)
  const stats = analysis?.mainNumbers ?? []
  const insights = [
    { title: 'Hot Numbers', icon: '↗', description: 'High appearance counts in the selected period.', tone: 'warm', numbers: getHotNumbers(stats) },
    { title: 'Cold Numbers', icon: '↘', description: 'Low appearance counts in the selected period.', tone: 'cool', numbers: getColdNumbers(stats) },
    { title: 'Overdue Numbers', icon: '◷', description: 'Long observed gaps, not numbers due to appear.', tone: 'purple', numbers: getOverdueNumbers(stats) },
  ]
  return <>
    <div className="summary-grid">
      <Card title="Latest Drawing"><div className="ball-row" role="img" aria-label={latest ? 'Main numbers ' + latest.mainNumbers.join(', ') + '; ' + lottery.specialBallName + ' ' + latest.specialBall : 'No drawing numbers available'}>
        {(latest ? [...latest.mainNumbers, latest.specialBall] : Array(6).fill('—')).map((number, index) => <span className={index === 5 ? 'lottery-ball special' : 'lottery-ball'} key={index} aria-hidden="true">{number}</span>)}
      </div><p>{latest ? <>{latest.drawDate} · {lottery.specialBallName} in blue</> : 'No drawing available'}</p>{latest?.multiplier != null && <p>{lottery.id === 'powerball' ? 'Power Play' : 'Megaplier'}: {latest.multiplier}×</p>}</Card>
      <Card title="Data Through"><div className="metric date-metric">{dataset?.dataThrough ?? '—'}</div><p>Latest available drawing date</p></Card>
      <Card title="Drawings Analyzed"><div className="metric">{analysis?.drawingsAnalyzed.toLocaleString() ?? '—'}<span className="metric-unit">drawings</span></div><p>{analysis?.currentEraCount.toLocaleString() ?? '—'} in the current rule era</p></Card>
      <Card title="Analysis Period"><AnalysisPeriodSelect value={period} onChange={onPeriodChange} /><p>Verified current-era drawings only</p></Card>
    </div>
    {analysis && <AnalysisExplanation analysis={analysis} />}
    <div className="section-heading"><h2>Number insights</h2><span>Main numbers · descriptive statistics</span></div>
    <div className="insights-grid">
      {insights.map((insight) => <Card title={insight.title} key={insight.title} className="insight-card">
        <span className={`insight-icon ${insight.tone}`} aria-hidden="true">{insight.icon}</span>
        {insight.numbers.length ? <div className="insight-numbers">{insight.numbers.slice(0, CLASSIFICATION_RULES.cardNumberLimit).map((stat) => <div key={stat.number}>
          <span className="lottery-ball">{stat.number}</span>
          <span className="insight-count">{insight.title === 'Overdue Numbers' ? `${stat.drawingsSinceLastAppearance === null ? '≥' : ''}${stat.gapLowerBound} gap` : `${stat.appearances} hits`}</span>
        </div>)}</div> : <div className="insight-empty">{!analysis ? 'Unavailable' : analysis.drawingsAnalyzed < CLASSIFICATION_RULES.minimumDrawings ? 'Insufficient data' : 'None meet the rule'}</div>}
        <p>{insight.description}</p>
      </Card>)}
      <Card title="Common Pairs" className="insight-card"><span className="insight-icon green" aria-hidden="true">⋈</span><div className="insight-empty">{analysis?.patterns.commonPairs[0]?.numbers.join(' + ') ?? 'No pairs available'}</div><p>{analysis?.patterns.commonPairs[0] && <>{analysis.patterns.commonPairs[0].count} drawings · {analysis.patterns.commonPairs[0].percent?.toFixed(2)}% of period</>}</p><a className="pairs-link" href="#common-pairs">View top {PATTERN_CONFIG.commonPairLimit} pairs</a></Card>
    </div>
    <div className="frequency-section">
      <Card title="Number Frequency" className="frequency-card">{analysis ? <NumberFrequency stats={analysis.mainNumbers} drawings={analysis.drawingsAnalyzed} /> : <p className="empty-analysis">Waiting for validated drawing data.</p>}</Card>

    </div>
    <PatternPanels patterns={analysis?.patterns ?? null} />
    <section className="card generator-card" aria-labelledby="generator-title"><div className="generator-symbol" aria-hidden="true">⚄</div><div className="generator-copy"><div className="generator-heading"><h3 id="generator-title">Generate Numbers</h3></div><p>Explore Random, Balanced, and Trend Weighted combinations with historical Pattern Scores.</p></div><button type="button" className="generate-button" onClick={onGenerate}>Generate Numbers <span aria-hidden="true">→</span></button></section>
  </>
}
