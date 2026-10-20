import { fetchKalshiSportsMarkets } from '@/api/client/kalshi-market-data';
import { fetchPolymarketUniverse, polymarketMaturityDays } from '@/api/client/polymarket-market-data';
import { getSportsMatches, setSportsMatches } from '@/api/client/storage';
import { matchPolymarketToKalshi, type SportsMatch } from '@/lib/sports-market-match';

// Sports markets are short-dated, so bounding the cross-product to markets
// closing within a few days keeps this cheap while still covering "tonight's
// game" and the next couple of days — the daily cadence already means
// anything further out gets picked up by tomorrow's run.
const MATCH_HORIZON_DAYS = 3;

let inflight: Promise<SportsMatch[]> | null = null;

export async function computeDailySportsMatches(): Promise<SportsMatch[]> {
  const cached = await getSportsMatches();
  if (cached) return cached;
  if (inflight) return inflight;
  inflight = runMatchingJob().finally(() => {
    inflight = null;
  });
  return inflight;
}

async function runMatchingJob(): Promise<SportsMatch[]> {
  const [polymarketUniverse, kalshiEntries] = await Promise.all([
    fetchPolymarketUniverse(),
    fetchKalshiSportsMarkets(),
  ]);

  const nearTermMarkets = polymarketUniverse.filter((market) => {
    const days = polymarketMaturityDays(market.endDate);
    return days != null && days <= MATCH_HORIZON_DAYS;
  });

  const matches = nearTermMarkets
    .map((market) => matchPolymarketToKalshi(
      { slug: market.slug, question: market.question, outcomes: market.outcomes, endDate: market.endDate },
      kalshiEntries,
    ))
    .filter((match): match is SportsMatch => match != null);

  console.log(`[sports-match] ${matches.length} matched pairs from ${nearTermMarkets.length} near-term Polymarket sports candidates`);
  await setSportsMatches(matches);
  return matches;
}
