/** A named savings goal — a real thing the user is saving toward (persists across quizzes). */
export interface SavingsGoal {
  id: string;
  label: string; // "New surfboard"
  emoji: string; // "🏄"
  /**
   * Price of the thing, in dollars. Absent for an open-ended goal ("just grow my
   * money"), which has no finish line and so can never be achieved — every
   * target-shaped calculation has to treat it as unbounded rather than as zero.
   */
  targetAmount?: number;
  createdAt: string; // ISO
  /**
   * Set while a goal exists only because a route search named it. A draft is real
   * enough to carry a search and its routes, but stays out of the Goals tab until
   * the user acquires something against it — searching is not committing. Cleared
   * on the first acquire; swept away if the deadline passes with nothing attached.
   */
  draft?: boolean;
  /** ISO time this goal's timeframe runs out, from the search that created it. */
  deadline?: string;
  achievedAt?: string; // ISO, set once tracked value first reaches the target
  /**
   * ISO time the congratulations screen was shown for this goal. Absent while a
   * reached goal still owes the user its celebration, which is what makes the
   * celebration survive a cold start: it is persisted state, not an event.
   */
  celebratedAt?: string;
}

/**
 * Persisted savings-goal state: every goal the user is running, plus a lifetime
 * count of goals reached. There is deliberately no "active goal" — a goal is an
 * argument that flows from the quiz into the search that produced a route and on
 * into the position taken from it, never a hidden mode the user can't see.
 */
export interface SavingsGoalState {
  goals: SavingsGoal[];
  achievedCount: number;
  /** Version of the math used to decide whether goals are achieved. */
  accountingVersion?: number;
}

/** The single-goal shape persisted before version 6. Read by the migration only. */
export interface LegacySavingsGoalState {
  current: SavingsGoal | null;
  achievedCount: number;
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
  /**
   * The savings goal this position is working toward — the active goal at track
   * time. Absent on positions tracked before goals were the organising unit;
   * those roll up under the primary goal rather than vanishing from every view.
   */
  goalId?: string;
  category: string;
  emoji: string;
  description: string;
  platform: string;
  strategy: string;
  riskLevel: number;
  probability: number;
  expectedReturn: number;
  amountWagered: number;
  /**
   * `watching` means the user is following this route without putting money in.
   * Every money calculation filters on `active`, so a watched position stays out
   * of staked, expected value, and P&L while remaining visible in the list.
   */
  status: 'active' | 'won' | 'lost' | 'watching';
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
