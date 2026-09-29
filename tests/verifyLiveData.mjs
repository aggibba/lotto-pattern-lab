import { lotteries } from '../src/config/lotteries.ts'
import { fetchLotteryDataset } from '../src/services/nyOpenData.ts'
for (const lottery of Object.values(lotteries)) {
  const dataset = await fetchLotteryDataset(lottery)
  const response = await fetch(lottery.source.apiUrl + '?$limit=1', { headers: { Origin: 'http://localhost:5173' } })
  console.log(JSON.stringify({ lottery: lottery.name, count: dataset.drawings.length, earliest: dataset.earliestDate, latest: dataset.dataThrough, warnings: dataset.warnings, rejected: 0, cors: response.headers.get('access-control-allow-origin') }))
}
