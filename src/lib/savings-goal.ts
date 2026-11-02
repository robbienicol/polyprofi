import type { LegacySavingsGoalState, QuizAnswers, SavingsGoal, SavingsGoalState, TrackedBet } from '@/types/bets';

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

/**
 * The search timeframe a goal implies, from how long its deadline has left. Used
 * when a goal starts a search directly (the Goals tab) instead of going through
 * the quiz, where the user picks it by hand. Rounds up to the nearest bucket so a
 * goal with 10 days left searches "this month" rather than a week it can't make.
 */
export function goalTimeframe(goal: SavingsGoal, now: number = Date.now()): QuizAnswers['timeframe'] {
  const deadline = goal.deadline ? Date.parse(goal.deadline) : NaN;
  if (!Number.isFinite(deadline)) return 'month';
  const days = (deadline - now) / 86_400_000;
  if (days <= 1) return 'today';
  if (days <= 7) return 'week';
  if (days <= 30) return 'month';
  if (days <= 90) return '3months';
  if (days <= 365) return '1year';
  return '5years';
}

/** Positions working toward one goal. */
export function betsForGoal(bets: TrackedBet[], goalId: string): TrackedBet[] {
  return bets.filter((bet) => bet.goalId === goalId);
}

/**
 * Goal ids carried in a URL parameter, as the Goals tab and the Portfolio tab pass a
 * selection back and forth. Tolerant of the shapes a parameter really arrives in —
 * missing, empty, an array from a repeated key, padded, duplicated — because every
 * one of those means "no usable selection" rather than an error worth a screen.
 */
export function parseGoalIds(value: string | string[] | undefined): string[] {
  const raw = Array.isArray(value) ? value.join(',') : value ?? '';
  return [...new Set(raw.split(',').map((id) => id.trim()).filter(Boolean))];
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

export { __selfCheck } from '@/lib/savings-goal.check';
