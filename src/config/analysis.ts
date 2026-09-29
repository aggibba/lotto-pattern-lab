export const ANALYSIS_PERIODS = [
  { value: '20', label: 'Last 20 Drawings', limit: 20 },
  { value: '50', label: 'Last 50 Drawings', limit: 50 },
  { value: '100', label: 'Last 100 Drawings', limit: 100 },
  { value: 'current-era', label: 'Current Rule Era', limit: null },
] as const
export type AnalysisPeriod = (typeof ANALYSIS_PERIODS)[number]['value']
export const CLASSIFICATION_RULES = {
  minimumDrawings: 20,
  hotAverageMultiple: 1.5,
  coldAverageMultiple: 0.5,
  overdueGapMultiple: 1,
  cardNumberLimit: 5,
} as const
export const ANALYSIS_DISCLAIMER = 'Hot, Cold, and Overdue describe historical drawing patterns only. Lottery drawings are independent, and these labels do not indicate future winning probability.'
