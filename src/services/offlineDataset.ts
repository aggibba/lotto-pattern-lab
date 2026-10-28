import { lotteries } from '../config/lotteries.ts'
import { selectAnalysisDrawings } from '../analytics/drawingSelection.ts'
import type { LotteryDataset, LotteryId } from '../types/lottery.ts'

const CACHE = 'lotto-validated-archives-v1'
const key = (id: LotteryId) => new URL(`/offline-archive/${id}`, location.origin).href
export function validateSnapshot(value: unknown, id: LotteryId): LotteryDataset {
  const envelope = value as { version?: number; dataset?: LotteryDataset } | null
  const d = envelope?.dataset
  if (envelope?.version !== 1 || !d || d.lotteryId !== id || !Array.isArray(d.drawings) || !d.drawings.length || typeof d.retrievedAt !== 'string' || !Number.isFinite(Date.parse(d.retrievedAt)) || d.earliestDate !== lotteries[id].coverageStart || d.drawings[0]?.drawDate !== d.earliestDate || d.drawings.at(-1)?.drawDate !== d.dataThrough || d.drawings.some((row, i) => i > 0 && row.drawDate <= d.drawings[i - 1].drawDate)) throw new Error('Invalid offline archive.')
  const analysis = selectAnalysisDrawings(d.drawings, { lottery: lotteries[id], period: 'current-era', asOfDate: new Date().toISOString().slice(0, 10) })
  return { ...d, source: lotteries[id].source, warnings: analysis.warnings, cacheNotice: undefined }
}
export async function saveOfflineDataset(dataset: LotteryDataset) {
  try {
    if (typeof caches === 'undefined' || !dataset.drawings.length) return
    const cache = await caches.open(CACHE)
    await cache.put(key(dataset.lotteryId), new Response(JSON.stringify({ version: 1, dataset }), { headers: { 'Content-Type': 'application/json' } }))
  } catch { /* Storage denial/quota must not prevent use of a successful official fetch. */ }
}
export async function readOfflineDataset(id: LotteryId): Promise<LotteryDataset | null> {
  try {
    if (typeof caches === 'undefined') return null
    const response = await (await caches.open(CACHE)).match(key(id))
    return response ? validateSnapshot(await response.json(), id) : null
  } catch { return null }
}
