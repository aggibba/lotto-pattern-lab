import { useEffect, useState } from 'react'
import type { LotteryDataset, LotteryId } from '../types/lottery.ts'
import { loadLotteryDataset } from '../services/drawingRepository.ts'

type LoadState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; dataset: LotteryDataset }
export function useLotteryDataset(id: LotteryId) {
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  useEffect(() => {
    let active = true
    loadLotteryDataset(id, attempt > 0).then(
      (dataset) => { if (active) setState({ status: 'ready', dataset }) },
      (error: unknown) => { if (active) setState({ status: 'error', message: error instanceof Error ? error.message : 'Unable to load historical drawings.' }) },
    )
    return () => { active = false }
  }, [id, attempt])
  return { state, retry: () => { setState({ status: 'loading' }); setAttempt((value) => value + 1) } }
}
