import type { GoalOdds } from '@/lib/goal-odds';
import type { GoalScoreBreakdown } from '@/lib/score';
import type { Route } from '@/types/routes';

export type RouteSort = 'score' | 'chance' | 'payout' | 'value' | 'soonest' | 'type';

export interface RouteFilters {
  category: string | null;
  lossProfile: Route['lossProfile'] | null;
  minimumProbability: number;
  sort: RouteSort;
  /**
   * Prediction-market topic ('sports', 'politics', ...). Only meaningful while the
   * prediction asset class is selected, since no other route carries a topic.
   */
  predictionTopic: string | null;
  /** League inside the topic ('nfl', 'cfb', ...). Only meaningful with a topic set. */
  predictionSubtopic?: string | null;
  /**
   * Kind of route inside a non-prediction class ('subscriptions', 'index', 'BTC-USD'),
   * from @/lib/route-subcategories. Only meaningful with that class selected.
   */
  subcategory?: string | null;
  /** Longest acceptable time to resolution, in days. Null means any. */
  maxDaysToResolve: number | null;
  /** Sections the list by probability band instead of showing one flat ranking. */
  groupByChance: boolean;
  /**
   * Free-text market search ("Messi", "Tesla"). Matches on what the user can read
   * on the card, and while it is set the near-miss relevance rule stands down —
   * asking for a market by name should show it even when it misses the goal.
   */
  keyword: string;
}

export interface RouteResults {
  ranked: Route[];
  filtered: Route[];
  requiredInvestmentById: Map<string, number | null>;
  scoreById: Map<string, GoalScoreBreakdown>;
  /**
   * Per route: the stake sized to the user's loss cap, the chance of reaching the goal
   * at that stake, and the bad case. What the list is ranked on. See @/lib/goal-odds.
   */
  oddsById: Map<string, GoalOdds>;
  selectedStake: (route: Route) => number;
  /**
   * Smallest amount the user would have to be willing to invest for a route at or above
   * `minimumProbability` to reappear, or null if raising it would not help.
   */
  unlockInvestmentFor: (minimumProbability: number) => number | null;
  /**
   * Smallest amount the user would have to be willing to invest for a capital-preserving
   * route to reach the goal, or null when raising it would not help — either no such
   * route exists in the pool at any amount, or one is already affordable.
   */
  unlockCapitalSafeInvestment: number | null;
  /**
   * Spending cuts folded out of `filtered`: beyond the few worth featuring for this
   * goal. Most feasible first. Empty while cuts are what the user asked for — the
   * "Cut spending" asset class, or a keyword search.
   */
  moreCuts: Route[];
  /**
   * Whether the goal is reachable at all, and by how much it is missed when it is not.
   * Read off the whole pool before any filter, because the question it answers — "does
   * this add up?" — is about the market and the budget, not about the chips.
   */
  goalReach: GoalReach;
}

/**
 * The honest answer to "can I get there from here?", as numbers rather than an
 * absence. Saying nothing when no route reaches the goal is the one failure this
 * product cannot afford: the user reads an empty list as a broken app, when it is
 * the app working exactly as intended.
 */
export interface GoalReach {
  /** The profit the user asked for. */
  target: number;
  /** Best profit any route in the pool projects at the amount the user intends to invest. */
  bestProjectedReturn: number;
  /** `bestProjectedReturn / target`, floored at 0. 1 or more means the goal is met. */
  proximity: number;
  /** True when at least one route reaches the target at the intended amount. */
  reachable: boolean;
  /** Smallest amount that brings a goal-reaching route back, or null when none exists at any amount. */
  investmentToReach: number | null;
  /** Routes considered, before relevance and filters. Zero means there was nothing to judge. */
  poolSize: number;
}

/** A run of routes that share a probability band, in descending order of chance. */
export interface RouteGroup {
  /** Lower bound of the band, in percent — also the group's identity. */
  floor: number;
  label: string;
  routes: Route[];
}
