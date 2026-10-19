import AsyncStorage from '@react-native-async-storage/async-storage';

import { KEYS } from '@/api/client/storage-keys';
import type { GenericMatch } from '@/lib/kalshi-market-match';
import type { SportsMatch } from '@/lib/sports-market-match';
import { Route } from '@/types/routes';
import {
  isArrayOf,
  isGenericMatch,
  isRecordOf,
  isRoute,
  isSportsMatch,
  parseJsonAs,
} from '@/lib/runtime-validation';

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

// ── Daily Kalshi↔Polymarket generic (non-sports) match cache ────────────────
export async function getGenericMatches(): Promise<GenericMatch[] | null> {
  const raw = await AsyncStorage.getItem(KEYS.GENERIC_MATCHES);
  if (!raw) return null;
  const cached = parseJsonAs(raw, isRecordOf(isArrayOf(isGenericMatch)));
  return cached?.[todayKey()] ?? null;
}

export async function setGenericMatches(matches: GenericMatch[]): Promise<void> {
  await AsyncStorage.setItem(KEYS.GENERIC_MATCHES, JSON.stringify({ [todayKey()]: matches }));
}
