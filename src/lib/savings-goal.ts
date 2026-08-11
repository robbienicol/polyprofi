import type { SavingsGoalState } from '@/types/bets';

export const GOAL_ACCOUNTING_VERSION = 2;

interface SavingsGoalMigration {
  state: SavingsGoalState;
  migrated: boolean;
}

/**
 * Version 1 compared a goal with total portfolio value, so deposited principal
 * could mark the goal achieved immediately. Those achievement records are not
 * trustworthy and the local schema has no history capable of repairing them
 * individually. Reset them once; version 2 achievements use profit-only math.
 */
export function migrateSavingsGoalState(state: SavingsGoalState): SavingsGoalMigration {
  if (state.accountingVersion === GOAL_ACCOUNTING_VERSION) {
    return { state, migrated: false };
  }

  const current = state.current ? { ...state.current } : null;
  if (current) delete current.achievedAt;

  return {
    state: {
      current,
      achievedCount: 0,
      accountingVersion: GOAL_ACCOUNTING_VERSION,
    },
    migrated: true,
  };
}

function invariant(condition: boolean, message: string): void {
  if (!condition) throw new Error(`[savings-goal] ${message}`);
}

export function __selfCheck(): void {
  const legacy: SavingsGoalState = {
    current: {
      id: 'goal-1',
      label: 'Trip',
      emoji: '✈️',
      targetAmount: 1_000,
      createdAt: '2026-01-01T00:00:00.000Z',
      achievedAt: '2026-01-02T00:00:00.000Z',
    },
    achievedCount: 3,
  };
  const repaired = migrateSavingsGoalState(legacy);
  invariant(repaired.migrated, 'legacy state is migrated');
  invariant(repaired.state.current?.achievedAt == null, 'legacy false achievement is cleared');
  invariant(repaired.state.achievedCount === 0, 'untrustworthy legacy achievement count is reset');
  invariant(repaired.state.accountingVersion === GOAL_ACCOUNTING_VERSION, 'migration is versioned');

  const current: SavingsGoalState = {
    ...legacy,
    accountingVersion: GOAL_ACCOUNTING_VERSION,
  };
  const unchanged = migrateSavingsGoalState(current);
  invariant(!unchanged.migrated, 'current accounting state is not migrated again');
  invariant(unchanged.state.current?.achievedAt === legacy.current?.achievedAt, 'valid version 2 achievement is preserved');
}
