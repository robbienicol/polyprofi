import AsyncStorage from '@react-native-async-storage/async-storage';

import type { SportsMatch } from '@/lib/sports-market-match';
import { parsePortfolioHistory, serializePortfolioHistory } from '@/lib/portfolio-history';
import { sanitizePreferences, type Preferences } from '@/lib/preferences';
import { migrateSavingsGoalState } from '@/lib/savings-goal';
import { QuizAnswers, SavingsGoalState, TrackedBet } from '@/types/bets';
import { Route, SavedRoutesBatch } from '@/types/routes';
import {
  isArrayOf,
  isPortfolioProgressPoint,
  isQuizAnswers,
  isRecordOf,
  isRoute,
  isSavedRoutesBatch,
  isSavingsGoalState,
  isSportsMatch,
  isTrackedBet,
  parseJson,
  parseJsonAs,
} from '@/lib/runtime-validation';

// Keep the pre-rebrand namespace so an app update retains existing user data.
const KEYS = {
  SUBSCRIBED: 'polyprofit:subscribed',
  QUIZ: 'polyprofit:quiz',
  QUIZ_OWNER: 'polyprofit:quizOwner',
  BETS: 'polyprofit:bets',
  ONBOARDING: 'polyprofit:onboardingComplete',
  SAVED_ROUTES: 'polyprofit:savedRoutes',
  DAILY_POOL: 'polyprofit:dailyPool',
  PORTFOLIO_PROGRESS: 'polyprofit:portfolioProgress',
  SAVINGS_GOAL: 'polyprofit:savingsGoal',
  SAVINGS_GOAL_OWNER: 'polyprofit:savingsGoalOwner',
  SPORTS_MATCHES: 'polyprofit:sportsMatches',
  BIOMETRIC_LOCK: 'polyprofit:biometricLockEnabled',
  PREFERENCES: 'polyprofit:preferences',
  PROFILE_COMPLETE: 'polyprofit:profileComplete',
  PROFILE_COMPLETE_OWNER: 'polyprofit:profileCompleteOwner',
} as const;

const MAX_SAVED_BATCHES = 10;

export interface PortfolioProgressPoint {
  time: number;
  value: number;
  basisValue: number;
  livePnl: number;
  projectedPnl: number;
}

// ── Daily avenue pool cache ──────────────────────────────────────────────────
// The pivot decoupled results from stake, so a generated pool is valid all day.
// Cache by "YYYY-MM-DD|<goalKey>"; keep only today's entries to bound size.
function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function getDailyPool(goalKey: string): Promise<Route[] | null> {
  const raw = await AsyncStorage.getItem(KEYS.DAILY_POOL);
  if (!raw) return null;
  const map = parseJsonAs(raw, isRecordOf(isArrayOf(isRoute)));
  return map?.[`${todayKey()}|${goalKey}`] ?? null;
}

export async function setDailyPool(goalKey: string, routes: Route[]): Promise<void> {
  const today = todayKey();
  let map: Record<string, Route[]> = {};
  const raw = await AsyncStorage.getItem(KEYS.DAILY_POOL);
  if (raw) {
    const prev = parseJsonAs(raw, isRecordOf(isArrayOf(isRoute)));
    if (prev) {
      // drop anything not from today
      for (const k of Object.keys(prev)) if (k.startsWith(`${today}|`)) map[k] = prev[k];
    }
  }
  map[`${today}|${goalKey}`] = routes;
  await AsyncStorage.setItem(KEYS.DAILY_POOL, JSON.stringify(map));
}

// ── Daily Kalshi↔Polymarket sports match cache ───────────────────────────────
// The pairing (not the price) is what's expensive to compute, and it's stable
// for the whole trading day — so it's cached once per day, not per user/goal.
export async function getSportsMatches(): Promise<SportsMatch[] | null> {
  const raw = await AsyncStorage.getItem(KEYS.SPORTS_MATCHES);
  if (!raw) return null;
  const cached = parseJsonAs(raw, isRecordOf(isArrayOf(isSportsMatch)));
  return cached?.[todayKey()] ?? null;
}

export async function setSportsMatches(matches: SportsMatch[]): Promise<void> {
  await AsyncStorage.setItem(KEYS.SPORTS_MATCHES, JSON.stringify({ [todayKey()]: matches }));
}

export async function getSubscribed(): Promise<boolean> {
  const val = await AsyncStorage.getItem(KEYS.SUBSCRIBED);
  return val === 'true';
}

export async function setSubscribed(subscribed: boolean): Promise<void> {
  await AsyncStorage.setItem(KEYS.SUBSCRIBED, String(subscribed));
}

export async function getQuizAnswers(userId?: string): Promise<QuizAnswers | null> {
  const owner = await AsyncStorage.getItem(KEYS.QUIZ_OWNER);
  if (userId && owner && owner !== userId) return null;
  const val = await AsyncStorage.getItem(KEYS.QUIZ);
  if (!val) return null;
  return parseJsonAs(val, isQuizAnswers);
}

export async function setQuizAnswers(answers: QuizAnswers, userId?: string): Promise<void> {
  const writes: Promise<void>[] = [
    AsyncStorage.setItem(KEYS.QUIZ, JSON.stringify(answers)),
  ];
  if (userId) writes.push(AsyncStorage.setItem(KEYS.QUIZ_OWNER, userId));
  else writes.push(AsyncStorage.removeItem(KEYS.QUIZ_OWNER));
  await Promise.all(writes);
}

export async function clearQuizAnswers(): Promise<void> {
  await AsyncStorage.multiRemove([KEYS.QUIZ, KEYS.QUIZ_OWNER]);
}

/**
 * Cached "this account finished the profile survey" flag.
 *
 * The survey's real home is the server, but a failed load must not read as
 * "not completed" — that redirects a returning user back into the survey on
 * every cold start. This cache is what the hook falls back to when /api/profile
 * is unreachable, the same way savings goals fall back to local state.
 */
export async function getProfileCompleted(userId?: string): Promise<boolean> {
  const owner = await AsyncStorage.getItem(KEYS.PROFILE_COMPLETE_OWNER);
  if (userId && owner && owner !== userId) return false;
  return (await AsyncStorage.getItem(KEYS.PROFILE_COMPLETE)) === 'true';
}

export async function setProfileCompleted(completed: boolean, userId?: string): Promise<void> {
  const writes: Promise<void>[] = [
    AsyncStorage.setItem(KEYS.PROFILE_COMPLETE, String(completed)),
  ];
  if (userId) writes.push(AsyncStorage.setItem(KEYS.PROFILE_COMPLETE_OWNER, userId));
  else writes.push(AsyncStorage.removeItem(KEYS.PROFILE_COMPLETE_OWNER));
  await Promise.all(writes);
}

export async function getSavingsGoalState(userId?: string): Promise<SavingsGoalState | null> {
  const owner = await AsyncStorage.getItem(KEYS.SAVINGS_GOAL_OWNER);
  if (userId && owner && owner !== userId) return null;
  const val = await AsyncStorage.getItem(KEYS.SAVINGS_GOAL);
  if (!val) return null;
  const parsed = parseJsonAs(val, isSavingsGoalState);
  if (!parsed) return null;

  const migration = migrateSavingsGoalState(parsed);
  if (migration.migrated) {
    await AsyncStorage.setItem(KEYS.SAVINGS_GOAL, JSON.stringify(migration.state));
  }
  return migration.state;
}

export async function setSavingsGoalState(state: SavingsGoalState, userId?: string): Promise<void> {
  const writes: Promise<void>[] = [
    AsyncStorage.setItem(KEYS.SAVINGS_GOAL, JSON.stringify(state)),
  ];
  if (userId) writes.push(AsyncStorage.setItem(KEYS.SAVINGS_GOAL_OWNER, userId));
  else writes.push(AsyncStorage.removeItem(KEYS.SAVINGS_GOAL_OWNER));
  await Promise.all(writes);
}

export async function getTrackedBets(): Promise<TrackedBet[]> {
  const val = await AsyncStorage.getItem(KEYS.BETS);
  if (!val) return [];
  return parseJsonAs(val, isArrayOf(isTrackedBet)) ?? [];
}

export async function saveTrackedBets(bets: TrackedBet[]): Promise<void> {
  await AsyncStorage.setItem(KEYS.BETS, JSON.stringify(bets));
}

export async function getPortfolioProgress(): Promise<PortfolioProgressPoint[]> {
  const value = await AsyncStorage.getItem(KEYS.PORTFOLIO_PROGRESS);
  if (!value) return [];
  const parsed = parsePortfolioHistory(value, isPortfolioProgressPoint);
  if (parsed) return parsed;

  // Unversioned points may have been written by several incompatible accounting
  // builds. They cannot be repaired reliably, so start one clean curve.
  await AsyncStorage.removeItem(KEYS.PORTFOLIO_PROGRESS);
  return [];
}

export async function recordPortfolioProgress(
  point: PortfolioProgressPoint,
  basis?: PortfolioProgressPoint
): Promise<PortfolioProgressPoint[]> {
  const existing = await getPortfolioProgress();
  const seeded = existing.length === 0 && basis && basis.time < point.time
    ? [basis]
    : existing;
  const last = seeded[seeded.length - 1];
  const basisChanged = last && Math.abs(last.basisValue - point.basisValue) >= 0.005;
  const next = basisChanged
    ? point.time > last.time
      ? [...seeded, point]
      : [...seeded.slice(0, -1), point]
    : last && point.time - last.time < 45_000
      ? [...seeded.slice(0, -1), point]
      : [...seeded, point];
  const bounded = next.slice(-2_000);
  await AsyncStorage.setItem(KEYS.PORTFOLIO_PROGRESS, serializePortfolioHistory(bounded));
  return bounded;
}

export async function getOnboardingComplete(): Promise<boolean> {
  return (await AsyncStorage.getItem(KEYS.ONBOARDING)) === 'true';
}

export async function setOnboardingComplete(): Promise<void> {
  await AsyncStorage.setItem(KEYS.ONBOARDING, 'true');
}

export async function getSavedRoutesHistory(): Promise<SavedRoutesBatch[]> {
  const val = await AsyncStorage.getItem(KEYS.SAVED_ROUTES);
  if (!val) return [];
  return parseJsonAs(val, isArrayOf(isSavedRoutesBatch)) ?? [];
}

export async function appendSavedRoutesBatch(batch: SavedRoutesBatch): Promise<void> {
  const history = await getSavedRoutesHistory();
  const next = [batch, ...history].slice(0, MAX_SAVED_BATCHES);
  await AsyncStorage.setItem(KEYS.SAVED_ROUTES, JSON.stringify(next));
}

export async function getBiometricLockEnabled(): Promise<boolean> {
  return (await AsyncStorage.getItem(KEYS.BIOMETRIC_LOCK)) === 'true';
}

export async function setBiometricLockEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(KEYS.BIOMETRIC_LOCK, String(enabled));
}

// ── Settings ─────────────────────────────────────────────────────────────────
// One blob, sanitized on read, so a new setting needs no key and no migration.

export async function getPreferences(): Promise<Preferences> {
  const raw = await AsyncStorage.getItem(KEYS.PREFERENCES);
  return sanitizePreferences(raw ? parseJson(raw) : null);
}

/** Merge a patch over what's stored and return the resulting full object. */
export async function updatePreferences(patch: Partial<Preferences>): Promise<Preferences> {
  const next = sanitizePreferences({ ...(await getPreferences()), ...patch });
  await AsyncStorage.setItem(KEYS.PREFERENCES, JSON.stringify(next));
  return next;
}
