import AsyncStorage from '@react-native-async-storage/async-storage';

import { KEYS } from '@/api/client/storage-keys';
import { parsePortfolioHistory, serializePortfolioHistory } from '@/lib/portfolio-history';
import { sanitizeOnboardingProfile, type OnboardingProfile } from '@/lib/onboarding-profile';
import { migrateSavingsGoalState } from '@/lib/savings-goal';
import { QuizAnswers, SavingsGoalState, TrackedBet } from '@/types/bets';
import { noteLocalWrite } from '@/api/client/user-data-sync';
import { SavedRoutesBatch } from '@/types/routes';
import {
  isArrayOf,
  isPortfolioProgressPoint,
  isQuizAnswers,
  isSavedRoutesBatch,
  isSavingsGoalState,
  isTrackedBet,
  parseJson,
  parseJsonAs,
} from '@/lib/runtime-validation';

export {
  getSportsMatches,
  setSportsMatches,
  getGenericMatches,
  setGenericMatches,
} from '@/api/client/storage-daily-cache';
export {
  getAlertLedger,
  saveAlertLedger,
  getPreferences,
  updatePreferences,
  getSpendingCuts,
  saveSpendingCuts,
  clearSpendingCuts,
  type ImportedSpendingCuts,
} from '@/api/client/storage-settings';

/** How many generated batches the device keeps. Exported so the optimistic
 * cache write in useSavedRoutes trims to exactly what the disk will hold. */
export const MAX_SAVED_BATCHES = 10;

export interface PortfolioProgressPoint {
  time: number;
  value: number;
  basisValue: number;
  livePnl: number;
  projectedPnl: number;
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

/**
 * Whether this user's goals on the device hold a change the server never received
 * (saved offline, or the POST failed). Stored as the owner's id so a flag left by one
 * account never makes another account's device copy win over its server copy.
 */
export async function isSavingsGoalUnsynced(userId: string): Promise<boolean> {
  return (await AsyncStorage.getItem(KEYS.SAVINGS_GOAL_UNSYNCED)) === userId;
}

export async function setSavingsGoalUnsynced(userId: string, unsynced: boolean): Promise<void> {
  if (unsynced) await AsyncStorage.setItem(KEYS.SAVINGS_GOAL_UNSYNCED, userId);
  else if ((await AsyncStorage.getItem(KEYS.SAVINGS_GOAL_UNSYNCED)) === userId) {
    await AsyncStorage.removeItem(KEYS.SAVINGS_GOAL_UNSYNCED);
  }
}

export async function getTrackedBets(): Promise<TrackedBet[]> {
  const val = await AsyncStorage.getItem(KEYS.BETS);
  if (!val) return [];
  return parseJsonAs(val, isArrayOf(isTrackedBet)) ?? [];
}

export async function saveTrackedBets(bets: TrackedBet[]): Promise<void> {
  await AsyncStorage.setItem(KEYS.BETS, JSON.stringify(bets));
  await noteLocalWrite('bets');
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
  await noteLocalWrite('portfolioProgress');
  return bounded;
}

export async function getOnboardingComplete(): Promise<boolean> {
  return (await AsyncStorage.getItem(KEYS.ONBOARDING)) === 'true';
}

export async function setOnboardingComplete(): Promise<void> {
  await AsyncStorage.setItem(KEYS.ONBOARDING, 'true');
}

// ── Early access ─────────────────────────────────────────────────────────────
// Device-level, like the onboarding flag: the code is what buys entry, so once
// it has been entered on a device it is not asked for again on that device —
// including after a sign-out and back in as someone else.

export async function getEarlyAccessGranted(): Promise<boolean> {
  return (await AsyncStorage.getItem(KEYS.EARLY_ACCESS)) === 'true';
}

export async function setEarlyAccessGranted(): Promise<void> {
  await AsyncStorage.setItem(KEYS.EARLY_ACCESS, 'true');
}

// ── First-run answers ────────────────────────────────────────────────────────
// The parts of onboarding the server profile has no column for. One blob,
// sanitized on read, so a new question needs neither a key nor a migration.

export async function getOnboardingProfile(): Promise<OnboardingProfile> {
  const raw = await AsyncStorage.getItem(KEYS.ONBOARDING_PROFILE);
  return sanitizeOnboardingProfile(raw ? parseJson(raw) : null);
}

/** Merge a patch over what's stored and return the resulting full object. */
export async function updateOnboardingProfile(patch: Partial<OnboardingProfile>): Promise<OnboardingProfile> {
  const next = sanitizeOnboardingProfile({ ...(await getOnboardingProfile()), ...patch });
  await AsyncStorage.setItem(KEYS.ONBOARDING_PROFILE, JSON.stringify(next));
  await noteLocalWrite('onboardingProfile');
  return next;
}

// ── Dev: replay the first-run funnel ─────────────────────────────────────────
// Clearing the two local keys is not enough on its own: `profile_completed_at`
// lives on the server, so the router would still skip the quiz. This flag makes
// index.tsx ignore that column for one run through, and building-plan clears it
// once the funnel has been completed again. Only ever set from a `__DEV__` build.

export async function getDevReplayFunnel(): Promise<boolean> {
  return (await AsyncStorage.getItem(KEYS.DEV_REPLAY_FUNNEL)) === 'true';
}

export async function clearDevReplayFunnel(): Promise<void> {
  await AsyncStorage.removeItem(KEYS.DEV_REPLAY_FUNNEL);
}

/**
 * Wipes the first-run state so the carousel, the greeting, and the quiz all run
 * again from the top. Deliberately leaves goals, saved routes, and settings
 * alone — this is for looking at the funnel, not for emptying the app.
 */
export async function resetOnboardingForDev(): Promise<void> {
  await AsyncStorage.multiRemove([KEYS.ONBOARDING, KEYS.ONBOARDING_PROFILE]);
  await AsyncStorage.setItem(KEYS.DEV_REPLAY_FUNNEL, 'true');
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
  await noteLocalWrite('savedRoutes');
}

export async function getBiometricLockEnabled(): Promise<boolean> {
  return (await AsyncStorage.getItem(KEYS.BIOMETRIC_LOCK)) === 'true';
}

export async function setBiometricLockEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(KEYS.BIOMETRIC_LOCK, String(enabled));
}
