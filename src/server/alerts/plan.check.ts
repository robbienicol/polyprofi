import { EMPTY_SERVER_LEDGER, planAlerts, type UserAlertInputs } from '@/server/alerts/plan';
import type { BetLiveStatus, SavingsGoal, TrackedBet } from '@/types/bets';

function invariant(condition: boolean, message: string): void {
  if (!condition) throw new Error(`[alert plan] ${message}`);
}

const bet: TrackedBet = {
  id: 'b1', category: 'Polymarket', emoji: '🔮', description: 'Fed holds in December', platform: 'Polymarket',
  strategy: '', riskLevel: 3, probability: 80, expectedReturn: 100, amountWagered: 400, status: 'active',
  createdAt: '2026-10-01T00:00:00Z', goalId: 'g1',
};
const goal: SavingsGoal = { id: 'g1', label: 'Trip', emoji: '✈️', targetAmount: 1000, createdAt: '2026-10-01T00:00:00Z' };
const status = (patch: Partial<BetLiveStatus>): BetLiveStatus => ({
  betId: 'b1', unrealizedPnl: 0, profitGoal: 100, profitGoalHit: false, sellRecommended: false,
  reason: '', isLive: false, fetchedAt: '2026-10-20T00:00:00Z', ...patch,
});
const base: UserAlertInputs = {
  bets: [bet], goals: [goal], statuses: [], quotes: [], ledger: EMPTY_SERVER_LEDGER, now: new Date('2026-10-20T12:00:00Z'),
};

export function __selfCheck(): void {
  // A sell nudge goes out once, then never again for that position.
  const sell = planAlerts({ ...base, statuses: [status({ sellRecommended: true, unrealizedPnl: 120 })] });
  invariant(sell.messages.some((m) => m.title === 'Goal hit — sell now'), 'a recommended sell is sent');
  const again = planAlerts({ ...base, statuses: [status({ sellRecommended: true, unrealizedPnl: 120 })], ledger: sell.ledger });
  invariant(!again.messages.some((m) => m.title === 'Goal hit — sell now'), 'the same sell is never sent twice');

  // A resolution wins over a sell nudge, and is also sent once.
  const settled = planAlerts({ ...base, statuses: [status({ sellRecommended: true, resolvedStatus: 'won' })] });
  invariant(settled.messages.length >= 1 && settled.messages[0].title.includes('Position resolved'), 'a resolved position says so');
  invariant(!settled.messages.some((m) => m.title === 'Goal hit — sell now'), 'no sell nudge for a settled position');
  invariant(planAlerts({ ...base, statuses: [status({ resolvedStatus: 'won' })], ledger: settled.ledger }).messages
    .every((m) => !m.title.includes('Position resolved')), 'a resolution is sent once');

  // Nothing to say, nothing sent — and the ledger forgets positions that no longer exist.
  const quiet = planAlerts({ ...base, statuses: [status({})] });
  invariant(quiet.messages.length === 0, 'no news is no notification');
  const forgotten = planAlerts({ ...base, bets: [], ledger: { ...EMPTY_SERVER_LEDGER, sold: ['gone'] } });
  invariant(forgotten.ledger.sold.length === 0, 'ids for deleted positions are dropped from the ledger');
}
