import AsyncStorage from '@react-native-async-storage/async-storage';

import type { SportsMatch } from '@/lib/sports-market-match';
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
  parseJsonAs,
} from '@/lib/runtime-validation';

const KEYS = {
  SUBSCRIBED: 'polyprofit:subscribed',
  QUIZ: 'polyprofit:quiz',
  BETS: 'polyprofit:bets',
  ONBOARDING: 'polyprofit:onboardingComplete',
  SAVED_ROUTES: 'polyprofit:savedRoutes',
  DAILY_POOL: 'polyprofit:dailyPool',
  PORTFOLIO_PROGRESS: 'polyprofit:portfolioProgress',
  SAVINGS_GOAL: 'polyprofit:savingsGoal',
  SPORTS_MATCHES: 'polyprofit:sportsMatches',
  BIOMETRIC_LOCK: 'polyprofit:biometricLockEnabled',
} as const;

const MAX_SAVED_BATCHES = 10;

export interface PortfolioProgressPoint {
  time: number;
  value: number;
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

export async function getQuizAnswers(): Promise<QuizAnswers | null> {
  const val = await AsyncStorage.getItem(KEYS.QUIZ);
  if (!val) return null;
  return parseJsonAs(val, isQuizAnswers);
}

export async function setQuizAnswers(answers: QuizAnswers): Promise<void> {
  await AsyncStorage.setItem(KEYS.QUIZ, JSON.stringify(answers));
}

export async function clearQuizAnswers(): Promise<void> {
  await AsyncStorage.removeItem(KEYS.QUIZ);
}

export async function getSavingsGoalState(): Promise<SavingsGoalState | null> {
  const val = await AsyncStorage.getItem(KEYS.SAVINGS_GOAL);
  if (!val) return null;
  return parseJsonAs(val, isSavingsGoalState);
}

export async function setSavingsGoalState(state: SavingsGoalState): Promise<void> {
  await AsyncStorage.setItem(KEYS.SAVINGS_GOAL, JSON.stringify(state));
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
  return parseJsonAs(value, isArrayOf(isPortfolioProgressPoint)) ?? [];
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
  const next = last && point.time - last.time < 45_000
    ? [...seeded.slice(0, -1), point]
    : [...seeded, point];
  const bounded = next.slice(-2_000);
  await AsyncStorage.setItem(KEYS.PORTFOLIO_PROGRESS, JSON.stringify(bounded));
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
