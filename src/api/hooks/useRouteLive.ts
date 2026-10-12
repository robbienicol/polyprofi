import { useQuery } from '@tanstack/react-query';
import { useIsFocused } from 'expo-router';
import { useMemo } from 'react';

import { fetchPolymarketMarketsBySlug } from '@/api/client/polymarket-market-data';
import { fetchOutcomeHistory, fetchStockHistory, type PriceSeries } from '@/api/client/price-history';
import { betOutcomeSide, outcomeTokenId } from '@/lib/bet-monitor-match';
import { isStockOrEtfCategory, inferAssetSymbol } from '@/lib/tracked-assets';
import type { Route } from '@/types/routes';

const SECOND = 1_000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;

/**
 * What a route's card can chart: the market's own prints for the thing it buys.
 * Only routes with a real tradable price get one — a T-bill, a spending cut or a
 * card bonus has no line, and drawing one would be a line made up.
 */
export type RouteFeed =
  | { kind: 'quote'; symbol: string }
  | { kind: 'outcome'; slug: string; side: string };

const SYMBOL = /^[A-Z0-9][A-Z0-9.-]{0,11}$/;

export function routeFeed(route: Route): RouteFeed | null {
  if (route.sourceSlug) {
    const side = betOutcomeSide(route);
    return side ? { kind: 'outcome', slug: route.sourceSlug, side } : null;
  }
  if (route.optionPosition) return { kind: 'quote', symbol: route.optionPosition.underlying.toUpperCase() };
  const crypto = route.id.match(/^crypto-([a-z0-9]+)$/);
  if (crypto) return { kind: 'quote', symbol: `${crypto[1].toUpperCase()}-USD` };
  const etf = route.id.match(/^etf-(.+)$/);
  if (etf && SYMBOL.test(etf[1].toUpperCase())) return { kind: 'quote', symbol: etf[1].toUpperCase() };
  if (isStockOrEtfCategory(route.category)) {
    const symbol = inferAssetSymbol(route.description, route.strategy, route.line);
    return symbol ? { kind: 'quote', symbol } : null;
  }
  return null;
}

export interface RouteLive {
  /** Ascending prints. At least two, or the hook returns null. */
  series: PriceSeries;
  /** Where the change is measured from: yesterday's close, or the window's first print. */
  baseline: number;
  last: number;
  /** 'today' for a 1D quote, '7d' for a contract, whose day is usually flat. */
  window: string;
  kind: RouteFeed['kind'];
}

/**
 * A route's live line. Quotes re-pull the day's 5-minute bars every 15s, whose last
 * bar moves with the market while it is open. A contract's week of hourly prints
 * changes slowly, so it is pulled once a minute and its midpoint every 10s is laid
 * on the end — that is the tick.
 *
 * Keys are per symbol / token, so ten cards on VOO share one request.
 */
export function useRouteLive(route: Route): { live: RouteLive | null; loading: boolean } {
  const feed = useMemo(() => routeFeed(route), [route]);
  // Polls only while its screen is in front: a tab left behind stays mounted, and
  // twelve cards ticking on a screen nobody is looking at is wasted requests.
  const focused = useIsFocused();

  const token = useQuery({
    queryKey: ['ROUTE_LIVE_TOKEN', feed?.kind === 'outcome' ? feed.slug : null, feed?.kind === 'outcome' ? feed.side : null],
    enabled: feed?.kind === 'outcome',
    staleTime: HOUR,
    queryFn: async () => {
      if (feed?.kind !== 'outcome') return null;
      const [market] = await fetchPolymarketMarketsBySlug([feed.slug]);
      return market ? outcomeTokenId(market, feed.side) : null;
    },
  });
  const tokenId = token.data ?? null;

  const history = useQuery({
    queryKey: ['ROUTE_LIVE_HISTORY', feed?.kind === 'quote' ? feed.symbol : tokenId],
    enabled: feed?.kind === 'quote' || !!tokenId,
    refetchInterval: focused ? (feed?.kind === 'quote' ? 15 * SECOND : MINUTE) : false,
    staleTime: 10 * SECOND,
    queryFn: () => {
      const now = Date.now();
      return feed?.kind === 'quote'
        ? fetchStockHistory(feed.symbol, '1D', now, now)
        : fetchOutcomeHistory(tokenId!, '1W', now, now, 15);
    },
  });

  const midpoint = useQuery({
    queryKey: ['ROUTE_LIVE_MID', tokenId],
    enabled: !!tokenId,
    refetchInterval: focused ? 10 * SECOND : false,
    staleTime: 5 * SECOND,
    queryFn: () => fetchMidpoint(tokenId!),
  });

  const live = useMemo(() => {
    const base = history.data;
    if (!feed || !base || base.prices.length < 2) return null;
    const mid = midpoint.data;
    const lastTime = base.times[base.times.length - 1];
    // A midpoint fetched before the history refetch is older than its last print;
    // laid on the end at its own time it would draw the line backwards.
    const joined = mid != null
      ? { ...base, times: [...base.times, Math.max(midpoint.dataUpdatedAt, lastTime + 1)], prices: [...base.prices, mid] }
      : base;
    const series = changePoints(joined);
    const last = series.prices[series.prices.length - 1];
    const baseline = feed.kind === 'quote' && base.previousClose ? base.previousClose : series.prices[0];
    return { series, baseline, last, window: feed.kind === 'quote' ? 'today' : '7d', kind: feed.kind };
  }, [feed, history.data, midpoint.data, midpoint.dataUpdatedAt]);

  // Loading only while a request is in flight: a symbol Yahoo cannot resolve or a
  // market with no token ends as "no line", not a placeholder that pulses forever.
  return { live, loading: feed != null && live == null && (token.isLoading || history.isLoading) };
}

async function fetchMidpoint(tokenId: string): Promise<number | null> {
  try {
    const response = await fetch(`https://clob.polymarket.com/midpoint?token_id=${encodeURIComponent(tokenId)}`, {
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) return null;
    const mid = Number(((await response.json()) as { mid?: string }).mid);
    return Number.isFinite(mid) && mid > 0 && mid < 1 ? mid : null;
  } catch {
    return null;
  }
}

/**
 * Only the prints where the price moved, plus the latest. A thin contract repeats the
 * same price for hours and then jumps, which drew as a staircase; joining the moves
 * draws it the way the portfolio chart reads, one move to the next.
 */
function changePoints(series: PriceSeries): PriceSeries {
  const { times, prices } = series;
  if (prices.length < 3) return series;
  const keptTimes = [times[0]];
  const keptPrices = [prices[0]];
  for (let index = 1; index < prices.length - 1; index += 1) {
    if (prices[index] !== keptPrices[keptPrices.length - 1]) {
      keptTimes.push(times[index]);
      keptPrices.push(prices[index]);
    }
  }
  keptTimes.push(times[times.length - 1]);
  keptPrices.push(prices[prices.length - 1]);
  return { ...series, times: keptTimes, prices: keptPrices };
}
