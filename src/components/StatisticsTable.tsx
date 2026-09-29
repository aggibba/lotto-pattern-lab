import { useMemo, useState } from 'react'
import { sortStatistics } from '../analytics/numberStatistics'
import { CLASSIFICATION_RULES } from '../config/analysis'
import type { NumberStatistics, StatisticsSortKey } from '../types/analysis'

const columns: { label: string; key: StatisticsSortKey }[] = [
  { label: 'Number', key: 'number' }, { label: 'Appearances', key: 'appearances' },
  { label: 'Frequency %', key: 'frequencyPercent' }, { label: 'Drawings Since', key: 'drawingsSinceLastAppearance' },
  { label: 'Recent 20', key: 'recent20' }, { label: 'Recent 50', key: 'recent50' }, { label: 'Recent 100', key: 'recent100' },
]
export function StatisticsTable({ stats, drawings, label }: { stats: readonly NumberStatistics[]; drawings: number; label: string }) {
  const [sort, setSort] = useState<{ key: StatisticsSortKey; direction: 'asc' | 'desc' }>({ key: 'number', direction: 'asc' })
  const rows = useMemo(() => sortStatistics(stats, sort.key, sort.direction), [stats, sort])
  function heading(column: (typeof columns)[number]) {
    const active = sort.key === column.key
    return <th key={column.key} scope="col" aria-sort={active ? sort.direction === 'asc' ? 'ascending' : 'descending' : 'none'}><button type="button" onClick={() => setSort({ key: column.key, direction: active && sort.direction === 'asc' ? 'desc' : 'asc' })}>{column.label}<span aria-hidden="true"> {active ? sort.direction === 'asc' ? '↑' : '↓' : '↕'}</span></button></th>
  }
  return <div className="table-scroll" role="region" aria-label={`${label} statistics table, scroll horizontally on smaller screens`} tabIndex={0}>
    <table className="statistics-table">
      <caption>{label} · {drawings} drawings analyzed. Select a column heading to sort.</caption>
      <thead><tr>{columns.slice(0, 3).map(heading)}<th scope="col">Last Drawn</th>{columns.slice(3).map(heading)}<th scope="col">Status</th></tr></thead>
      <tbody>{rows.map((stat) => <tr key={stat.number}>
        <th scope="row"><span className="table-ball">{stat.number}</span></th>
        <td>{stat.appearances}</td><td>{stat.frequencyPercent === null ? '—' : `${stat.frequencyPercent.toFixed(2)}%`}</td>
        <td>{stat.lastDrawnDate ?? (drawings ? 'Not in period' : '—')}</td>
        <td>{!drawings ? '—' : stat.drawingsSinceLastAppearance ?? `≥${stat.gapLowerBound}`}</td>
        <td>{stat.recent20}</td><td>{stat.recent50}</td><td>{stat.recent100}</td>
        <td><div className="status-list">{drawings < CLASSIFICATION_RULES.minimumDrawings ? <span className="neutral-status">Insufficient data</span> : stat.statuses.length ? stat.statuses.map((status) => <span key={status} className={`number-status ${status.toLowerCase()}`}>{status}</span>) : <span className="neutral-status">Neutral</span>}</div></td>
      </tr>)}</tbody>
    </table>
  </div>
}
