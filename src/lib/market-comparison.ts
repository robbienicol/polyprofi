import { fetchKalshiMarketByTicker } from '@/api/client/kalshi-market-data';
import { fetchPolymarketUniverse } from '@/api/client/polymarket-market-data';
import { computeDailySportsMatches } from '@/lib/sports-market-matching-job';
import { netYesPrice } from '@/lib/platform-fees';
import type { Route } from '@/types/routes';

export interface MarketComparison {
  kalshiTicker: string;
  polymarketPrice: number; // net of fees
  kalshiPrice: number; // net of fees
  betterPlatform: 'polymarket' | 'kalshi' | 'tie';
  edgeCents: number;
}

const CONTRACTS_FOR_FEE_ESTIMATE = 100;

/**
 * Resolves a route's cross-platform comparison, or null if there's no
 * confident match, no traceable source market (e.g. an AI-generated route),
 * or the route's outcome direction can't be determined safely.
 */
export async function resolveMarketComparison(route: Route): Promise<MarketComparison | null> {
  if (!route.sourceSlug) return null;

  const matches = await computeDailySportsMatches();
  const match = matches.find((m) => m.polymarketSlug === route.sourceSlug);
  if (!match) return null;

  const polymarketUniverse = await fetchPolymarketUniverse();
  const polymarketMarket = polymarketUniverse.find((m) => m.slug === route.sourceSlug);
  if (!polymarketMarket || polymarketMarket.outcomes.length !== 2) return null;

  // route.line is "${outcome} ${cents}¢" (see polymarket-routes.ts toRoute()),
  // where `outcome` is verbatim one of the market's two outcome strings — for
  // sports markets that's a team name, e.g. "Toronto Tempo 91¢", not "Yes"/"No".
  const isOutcome0 = route.line?.startsWith(polymarketMarket.outcomes[0]) ?? false;
  const isOutcome1 = route.line?.startsWith(polymarketMarket.outcomes[1]) ?? false;
  if (isOutcome0 === isOutcome1) return null; // ambiguous or neither — can't determine direction safely

  const kalshiTicker = isOutcome0 ? match.kalshiYesTicker : match.kalshiNoTicker;
  const kalshiMarket = await fetchKalshiMarketByTicker(kalshiTicker);
  if (!kalshiMarket) return null;

  const rawPolymarketPrice = polymarketMarket.prices[isOutcome0 ? 0 : 1];
  const rawKalshiPrice = isOutcome0 ? kalshiMarket.yesAsk : kalshiMarket.noAsk;
  if (rawPolymarketPrice == null || rawKalshiPrice == null) return null;

  const polymarketPrice = netYesPrice(rawPolymarketPrice, 'polymarket', CONTRACTS_FOR_FEE_ESTIMATE);
  const kalshiPrice = netYesPrice(rawKalshiPrice, 'kalshi', CONTRACTS_FOR_FEE_ESTIMATE);
  const edgeCents = Math.round(Math.abs(polymarketPrice - kalshiPrice) * 100);
  const betterPlatform = edgeCents === 0
    ? 'tie'
    : polymarketPrice < kalshiPrice ? 'polymarket' : 'kalshi';

  return { kalshiTicker, polymarketPrice, kalshiPrice, betterPlatform, edgeCents };
}
