import { useEffect, useRef } from 'react';

import { getAlertLedger, saveAlertLedger } from '@/api/client/storage';
import { useGoalsProgress } from '@/api/hooks/useGoalProgress';
import { usePortfolioProgress } from '@/api/hooks/usePortfolioProgress';
import { useSavingsGoal } from '@/api/hooks/useSavingsGoal';
import { useTrackedBets } from '@/api/hooks/useTrackedBets';
import { selectAlert, recordAlert, type AlertCandidate, type GoalSnapshot } from '@/lib/gain-alerts';
import { notifyGoalMilestone, notifyPositionGain } from '@/lib/notifications';
import type { TrackedBet } from '@/types/bets';

/**
 * Watches live position and goal progress, and sends at most one piece of good
 * news per day.
 *
 * Mounted once, app-wide, alongside the other housekeeping in _layout. It rides
 * the portfolio refresh that is already running rather than polling on its own,
 * so a notification costs no extra network.
 *
 * The in-flight guard matters more than it looks: the price refresh ticks every
 * 60 seconds and the ledger write is async, so without it two ticks can both
 * read a ledger that has not been written yet and fire the same alert twice.
 */
export function useGainAlerts(): void {
  const { bets } = useTrackedBets();
  const { allGoals } = useSavingsGoal();
  const { positionById } = usePortfolioProgress(0, { recordHistory: false });
  const { byGoalId } = useGoalsProgress(allGoals);
  const sending = useRef(false);

  useEffect(() => {
    if (sending.current) return;

    const positions = Object.values(positionById);
    const goals: GoalSnapshot[] = allGoals.flatMap((goal) => {
      // An open-ended goal has no finish line, so it has no milestones either.
      if (!goal.targetAmount || goal.achievedAt) return [];
      return [{ goalId: goal.id, netGain: byGoalId[goal.id]?.netGain ?? 0, targetAmount: goal.targetAmount }];
    });
    if (positions.length === 0 && goals.length === 0) return;

    sending.current = true;
    void (async () => {
      try {
        const ledger = await getAlertLedger();
        const candidate = selectAlert({ positions, goals, ledger, now: new Date() });
        if (!candidate) return;
        // The ledger is written BEFORE the notification goes out. A push that
        // fails is a missed alert; a ledger that fails is the same alert every
        // minute forever, so the write is the one that must not be skipped.
        await saveAlertLedger(recordAlert(ledger, candidate, new Date()));
        await send(candidate, bets, allGoals);
      } finally {
        sending.current = false;
      }
    })();
  }, [positionById, allGoals, byGoalId, bets]);
}

async function send(
  candidate: AlertCandidate,
  bets: TrackedBet[],
  goals: { id: string; label: string; emoji: string }[],
): Promise<void> {
  if (candidate.kind === 'position') {
    const bet = bets.find((entry) => entry.id === candidate.betId);
    const gain = Math.round(candidate.gain).toLocaleString();
    await notifyPositionGain({
      betId: candidate.betId,
      title: `${bet?.emoji ?? '📈'} Up $${gain}`,
      body: bet
        ? `Your ${bet.category} position is up ${Math.round(candidate.returnPct)}%. Tap to see where it stands.`
        : `One of your positions is up ${Math.round(candidate.returnPct)}%. Tap to see where it stands.`,
    });
    return;
  }

  const goal = goals.find((entry) => entry.id === candidate.goalId);
  const remaining = Math.max(0, Math.round(candidate.targetAmount - candidate.netGain)).toLocaleString();
  await notifyGoalMilestone({
    goalId: candidate.goalId,
    title: `${goal?.emoji ?? '🎯'} ${candidate.milestone}% of the way there`,
    body: goal
      ? `${goal.label} is $${remaining} away. Tap to see what got you here.`
      : `You are $${remaining} from your goal. Tap to see what got you here.`,
  });
}
