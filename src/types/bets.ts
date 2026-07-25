/** A named savings goal — a real thing the user is saving toward (persists across quizzes). */
export interface SavingsGoal {
  id: string;
  label: string; // "New surfboard"
  emoji: string; // "🏄"
  targetAmount: number; // price of the thing, in dollars
  createdAt: string; // ISO
  achievedAt?: string; // ISO, set once tracked value first reaches the target
}

/** Persisted savings-goal state: the current goal plus a lifetime count of goals reached. */
export interface SavingsGoalState {
  current: SavingsGoal | null;
  achievedCount: number;
}

export interface QuizAnswers {
  balance: number;
  target: number;
  timeframe: 'today' | 'week' | 'month' | '3months' | '1year' | '5years';
  categories: string[]; // empty means no preference (all markets)
  riskTolerance: 'conservative' | 'balanced' | 'aggressive';
  maxRiskLevel: number; // 1–5: max riskLevel the user is willing to see
  minProbability: number; // 0–100: minimum win probability the user wants
}

export interface TrackedBet {
  id: string;
  category: string;
  emoji: string;
  description: string;
  platform: string;
  strategy: string;
  riskLevel: number;
  probability: number;
  expectedReturn: number;
  amountWagered: number;
  status: 'active' | 'won' | 'lost';
  createdAt: string;
  /** User's $ profit goal from the quiz (e.g. 30). Used for sell alerts. */
  profitGoal?: number;
  /** Contract entry price 0–1 for prediction markets (e.g. 0.45 = 45¢). */
  entryPrice?: number;
  /** Sports / Polymarket line copied from the route at track time. */
  line?: string;
  /** Fuzzy search text for live Polymarket price lookup. */
  monitorQuery?: string;
  /** User dismissed the sell alert for this session. */
  sellAlertDismissed?: boolean;
  /** Ticker captured when a stock or ETF route is tracked (for example, VOO). */
  assetSymbol?: string;
  /** Market price per share when the route was tracked. */
  assetEntryPrice?: number;
  /** Annualized sourced yield used for deterministic savings/Treasury accrual. */
  annualYieldPct?: number;
  /** Original route horizon, used to cap projected accrual at maturity. */
  maturesInDays?: number;
}

/** Live status from bet-monitor — not persisted. */
export interface BetLiveStatus {
  betId: string;
  unrealizedPnl: number;
  currentPrice?: number;
  entryPrice?: number;
  profitGoal: number;
  profitGoalHit: boolean;
  sellRecommended: boolean;
  reason: string;
  liveContext?: string;
  gameStatus?: string;
  homeScore?: number;
  awayScore?: number;
  isLive: boolean;
  fetchedAt: string;
}
