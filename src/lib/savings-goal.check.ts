import type { LegacySavingsGoalState, SavingsGoal, SavingsGoalState, TrackedBet } from '@/types/bets';
import { GOAL_ACCOUNTING_VERSION, migrateSavingsGoalState, isOpenEnded, goalProgressFraction, goalRemaining, betsForGoal, parseGoalIds, committedGoals, goalByLabel, defaultQuizGoal, abandonedDraftGoalIds, pendingCelebrationGoal, shouldPresentCelebration } from '@/lib/savings-goal';

function invariant(condition: boolean, message: string): void {
  if (!condition) throw new Error(`[savings-goal] ${message}`);
}

export function __selfCheck(): void {
  const principalInclusive: LegacySavingsGoalState = {
    current: {
      id: 'goal-1',
      label: 'Surfboard',
      emoji: '🏄',
      targetAmount: 250,
      createdAt: '2026-01-01T00:00:00.000Z',
      achievedAt: '2026-01-02T00:00:00.000Z',
    },
    achievedCount: 3,
    accountingVersion: 3,
  };
  const repaired = migrateSavingsGoalState(principalInclusive);
  invariant(repaired.migrated, 'principal-inclusive state is migrated');
  invariant(repaired.state.goals.length === 1, 'the single legacy goal becomes the first goal in the list');
  invariant(repaired.state.goals[0].achievedAt == null, 'false current achievement is cleared');
  invariant(repaired.state.achievedCount === 2, 'only the false current achievement is removed from the count');
  invariant(repaired.state.accountingVersion === GOAL_ACCOUNTING_VERSION, 'migration is versioned');

  const profitOnly: LegacySavingsGoalState = { ...principalInclusive, accountingVersion: 2 };
  const preserved = migrateSavingsGoalState(profitOnly);
  invariant(
    preserved.state.goals[0].achievedAt === profitOnly.current?.achievedAt,
    'valid profit-only achievement is preserved',
  );
  invariant(preserved.state.achievedCount === 3, 'valid profit-only achievement count is preserved');

  // Version 4 was the accounting in the field before the celebration existed, so
  // its achievements must survive the upgrade — and must not trigger confetti.
  const beforeCelebration: LegacySavingsGoalState = { ...principalInclusive, accountingVersion: 4 };
  const upgraded = migrateSavingsGoalState(beforeCelebration);
  invariant(upgraded.migrated, 'a version 4 state is migrated to the multi-goal version');
  invariant(upgraded.state.goals[0].achievedAt === beforeCelebration.current?.achievedAt, 'a version 4 achievement is preserved');
  invariant(upgraded.state.achievedCount === 3, 'a version 4 achievement count is preserved');
  invariant(
    upgraded.state.goals[0].celebratedAt === beforeCelebration.current?.achievedAt,
    'a goal reached before the celebration existed is backfilled as already celebrated',
  );
  invariant(pendingCelebrationGoal(upgraded.state.goals) === null, 'an upgraded old achievement owes no celebration');

  // A version 5 state is single-goal but already celebration-aware: its pending
  // confetti must survive the shape change rather than being backfilled away.
  const owesConfetti = migrateSavingsGoalState({
    current: { ...principalInclusive.current!, achievedAt: '2026-01-02T00:00:00.000Z' },
    achievedCount: 3,
    accountingVersion: 5,
  });
  invariant(owesConfetti.migrated, 'a version 5 state is migrated to the multi-goal shape');
  invariant(
    pendingCelebrationGoal(owesConfetti.state.goals)?.id === 'goal-1',
    'a version 5 goal still owing confetti keeps owing it after the shape change',
  );

  // ── multi-goal state ──────────────────────────────────────────────────────
  const trip: SavingsGoal = {
    id: 'goal-2',
    label: 'A dream trip',
    emoji: '✈️',
    targetAmount: 4_000,
    createdAt: '2026-08-01T00:00:00.000Z',
  };
  const openEnded: SavingsGoal = {
    id: 'goal-3',
    label: 'Just grow my money',
    emoji: '💸',
    createdAt: '2026-08-02T00:00:00.000Z',
  };
  const multi: SavingsGoalState = {
    goals: [trip, openEnded],
    achievedCount: 1,
    accountingVersion: GOAL_ACCOUNTING_VERSION,
  };
  invariant(!migrateSavingsGoalState(multi).migrated, 'current multi-goal state is not migrated again');

  invariant(!isOpenEnded(trip), 'a goal with a target is not open-ended');
  invariant(isOpenEnded(openEnded), 'a goal with no target is open-ended');
  invariant(goalProgressFraction(2_000, trip) === 0.5, 'half the target is half the progress');
  invariant(goalProgressFraction(9_000, trip) === 1, 'progress past the target is capped at 1');
  invariant(goalProgressFraction(-50, trip) === 0, 'a loss reads as no progress, not negative progress');
  invariant(goalProgressFraction(5_000, openEnded) === 0, 'an open-ended goal has no progress fraction');
  invariant(goalRemaining(1_500, trip) === 2_500, 'remaining is the target less what has been earned');
  invariant(goalRemaining(9_000, trip) === 0, 'remaining never goes negative');
  invariant(goalRemaining(9_000, openEnded) === 0, 'an open-ended goal has nothing remaining');

  // ── position attribution ──────────────────────────────────────────────────
  const bet = (id: string, goalId?: string): TrackedBet => ({
    id,
    goalId,
    category: 'Stocks & ETFs',
    emoji: '📈',
    description: id,
    platform: 'Robinhood',
    strategy: '',
    riskLevel: 2,
    probability: 60,
    expectedReturn: 50,
    amountWagered: 100,
    status: 'active',
    createdAt: '2026-08-03T00:00:00.000Z',
  });
  const bets = [bet('tagged-trip', 'goal-2'), bet('tagged-open', 'goal-3'), bet('untagged')];
  const tripBets = betsForGoal(bets, 'goal-2');
  invariant(tripBets.length === 1 && tripBets[0].id === 'tagged-trip', 'a goal gets exactly the positions that name it');
  invariant(betsForGoal(bets, 'goal-missing').length === 0, 'a goal with no positions gets none');

  // ── default quiz goal ─────────────────────────────────────────────────────
  invariant(defaultQuizGoal(multi.goals, 'goal-3')?.id === 'goal-3', 'the quiz defaults to the last searched goal');
  invariant(defaultQuizGoal(multi.goals, undefined)?.id === 'goal-2', 'with no last search the quiz defaults to the first goal');
  invariant(defaultQuizGoal(multi.goals, 'goal-deleted')?.id === 'goal-2', 'a last search naming a deleted goal falls back to the first');
  invariant(defaultQuizGoal([], 'goal-2') === null, 'no goals means no default');

  // ── drafts ────────────────────────────────────────────────────────────────
  const now = Date.parse('2026-08-20T00:00:00.000Z');
  const draft = (id: string, deadline: string, over: Partial<SavingsGoal> = {}): SavingsGoal => ({
    id,
    label: `$50 ${id}`,
    emoji: '⚡',
    targetAmount: 50,
    createdAt: '2026-08-10T00:00:00.000Z',
    draft: true,
    deadline,
    ...over,
  });
  const abandoned = draft('abandoned', '2026-08-19T00:00:00.000Z');
  const acted = draft('acted-on', '2026-08-19T00:00:00.000Z');
  const stillRunning = draft('still-running', '2026-08-25T00:00:00.000Z');
  const draftReached = draft('reached', '2026-08-19T00:00:00.000Z', { achievedAt: '2026-08-18T00:00:00.000Z' });
  const sweep = abandonedDraftGoalIds(
    [trip, abandoned, acted, stillRunning, draftReached],
    [bet('position', 'acted-on')],
    now,
  );
  invariant(sweep.length === 1 && sweep[0] === 'abandoned', 'only the expired draft with nothing attached is swept');
  invariant(abandonedDraftGoalIds([trip], [], now).length === 0, 'a committed goal is never swept');
  invariant(abandonedDraftGoalIds([stillRunning], [], now).length === 0, 'a draft still inside its deadline is left alone');

  // A draft is a search in progress, not a goal the user has: it stays out of the list.
  // ── selection parameters ──────────────────────────────────────────────────
  invariant(parseGoalIds('goal-1,goal-2').length === 2, 'a comma-separated parameter is a selection');
  invariant(parseGoalIds(' goal-1 , goal-2 ')[0] === 'goal-1', 'padding around an id is trimmed');
  invariant(parseGoalIds('goal-1,goal-1').length === 1, 'a repeated id selects one goal, not two');
  invariant(parseGoalIds(['goal-1', 'goal-2']).length === 2, 'a repeated key arrives as an array and still reads');
  invariant(parseGoalIds('').length === 0, 'an empty parameter is no selection');
  invariant(parseGoalIds(undefined).length === 0, 'a missing parameter is no selection');
  invariant(parseGoalIds(',,').length === 0, 'separators with nothing between them select nothing');

  invariant(committedGoals([trip, abandoned]).length === 1, 'drafts are hidden from the goals list');
  invariant(committedGoals([trip, abandoned])[0].id === 'goal-2', 'the committed goal is the one that survives the filter');
  invariant(goalByLabel([trip], '  a DREAM trip ')?.id === 'goal-2', 'a goal is found by name regardless of case or padding');
  invariant(goalByLabel([trip], 'a dream') === null, 'a partial name is not a match');
  invariant(goalByLabel([trip], '   ') === null, 'an empty name matches nothing');

  // ── celebration presentation ──────────────────────────────────────────────
  const reached: SavingsGoal = { ...trip, achievedAt: '2026-08-12T09:00:00.000Z' };
  invariant(pendingCelebrationGoal([openEnded, reached])?.id === 'goal-2', 'a freshly reached goal owes a celebration');
  invariant(pendingCelebrationGoal([{ ...reached, celebratedAt: '2026-08-12T09:00:01.000Z' }]) === null, 'a celebrated goal owes nothing');
  invariant(pendingCelebrationGoal([trip]) === null, 'an unreached goal owes nothing');
  invariant(pendingCelebrationGoal([]) === null, 'no goals owe nothing');

  const present = (pathname: string, presentedGoalId: string | null = null): boolean =>
    shouldPresentCelebration({ goal: reached, pathname, presentedGoalId });
  invariant(present('/'), 'the celebration is presented on the home screen');
  invariant(present('/goals'), 'the celebration is presented on the goals tab');
  invariant(!present('/sign-in'), 'signing in is never interrupted by a celebration');
  invariant(!present('/onboarding'), 'onboarding is never interrupted by a celebration');
  invariant(!present('/goal-setup'), 'setting a goal is never interrupted by a celebration');
  invariant(!present('/goal-achieved'), 'the celebration never presents itself on top of itself');
  invariant(!present('/', 'goal-2'), 'a goal already presented this session is not presented again');
  invariant(present('/', 'goal-1'), 'a different goal is still presented after an earlier one');
}
