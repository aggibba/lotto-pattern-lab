import type { Drawing, Lottery, LotteryDataset } from '../types/lottery.ts'
import { parseDrawing, parseDrawDate } from '../utils/drawingValidation.ts'

type Fetcher = typeof fetch
const PAGE_SIZE = 500
async function request(lottery: Lottery, params: Record<string, string>, fetcher: Fetcher): Promise<unknown[]> {
  const url = new URL(lottery.source.apiUrl)
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value))
  const response = await fetcher(url, { signal: AbortSignal.timeout(30_000), cache: 'no-store' })
  if (!response.ok) throw new Error(`NY Open Data returned HTTP ${response.status}. Please retry later.`)
  const rows: unknown = await response.json()
  if (!Array.isArray(rows)) throw new Error('NY Open Data returned an invalid response.')
  return rows
}
async function summary(lottery: Lottery, fetcher: Fetcher) {
  const rows = await request(lottery, { '$select': 'count(*) as total,min(draw_date) as earliest,max(draw_date) as latest' }, fetcher)
  const row = rows[0] as Record<string, unknown> | undefined
  if (rows.length !== 1 || !row || typeof row.total !== 'string' || !/^\d+$/.test(row.total)) throw new Error('Invalid API count response.')
  const total = Number(row.total)
  if (!Number.isSafeInteger(total) || total > 100_000) throw new Error('Unexpected dataset size.')
  return { total, earliest: total ? parseDrawDate(row.earliest) : null, latest: total ? parseDrawDate(row.latest) : null }
}
export async function fetchLotteryDataset(lottery: Lottery, fetcher: Fetcher = fetch): Promise<LotteryDataset> {
  const before = await summary(lottery, fetcher)
  const drawings: Drawing[] = []
  const dates = new Set<string>()
  for (let offset = 0; offset < before.total; offset += PAGE_SIZE) {
    const rows = await request(lottery, { '$order': 'draw_date ASC', '$limit': String(PAGE_SIZE), '$offset': String(offset) }, fetcher)
    const expected = Math.min(PAGE_SIZE, before.total - offset)
    if (rows.length !== expected) throw new Error(`Incomplete API response: expected ${expected} rows at offset ${offset}, received ${rows.length}.`)
    rows.forEach((row, index) => {
      let drawing: Drawing
      try { drawing = parseDrawing(row, lottery) } catch (error) {
        throw new Error(`Rejected ${lottery.name} record ${offset + index + 1}: ${error instanceof Error ? error.message : 'invalid row'}. No partial dataset was accepted.`)
      }
      if (dates.has(drawing.drawDate)) throw new Error(`Duplicate drawing date: ${drawing.drawDate}. No partial dataset was accepted.`)
      if (drawings.length && drawing.drawDate < drawings[drawings.length - 1].drawDate) throw new Error('API drawing order changed during pagination.')
      dates.add(drawing.drawDate)
      drawings.push(drawing)
    })
  }
  const after = await summary(lottery, fetcher)
  if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error('The source changed while loading. Please retry for a consistent dataset.')
  if (drawings.length !== before.total || (drawings[0]?.drawDate ?? null) !== before.earliest || (drawings.at(-1)?.drawDate ?? null) !== before.latest) throw new Error('Incomplete dataset: count or date bounds do not match the source.')
  if (before.total && before.earliest !== lottery.coverageStart) throw new Error('Source historical coverage changed unexpectedly. Dataset was not accepted.')
  const unverified = drawings.filter((drawing) => drawing.ruleVerification === 'unverified').length
  return { lotteryId: lottery.id, drawings, source: lottery.source, earliestDate: before.earliest, dataThrough: before.latest, retrievedAt: new Date().toISOString(), warnings: unverified ? [`${unverified} drawings have unverified historical rules and must be excluded from future analysis.`] : [] }
}
