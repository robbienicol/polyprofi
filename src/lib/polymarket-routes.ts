import { PolymarketEntry } from '@/api/client/market-data';
import { polymarketMarketQuality } from '@/lib/polymarket-market-quality';
import { Route, RouteParams } from '@/types/routes';

type RiskBand = 2 | 3 | 4 | 5;

interface Candidate {
  market: PolymarketEntry;
  outcomeIndex: number;
  outcome: string;
  price: number;
  probability: number;
  riskLevel: RiskBand;
}

function polymarketRiskLevel(probability: number): RiskBand {
  if (probability >= 85) return 2;
  if (probability >= 65) return 3;
  if (probability >= 35) return 4;
  return 5;
}

function fallbackMaturity(timeframe: string): number {
  return ({ today: 1, week: 7, month: 30, '3months': 90, '1year': 365, '5years': 1825 } as Record<string, number>)[timeframe] ?? 30;
}

function maturityDays(endDate: string | undefined, timeframe: string): number {
  if (!endDate) return fallbackMaturity(timeframe);
  const end = new Date(endDate).getTime();
  if (!Number.isFinite(end)) return fallbackMaturity(timeframe);
  return Math.max(1, Math.ceil((end - Date.now()) / 86_400_000));
}

function stableId(market: PolymarketEntry, outcome: string): string {
  const base = market.slug || market.question;
  const safe = `${base}-${outcome}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `pm-live-${safe.slice(0, 90)}`;
}

function toRoute(candidate: Candidate, params: RouteParams): Route {
  const { market, outcomeIndex, outcome, price, probability, riskLevel } = candidate;
  const expectedReturn = Math.round(params.balance * (1 / price - 1));
  const cents = Math.round(price * 100);
  const volume = market.volumeM >= 1
    ? `$${market.volumeM.toFixed(1)}M`
    : `$${Math.round(market.volumeM * 1000).toLocaleString()}K`;

  return {
    id: stableId(market, outcome),
    category: 'Polymarket',
    emoji: '🔮',
    description: `Buy ${outcome} on “${market.question}” at ${cents}¢ — ${probability}% market-implied chance, ${volume} traded.`,
    riskLevel,
    probability,
    expectedReturn,
    platform: 'Polymarket',
    line: `${outcome} ${cents}¢`,
    maturesInDays: maturityDays(market.endDate, params.timeframe),
    lossProfile: 'binary',
    meetsTarget: expectedReturn >= params.target,
    strategy: `Buy ${outcome} near ${cents}¢. Maximum loss is the full $${Math.round(params.balance).toLocaleString()} stake. No independent edge is assumed; this score uses the live market price and loss profile.`,
    marketQuality: polymarketMarketQuality(market, outcomeIndex),
  };
}

/**
 * Turn the live market universe into a balanced exploration pool. Each market
 * appears once, and quotas keep high-confidence, balanced, and long-shot
 * contracts represented instead of letting one price band dominate by volume.
 */
export function buildPolymarketRoutes(
  markets: PolymarketEntry[],
  params: RouteParams,
  limit = 120
): Route[] {
  const candidates: Candidate[] = markets.flatMap((market) =>
    market.prices.map((price, index) => {
      const probability = Math.round(price * 100);
      return {
        market,
        outcomeIndex: index,
        outcome: market.outcomes[index] ?? (index === 0 ? 'Yes' : 'No'),
        price,
        probability,
        riskLevel: polymarketRiskLevel(probability),
      };
    })
  );

  const bands: RiskBand[] = [2, 3, 4, 5];
  const baseQuota = Math.floor(limit / bands.length);
  const usedMarkets = new Set<string>();
  const selected: Candidate[] = [];

  for (const [index, band] of bands.entries()) {
    const quota = baseQuota + (index < limit % bands.length ? 1 : 0);
    const choices = candidates
      .filter((candidate) => candidate.riskLevel === band)
      .sort((a, b) => b.market.volumeM - a.market.volumeM || b.probability - a.probability);

    for (const candidate of choices) {
      if (selected.filter((item) => item.riskLevel === band).length >= quota) break;
      if (usedMarkets.has(candidate.market.question)) continue;
      selected.push(candidate);
      usedMarkets.add(candidate.market.question);
    }
  }

  if (selected.length < limit) {
    const remaining = [...candidates].sort((a, b) => b.market.volumeM - a.market.volumeM);
    for (const candidate of remaining) {
      if (selected.length >= limit) break;
      if (usedMarkets.has(candidate.market.question)) continue;
      selected.push(candidate);
      usedMarkets.add(candidate.market.question);
    }
  }

  return selected.map((candidate) => toRoute(candidate, params));
}

export function __selfCheck(): void {
  console.assert(polymarketRiskLevel(90) === 2, '90% contract belongs in the high-confidence band');
  console.assert(polymarketRiskLevel(70) === 3, '70% contract belongs in the balanced-high band');
  console.assert(polymarketRiskLevel(50) === 4, '50% contract is aggressive because the full stake is at risk');
  console.assert(polymarketRiskLevel(20) === 5, '20% contract is a long shot');
}
