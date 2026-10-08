import type { PolymarketEntry } from '@/api/client/market-data-types';
import type { MarketQualityFacts } from '@/types/routes';

const MIN_MEANINGFUL_RANGE_PTS = 1;

export function polymarketMarketQuality(
  market: PolymarketEntry,
  outcomeIndex: number
): MarketQualityFacts {
  const outcomePrice = market.prices[outcomeIndex] ?? market.prices[0] ?? 0.5;
  const direction = outcomeIndex === 0 ? 1 : -1;
  const changes = [
    optionalScaled(market.oneDayPriceChange, direction),
    optionalScaled(market.oneWeekPriceChange, direction),
    optionalScaled(market.oneMonthPriceChange, direction),
  ] as const;
  const checkpoints = [
    outcomePrice,
    ...changes
      .filter((change): change is number => change != null)
      .map((change) => clamp(outcomePrice - change, 0, 1)),
  ];
  const low = Math.min(...checkpoints);
  const high = Math.max(...checkpoints);
  const recentRangePts = checkpoints.length > 1 ? round1((high - low) * 100) : undefined;
  const pricePositionPct = recentRangePts != null && recentRangePts >= MIN_MEANINGFUL_RANGE_PTS
    ? Math.round(clamp(((outcomePrice - low) / (high - low)) * 100, 0, 100))
    : undefined;
  const pricePosition = pricePositionLabel(recentRangePts, pricePositionPct);

  const liquidityUsd = Math.max(0, (market.liquidityM ?? 0) * 1_000_000);
  const spread = market.spread
    ?? (market.bestBid != null && market.bestAsk != null ? market.bestAsk - market.bestBid : undefined);
  const spreadCents = spread != null ? round1(Math.max(0, spread) * 100) : undefined;
  const liquidityScore = clamp((Math.log10(Math.max(liquidityUsd, 1)) - 3) * 50, 0, 100);
  const spreadScore = spreadCents == null ? undefined : clamp(115 - spreadCents * 15, 0, 100);
  const executionScore = Math.round(
    spreadScore == null
      ? liquidityScore
      : spreadScore * 0.65 + liquidityScore * 0.35
  );
  const stabilityScore = recentRangePts == null ? undefined : volatilityStabilityScore(recentRangePts);

  const yesBid = market.bestBid;
  const yesAsk = market.bestAsk;
  const selectedBid = outcomeIndex === 0 ? yesBid : yesAsk == null ? undefined : 1 - yesAsk;
  const selectedAsk = outcomeIndex === 0 ? yesAsk : yesBid == null ? undefined : 1 - yesBid;

  return {
    executionScore,
    stabilityScore,
    liquidityUsd: Math.round(liquidityUsd),
    spreadCents,
    bestBidCents: selectedBid == null ? undefined : round1(selectedBid * 100),
    bestAskCents: selectedAsk == null ? undefined : round1(selectedAsk * 100),
    recentRangePts,
    pricePositionPct,
    pricePosition,
    oneDayMovePts: toPoints(changes[0]),
    oneWeekMovePts: toPoints(changes[1]),
    oneMonthMovePts: toPoints(changes[2]),
  };
}

function volatilityStabilityScore(rangePts: number): number {
  if (rangePts <= 5) return 100;
  if (rangePts <= 15) return Math.round(100 - (rangePts - 5) * 3);
  return Math.round(clamp(70 - (rangePts - 15) * 4, 0, 70));
}

function pricePositionLabel(
  rangePts: number | undefined,
  positionPct: number | undefined
): MarketQualityFacts['pricePosition'] {
  if (rangePts == null) return 'unavailable';
  if (rangePts < MIN_MEANINGFUL_RANGE_PTS || positionPct == null) return 'steady';
  if (positionPct <= 25) return 'near_recent_low';
  if (positionPct >= 75) return 'near_recent_high';
  return 'middle';
}

function optionalScaled(value: number | undefined, scale: number): number | undefined {
  return value == null || !Number.isFinite(value) ? undefined : value * scale;
}

function toPoints(value: number | undefined): number | undefined {
  return value == null ? undefined : round1(value * 100);
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export function __selfCheck(): void {
  const market: PolymarketEntry = {
    question: 'Test',
    outcomes: ['Yes', 'No'],
    prices: [0.6, 0.4],
    volumeM: 1,
    liquidityM: 0.1,
    spread: 0.01,
    bestBid: 0.59,
    bestAsk: 0.6,
    oneDayPriceChange: 0.02,
    oneWeekPriceChange: 0.1,
    oneMonthPriceChange: -0.05,
  };
  const yes = polymarketMarketQuality(market, 0);
  const no = polymarketMarketQuality(market, 1);
  invariant(yes.executionScore === 100, `deep 1¢ market should score 100, got ${yes.executionScore}`);
  invariant(yes.recentRangePts === 15, `expected a 15pt sampled range, got ${yes.recentRangePts}`);
  invariant(yes.pricePosition === 'middle', `60¢ should be in the sampled middle, got ${yes.pricePosition}`);
  invariant(no.pricePositionPct === 33, `No position should invert Yes, got ${no.pricePositionPct}`);
  invariant(no.bestBidCents === 40 && no.bestAskCents === 41, 'No bid/ask should invert the Yes book');
}

function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`[polymarket quality self-check] ${message}`);
}
