import { fetchAllBetStatuses } from '@/api/client/bet-monitor';
import { stockIdentity } from '@/lib/portfolio-progress';
import { sanitizePreferences } from '@/lib/preferences';
import { isArrayOf, isRecord, isSavingsGoalState, isTrackedBet } from '@/lib/runtime-validation';
import { migrateSavingsGoalState } from '@/lib/savings-goal';
import { isStockOrEtfCategory } from '@/lib/tracked-assets';
import { EMPTY_SERVER_LEDGER, planAlerts, type ServerAlertLedger } from '@/server/alerts/plan';
import { sendPush, type PushMessage } from '@/server/alerts/push';
import { alertInputsFor, pushUsersDue, saveAlertLedger, type PushUser } from '@/server/alerts/queries';
import { liveQuotes } from '@/server/market/quotes';
import type { SavingsGoal, TrackedBet } from '@/types/bets';

/**
 * One scheduled pass over users with a push token: load what they hold, check it
 * against live prices, send what's due, remember what was sent.
 *
 * Takes the users who have waited longest, a batch at a time, so a run stays short
 * however many users there are; each run picks up where the last one left off.
 */
const USERS_PER_RUN = 25;

interface UserAlertData {
  bets: TrackedBet[];
  goals: SavingsGoal[];
  alertsOn: boolean;
}

function readLedger(value: unknown): ServerAlertLedger {
  if (!isRecord(value)) return EMPTY_SERVER_LEDGER;
  return { ...EMPTY_SERVER_LEDGER, ...(value as Partial<ServerAlertLedger>) };
}

/** The stored rows, validated into what the alert rules work with. */
async function loadUser(clerkId: string): Promise<UserAlertData> {
  const { blobs, goalState } = await alertInputsFor(clerkId);
  return {
    bets: isArrayOf(isTrackedBet)(blobs.bets) ? blobs.bets : [],
    goals: isSavingsGoalState(goalState) ? migrateSavingsGoalState(goalState).state.goals : [],
    alertsOn: sanitizePreferences(blobs.preferences).positionAlerts,
  };
}

/** Checks one user; returns the push messages that are due. */
async function alertsFor(user: PushUser, now: Date): Promise<PushMessage[]> {
  const ledger = readLedger(user.ledger);
  const { bets, goals, alertsOn } = await loadUser(user.clerkId);
  const active = bets.filter((bet) => bet.status === 'active');
  if (!alertsOn || (active.length === 0 && goals.length === 0)) {
    await saveAlertLedger(user.clerkId, ledger);
    return [];
  }

  const symbols = active
    .filter((bet) => isStockOrEtfCategory(bet.category))
    .map((bet) => stockIdentity(bet).symbol)
    .filter((symbol): symbol is string => Boolean(symbol));
  const [statuses, quotes] = await Promise.all([fetchAllBetStatuses(active), liveQuotes(symbols)]);
  const plan = planAlerts({ bets, goals, statuses, quotes, ledger, now });

  // The ledger is saved BEFORE sending: a push that fails is one missed alert, a
  // ledger that fails is the same alert every ten minutes forever.
  await saveAlertLedger(user.clerkId, plan.ledger);
  return plan.messages.flatMap((message) => user.tokens.map((to) => ({ ...message, to })));
}

export async function runAlertBatch(now = new Date()): Promise<{ checked: number; sent: number }> {
  const users = await pushUsersDue(USERS_PER_RUN);

  const results = await Promise.allSettled(users.map((user) => alertsFor(user, now)));
  const messages = results.flatMap((result) => (result.status === 'fulfilled' ? result.value : []));
  for (const result of results) {
    if (result.status === 'rejected') console.warn(`[alerts] user check failed: ${String(result.reason)}`);
  }
  await sendPush(messages);
  return { checked: users.length, sent: messages.length };
}
