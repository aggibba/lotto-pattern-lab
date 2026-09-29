import type { DataSource } from '../types/lottery.ts'
export function nySource(datasetId: string): DataSource {
  return {
    id: `ny-${datasetId}`, datasetId,
    name: 'New York State Gaming Commission / NY Open Data',
    apiUrl: `https://data.ny.gov/resource/${datasetId}.json`,
    url: `https://data.ny.gov/d/${datasetId}`,
  }
}
