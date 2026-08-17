import { QuizAnswers } from '@/types/bets';

interface ExpertSentiment {
  lean: 'bullish' | 'bearish' | 'mixed' | 'no_signal';
  confidence: 'high' | 'medium' | 'low';
  summary: string;
}

export interface MarketQualityFacts {
  executionScore: number;
  stabilityScore?: number;
  liquidityUsd: number;
  spreadCents?: number;
  bestBidCents?: number;
  bestAskCents?: number;
  recentRangePts?: number;
  pricePositionPct?: number;
  pricePosition: 'steady' | 'near_recent_low' | 'middle' | 'near_recent_high' | 'unavailable';
  oneDayMovePts?: number;
  oneWeekMovePts?: number;
  oneMonthMovePts?: number;
}

/**
 * How and when a position is planned to be closed.
 *
 * 'hold' is the default and needs no plan object: you are in until the contract resolves.
 * 'bracket' is a pre-committed take-profit / stop-loss pair, which is what lets a
 * prediction-market contract be offered as a *second, distinct* route from the same
 * market. The numbers here come from `@/lib/prediction-swing` — read the module header
 * before changing any of them, because the bracket is exactly zero-EV before costs and
 * nothing downstream may present it otherwise.
 */
export interface ExitPlan {
  kind: 'hold' | 'bracket';
  /** Mid price at entry, in cents. Both barriers sit on this same series. */
  entryCents: number;
  /** What you actually pay after crossing half the spread. */
  netEntryCents: number;
  /** Sell level in cents — set by the user's profit goal, never by a price forecast. */
  takeProfitCents: number;
  /** Stop level in cents — set outside the market's own daily noise. */
  stopCents: number;
  /** Spread crossed on the way in and again on the way out. */
  roundTripCostCents: number;
  /** P(take-profit touched before stop), in percent. No volatility or time term. */
  barrierProbability: number;
  /** The hit rate needed just to break even after costs. Always ≥ barrierProbability. */
  breakevenProbability: number;
  /** barrierProbability − breakevenProbability. Always ≤ 0: exactly −cost/width. */
  costEdgePts: number;
  /** Expected days until a barrier is touched, capped at the horizon. */
  expectedExitDays: number;
  /** P(the bracket closes inside the horizon at all), in percent. */
  resolvesInTimeProbability: number;
  /** barrierProbability × resolvesInTime — the reliability the universal score consumes. */
  successProbability: number;
  /** Fraction of the stake lost if the stop fills at its level. */
  plannedLossFraction: number;
  /** …after gap risk in a book too thin to honour the stop. Feeds the score. */
  effectiveLossFraction: number;
  /** Net profit per $1 staked when the take-profit fills. */
  winReturnRate: number;
}

export interface Route {
  id: string;
  category: string;
  emoji: string;
  description: string;
  riskLevel: number; // 1–5
  probability: number; // 0–100
  expectedReturn: number; // profit in dollars if successful
  platform: string;
  strategy: string;
  // For sports/binary bets: the actual line, e.g. "France ML -200", "Over 2.5 +110". Optional.
  line?: string;
  // Calendar days until the position resolves / pays out (Polymarket end date,
  // bond term, or the goal timeframe). Drives the "matures in Nd" label + sort.
  maturesInDays?: number;
  // 'binary': lose entire stake if wrong (sports, Polymarket)
  // 'partial': capital preserved if thesis doesn't play out (crypto, stocks, bracketed
  //            prediction-market positions whose stop caps the loss — see exitPlan)
  lossProfile: 'binary' | 'partial';
  // Present on routes closed by a pre-committed take-profit/stop pair rather than held to
  // resolution. Its effectiveLossFraction is what the score uses for principal protection.
  exitPlan?: ExitPlan;
  // true if expectedReturn >= user's target
  meetsTarget: boolean;
  expertSentiment?: ExpertSentiment;
  investmentFacts?: RouteInvestmentFacts;
  marketQuality?: MarketQualityFacts;
  // Present only for live Polymarket routes (id starts "pm-live-"); traces
  // back to the source market so it can be matched against other platforms.
  // Absent for AI-generated and non-Polymarket routes.
  sourceSlug?: string;
  sourceEndDate?: string;
}

interface RouteInvestmentFacts {
  yieldPct?: number;
  yieldLabel?: string;
  yieldAsOf?: string;
  yieldSource?: string;
  yieldSourceUrl?: string;
  projectedProfit?: number;
  projectionBasis?: string;
  liquidity?: string;
  expenseRatioPct?: number;
  sourceCheckedAt?: string;
}

export type RouteParams = QuizAnswers;

export interface SavedRoutesBatch {
  id: string;
  generatedAt: string;
  quizSnapshot: QuizAnswers;
  routes: Route[];
  rerankedAt?: string;
  previousTopRouteId?: string;
  /** The savings goal this search was run for. Absent on searches saved before goals. */
  goalId?: string;
}
