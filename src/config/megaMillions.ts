import type { Lottery } from '../types/lottery.ts'
import { nySource } from './sources.ts'
export const megaMillions: Lottery = {
  id: 'mega-millions', name: 'Mega Millions', specialBallName: 'Mega Ball',
  coverageStart: '2002-05-17', coverageLabel: 'Available history beginning 2002',
  source: nySource('5xaw-6ayf'),
  ruleSets: [
    { id: 'mm-2002', effectiveFrom: '2002-05-17', effectiveTo: '2005-06-22', mainBallCount: 5, mainBallMin: 1, mainBallMax: 52, specialBallMin: 1, specialBallMax: 52,
      evidenceUrls: ['https://www.michigan.gov/-/media/Project/Websites/msl/BSL-L-AR2002.pdf?rev=0dee7fce3bd8443fbb1891515938924b', 'https://data.ny.gov/api/views/5xaw-6ayf.json'] },
    { id: 'mm-2005', effectiveFrom: '2005-06-22', effectiveTo: '2013-10-22', mainBallCount: 5, mainBallMin: 1, mainBallMax: 56, specialBallMin: 1, specialBallMax: 46,
      note: 'Verified sales-effective date; applies to drawings on or after this date.',
      evidenceUrls: ['https://www.galottery.com/en-us/media-center/pressreleaseinput/2005/june/mega-millions-gets-bigger-bigger-jackpots-bigger-possibilities.html'] },
    { id: 'mm-2013', effectiveFrom: '2013-10-22', effectiveTo: '2017-10-31', mainBallCount: 5, mainBallMin: 1, mainBallMax: 75, specialBallMin: 1, specialBallMax: 15,
      evidenceUrls: ['https://www.lottery.ok.gov/media/documents/financial/CAFR_Report_Final_%2713.pdf'] },
    { id: 'mm-2017', effectiveFrom: '2017-10-31', effectiveTo: '2025-04-08', mainBallCount: 5, mainBallMin: 1, mainBallMax: 70, specialBallMin: 1, specialBallMax: 25,
      evidenceUrls: ['https://www.idaholottery.com/happenings/press-releases/mega-millions-commemorates-15-years-with-game-enhancements'] },
    { id: 'mm-2025', effectiveFrom: '2025-04-08', effectiveTo: null, mainBallCount: 5, mainBallMin: 1, mainBallMax: 70, specialBallMin: 1, specialBallMax: 24,
      evidenceUrls: ['https://www.megamillions.com/about.aspx'] },
  ],
}
