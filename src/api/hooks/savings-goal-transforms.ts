/**
 * The pure state changes behind each useSavingsGoal mutation. Each one runs twice:
 * once against the query cache up front (optimistic) and once inside the
 * read-modify-write against storage. Returning null means the change declined
 * (already achieved, nothing to remove) and leaves that copy alone.
 */
import { GOAL_ACCOUNTING_VERSION } from '@/lib/savings-goal';
import type { SavingsGoal, SavingsGoalState } from '@/types/bets';

export const EMPTY_STATE: SavingsGoalState = {
  goals: [],
  achievedCount: 0,
  accountingVersion: GOAL_ACCOUNTING_VERSION,
};

export interface SavingsGoalInput {
  label: string;
  emoji: string;
  /** Omitted for an open-ended goal ("just grow my money"), which has no finish line. */
  targetAmount?: number;
  /** Set for a goal a route search named but nothing has been acquired against yet. */
  draft?: boolean;
  /** ISO deadline from the search, after which an unused draft is swept away. */
  deadline?: string;
}

export function buildGoal(input: SavingsGoalInput): SavingsGoal {
  const target = input.targetAmount != null ? Math.max(1, Math.round(input.targetAmount)) : undefined;
  return {
    id: `goal-${Date.now()}`,
    label: input.label.trim(),
    emoji: input.emoji,
    ...(target != null ? { targetAmount: target } : null),
    ...(input.draft ? { draft: true } : null),
    ...(input.deadline ? { deadline: input.deadline } : null),
    createdAt: new Date().toISOString(),
  };
}

// Add a goal. Existing goals and their positions stay put.
export function addGoalTo(prev: SavingsGoalState, goal: SavingsGoal): SavingsGoalState {
  return {
    ...prev,
    goals: [...prev.goals, goal],
    accountingVersion: GOAL_ACCOUNTING_VERSION,
  };
}

// Promote a draft into a real goal. Called when the user acquires against it:
// committing money is what turns a search into something worth tracking.
export function confirmDraft(prev: SavingsGoalState, goalId: string): SavingsGoalState | null {
  const target = prev.goals.find((goal) => goal.id === goalId);
  if (!target?.draft) return null;
  const confirmed = { ...target };
  delete confirmed.draft;
  return { ...prev, goals: prev.goals.map((goal) => (goal.id === goalId ? confirmed : goal)) };
}

// Drop goals. Their positions are reassigned by the caller before this runs —
// see reassignBets in useTrackedBets — so nothing is left pointing at nothing.
//
// Takes a list rather than one id: every write here is a read-modify-write against
// storage, so removing three goals with three calls can interleave and resurrect
// the ones whose read happened before the others' writes landed.
export function dropGoals(prev: SavingsGoalState, goalIds: string[]): SavingsGoalState | null {
  const drop = new Set(goalIds);
  const goals = prev.goals.filter((goal) => !drop.has(goal.id));
  return goals.length === prev.goals.length ? null : { ...prev, goals };
}

// Mark one goal reached (idempotent) and bump the lifetime count once.
export function achieveGoal(prev: SavingsGoalState, goalId: string): SavingsGoalState | null {
  const target = prev.goals.find((goal) => goal.id === goalId);
  if (!target || target.achievedAt) return null;
  const achieved = { ...target, achievedAt: new Date().toISOString() };
  return {
    ...prev,
    goals: prev.goals.map((goal) => (goal.id === goalId ? achieved : goal)),
    achievedCount: prev.achievedCount + 1,
    accountingVersion: GOAL_ACCOUNTING_VERSION,
  };
}

// Record that the congratulations screen has been shown, so it shows once.
export function celebrateGoal(prev: SavingsGoalState, goalId: string): SavingsGoalState | null {
  const target = prev.goals.find((goal) => goal.id === goalId);
  if (!target?.achievedAt || target.celebratedAt) return null;
  const celebrated = { ...target, celebratedAt: new Date().toISOString() };
  return { ...prev, goals: prev.goals.map((goal) => (goal.id === goalId ? celebrated : goal)) };
}
