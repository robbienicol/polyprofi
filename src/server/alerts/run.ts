import { fetchAllBetStatuses } from '@/api/client/bet-monitor';
import { stockIdentity } from '@/lib/portfolio-progress';
import { sanitizePreferences } from '@/lib/preferences';
import { isArrayOf, isRecord, isSavingsGoalState, isTrackedBet } from '@/lib/runtime-validation';
import { migrateSavingsGoalState } from '@/lib/savings-goal';
import { isStockOrEtfCategory } from '@/lib/tracked-assets';
import { EMPTY_SERVER_LEDGER, planAlerts, type ServerAlertLedger } from '@/server/alerts/plan';
import { sendPush, type PushMessage } from '@/server/alerts/push';
import { sql } from '@/server/db';
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

interface PushUser {
  clerk_id: string;
  tokens: string[];
  ledger: unknown;
}

interface UserRows {
  bets: TrackedBet[];
  goals: SavingsGoal[];
  alertsOn: boolean;
}

function readLedger(value: unknown): ServerAlertLedger {
  if (!isRecord(value)) return EMPTY_SERVER_LEDGER;
  return { ...EMPTY_SERVER_LEDGER, ...(value as Partial<ServerAlertLedger>) };
}

async function loadUser(clerkId: string): Promise<UserRows> {
  const [blobRows, userRows] = await Promise.all([
    sql`SELECT key, value FROM user_data WHERE clerk_id = ${clerkId} AND key IN ('bets', 'preferences')`,
    sql`SELECT savings_goal_state FROM users WHERE clerk_id = ${clerkId}`,
  ]);
  const blobs = blobRows as { key: string; value: unknown }[];
  const users = userRows as { savings_goal_state: unknown }[];
  const blob = (key: string) => blobs.find((row) => row.key === key)?.value;
  const bets = blob('bets');
  const goalState = users[0]?.savings_goal_state;
  return {
    bets: isArrayOf(isTrackedBet)(bets) ? bets : [],
    goals: isSavingsGoalState(goalState) ? migrateSavingsGoalState(goalState).state.goals : [],
    alertsOn: sanitizePreferences(blob('preferences')).positionAlerts,
  };
}

async function saveLedger(clerkId: string, ledger: ServerAlertLedger): Promise<void> {
  await sql`
    INSERT INTO alert_state (clerk_id, ledger, checked_at)
    VALUES (${clerkId}, ${JSON.stringify(ledger)}::jsonb, now())
    ON CONFLICT (clerk_id) DO UPDATE SET ledger = EXCLUDED.ledger, checked_at = EXCLUDED.checked_at
  `;
}

/** Checks one user; returns the push messages that are due. */
async function alertsFor(user: PushUser, now: Date): Promise<PushMessage[]> {
  const ledger = readLedger(user.ledger);
  const { bets, goals, alertsOn } = await loadUser(user.clerk_id);
  const active = bets.filter((bet) => bet.status === 'active');
  if (!alertsOn || (active.length === 0 && goals.length === 0)) {
    await saveLedger(user.clerk_id, ledger);
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
  await saveLedger(user.clerk_id, plan.ledger);
  return plan.messages.flatMap((message) => user.tokens.map((to) => ({ ...message, to })));
}

export async function runAlertBatch(now = new Date()): Promise<{ checked: number; sent: number }> {
  const users = (await sql`
    SELECT p.clerk_id, array_agg(p.token) AS tokens, a.ledger
    FROM push_tokens p
    LEFT JOIN alert_state a ON a.clerk_id = p.clerk_id
    GROUP BY p.clerk_id, a.ledger, a.checked_at
    ORDER BY a.checked_at ASC NULLS FIRST
    LIMIT ${USERS_PER_RUN}
  `) as PushUser[];

  const results = await Promise.allSettled(users.map((user) => alertsFor(user, now)));
  const messages = results.flatMap((result) => (result.status === 'fulfilled' ? result.value : []));
  for (const result of results) {
    if (result.status === 'rejected') console.warn(`[alerts] user check failed: ${String(result.reason)}`);
  }
  await sendPush(messages);
  return { checked: users.length, sent: messages.length };
}
