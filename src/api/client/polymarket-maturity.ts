import type { PolymarketEntry } from '@/api/client/market-data-types';
import {
  TIMEFRAME_MATURITY_LIMITS,
  timeframeMaturityLimit,
} from '@/lib/quiz-profile';
import type { RouteParams } from '@/types/routes';

export const DAY_MS = 86_400_000;
export const HORIZON_LIMITS = Object.values(TIMEFRAME_MATURITY_LIMITS);

export function polymarketMaturityDays(
  endDate: string | undefined,
  now = Date.now(),
): number | null {
  if (!endDate) return null;
  const end = new Date(endDate).getTime();
  if (!Number.isFinite(end) || end <= now) return null;
  return Math.ceil((end - now) / DAY_MS);
}

export function filterPolymarketMarketsForTimeframe(
  markets: PolymarketEntry[],
  timeframe: RouteParams['timeframe'],
  now = Date.now(),
): PolymarketEntry[] {
  const maxDays = timeframeMaturityLimit(timeframe);
  return markets.filter((market) => {
    const days = polymarketMaturityDays(market.endDate, now);
    return days != null && days <= maxDays;
  });
}

export function balancePolymarketUniverse(
  markets: PolymarketEntry[],
  limit: number,
  now = Date.now(),
): PolymarketEntry[] {
  if (limit <= 0) return [];
  const buckets = HORIZON_LIMITS.map(() => [] as PolymarketEntry[]);
  for (const market of markets) {
    const days = polymarketMaturityDays(market.endDate, now);
    if (days == null) continue;
    const bucketIndex = HORIZON_LIMITS.findIndex((maxDays) => days <= maxDays);
    if (bucketIndex >= 0) buckets[bucketIndex].push(market);
  }
  for (const bucket of buckets) bucket.sort((a, b) => b.volumeM - a.volumeM);

  const selected: PolymarketEntry[] = [];
  const used = new Set<string>();
  const quota = Math.floor(limit / buckets.length);
  for (const bucket of buckets) {
    for (const market of bucket.slice(0, quota)) {
      selected.push(market);
      used.add(market.slug ?? market.question);
    }
  }

  const remaining = buckets
    .flat()
    .filter((market) => !used.has(market.slug ?? market.question))
    .sort((a, b) => b.volumeM - a.volumeM);
  return [...selected, ...remaining].slice(0, limit);
}
