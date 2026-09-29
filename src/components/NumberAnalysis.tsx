import { useState } from 'react'
import type { Lottery } from '../types/lottery'
import type { NumberAnalysisResult } from '../types/analysis'
import type { AnalysisPeriod } from '../config/analysis'
import { Card } from './Card'
import { AnalysisExplanation, AnalysisPeriodSelect } from './AnalysisControls'
import { StatisticsTable } from './StatisticsTable'
import { PatternPanels } from './PatternPanels'

export function NumberAnalysis({ lottery, analysis, period, onPeriodChange }: { lottery: Lottery; analysis: NumberAnalysisResult | null; period: AnalysisPeriod; onPeriodChange: (value: AnalysisPeriod) => void }) {
  const [pool, setPool] = useState<'main' | 'special'>('main')
  return <>
    <div className="summary-grid">
      <Card title="Selected Lottery"><div className="metric lottery-metric">{lottery.name}</div><p>Verified current rule era only</p></Card>
      <Card title="Analysis Period"><AnalysisPeriodSelect value={period} onChange={onPeriodChange} /><p>Recalculated locally from loaded history</p></Card>
      <Card title="Drawings Analyzed"><div className="metric">{analysis?.drawingsAnalyzed.toLocaleString() ?? '—'}</div><p>{analysis?.currentEraCount.toLocaleString() ?? '—'} available in the current era</p></Card>
      <Card title="Data Through"><div className="metric date-metric">{analysis?.dataThrough ?? '—'}</div><p>Latest drawing included in analysis</p></Card>
    </div>
    {analysis && <>
      <AnalysisExplanation analysis={analysis} />
      <section className="card number-analysis-card" aria-label="Number statistics">
        <div className="pool-selector" role="group" aria-label="Number pool">
          <button type="button" aria-pressed={pool === 'main'} onClick={() => setPool('main')}>Main Numbers</button>
          <button type="button" aria-pressed={pool === 'special'} onClick={() => setPool('special')}>Special Ball · {lottery.specialBallName}</button>
        </div>
        <StatisticsTable stats={pool === 'main' ? analysis.mainNumbers : analysis.specialBalls} drawings={analysis.drawingsAnalyzed} label={pool === 'main' ? `${lottery.name} main numbers` : lottery.specialBallName} />
      </section>
      <PatternPanels patterns={analysis.patterns} />
    </>}
  </>
}
