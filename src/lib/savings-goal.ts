import type { LegacySavingsGoalState, SavingsGoal, SavingsGoalState, TrackedBet } from '@/types/bets';

export const GOAL_ACCOUNTING_VERSION = 6;

interface SavingsGoalMigration {
  state: SavingsGoalState;
  migrated: boolean;
}

type StoredGoalState = SavingsGoalState | LegacySavingsGoalState;

/** True for the version 6 shape: a list of goals rather than one `current` goal. */
function isMultiGoalState(state: StoredGoalState): state is SavingsGoalState {
  return Array.isArray((state as SavingsGoalState).goals);
}

/**
 * Version 5 added the achievement celebration. A goal reached before the
 * celebration existed is backfilled as already celebrated — otherwise everyone
 * upgrading gets confetti for a goal they hit weeks ago.
 */
function backfillCelebration(goal: SavingsGoal): SavingsGoal {
  if (!goal.achievedAt || goal.celebratedAt) return goal;
  return { ...goal, celebratedAt: goal.achievedAt };
}

function withoutAchievement(goal: SavingsGoal): SavingsGoal {
  const next = { ...goal };
  delete next.achievedAt;
  return next;
}

function readGoals(state: StoredGoalState): SavingsGoal[] {
  if (isMultiGoalState(state)) return state.goals.filter(Boolean);
  return state.current ? [state.current] : [];
}

/**
 * Version 6 turns the single `current` goal into a list, since positions and
 * route searches now name the goal they belong to. Earlier accounting versions
 * are carried through the same repairs they always were.
 */
export function migrateSavingsGoalState(state: StoredGoalState): SavingsGoalMigration {
  if (isMultiGoalState(state) && state.accountingVersion === GOAL_ACCOUNTING_VERSION) {
    return { state, migrated: false };
  }

  const stored = readGoals(state);
  const version = state.accountingVersion;
  // Version 3 credited invested principal toward targets, so the achievements it
  // recorded may be false; anything older predates profit-only accounting.
  const achievementsValid = version === 2 || version === 4 || version === 5 || version === GOAL_ACCOUNTING_VERSION;
  // Celebrations arrived in version 5. Before that an `achievedAt` with no
  // `celebratedAt` just meant "reached", not "still owes confetti".
  const backfillCelebrations = version === 2 || version === 4;

  const goals = stored.map((goal) => {
    if (!achievementsValid) return withoutAchievement(goal);
    return backfillCelebrations ? backfillCelebration(goal) : goal;
  });

  const falseAchievements = achievementsValid ? 0 : stored.filter((goal) => goal.achievedAt).length;
  const achievedCount = achievementsValid
    ? state.achievedCount
    : version === 3
      ? Math.max(0, state.achievedCount - falseAchievements)
      : 0;

  return {
    state: { goals, achievedCount, accountingVersion: GOAL_ACCOUNTING_VERSION },
    migrated: true,
  };
}

// ── goal selectors ──────────────────────────────────────────────────────────

/** An open-ended goal ("just grow my money") has no finish line to reach. */
export function isOpenEnded(goal: SavingsGoal): boolean {
  return goal.targetAmount == null || goal.targetAmount <= 0;
}

/** How far net gains have carried this goal, 0–1. Always 0 for an open-ended goal. */
export function goalProgressFraction(netGain: number, goal: SavingsGoal): number {
  if (isOpenEnded(goal)) return 0;
  return Math.max(0, Math.min(1, netGain / (goal.targetAmount as number)));
}

/** What is left to earn on this goal. Zero for an open-ended goal — nothing is "left". */
export function goalRemaining(netGain: number, goal: SavingsGoal): number {
  if (isOpenEnded(goal)) return 0;
  return Math.max(0, (goal.targetAmount as number) - netGain);
}

/** Positions working toward one goal. */
export function betsForGoal(bets: TrackedBet[], goalId: string): TrackedBet[] {
  return bets.filter((bet) => bet.goalId === goalId);
}

/**
 * The goals a user actually has: drafts named by a search nobody acted on are
 * excluded, so browsing routes never fills the Goals tab with noise.
 */
export function committedGoals(goals: SavingsGoal[]): SavingsGoal[] {
  return goals.filter((goal) => !goal.draft);
}

/**
 * An existing goal by name, case- and space-insensitive. A second search called
 * "Headphones" should keep working toward the Headphones goal rather than opening
 * a rival with the same name.
 */
export function goalByLabel(goals: SavingsGoal[], label: string): SavingsGoal | null {
  const wanted = label.trim().toLowerCase();
  if (!wanted) return null;
  return goals.find((goal) => goal.label.trim().toLowerCase() === wanted) ?? null;
}

/**
 * The goal a new quiz should default to: the one the last search was run for,
 * else the first goal. "Last used" beats "oldest" — the goal you were just
 * working on is the one you probably still are.
 */
export function defaultQuizGoal(goals: SavingsGoal[], lastSearchGoalId: string | undefined): SavingsGoal | null {
  return goals.find((goal) => goal.id === lastSearchGoalId) ?? goals[0] ?? null;
}

/**
 * Draft goals whose deadline has passed with nothing attached. A search the user
 * never acted on shouldn't leave litter behind — and because no position names
 * them, deleting them orphans nothing.
 */
export function abandonedDraftGoalIds(goals: SavingsGoal[], bets: TrackedBet[], now: number): string[] {
  return goals
    .filter((goal) => {
      if (!goal.draft || goal.achievedAt || !goal.deadline) return false;
      if (Date.parse(goal.deadline) > now) return false;
      return !bets.some((bet) => bet.goalId === goal.id);
    })
    .map((goal) => goal.id);
}

// ── celebration ─────────────────────────────────────────────────────────────

/** The first reached goal that still owes the user its congratulations screen. */
export function pendingCelebrationGoal(goals: SavingsGoal[] | null | undefined): SavingsGoal | null {
  return goals?.find((goal) => goal.achievedAt && !goal.celebratedAt) ?? null;
}

/**
 * Screens in the pre-app funnel. Interrupting sign-up or goal setup with
 * confetti for an older goal would be worse than waiting a few seconds, so the
 * celebration holds until the user is actually inside the app. Deliberately a
 * path list rather than an auth check, so EXPO_PUBLIC_DEV_BYPASS_AUTH still works.
 */
const FUNNEL_PATHS = [
  '/onboarding',
  '/sign-in',
  '/sign-up',
  '/profile-survey',
  '/goal-setup',
  '/goal-achieved',
];

export interface CelebrationPresentationInput {
  goal: SavingsGoal | null | undefined;
  pathname: string;
  /** Goal id already presented in this session, so a re-render can't stack screens. */
  presentedGoalId: string | null;
}

export function shouldPresentCelebration({
  goal,
  pathname,
  presentedGoalId,
}: CelebrationPresentationInput): boolean {
  if (!goal?.achievedAt || goal.celebratedAt || goal.id === presentedGoalId) return false;
  return !FUNNEL_PATHS.includes(pathname);
}

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
