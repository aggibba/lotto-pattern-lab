import { lotteries } from '../config/lotteries.ts'
import type { LotteryDataset, LotteryId } from '../types/lottery.ts'
import { fetchLotteryDataset } from './nyOpenData.ts'
import { readOfflineDataset, saveOfflineDataset } from './offlineDataset.ts'

// Shared promises also prevent duplicate requests during React StrictMode mounting.
const cache = new Map<LotteryId, { expires: number; promise: Promise<LotteryDataset> }>()
const SESSION_TTL = 60 * 60 * 1000
export function loadLotteryDataset(id: LotteryId, refresh = false): Promise<LotteryDataset> {
  const cached = cache.get(id)
  if (!refresh && cached && cached.expires > Date.now()) return cached.promise
  const promise = (async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new Error('Offline')
      const dataset = await fetchLotteryDataset(lotteries[id])
      await saveOfflineDataset(dataset)
      return dataset
    } catch (error) {
      const saved = await readOfflineDataset(id)
      if (!saved) throw error
      return { ...saved, cacheNotice: 'Fresh data could not be loaded. Showing a previously saved archive; it may be out of date. Reconnect and use Refresh Data to retry.' }
    }
  })()
  cache.set(id, { expires: Date.now() + SESSION_TTL, promise })
  void promise.catch(() => { if (cache.get(id)?.promise === promise) cache.delete(id) })
  void promise.then(dataset => { if (dataset.cacheNotice && cache.get(id)?.promise === promise) cache.delete(id) }, () => {})
  return promise
}
