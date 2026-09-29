import { useState } from 'react'
import { DEFAULT_SETTINGS, SETTINGS_KEY, serializeSettings, type Settings as Preferences } from '../config/settings'
import { lotteries } from '../config/lotteries'
import { ANALYSIS_PERIODS } from '../config/analysis'
import { STRATEGIES } from '../config/generator'

export function Settings({ value, onSave }: { value: Preferences; onSave: (value: Preferences) => void }) {
  const [draft, setDraft] = useState(value)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  function save(next: Preferences) {
    try { localStorage.setItem(SETTINGS_KEY, serializeSettings(next)); setDraft(next); onSave(next); setError(''); setMessage('Settings saved. Defaults apply on reload, lottery changes, and when opening Generator.') }
    catch { setError('Settings could not be saved. Browser storage may be unavailable or full.'); setMessage('') }
  }
  return <section aria-label="Settings"><div className="page-heading"><div><h2>Settings</h2><p>Defaults are stored only in this browser.</p></div></div>
    <form className="card generator-controls" onSubmit={e => { e.preventDefault(); save(draft) }}>
      <label>Default Lottery<select aria-label="Default Lottery" value={draft.lottery} onChange={e => setDraft({ ...draft, lottery: e.target.value as Preferences['lottery'] })}>{Object.values(lotteries).map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select></label>
      <label>Default Analysis Period<select aria-label="Default Analysis Period" value={draft.period} onChange={e => setDraft({ ...draft, period: e.target.value as Preferences['period'] })}>{ANALYSIS_PERIODS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}</select></label>
      <label>Default Generator Strategy<select aria-label="Default Generator Strategy" value={draft.strategy} onChange={e => setDraft({ ...draft, strategy: e.target.value as Preferences['strategy'] })}>{STRATEGIES.map(s => <option key={s}>{s}</option>)}</select></label>
      <label>Default combinations<select aria-label="Default combinations" value={draft.count} onChange={e => setDraft({ ...draft, count: Number(e.target.value) })}>{[1, 5, 10, 20].map(n => <option key={n}>{n}</option>)}</select></label>
      <button type="submit">Save Settings</button><button type="button" onClick={() => save({ ...DEFAULT_SETTINGS })}>Reset to Defaults</button>
    </form>{message && <p role="status">{message}</p>}{error && <p role="alert">{error}</p>}
  </section>
}
