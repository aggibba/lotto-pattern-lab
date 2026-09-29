import { ANALYSIS_PERIODS, ANALYSIS_DISCLAIMER, CLASSIFICATION_RULES } from '../config/analysis'
import type { AnalysisPeriod } from '../config/analysis'
import type { NumberAnalysisResult } from '../types/analysis'
import { classificationThresholds } from '../analytics/classifications'

export function AnalysisPeriodSelect({ value, onChange }: { value: AnalysisPeriod; onChange: (value: AnalysisPeriod) => void }) {
  return <><label className="sr-only" htmlFor="analysis-period">Analysis Period</label><select id="analysis-period" value={value} onChange={(event) => onChange(event.target.value as AnalysisPeriod)}>{ANALYSIS_PERIODS.map((period) => <option key={period.value} value={period.value}>{period.label}</option>)}</select></>
}
export function AnalysisExplanation({ analysis }: { analysis: NumberAnalysisResult }) {
  const rule = analysis.ruleSet
  const mainRange = rule.mainBallMax - rule.mainBallMin + 1
  const specialRange = rule.specialBallMax - rule.specialBallMin + 1
  const main = classificationThresholds(analysis.drawingsAnalyzed, mainRange, rule.mainBallCount)
  const special = classificationThresholds(analysis.drawingsAnalyzed, specialRange, 1)
  return <div className="analysis-explanation">
    <p className="statistical-disclaimer">{ANALYSIS_DISCLAIMER}</p>
    <p>Verified current era: {rule.effectiveFrom} onward · Main {rule.mainBallMin}–{rule.mainBallMax} · Special {rule.specialBallMin}–{rule.specialBallMax}. Every period is restricted to this era.</p>
    <p>Selected dates: {analysis.periodStart ?? '—'} through {analysis.dataThrough ?? '—'}. Recent 20 / 50 / 100 use the newest {analysis.recentSampleSizes.recent20} / {analysis.recentSampleSizes.recent50} / {analysis.recentSampleSizes.recent100} drawings within this selection.</p>
    {analysis.warnings.map((warning) => <p className="analysis-warning" role="status" key={warning}>{warning}</p>)}
    <details><summary>How counts, gaps, and labels work</summary>
      <p>Frequency = appearances ÷ drawings analyzed × 100. Last Drawn and Drawings Since refer only to this selected period. A gap of 0 means the latest drawing. “Not in period” and “≥N” mean no appearance in N observed drawings; the exact earlier date and gap are unknown. No data is shown as “—”.</p>
      <p>For each pool separately, average appearances = drawings analyzed × balls drawn per drawing ÷ valid pool size. Hot: appearances ≥ {CLASSIFICATION_RULES.hotAverageMultiple} × this average. Cold: appearances ≤ {CLASSIFICATION_RULES.coldAverageMultiple} × this average. These thresholds use the entire selected period.</p>
      <p>Overdue: observed gap ≥ ceil(pool size ÷ balls drawn per drawing). Current thresholds: main {main.overdue} drawings; special {special.overdue} drawings. An unseen number qualifies only when its observed lower bound reaches the threshold. This is a descriptive cutoff, not a claim that a number is due.</p>
      <p>Labels require at least {CLASSIFICATION_RULES.minimumDrawings} drawings. Current integer frequency cutoffs: main Hot ≥ {Math.ceil(main.hot)}, Cold ≤ {Math.floor(main.cold)}; special Hot ≥ {Math.ceil(special.hot)}, Cold ≤ {Math.floor(special.cold)}. Labels can overlap. “Neutral” means no threshold met, not a recommendation.</p>
      <p>Dashboard cards show up to {CLASSIFICATION_RULES.cardNumberLimit} qualifying main numbers. Hot sorts by appearances descending, Cold ascending, Overdue by observed gap descending. Ties sort by number ascending. Table gap sorting uses observed lower bounds.</p>
    </details>
  </div>
}
