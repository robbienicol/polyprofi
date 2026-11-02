import { calculatePortfolioProgress, realizedPnlFor } from '@/lib/portfolio-progress';
import { betsForGoal } from '@/lib/savings-goal';
import type { SavingsGoal, TrackedBet } from '@/types/bets';

export interface GoalProgress {
  /** Net gains attributable to this goal — the only thing that counts toward a target. */
  netGain: number;
  /** Current value of the goal's positions, principal included. */
  value: number;
  /** Principal staked against this goal. */
  staked: number;
  activeCount: number;
}

export const NO_PROGRESS: GoalProgress = { netGain: 0, value: 0, staked: 0, activeCount: 0 };

type ProgressInputs = Parameters<typeof calculatePortfolioProgress>[0];

/** Each goal's net gain, value and stake, keyed by goal id. */
export function progressByGoal(
  goals: SavingsGoal[],
  allBets: TrackedBet[],
  allActive: TrackedBet[],
  statusById: ProgressInputs['statusesById'],
  quotes: ProgressInputs['quotes'],
  now: number,
): Record<string, GoalProgress> {
  const entries = goals.map((goal): [string, GoalProgress] => {
    const scoped = betsForGoal(allActive, goal.id);
    const realized = betsForGoal(allBets, goal.id).reduce((sum, bet) => sum + realizedPnlFor(bet), 0);
    if (scoped.length === 0) return [goal.id, realized === 0 ? NO_PROGRESS : { ...NO_PROGRESS, netGain: realized }];
    const snapshot = calculatePortfolioProgress({
      active: scoped,
      // A goal has no cash of its own; only what is actually staked against it.
      fallbackBalance: 0,
      statusesById: statusById,
      quotes,
      now,
    });
    return [goal.id, {
      netGain: snapshot.goalProgress + realized,
      value: snapshot.value,
      staked: scoped.reduce((sum, bet) => sum + bet.amountWagered, 0),
      activeCount: scoped.length,
    }];
  });
  return Object.fromEntries(entries) as Record<string, GoalProgress>;
}
