import type { AlertCandidate } from '@/lib/gain-alerts';
import type { BetLiveStatus, TrackedBet } from '@/types/bets';

/**
 * The words of every alert, in one place. The device sends them as local notifications
 * while the app is open; the server sends the same text as push notifications while
 * it is closed. Written once so the two can never drift apart.
 *
 * `url` is what the notification observer in _layout routes to when tapped.
 */

export interface AlertMessage {
  title: string;
  body: string;
  url?: string;
}

interface GoalLabel {
  id: string;
  label: string;
  emoji: string;
  targetAmount?: number;
}

function shortDescription(bet: TrackedBet): string {
  return bet.description.length > 80 ? `${bet.description.slice(0, 80)}…` : bet.description;
}

export function sellMessage(status: Pick<BetLiveStatus, 'unrealizedPnl' | 'profitGoal'>, bet?: TrackedBet): AlertMessage {
  return {
    title: 'Goal hit — sell now',
    body: bet
      ? `Your ${bet.category} position is up $${status.unrealizedPnl.toFixed(0)}. Lock in your $${status.profitGoal} target on ${bet.platform}.`
      : `You're up $${status.unrealizedPnl.toFixed(0)} — sell to lock in your profit.`,
  };
}

export function resolvedMessage(bet: TrackedBet, outcome: 'won' | 'lost'): AlertMessage {
  const verb = outcome === 'won' ? 'won' : "didn't hit";
  return {
    title: `${bet.emoji} Position resolved`,
    body: `${shortDescription(bet)} — you ${verb}.`,
  };
}

/** Carries no deep link: the congratulations screen opens from saved goal state. */
export function goalReachedMessage(goal: Omit<GoalLabel, 'id'>): AlertMessage {
  return {
    title: `${goal.emoji} Goal reached — ${goal.label}!`,
    body: `Your gains just covered your $${(goal.targetAmount ?? 0).toLocaleString()} goal. Open the app to celebrate and pick your next one.`,
  };
}

/**
 * The day's one piece of good news. The `celebrate` flag tells the destination this
 * arrival was good news, so it can ask for a rating on the back of it.
 */
export function goodNewsMessage(candidate: AlertCandidate, bets: TrackedBet[], goals: GoalLabel[]): AlertMessage {
  if (candidate.kind === 'position') {
    const bet = bets.find((entry) => entry.id === candidate.betId);
    const gain = Math.round(candidate.gain).toLocaleString();
    return {
      title: `${bet?.emoji ?? '📈'} Up $${gain}`,
      body: bet
        ? `Your ${bet.category} position is up ${Math.round(candidate.returnPct)}%. Tap to see where it stands.`
        : `One of your positions is up ${Math.round(candidate.returnPct)}%. Tap to see where it stands.`,
      url: `/positions?betId=${encodeURIComponent(candidate.betId)}&celebrate=1`,
    };
  }
  const goal = goals.find((entry) => entry.id === candidate.goalId);
  const remaining = Math.max(0, Math.round(candidate.targetAmount - candidate.netGain)).toLocaleString();
  return {
    title: `${goal?.emoji ?? '🎯'} ${candidate.milestone}% of the way there`,
    body: goal
      ? `${goal.label} is $${remaining} away. Tap to see what got you here.`
      : `You are $${remaining} from your goal. Tap to see what got you here.`,
    url: `/goal/${encodeURIComponent(candidate.goalId)}?celebrate=1`,
  };
}
