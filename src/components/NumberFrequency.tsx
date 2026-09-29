import type { NumberStatistics } from '../types/analysis'
export function NumberFrequency({ stats, drawings }: { stats: readonly NumberStatistics[]; drawings: number }) {
  if (!drawings) return <p className="empty-analysis">No verified drawings to visualize.</p>
  return <>
    <p>Percentage of selected drawings containing each main number. Scale: 0–100%.</p>
    <div className="frequency-list" tabIndex={0} role="region" aria-label="Main number frequencies, scroll for all numbers">
      {stats.map((stat) => <div className="frequency-row" key={stat.number} aria-label={`Number ${stat.number}: ${stat.appearances} appearances in ${drawings} drawings, ${stat.frequencyPercent?.toFixed(2)} percent`}>
        <span className="frequency-number">{stat.number}</span>
        <span className="frequency-track" aria-hidden="true"><span style={{ width: `${stat.frequencyPercent ?? 0}%` }} /></span>
        <span className="frequency-value">{stat.frequencyPercent?.toFixed(2)}% <small>({stat.appearances})</small></span>
      </div>)}
    </div>
  </>
}
