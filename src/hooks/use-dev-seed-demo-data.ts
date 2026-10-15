import { useAuth } from '@clerk/clerk-expo';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';

import { clearSpendingCuts, saveSpendingCuts, saveTrackedBets, setSavingsGoalState } from '@/api/client/storage';
import { apiBaseUrl } from '@/lib/api-base-url';
import { isArrayOf, isRecord, isSpendingCut, parseJson } from '@/lib/runtime-validation';
import { GOAL_ACCOUNTING_VERSION } from '@/lib/savings-goal';
import type { SpendingCut } from '@/lib/spending-cut-routes';
import type { SavingsGoal, SavingsGoalState, TrackedBet } from '@/types/bets';

const DAY_MS = 24 * 60 * 60 * 1_000;
const daysAgo = (days: number): string => new Date(Date.now() - days * DAY_MS).toISOString();

const GOAL_EMERGENCY = 'demo-goal-emergency';
const GOAL_JAPAN = 'demo-goal-japan';

function demoGoals(): SavingsGoal[] {
  return [
    { id: GOAL_EMERGENCY, label: 'Emergency fund', emoji: '🛟', targetAmount: 5_000, createdAt: daysAgo(26) },
    { id: GOAL_JAPAN, label: 'Trip to Japan', emoji: '🗾', targetAmount: 3_000, createdAt: daysAgo(19) },
  ];
}

function demoBet(overrides: Partial<TrackedBet> & Pick<TrackedBet, 'id' | 'category' | 'emoji' | 'description' | 'platform' | 'strategy' | 'amountWagered' | 'createdAt'>): TrackedBet {
  return {
    riskLevel: 2,
    probability: 60,
    expectedReturn: Math.round(overrides.amountWagered * 0.15),
    status: 'active',
    ...overrides,
  };
}

/**
 * Eight positions spread across the two demo goals, aged a couple of weeks so
 * the dashboards read as a used account rather than a fresh one:
 *
 * - Two stocks (AAPL, VOO) — priced live off the real quote feed, so these
 *   genuinely move with the market rather than a scripted number.
 * - Two Treasury/savings positions — accrue deterministically from elapsed
 *   time, so they show real, if modest, gains no matter when this runs.
 * - Two active Polymarket positions: one on a real, currently-open market (see
 *   below) so it prices live; one with no matching market, which is the
 *   ordinary "no live price yet" case real positions hit too.
 * - One resolved won, one resolved lost, so the resolved-position math and
 *   copy have something to add up.
 */
function demoBets(): TrackedBet[] {
  return [
    demoBet({
      id: 'demo-aapl',
      goalId: GOAL_EMERGENCY,
      category: 'Stocks & ETFs',
      emoji: '📈',
      description: 'Put $1,200 in AAPL at $232',
      platform: 'Robinhood',
      strategy: 'Buy AAPL at $232',
      amountWagered: 1_200,
      costBasis: 1_200,
      assetSymbol: 'AAPL',
      assetEntryPrice: 232,
      createdAt: daysAgo(19),
    }),
    demoBet({
      id: 'demo-voo',
      goalId: GOAL_JAPAN,
      category: 'Stocks & ETFs',
      emoji: '📈',
      description: 'Put $1,800 in VOO at $555',
      platform: 'Robinhood',
      strategy: 'Buy VOO at $555',
      amountWagered: 1_800,
      costBasis: 1_800,
      assetSymbol: 'VOO',
      assetEntryPrice: 555,
      createdAt: daysAgo(26),
    }),
    demoBet({
      id: 'demo-tbill',
      goalId: GOAL_EMERGENCY,
      category: 'Savings & Treasuries',
      emoji: '🏦',
      description: 'Put $2,000 in a 13-week T-Bill at 4.6% APY',
      platform: 'Robinhood',
      strategy: '13-week T-Bill at 4.6% APY',
      amountWagered: 2_000,
      costBasis: 2_000,
      annualYieldPct: 4.6,
      maturesInDays: 91,
      createdAt: daysAgo(22),
    }),
    demoBet({
      id: 'demo-hysa',
      goalId: GOAL_JAPAN,
      category: 'Savings & Treasuries',
      emoji: '🏦',
      description: 'Put $1,000 in a high-yield savings account at 4.1% APY',
      platform: 'Robinhood',
      strategy: 'High-yield savings at 4.1% APY',
      amountWagered: 1_000,
      costBasis: 1_000,
      annualYieldPct: 4.1,
      createdAt: daysAgo(15),
    }),
    // Real, currently-open market — priced live off the actual Polymarket book,
    // so this one's P&L is genuine, not scripted. Bought (fictionally) at 40¢
    // on the No side; swap the slug in lib/preferences-adjacent demo data if
    // this market closes.
    demoBet({
      id: 'demo-poly-live',
      goalId: GOAL_EMERGENCY,
      category: 'Polymarket',
      emoji: '🔮',
      description: 'Buy No on “Will J.D. Vance win the 2028 Republican presidential nomination?” at 40¢',
      platform: 'Polymarket',
      strategy: 'Buy No at 40¢',
      amountWagered: 300,
      costBasis: 300,
      entryPrice: 0.4,
      line: 'No 40¢',
      sourceSlug: 'will-jd-vance-win-the-2028-republican-presidential-nomination',
      outcomeSide: 'No',
      createdAt: daysAgo(12),
    }),
    // No matching market on purpose — the ordinary case where a tracked pick's
    // market has renamed, delisted, or was never findable. Shows "unavailable"
    // pricing rather than a fabricated one, same as it would for a real user.
    demoBet({
      id: 'demo-poly-unmatched',
      goalId: GOAL_JAPAN,
      category: 'Polymarket',
      emoji: '🔮',
      description: 'Buy Yes on “Will mortgage rates drop below 5% in 2026?” at 55¢',
      platform: 'Polymarket',
      strategy: 'Buy Yes at 55¢',
      amountWagered: 250,
      costBasis: 250,
      entryPrice: 0.55,
      line: 'Yes 55¢',
      outcomeSide: 'Yes',
      createdAt: daysAgo(9),
    }),
    demoBet({
      id: 'demo-poly-won',
      goalId: GOAL_EMERGENCY,
      category: 'Polymarket',
      emoji: '🔮',
      description: 'Buy Yes on “Will the Fed cut rates at its September meeting?” at 62¢',
      platform: 'Polymarket',
      strategy: 'Buy Yes at 62¢',
      amountWagered: 400,
      costBasis: 400,
      entryPrice: 0.62,
      expectedReturn: 245,
      status: 'won',
      createdAt: daysAgo(24),
    }),
    demoBet({
      id: 'demo-poly-lost',
      goalId: GOAL_JAPAN,
      category: 'Polymarket',
      emoji: '🔮',
      description: 'Buy Yes on “Will it snow in NYC before December?” at 35¢',
      platform: 'Polymarket',
      strategy: 'Buy Yes at 35¢',
      amountWagered: 300,
      costBasis: 300,
      entryPrice: 0.35,
      status: 'lost',
      createdAt: daysAgo(17),
    }),
  ];
}

/**
 * The cuts detected in YOUR OWN statement, read from `EXPO_PUBLIC_DEV_SPENDING_CUTS`
 * and written there by `bun run seed:statement`.
 *
 * Nothing is invented here, and that is the point: an earlier version of this file
 * hand-wrote plausible-looking cuts, and a "Cancel Netflix" for a subscription the
 * user did not have read as the detector being broken rather than as demo data. So
 * the seed either replays a real statement or seeds no cuts at all.
 *
 * The env var holds the detected cuts only — never the transactions — and `.env` is
 * gitignored, so no real spending reaches a tracked file. Returns null when it is
 * unset, malformed, or empty, which is the ordinary case on a clean checkout.
 */
function statementSpendingCuts(): { cuts: SpendingCut[]; monthsCovered: number; transactionCount: number } | null {
  const raw = process.env.EXPO_PUBLIC_DEV_SPENDING_CUTS;
  if (!raw) return null;
  const parsed = parseJson(raw);
  if (!isRecord(parsed) || !isArrayOf(isSpendingCut)(parsed.cuts) || parsed.cuts.length === 0) {
    console.warn('[dev-seed] EXPO_PUBLIC_DEV_SPENDING_CUTS is set but unreadable — run: bun run seed:statement');
    return null;
  }
  return {
    cuts: parsed.cuts,
    monthsCovered: typeof parsed.monthsCovered === 'number' ? parsed.monthsCovered : 0,
    transactionCount: typeof parsed.transactionCount === 'number' ? parsed.transactionCount : 0,
  };
}

/**
 * Fills the signed-in dev account with a few weeks of history — two goals,
 * eight positions across stocks, Treasuries and Polymarket, some up, some
 * down, some flat — so the "been using it a while" screens (Home, Portfolio,
 * Positions, Goals) have something real to look at instead of an empty state.
 *
 * Gated on `__DEV__`, same as useDevResetOnboarding. Overwrites the signed-in
 * account's tracked positions and goals — meant for a disposable dev account,
 * not one with anything you want to keep.
 */
export function useDevSeedDemoData(): {
  available: boolean;
  loading: boolean;
  run: () => Promise<void>;
  clear: () => Promise<void>;
} {
  const { userId, getToken, isSignedIn } = useAuth();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);

  const pushGoals = useCallback(async (state: SavingsGoalState) => {
    await setSavingsGoalState(state, isSignedIn ? userId ?? undefined : undefined);
    if (isSignedIn) {
      const token = await getToken();
      await fetch(`${apiBaseUrl()}/api/savings-goal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token ?? ''}` },
        body: JSON.stringify(state),
      }).catch(() => {});
    }
    await queryClient.invalidateQueries({ queryKey: ['SAVINGS_GOAL', isSignedIn ? userId : 'local'] });
  }, [getToken, isSignedIn, queryClient, userId]);

  const run = useCallback(async () => {
    if (!__DEV__ || loading) return;
    setLoading(true);
    try {
      await saveTrackedBets(demoBets());
      // Only when a real statement has been staged into .env; never invented.
      const statement = statementSpendingCuts();
      if (statement) await saveSpendingCuts({ ...statement, importedAt: Date.now() });
      await pushGoals({ goals: demoGoals(), achievedCount: 0, accountingVersion: GOAL_ACCOUNTING_VERSION });
      await queryClient.invalidateQueries({ queryKey: ['TRACKED_BETS'] });
      await queryClient.invalidateQueries({ queryKey: ['SPENDING_CUTS'] });
    } finally {
      setLoading(false);
    }
  }, [loading, pushGoals, queryClient]);

  const clear = useCallback(async () => {
    if (!__DEV__ || loading) return;
    setLoading(true);
    try {
      await saveTrackedBets([]);
      await clearSpendingCuts();
      await pushGoals({ goals: [], achievedCount: 0, accountingVersion: GOAL_ACCOUNTING_VERSION });
      await queryClient.invalidateQueries({ queryKey: ['TRACKED_BETS'] });
      await queryClient.invalidateQueries({ queryKey: ['SPENDING_CUTS'] });
    } finally {
      setLoading(false);
    }
  }, [loading, pushGoals, queryClient]);

  return { available: __DEV__, loading, run, clear };
}
