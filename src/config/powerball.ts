import type { Lottery } from '../types/lottery.ts'
import { nySource } from './sources.ts'
export const powerball: Lottery = {
  id: 'powerball', name: 'Powerball', specialBallName: 'Powerball',
  coverageStart: '2010-02-03', coverageLabel: 'Available history beginning 2010',
  source: nySource('d6yy-54nr'),
  ruleSets: [
    { id: 'pb-coverage-59-39', effectiveFrom: '2010-02-03', effectiveTo: '2012-01-18', mainBallCount: 5, mainBallMin: 1, mainBallMax: 59, specialBallMin: 1, specialBallMax: 39,
      note: 'Start is source coverage, not the original launch of this matrix.',
      evidenceUrls: ['https://nelottery.com/media/annualreport12.pdf'] },
    { id: 'pb-2012', effectiveFrom: '2012-01-18', effectiveTo: '2015-10-07', mainBallCount: 5, mainBallMin: 1, mainBallMax: 59, specialBallMin: 1, specialBallMax: 35,
      evidenceUrls: ['https://nelottery.com/media/annualreport12.pdf', 'https://www.galottery.com/en-us/media-center/pressreleaseinput/2012/january/powerball-enhancements.html'] },
    { id: 'pb-2015', effectiveFrom: '2015-10-07', effectiveTo: null, mainBallCount: 5, mainBallMin: 1, mainBallMax: 69, specialBallMin: 1, specialBallMax: 26,
      evidenceUrls: ['https://floridalottery.com/content/dam/flalottery-web/files/game-reports/powerball/powerball-musl-game-rules.pdf'] },
  ],
}
