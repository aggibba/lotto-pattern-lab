import { powerball } from './powerball.ts'
import { megaMillions } from './megaMillions.ts'
import type { Lottery, LotteryId } from '../types/lottery.ts'
export const lotteries: Record<LotteryId, Lottery> = { powerball, 'mega-millions': megaMillions }
