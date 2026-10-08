import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { fetchMarketsForBets } from '@/api/client/bet-monitor';
import {
  fetchOutcomeHistory,
  fetchStockHistory,
  type ChartRange,
  type PriceSeries,
} from '@/api/client/price-history';
import type { PortfolioProgressPoint } from '@/api/client/storage';
import { betOutcomeSide, findMarketForBet, outcomeTokenId } from '@/lib/bet-monitor-match';
import { isPredictionMarketBet } from '@/lib/parse-bet-line';
import { stockIdentity, type PositionValuation } from '@/lib/portfolio-progress';
import { buildPortfolioSeries, type ChartSeries } from '@/lib/portfolio-series';
import { isStockOrEtfCategory } from '@/lib/tracked-assets';
import type { TrackedBet } from '@/types/bets';

const MINUTE = 60_000;
const NO_POINTS: PortfolioProgressPoint[] = [];

/** How often each range pulls new bars. 1D moves every five minutes; a year does not. */
const REFRESH_MS: Record<ChartRange, number> = {
  '1D': MINUTE,
  '1W': 5 * MINUTE,
  '1M': 15 * MINUTE,
  '3M': 60 * MINUTE,
  'YTD': 60 * MINUTE,
  '1Y': 60 * MINUTE,
  'ALL': 15 * MINUTE,
};

/**
 * The chart's series for one range, built from the market's own price history for
 * every position held, with the live value appended so the line ends where the
 * header number is — and keeps moving between fetches.
 */
export function usePortfolioSeries({
  bets,
  range,
  live,
  positionById,
  recorded = NO_POINTS,
}: {
  /** Active positions in scope. */
  bets: TrackedBet[];
  range: ChartRange;
  live: PortfolioProgressPoint | null;
  positionById: Record<string, PositionValuation>;
  recorded?: PortfolioProgressPoint[];
}): { series: ChartSeries; isLoading: boolean } {
  const symbols = useMemo(
    () => [...new Set(bets
      .filter((bet) => isStockOrEtfCategory(bet.category))
      .map((bet) => stockIdentity(bet).symbol)
      .filter((symbol): symbol is string => Boolean(symbol)))].sort(),
    [bets],
  );
  const predictionBets = useMemo(() => bets.filter(isPredictionMarketBet), [bets]);
  const predictionKey = predictionBets.map((bet) => bet.id).sort().join(',');

  // Which CLOB token each prediction position holds. Markets do not change tokens,
  // so this is looked up once per set of positions.
  const tokensQuery = useQuery({
    queryKey: ['CHART_OUTCOME_TOKENS', predictionKey],
    enabled: predictionBets.length > 0,
    staleTime: 60 * MINUTE,
    queryFn: async () => {
      const markets = await fetchMarketsForBets(predictionBets);
      const tokens: Record<string, string> = {};
      for (const bet of predictionBets) {
        const market = findMarketForBet(bet, markets);
        const token = market ? outcomeTokenId(market, betOutcomeSide(bet)) : null;
        if (token) tokens[bet.id] = token;
      }
      return tokens;
    },
  });
  const tokens = tokensQuery.data;

  // Rounded to the minute so a re-render does not mint a new query key.
  const since = useMemo(() => {
    const times = bets.map((bet) => Date.parse(bet.createdAt)).filter(Number.isFinite);
    return times.length > 0 ? Math.floor(Math.min(...times) / MINUTE) * MINUTE : 0;
  }, [bets]);

  const historyQuery = useQuery({
    queryKey: ['PORTFOLIO_PRICE_HISTORY', range, symbols.join(','), JSON.stringify(tokens ?? {}), since],
    enabled: bets.length > 0 && (predictionBets.length === 0 || tokensQuery.isFetched),
    staleTime: REFRESH_MS[range],
    refetchInterval: REFRESH_MS[range],
    // The previous range stays up until the next one lands, rather than blanking.
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const now = Date.now();
      const [stocks, outcomes] = await Promise.all([
        Promise.all(symbols.map(async (symbol) => [symbol, await fetchStockHistory(symbol, range, since, now)] as const)),
        Promise.all(Object.entries(tokens ?? {}).map(async ([betId, token]) =>
          [betId, await fetchOutcomeHistory(token, range, since, now)] as const)),
      ]);
      const keep = (rows: readonly (readonly [string, PriceSeries | null])[]) =>
        Object.fromEntries(rows.filter((row): row is readonly [string, PriceSeries] => row[1] != null));
      return { range, stockHistory: keep(stocks), outcomeHistory: keep(outcomes) };
    },
  });

  // Every distinct live value seen this session. Between bar fetches these are what
  // make the tip of the line tick, instead of one straight segment to "now". Kept
  // as state adjusted during render (not a ref) so the compiler can see it change.
  const [tail, setTail] = useState<PortfolioProgressPoint[]>([]);
  const lastSeen = tail[tail.length - 1];
  if (live && (!lastSeen || (live.time > lastSeen.time && Math.abs(live.value - lastSeen.value) >= 0.005))) {
    setTail([...tail.filter((point) => point.time > live.time - 6 * 60 * MINUTE), live]);
  }

  const history = historyQuery.data;
  const fetchedAt = historyQuery.dataUpdatedAt;
  const built = useMemo(() => buildPortfolioSeries({
    range,
    bets,
    // Placeholder data from the previous range would lay the wrong bars on this one's axis.
    stockHistory: history?.range === range ? history.stockHistory : {},
    outcomeHistory: history?.range === range ? history.outcomeHistory : {},
    positionById,
    live,
    liveTail: tail,
    recorded,
    now: Math.max(live?.time ?? 0, fetchedAt),
  }), [bets, fetchedAt, history, live, positionById, range, recorded, tail]);

  // While a new range is loading, the placeholder is the previous range's bars —
  // keep showing the last chart that was actually drawn from them.
  const switching = historyQuery.isPlaceholderData && history?.range !== range;
  const [settled, setSettled] = useState<ChartSeries | null>(null);
  if (!switching && settled !== built) setSettled(built);
  const series = switching && settled ? settled : built;

  return { series, isLoading: historyQuery.isLoading || switching };
}
