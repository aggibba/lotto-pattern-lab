import { useEffect, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

interface InstallEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}
const standalone = () => window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true

export function PwaControls() {
  const [online, setOnline] = useState(navigator.onLine)
  const [installed, setInstalled] = useState(standalone)
  const [install, setInstall] = useState<InstallEvent | null>(null)
  const [error, setError] = useState('')
  const { needRefresh: [needRefresh, setNeedRefresh], updateServiceWorker } = useRegisterSW({
    onRegisterError() { setError('Offline app setup is unavailable. You can continue using the website online.') },
  })
  useEffect(() => {
    const connectivity = () => setOnline(navigator.onLine)
    const offer = (event: Event) => { event.preventDefault(); setInstall(event as InstallEvent) }
    const done = () => { setInstalled(standalone()); setInstall(null) }
    const installedNow = () => { setInstalled(true); setInstall(null) }
    const mode = window.matchMedia('(display-mode: standalone)')
    window.addEventListener('online', connectivity); window.addEventListener('offline', connectivity)
    window.addEventListener('beforeinstallprompt', offer); window.addEventListener('appinstalled', installedNow)
    mode.addEventListener('change', done)
    const checkUpdate = () => {
      if (document.visibilityState === 'visible' && navigator.onLine && 'serviceWorker' in navigator) {
        void navigator.serviceWorker.getRegistration().then(registration => registration?.update()).catch(() => {})
      }
    }
    document.addEventListener('visibilitychange', checkUpdate)
    return () => {
      window.removeEventListener('online', connectivity); window.removeEventListener('offline', connectivity)
      window.removeEventListener('beforeinstallprompt', offer); window.removeEventListener('appinstalled', installedNow)
      mode.removeEventListener('change', done); document.removeEventListener('visibilitychange', checkUpdate)
    }
  }, [])
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  async function requestInstall() {
    if (!install) return
    try { await install.prompt(); await install.userChoice }
    catch { setError('Installation could not start. Use your browser’s install menu instead.') }
    finally { setInstall(null) }
  }
  return <div className="pwa-controls">
    {!online && <p className="notice" role="status">You are offline. Fresh lottery data is unavailable. Previously loaded or saved historical data may be shown; check Data Through and Retrieved before use.</p>}
    {error && <p role="status">{error}</p>}
    {needRefresh && <div className="notice" role="status"><div><p>An app update is ready. Save any combinations before reloading.</p><button onClick={() => { void updateServiceWorker(true).catch(() => setError('Update failed. Reconnect and reload to try again.')) }}>Update and reload</button> <button onClick={() => setNeedRefresh(false)}>Later</button></div></div>}
    {!installed && (install || ios) && <details className="install-help"><summary>Install Lotto Lab</summary>
      {install ? <button onClick={() => { void requestInstall() }}>Install app</button> : <p>In Safari: Share &gt; Add to Home Screen. If you are using another browser, open this page in Safari first.</p>}
    </details>}
  </div>
}
