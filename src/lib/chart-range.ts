/** The periods the portfolio chart can show, as a brokerage names them. */
export type ChartRange = '1D' | '1W' | '1M' | '3M' | 'YTD' | '1Y' | 'ALL';

export const CHART_RANGES: readonly ChartRange[] = ['1D', '1W', '1M', '3M', 'YTD', '1Y', 'ALL'];

const DAY_MS = 24 * 60 * 60 * 1_000;

/** Where a range begins. `since` is the first position, which is where "all" starts. */
export function rangeStartTime(range: ChartRange, now: number, since: number): number {
  switch (range) {
    case '1D': return now - DAY_MS;
    case '1W': return now - 7 * DAY_MS;
    case '1M': return now - 30 * DAY_MS;
    case '3M': return now - 91 * DAY_MS;
    case 'YTD': return new Date(new Date(now).getFullYear(), 0, 1).getTime();
    case '1Y': return now - 365 * DAY_MS;
    case 'ALL': return since;
  }
}
