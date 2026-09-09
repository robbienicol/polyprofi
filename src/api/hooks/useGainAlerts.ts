import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { getAlertLedger, saveAlertLedger } from '@/api/client/storage';
import { deviceQuery } from '@/api/query-client';
import { useGoalsProgress } from '@/api/hooks/useGoalProgress';
import { usePortfolioProgress } from '@/api/hooks/usePortfolioProgress';
import { useSavingsGoal } from '@/api/hooks/useSavingsGoal';
import { useTrackedBets } from '@/api/hooks/useTrackedBets';
import { EMPTY_LEDGER, selectAlert, recordAlert, type AlertCandidate, type AlertLedger, type GoalSnapshot } from '@/lib/gain-alerts';
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
 * The ledger lives in the query cache rather than being re-read from disk on
 * each tick. That is what stops the same alert going out twice: the price refresh
 * ticks every 60 seconds, and an async read-then-write let two ticks both see a
 * ledger the other had not written yet. The optimistic write lands in the cache
 * synchronously, so the next tick already sees the alert as sent.
 */
function alertLedgerKey() {
  return ['ALERT_LEDGER'] as const;
}
export function useGainAlerts(): void {
  const queryClient = useQueryClient();
  const { bets } = useTrackedBets();
  const { allGoals } = useSavingsGoal();
  const { positionById } = usePortfolioProgress(0, { recordHistory: false });
  const { byGoalId } = useGoalsProgress(allGoals);

  const { data: ledger } = useQuery({
    queryKey: alertLedgerKey(),
    queryFn: getAlertLedger,
    ...deviceQuery,
  });

  const { mutate: recordSent } = useMutation({
    mutationFn: (next: AlertLedger) => saveAlertLedger(next),
    onMutate: (next) => {
      const previous = queryClient.getQueryData<AlertLedger>(alertLedgerKey());
      queryClient.setQueryData(alertLedgerKey(), next);
      return { previous };
    },
    // A ledger that failed to persist must go back, or the day's quota is spent
    // on an alert that was never actually recorded.
    onError: (_error, _next, context) => {
      queryClient.setQueryData(alertLedgerKey(), context?.previous ?? EMPTY_LEDGER);
    },
  });

  useEffect(() => {
    // Nothing may be sent before the ledger is known — that is the only record of
    // what has already gone out today.
    if (!ledger) return;

    const positions = Object.values(positionById);
    const goals: GoalSnapshot[] = allGoals.flatMap((goal) => {
      // An open-ended goal has no finish line, so it has no milestones either.
      if (!goal.targetAmount || goal.achievedAt) return [];
      return [{ goalId: goal.id, netGain: byGoalId[goal.id]?.netGain ?? 0, targetAmount: goal.targetAmount }];
    });
    if (positions.length === 0 && goals.length === 0) return;

    const now = new Date();
    const candidate = selectAlert({ positions, goals, ledger, now });
    if (!candidate) return;

    // The ledger is written BEFORE the notification goes out. A push that fails
    // is a missed alert; a ledger that fails is the same alert every minute
    // forever, so the write is the one that must not be skipped.
    recordSent(recordAlert(ledger, candidate, now), {
      onSuccess: () => void send(candidate, bets, allGoals),
    });
  }, [positionById, allGoals, byGoalId, bets, ledger, recordSent]);
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
