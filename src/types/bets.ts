/** A named savings goal — a real thing the user is saving toward (persists across quizzes). */
export interface SavingsGoal {
  id: string;
  label: string; // "New surfboard"
  emoji: string; // "🏄"
  targetAmount: number; // price of the thing, in dollars
  createdAt: string; // ISO
  achievedAt?: string; // ISO, set once tracked value first reaches the target
  /**
   * ISO time the congratulations screen was shown for this goal. Absent while a
   * reached goal still owes the user its celebration, which is what makes the
   * celebration survive a cold start: it is persisted state, not an event.
   */
  celebratedAt?: string;
}

/** Persisted savings-goal state: the current goal plus a lifetime count of goals reached. */
export interface SavingsGoalState {
  current: SavingsGoal | null;
  achievedCount: number;
  /** Version of the math used to decide whether goals are achieved. */
  accountingVersion?: number;
}

export type AcquisitionPlatform = 'robinhood' | 'polymarket' | 'kalshi';

export interface QuizAnswers {
  balance: number;
  target: number;
  timeframe: 'today' | 'week' | 'month' | '3months' | '1year' | '5years';
  categories: string[]; // empty means no preference (all markets)
  riskTolerance: 'conservative' | 'balanced' | 'aggressive';
  /** Apps the user already uses. Optional so quizzes saved before this field still load. */
  preferredPlatforms?: AcquisitionPlatform[];
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
  /** Extra text used when matching this position to a live sports scoreboard. */
  monitorQuery?: string;
  /**
   * Slug of the source Polymarket market, copied from the route at track time.
   * This is how live monitoring finds the position's own price; without it the
   * monitor can only fall back to an exact question-text match.
   */
  sourceSlug?: string;
  /**
   * The outcome the user bought ("No", "Los Angeles Lakers", …). Required to
   * price the right side of the market — a No position valued off the Yes
   * column inverts its P&L.
   */
  outcomeSide?: string;
  /** User dismissed the sell alert for this session. */
  sellAlertDismissed?: boolean;
  /** Ticker captured when a stock or ETF route is tracked (for example, VOO). */
  assetSymbol?: string;
  /** Market price per share when the route was tracked. */
  assetEntryPrice?: number;
  /** Shares represented by the tracked dollar amount at the recorded entry price. */
  assetQuantity?: number;
  /** Principal assigned to this position. Kept separately from its current value. */
  costBasis?: number;
  /** Time the position was added to Pathey. */
  positionOpenedAt?: string;
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
