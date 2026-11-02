import type { TrackedAssetQuote } from '@/api/client/yahoo-quote';
import {
  goalReachedMessage,
  goodNewsMessage,
  resolvedMessage,
  sellMessage,
  type AlertMessage,
} from '@/lib/alert-messages';
import { EMPTY_LEDGER, recordAlert, selectAlert, type AlertLedger, type GoalSnapshot } from '@/lib/gain-alerts';
import { progressByGoal } from '@/lib/goal-progress';
import { calculatePortfolioProgress } from '@/lib/portfolio-progress';
import type { BetLiveStatus, SavingsGoal, TrackedBet } from '@/types/bets';

/**
 * Decides which alerts one user should get right now, and what to remember so none
 * of them repeat. Pure: the caller supplies the data and does the sending, so the
 * rules can be read (and tested) without a database or a network.
 *
 * The same rules the device applies while open: a sell nudge and a resolution notice
 * once per position, "goal reached" once per goal, and at most one piece of good news
 * a day (see @/lib/gain-alerts).
 */

export interface ServerAlertLedger {
  /** The once-a-day good-news ledger, shared with the device's own logic. */
  gain: AlertLedger;
  /** Positions already told to sell. */
  sold: string[];
  /** Positions already reported as resolved. */
  resolved: string[];
  /** Goals already reported as reached. */
  goalsReached: string[];
}

export const EMPTY_SERVER_LEDGER: ServerAlertLedger = { gain: EMPTY_LEDGER, sold: [], resolved: [], goalsReached: [] };

export interface UserAlertInputs {
  bets: TrackedBet[];
  goals: SavingsGoal[];
  statuses: BetLiveStatus[];
  quotes: TrackedAssetQuote[];
  ledger: ServerAlertLedger;
  now: Date;
}

export function planAlerts({ bets, goals, statuses, quotes, ledger, now }: UserAlertInputs): {
  messages: AlertMessage[];
  ledger: ServerAlertLedger;
} {
  const messages: AlertMessage[] = [];
  const active = bets.filter((bet) => bet.status === 'active');
  const statusById = Object.fromEntries(statuses.map((status) => [status.betId, status]));
  const sold = new Set(ledger.sold);
  const resolved = new Set(ledger.resolved);
  const goalsReached = new Set(ledger.goalsReached);

  for (const bet of active) {
    const status = statusById[bet.id];
    if (!status) continue;
    if (status.resolvedStatus && !resolved.has(bet.id)) {
      messages.push(resolvedMessage(bet, status.resolvedStatus));
      resolved.add(bet.id);
    } else if (status.sellRecommended && !sold.has(bet.id)) {
      messages.push(sellMessage(status, bet));
      sold.add(bet.id);
    }
  }

  const nowMs = now.getTime();
  const progress = progressByGoal(goals, bets, active, statusById, quotes, nowMs);
  const openGoals = goals.filter((goal) => goal.targetAmount && !goal.achievedAt);
  for (const goal of openGoals) {
    if (goalsReached.has(goal.id) || (progress[goal.id]?.netGain ?? 0) < goal.targetAmount!) continue;
    messages.push(goalReachedMessage(goal));
    goalsReached.add(goal.id);
  }

  const { positionById } = calculatePortfolioProgress({ active, fallbackBalance: 0, statusesById: statusById, quotes, now: nowMs });
  const snapshots: GoalSnapshot[] = openGoals
    .filter((goal) => !goalsReached.has(goal.id))
    .map((goal) => ({ goalId: goal.id, netGain: progress[goal.id]?.netGain ?? 0, targetAmount: goal.targetAmount! }));
  const goodNews = selectAlert({ positions: Object.values(positionById), goals: snapshots, ledger: ledger.gain, now });
  if (goodNews) messages.push(goodNewsMessage(goodNews, bets, goals));

  // Only ids still worth remembering, so the ledger can't grow forever.
  const known = new Set([...bets.map((bet) => bet.id), ...goals.map((goal) => goal.id)]);
  return {
    messages,
    ledger: {
      gain: goodNews ? recordAlert(ledger.gain, goodNews, now) : ledger.gain,
      sold: [...sold].filter((id) => known.has(id)),
      resolved: [...resolved].filter((id) => known.has(id)),
      goalsReached: [...goalsReached].filter((id) => known.has(id)),
    },
  };
}
