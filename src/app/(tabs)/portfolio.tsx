import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useMemo } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useGoalsProgress } from '@/api/hooks/useGoalProgress';
import { usePortfolioProgress } from '@/api/hooks/usePortfolioProgress';
import { useSavedRoutes } from '@/api/hooks/useSavedRoutes';
import { useSavingsGoal } from '@/api/hooks/useSavingsGoal';
import { useTrackedBets } from '@/api/hooks/useTrackedBets';
import { PortfolioOverview } from '@/components/portfolio/PortfolioOverview';
import { ThemedText } from '@/components/themed-text';
import { Brand, Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { goalRemaining } from '@/lib/savings-goal';

/**
 * Every position across every goal. The per-goal breakdown lives in the Goals
 * tab; this is the rollup.
 */
export default function PortfolioScreen(): React.ReactElement {
  const theme = useTheme();
  const router = useRouter();
  const { bets: allBets } = useTrackedBets();
  const { history } = useSavedRoutes();
  const { goals: allGoals } = useSavingsGoal();

  // Goals ticked on the Goals tab. Absent means the whole portfolio, which is what
  // this screen is for; a selection narrows every number on it to those goals.
  const { goalIds } = useLocalSearchParams<{ goalIds?: string }>();
  const selectedGoalIds = useMemo(
    () => new Set((goalIds ?? '').split(',').map((id) => id.trim()).filter(Boolean)),
    [goalIds],
  );
  const scoped = selectedGoalIds.size > 0;
  const goals = useMemo(
    () => (scoped ? allGoals.filter((goal) => selectedGoalIds.has(goal.id)) : allGoals),
    [allGoals, scoped, selectedGoalIds],
  );
  const bets = useMemo(
    () => (scoped ? allBets.filter((bet) => bet.goalId != null && selectedGoalIds.has(bet.goalId)) : allBets),
    [allBets, scoped, selectedGoalIds],
  );
  const goalsProgress = useGoalsProgress(goals);

  const latestSearch = history[0] ?? null;
  const fallbackCash = latestSearch?.quizSnapshot.balance ?? 0;
  // The same measurement Home shows, so the two screens can't disagree about what
  // the portfolio is worth. A scoped view values only the selected goals' positions
  // and never writes to the stored history, which is the whole portfolio's series.
  const scopeToBets = useCallback(
    (candidates: typeof allBets) => candidates.filter(
      (bet) => bet.goalId != null && selectedGoalIds.has(bet.goalId),
    ),
    [selectedGoalIds],
  );
  const progress = usePortfolioProgress(
    fallbackCash,
    scoped ? { scopeToBets, recordHistory: false } : {},
  );
  const activeBets = useMemo(() => bets.filter((bet) => bet.status === 'active'), [bets]);
  const staked = activeBets.reduce((sum, bet) => sum + bet.amountWagered, 0);

  // What this portfolio is worth if every goal lands: what's staked plus what the
  // goals still need. Goals own the targets now, so there is no second target to
  // reconcile against. Open-ended goals add nothing — they have no finish line.
  const outstanding = goals.reduce(
    (sum, goal) => sum + goalRemaining(goalsProgress.progressFor(goal.id).netGain, goal),
    0,
  );
  const targetValue = outstanding > 0 ? staked + outstanding : null;

  return (
    <View className="flex-1" style={{ backgroundColor: theme.background }}>
      <SafeAreaView className="flex-1">
        <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="px-4 pt-4 pb-16 gap-4">
          <View style={{ paddingHorizontal: 2 }}>
            <ThemedText style={{ fontSize: 11, fontWeight: '900', color: Brand[500], letterSpacing: 1.1 }}>
              PORTFOLIO
            </ThemedText>
            <ThemedText style={{ fontSize: 26, fontWeight: '800', color: theme.text, letterSpacing: -0.5, marginTop: 3 }}>
              {activeBets.length > 0
                ? `${activeBets.length} position${activeBets.length === 1 ? '' : 's'} working`
                : 'Nothing working yet'}
            </ThemedText>
            {scoped ? (
              <View className="flex-row items-center" style={{ gap: 8, marginTop: 5 }}>
                <ThemedText style={{ fontSize: 12, color: theme.textSecondary }}>
                  {goals.length} selected goal{goals.length === 1 ? '' : 's'}
                </ThemedText>
                <Pressable
                  onPress={() => router.setParams({ goalIds: '' })}
                  accessibilityRole="button"
                  hitSlop={8}
                  className="active:opacity-60"
                  style={{ borderRadius: Radius.pill, borderWidth: 1, borderColor: theme.border, paddingHorizontal: 10, paddingVertical: 3 }}>
                  <ThemedText style={{ fontSize: 11, fontWeight: '800', color: Brand[500] }}>Show all</ThemedText>
                </Pressable>
              </View>
            ) : goals.length > 1 && activeBets.length > 0 ? (
              <ThemedText style={{ fontSize: 12, color: theme.textSecondary, marginTop: 3 }}>
                Across all {goals.length} goals
              </ThemedText>
            ) : null}
          </View>

          <PortfolioOverview
            bets={bets}
            fallbackCash={fallbackCash}
            targetValue={targetValue}
            valueNow={{
              value: progress.value,
              netPnl: progress.goalProgress,
              livePositions: progress.livePositions,
              projectedPositions: progress.projectedPositions,
            }}
            historyPoints={progress.points}
            onFindRoutes={() => router.push('/(tabs)/routes')}
            onOpenPositions={() => router.push('/positions')}
          />

          <ThemedText style={{ fontSize: 11, color: theme.textTertiary, textAlign: 'center', opacity: 0.6 }}>
            AI-generated · Not financial advice · Informational only
          </ThemedText>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
