import { PwaControls } from './components/PwaControls'
import { useState } from 'react'
import { LotteryWorkspace } from './components/LotteryWorkspace'
import './App.css'
import { readSettings } from './config/settings'
import { Settings } from './components/Settings'
import { ErrorBoundary } from './components/ErrorBoundary'

import { lotteries } from './config/lotteries'
import type { LotteryId } from './types/lottery'
const navigation = ['Dashboard', 'Number Analysis', 'Generator', 'Backtest', 'History', 'Settings'] as const

function App() {
  const [preferences, setPreferences] = useState(readSettings)
  const [lottery, setLottery] = useState<LotteryId>(preferences.settings.lottery)
  const [page, setPage] = useState<(typeof navigation)[number]>('Dashboard')

  return (
    <div className="app-shell">
      <a className="skip-link" href="#dashboard">Skip to main content</a>
      <header className="site-header">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>
          <div><h1>Lotto Pattern Lab</h1><p>Historical Lottery Pattern Analysis</p></div>
        </div>
        <span className="version-label">THE NUMBERS, IN CONTEXT</span>
      </header>

      <div className="workspace">
        <aside className="sidebar">
          <label className="sidebar-label" htmlFor="lottery">LOTTERY</label>
          <select id="lottery" value={lottery} onChange={(event) => setLottery(event.target.value as LotteryId)}>
            {Object.values(lotteries).map((game) => <option key={game.id} value={game.id}>{game.name}</option>)}
          </select>
          <p className="sidebar-label navigation-label">WORKSPACE</p>
          <nav aria-label="Main navigation">
            {navigation.map((name, index) => (
              <button key={name} type="button" aria-label={name} className={`nav-item ${name === page ? 'active' : ''}`} aria-current={name === page ? 'page' : undefined} onClick={() => setPage(name)}>
                <span className="nav-icon" aria-hidden="true">{['▦', '▥', '⚄', '↺', '◷', '⚙'][index]}</span>
                <span className="desktop-nav-label">{name}</span><span className="mobile-nav-label" aria-hidden="true">{['Home', 'Analysis', 'Generator', 'Backtest', 'History', 'Settings'][index]}</span>
              </button>
            ))}
          </nav>
          <div className="sidebar-note"><span className="status-dot" />Foundation release<p>A space to explore historical data, one drawing at a time.</p></div>
        </aside>
        <main id="dashboard" tabIndex={-1}>
          <PwaControls />
          {preferences.error && <p role="alert">{preferences.error}</p>}
          <ErrorBoundary key={lottery} resetKey={page}>
            {page === 'Settings' ? <Settings value={preferences.settings} onSave={settings => setPreferences({ settings, error: '' })} /> : <LotteryWorkspace key={lottery} lottery={lotteries[lottery]} page={page} defaults={preferences.settings} onGenerate={() => setPage('Generator')} onLotteryChange={setLottery} />}
          </ErrorBoundary>
          <footer>Lottery drawings are random and independent. Historical patterns do not predict future winning numbers. Lotto Pattern Lab is intended for statistical analysis and entertainment purposes.</footer>
        </main>
      </div>
    </div>
  )
}

export default App
