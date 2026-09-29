import test from 'node:test'
import assert from 'node:assert/strict'
import { powerball } from '../src/config/powerball.ts'
import { megaMillions } from '../src/config/megaMillions.ts'
import { parseDrawing } from '../src/utils/drawingValidation.ts'
import { fetchLotteryDataset } from '../src/services/nyOpenData.ts'

const pb = { draw_date: '2026-09-21T00:00:00.000', winning_numbers: '02 07 09 17 58 20', multiplier: '2', double_play_winning_numbers: '03 09 16 26 32 02' }
const mm = { draw_date: '2026-09-22T00:00:00.000', winning_numbers: '07 13 26 37 68', mega_ball: '08' }
test('representative API rows: separate special balls, ignore Double Play, nullable multiplier', () => {
  assert.deepEqual(parseDrawing(pb, powerball).mainNumbers, [2, 7, 9, 17, 58])
  assert.equal(parseDrawing(pb, powerball).specialBall, 20)
  assert.equal(parseDrawing(pb, powerball).multiplier, 2)
  assert.equal(parseDrawing(mm, megaMillions).specialBall, 8)
  assert.equal(parseDrawing(mm, megaMillions).multiplier, null)
  assert.equal(parseDrawing({ ...mm, draw_date: '2025-04-04', multiplier: '3' }, megaMillions).multiplier, 3)
})
test('reject malformed rows, dates, counts, duplicate main numbers and out-of-era balls', () => {
  for (const row of [null, {}, { ...pb, winning_numbers: '1 2 3' }, { ...pb, winning_numbers: '1 1 2 3 4 5' }, { ...pb, winning_numbers: '1 2 3 4 70 5' }, { ...pb, draw_date: '2026-02-30' }, { ...pb, multiplier: '2x' }]) assert.throws(() => parseDrawing(row, powerball))
  assert.throws(() => parseDrawing({ ...mm, mega_ball: '25' }, megaMillions))
  assert.throws(() => parseDrawing({ ...mm, multiplier: '3' }, megaMillions))
  assert.equal(parseDrawing({ ...mm, draw_date: '2025-04-04', mega_ball: '25' }, megaMillions).specialBall, 25)
  assert.equal(parseDrawing({ ...pb, draw_date: '2012-01-14', winning_numbers: '1 2 3 4 59 39' }, powerball).ruleSetId, 'pb-coverage-59-39')
  assert.throws(() => parseDrawing({ ...pb, draw_date: '2012-01-18', winning_numbers: '1 2 3 4 59 39' }, powerball))
  assert.equal(parseDrawing(pb, { ...powerball, ruleSets: [] }).ruleVerification, 'unverified')
})
function mock(rows, options = {}) {
  const dates = rows.map((row) => row.draw_date.slice(0, 10)).sort()
  let summaries = 0
  return async (input) => {
    const url = new URL(input)
    if (options.httpError) return new Response('', { status: 503 })
    if (url.searchParams.has('$select')) {
      summaries++
      return Response.json([{ total: String(rows.length + (options.changed && summaries > 1 ? 1 : 0)), earliest: dates[0], latest: dates.at(-1) }])
    }
    const offset = Number(url.searchParams.get('$offset'))
    const limit = Number(url.searchParams.get('$limit'))
    const page = rows.slice(offset, offset + limit)
    return Response.json(options.truncated ? page.slice(1) : page)
  }
}
const many = Array.from({ length: 1001 }, (_, i) => ({ ...pb, draw_date: new Date(Date.UTC(2010, 1, 3 + i)).toISOString().slice(0, 10), winning_numbers: '1 2 3 4 5 6' }))
test('pagination retrieves more than 1000 records and checks bounds', async () => {
  const data = await fetchLotteryDataset(powerball, mock(many))
  assert.equal(data.drawings.length, 1001)
  assert.equal(data.earliestDate, '2010-02-03')
})
test('reject truncated pages, duplicate dates, source mutation, API errors and malformed rows', async () => {
  await assert.rejects(fetchLotteryDataset(powerball, mock(many, { truncated: true })), /Incomplete API/)
  await assert.rejects(fetchLotteryDataset(powerball, mock([many[0], many[0]])), /Duplicate drawing/)
  await assert.rejects(fetchLotteryDataset(powerball, mock(many, { changed: true })), /source changed/)
  await assert.rejects(fetchLotteryDataset(powerball, mock(many, { httpError: true })), /HTTP 503/)
  await assert.rejects(fetchLotteryDataset(powerball, mock([{ ...many[0], winning_numbers: '' }])), /Rejected/)
})
test('empty source produces an explicit empty dataset', async () => {
  const data = await fetchLotteryDataset(powerball, mock([]))
  assert.equal(data.drawings.length, 0)
  assert.equal(data.dataThrough, null)
})
