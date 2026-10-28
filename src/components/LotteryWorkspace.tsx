import { History } from './History'
import type { Settings } from '../config/settings'
import { Backtest } from './Backtest'
import { Generator } from './Generator'
import { useMemo, useState } from 'react'
import type { Lottery, LotteryId } from '../types/lottery'
import type { AnalysisPeriod } from '../config/analysis'
import { useLotteryDataset } from '../hooks/useLotteryDataset'
import { calculateAnalysis } from '../analytics/numberStatistics'
import { Dashboard } from './Dashboard'
import { NumberAnalysis } from './NumberAnalysis'

export function LotteryWorkspace({ lottery, page, onGenerate, onLotteryChange, defaults }: { lottery: Lottery; page: 'Dashboard' | 'Number Analysis' | 'Generator' | 'Backtest' | 'History'; defaults: Settings; onGenerate: () => void; onLotteryChange: (id: LotteryId) => void }) {
  const { state, retry } = useLotteryDataset(lottery.id)
  const [period, setPeriod] = useState<AnalysisPeriod>(defaults.period)
  const dataset = state.status === 'ready' ? state.dataset : null
  const asOfDate = new Date().toISOString().slice(0, 10)
  const result = useMemo(() => {
    if (!dataset || (page === 'Backtest' || page === 'History')) return { analysis: null, error: null }
    try { return { analysis: calculateAnalysis(dataset.drawings, { lottery, period, asOfDate }), error: null } }
    catch (error) { return { analysis: null, error: error instanceof Error ? error.message : 'Analysis input is invalid.' } }
  }, [dataset, lottery, period, asOfDate, page])
  const status = state.status === 'loading' ? 'Loading drawings…' : state.status === 'error' ? 'Data unavailable' : dataset?.drawings.length ? 'Historical data loaded' : 'No drawings available'
  return <>
    <div className="page-heading">
      <div><p className="eyebrow">{page === 'Dashboard' ? 'OVERVIEW' : 'ANALYSIS'} / {lottery.name.toUpperCase()}</p><h2>{page}</h2><p>{page === 'History' ? 'Browse the complete available official drawing archive.' : page === 'Backtest' ? 'Inspect strategy behavior against historical drawings using only earlier data.' : 'Explore recorded frequencies and gaps in historical drawings.'}</p></div>
      <span className="connection-badge"><span className="status-dot" />{status}</span>
    </div>
    <div className="notice" role={state.status === 'error' ? 'alert' : 'status'}>
      <span className="info-icon" aria-hidden="true">i</span>
      <div><strong>{status}</strong>{state.status === 'error' ? <><p>{state.message}</p><button className="retry-button" type="button" onClick={retry}>Retry loading</button></> : <p>{state.status === 'loading' ? 'Retrieving and validating the complete available archive.' : dataset?.drawings.length ? page === 'History' ? 'History includes all loaded drawings, across historical rule eras.' : page === 'Backtest' ? 'Backtests use verified rules active on each target date and strictly earlier training data.' : 'Analysis periods use verified current-era drawings only.' : 'The source returned no drawings. No sample data is substituted.'}</p>}
        {dataset?.warnings.map((warning) => <p key={warning}>{warning}</p>)}
      </div>
    </div>
    {dataset?.cacheNotice && <div className="notice" role="alert">{dataset.cacheNotice}</div>}
    <div className="source-details">
      <p><strong>Source:</strong> <a href={lottery.source.url} target="_blank" rel="noreferrer">New York State Gaming Commission / NY Open Data</a></p>
      <p><strong>Data Through:</strong> {dataset?.dataThrough ?? 'Unavailable'}</p>
      <p><strong>Available History Beginning:</strong> {dataset?.earliestDate ?? 'Unavailable'}</p>
      <p>{lottery.coverageLabel}{dataset?.earliestDate && <> · {dataset.earliestDate} through {dataset.dataThrough}</>}</p>
      {dataset && <p>{dataset.drawings.length.toLocaleString()} historical drawings loaded · Retrieved {new Date(dataset.retrievedAt).toLocaleString()}</p>}
      <button type="button" className="refresh-button" disabled={state.status === 'loading'} onClick={retry}>{state.status === 'loading' ? 'Refreshing data…' : 'Refresh Data'}</button>
    </div>
    {result.error && <div className="notice" role="alert"><div><strong>Analysis unavailable</strong><p>{result.error} No statistics were calculated.</p></div></div>}
    {page === 'History' ? <History lottery={lottery} dataset={dataset} onLotteryChange={onLotteryChange} /> : page === 'Backtest' ? <Backtest key={dataset?.retrievedAt ?? 'loading'} lottery={lottery} dataset={dataset} onLotteryChange={onLotteryChange} /> : page === 'Generator' ? <Generator key={dataset?.retrievedAt ?? 'loading'} defaults={defaults} lottery={lottery} dataset={dataset} period={period} onPeriodChange={setPeriod} onLotteryChange={onLotteryChange} /> : page === 'Dashboard' ? <Dashboard onGenerate={onGenerate} lottery={lottery} dataset={dataset} analysis={result.analysis} period={period} onPeriodChange={setPeriod} /> : <NumberAnalysis lottery={lottery} analysis={result.analysis} period={period} onPeriodChange={setPeriod} />}
  </>
}
