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
  // 'partial': capital preserved if thesis doesn't play out (crypto, stocks)
  lossProfile: 'binary' | 'partial';
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
}
