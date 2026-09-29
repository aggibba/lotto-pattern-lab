import { lotteries } from '../config/lotteries.ts'
import type { LotteryDataset, LotteryId } from '../types/lottery.ts'
import { fetchLotteryDataset } from './nyOpenData.ts'

// Shared promises also prevent duplicate requests during React StrictMode mounting.
const cache = new Map<LotteryId, { expires: number; promise: Promise<LotteryDataset> }>()
const SESSION_TTL = 60 * 60 * 1000
export function loadLotteryDataset(id: LotteryId, refresh = false): Promise<LotteryDataset> {
  const cached = cache.get(id)
  if (!refresh && cached && cached.expires > Date.now()) return cached.promise
  const promise = fetchLotteryDataset(lotteries[id])
  cache.set(id, { expires: Date.now() + SESSION_TTL, promise })
  void promise.catch(() => { if (cache.get(id)?.promise === promise) cache.delete(id) })
  return promise
}
