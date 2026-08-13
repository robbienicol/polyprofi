import type { SavingsGoal, SavingsGoalState } from '@/types/bets';

export const GOAL_ACCOUNTING_VERSION = 5;

interface SavingsGoalMigration {
  state: SavingsGoalState;
  migrated: boolean;
}

/**
 * Version 5 adds the achievement celebration. A goal reached before the
 * celebration existed is backfilled as already celebrated — otherwise everyone
 * upgrading gets confetti for a goal they hit weeks ago.
 */
function backfillCelebration(goal: SavingsGoal | null): SavingsGoal | null {
  if (!goal?.achievedAt || goal.celebratedAt) return goal;
  return { ...goal, celebratedAt: goal.achievedAt };
}

/** Version 4 restores profit-only goals and repairs achievements created by version 3's principal-inclusive rule. */
export function migrateSavingsGoalState(state: SavingsGoalState): SavingsGoalMigration {
  if (state.accountingVersion === GOAL_ACCOUNTING_VERSION) {
    return { state, migrated: false };
  }

  // Versions 2 and 4 both used profit-only accounting, so their achievements
  // remain valid — they only need version 5's celebration backfill.
  if (state.accountingVersion === 2 || state.accountingVersion === 4) {
    return {
      state: {
        ...state,
        current: backfillCelebration(state.current),
        accountingVersion: GOAL_ACCOUNTING_VERSION,
      },
      migrated: true,
    };
  }

  const current = state.current ? { ...state.current } : null;
  const currentWasMarkedAchieved = current?.achievedAt != null;
  if (current) delete current.achievedAt;

  return {
    state: {
      current,
      achievedCount: state.accountingVersion === 3
        ? Math.max(0, state.achievedCount - (currentWasMarkedAchieved ? 1 : 0))
        : 0,
      accountingVersion: GOAL_ACCOUNTING_VERSION,
    },
    migrated: true,
  };
}

/** A reached goal that still owes the user its congratulations screen. */
export function pendingCelebrationGoal(goal: SavingsGoal | null | undefined): SavingsGoal | null {
  return goal?.achievedAt && !goal.celebratedAt ? goal : null;
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
  const pending = pendingCelebrationGoal(goal);
  if (!pending || pending.id === presentedGoalId) return false;
  return !FUNNEL_PATHS.includes(pathname);
}

function invariant(condition: boolean, message: string): void {
  if (!condition) throw new Error(`[savings-goal] ${message}`);
}

export function __selfCheck(): void {
  const principalInclusive: SavingsGoalState = {
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
  invariant(repaired.state.current?.achievedAt == null, 'false current achievement is cleared');
  invariant(repaired.state.achievedCount === 2, 'only the false current achievement is removed from the count');
  invariant(repaired.state.accountingVersion === GOAL_ACCOUNTING_VERSION, 'migration is versioned');

  const profitOnly: SavingsGoalState = {
    ...principalInclusive,
    accountingVersion: 2,
  };
  const preserved = migrateSavingsGoalState(profitOnly);
  invariant(preserved.state.current?.achievedAt === profitOnly.current?.achievedAt, 'valid profit-only achievement is preserved');
  invariant(preserved.state.achievedCount === 3, 'valid profit-only achievement count is preserved');

  // Version 4 was the accounting in the field before the celebration existed, so
  // its achievements must survive the upgrade — and must not trigger confetti.
  const beforeCelebration: SavingsGoalState = { ...principalInclusive, accountingVersion: 4 };
  const upgraded = migrateSavingsGoalState(beforeCelebration);
  invariant(upgraded.migrated, 'a version 4 state is migrated to the celebration version');
  invariant(upgraded.state.current?.achievedAt === beforeCelebration.current?.achievedAt, 'a version 4 achievement is preserved');
  invariant(upgraded.state.achievedCount === 3, 'a version 4 achievement count is preserved');
  invariant(
    upgraded.state.current?.celebratedAt === beforeCelebration.current?.achievedAt,
    'a goal reached before the celebration existed is backfilled as already celebrated',
  );
  invariant(pendingCelebrationGoal(upgraded.state.current) === null, 'an upgraded old achievement owes no celebration');

  // ── celebration presentation ──────────────────────────────────────────────
  const reached: SavingsGoal = {
    id: 'goal-2',
    label: 'A dream trip',
    emoji: '✈️',
    targetAmount: 4_000,
    createdAt: '2026-08-01T00:00:00.000Z',
    achievedAt: '2026-08-12T09:00:00.000Z',
  };
  invariant(pendingCelebrationGoal(reached)?.id === 'goal-2', 'a freshly reached goal owes a celebration');
  invariant(pendingCelebrationGoal({ ...reached, celebratedAt: '2026-08-12T09:00:01.000Z' }) === null, 'a celebrated goal owes nothing');
  invariant(pendingCelebrationGoal({ ...reached, achievedAt: undefined }) === null, 'an unreached goal owes nothing');
  invariant(pendingCelebrationGoal(null) === null, 'no goal owes nothing');

  const present = (pathname: string, presentedGoalId: string | null = null): boolean =>
    shouldPresentCelebration({ goal: reached, pathname, presentedGoalId });
  invariant(present('/'), 'the celebration is presented on the home screen');
  invariant(present('/positions'), 'the celebration is presented anywhere inside the app');
  invariant(!present('/sign-in'), 'signing in is never interrupted by a celebration');
  invariant(!present('/onboarding'), 'onboarding is never interrupted by a celebration');
  invariant(!present('/goal-setup'), 'setting the first goal is never interrupted by a celebration');
  invariant(!present('/goal-achieved'), 'the celebration never presents itself on top of itself');
  invariant(!present('/', 'goal-2'), 'a goal already presented this session is not presented again');
  invariant(present('/', 'goal-1'), 'a different goal is still presented after an earlier one');

  const current: SavingsGoalState = {
    ...principalInclusive,
    accountingVersion: GOAL_ACCOUNTING_VERSION,
  };
  const unchanged = migrateSavingsGoalState(current);
  invariant(!unchanged.migrated, 'current accounting state is not migrated again');
  invariant(unchanged.state.current?.achievedAt === current.current?.achievedAt, 'current achievement is preserved');
}
