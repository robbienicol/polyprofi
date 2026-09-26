import { fetchKalshiMarketByTicker } from '@/api/client/kalshi-market-data';
import { fetchPolymarketUniverse } from '@/api/client/polymarket-market-data';
import { computeDailyGenericMatches } from '@/lib/kalshi-generic-matching-job';
import { computeDailySportsMatches } from '@/lib/sports-market-matching-job';
import { netYesPrice } from '@/lib/platform-fees';
import type { Route } from '@/types/routes';

/** The bit both match kinds reduce to once we only care about a ticker per side —
 * a sports match has one ticker per team, a generic match has one ticker for
 * both sides of its single Yes/No market. */
interface ResolvedMatch {
  kalshiYesTicker: string;
  kalshiNoTicker: string;
}

export interface MarketComparison {
  kalshiTicker: string;
  kalshiEventTicker: string;
  kalshiSeriesTicker: string;
  polymarketPrice: number; // net of fees
  kalshiPrice: number; // net of fees
  /**
   * The same two prices as the venues actually quote them. Calibration buckets on the
   * quoted price, because that is what the historical table was built from — netting a
   * fee in first can push a contract across a bucket edge and answer for the wrong cohort.
   */
  polymarketRawPrice: number;
  kalshiRawPrice: number;
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

  const match = await resolveMatch(route.sourceSlug);
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

  return {
    kalshiTicker,
    kalshiEventTicker: kalshiMarket.eventTicker,
    kalshiSeriesTicker: kalshiMarket.seriesTicker,
    polymarketPrice,
    kalshiPrice,
    polymarketRawPrice: rawPolymarketPrice,
    kalshiRawPrice: rawKalshiPrice,
    betterPlatform,
    edgeCents,
  };
}

/** Sports first (the sturdier, team+date-anchored matcher), then the generic
 * question-text matcher for everything sports doesn't cover. */
async function resolveMatch(sourceSlug: string): Promise<ResolvedMatch | null> {
  const sportsMatches = await computeDailySportsMatches();
  const sportsMatch = sportsMatches.find((m) => m.polymarketSlug === sourceSlug);
  if (sportsMatch) return sportsMatch;

  const genericMatches = await computeDailyGenericMatches();
  const genericMatch = genericMatches.find((m) => m.polymarketSlug === sourceSlug);
  if (genericMatch) return { kalshiYesTicker: genericMatch.kalshiTicker, kalshiNoTicker: genericMatch.kalshiTicker };

  return null;
}
