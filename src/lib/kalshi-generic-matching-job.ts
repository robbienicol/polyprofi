import { fetchKalshiGenericMarkets } from '@/api/client/kalshi-market-data';
import { fetchPolymarketUniverse, polymarketMaturityDays } from '@/api/client/polymarket-market-data';
import { getGenericMatches, setGenericMatches } from '@/api/client/storage';
import { matchPolymarketToKalshiGeneric, toMatchCandidates, type GenericMatch } from '@/lib/kalshi-market-match';

// Politics/economics/culture markets run for weeks or months, not hours, so the
// horizon is much wider than the 3-day sports window (see MATCH_HORIZON_DAYS in
// sports-market-matching-job.ts) — a market resolving next month is still worth
// comparing today.
const MATCH_HORIZON_DAYS = 120;

let inflight: Promise<GenericMatch[]> | null = null;

export async function computeDailyGenericMatches(): Promise<GenericMatch[]> {
  const cached = await getGenericMatches();
  if (cached) return cached;
  if (inflight) return inflight;
  inflight = runMatchingJob().finally(() => {
    inflight = null;
  });
  return inflight;
}

async function runMatchingJob(): Promise<GenericMatch[]> {
  const [polymarketUniverse, kalshiEntries] = await Promise.all([
    fetchPolymarketUniverse(),
    fetchKalshiGenericMarkets(),
  ]);

  const candidates = toMatchCandidates(kalshiEntries);
  const inHorizon = polymarketUniverse.filter((market) => {
    const days = polymarketMaturityDays(market.endDate);
    return days != null && days <= MATCH_HORIZON_DAYS;
  });

  const matches = inHorizon
    .map((market) => matchPolymarketToKalshiGeneric(
      { slug: market.slug, question: market.question, outcomes: market.outcomes, endDate: market.endDate },
      candidates,
    ))
    .filter((match): match is GenericMatch => match != null);

  console.log(`[kalshi-generic-match] ${matches.length} matched pairs from ${inHorizon.length} in-horizon Polymarket candidates`);
  await setGenericMatches(matches);
  return matches;
}
