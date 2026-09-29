import { useMemo, useState } from 'react'
import type { Lottery, LotteryDataset, LotteryId } from '../types/lottery'
import { lotteries } from '../config/lotteries'

export function History({ lottery, dataset, onLotteryChange }: { lottery: Lottery; dataset: LotteryDataset | null; onLotteryChange: (id: LotteryId) => void }) {
  const [sort, setSort] = useState('newest')
  const [page, setPage] = useState(0)
  const drawings = useMemo(() => sort === 'newest' ? [...(dataset?.drawings ?? [])].reverse() : dataset?.drawings ?? [], [dataset, sort])
  const pages = Math.max(1, Math.ceil(drawings.length / 25))
  const current = Math.min(page, pages - 1)
  return <section aria-label="Drawing History">
    <div className="card generator-controls"><label>History Lottery<select aria-label="History Lottery" value={lottery.id} onChange={e => onLotteryChange(e.target.value as LotteryId)}>{Object.values(lotteries).map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select></label>
      <label>Sort<select aria-label="Sort" value={sort} onChange={e => { setSort(e.target.value); setPage(0) }}><option value="newest">Newest First</option><option value="oldest">Oldest First</option></select></label></div>
    <p className="analysis-explanation">Scroll within the table to view all columns and drawings on this page.</p>
    <div className="card history-card"><div className="table-scroll" tabIndex={0} role="region" aria-label="Historical drawings table"><table className="statistics-table"><caption>{lottery.name} official drawing history</caption><thead><tr>{['Drawing Date', 'Main Numbers', lottery.specialBallName, 'Multiplier'].map(h => <th scope="col" key={h}>{h}</th>)}</tr></thead><tbody>{drawings.slice(current * 25, (current + 1) * 25).map(d => <tr key={d.drawDate}><th scope="row">{d.drawDate}</th><td>{d.mainNumbers.join(', ')}</td><td>{d.specialBall}</td><td>{d.multiplier === null ? 'Not available' : `${d.multiplier}×`}</td></tr>)}</tbody></table></div>
    {!drawings.length && <p>No drawing history available.</p>}</div>
    <div className="backtest-pagination"><button disabled={current === 0} onClick={() => setPage(current - 1)}>Previous drawings</button><span role="status">Page {current + 1} of {pages} · {drawings.length.toLocaleString()} drawings</span><button disabled={current >= pages - 1} onClick={() => setPage(current + 1)}>Next drawings</button></div>
  </section>
}
