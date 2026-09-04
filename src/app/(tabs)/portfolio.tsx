import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import React, { useCallback, useMemo } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useGoalsProgress } from '@/api/hooks/useGoalProgress';
import { usePortfolioProgress } from '@/api/hooks/usePortfolioProgress';
import { usePreferences } from '@/api/hooks/usePreferences';
import { useSavedRoutes } from '@/api/hooks/useSavedRoutes';
import { useSavingsGoal } from '@/api/hooks/useSavingsGoal';
import { useTrackedBets } from '@/api/hooks/useTrackedBets';
import {
  CapitalSplitCard,
  CheapestPathCard,
  GoalContributionCard,
  MaturityTimelineCard,
} from '@/components/portfolio/PortfolioInsights';
import { PortfolioOverview } from '@/components/portfolio/PortfolioOverview';
import { ThemedText } from '@/components/themed-text';
import { Brand, Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { goalRemaining, parseGoalIds } from '@/lib/savings-goal';

/**
 * Every position across every goal. The per-goal breakdown lives in the Goals
 * tab; this is the rollup.
 */
export default function PortfolioScreen(): React.ReactElement {
  const theme = useTheme();
  const router = useRouter();
  const { bets: allBets, resolveBet } = useTrackedBets();
  const { history } = useSavedRoutes();
  const { goals: allGoals } = useSavingsGoal();
  const { preferences } = usePreferences();

  // Goals ticked on the Goals tab. Absent means the whole portfolio, which is what
  // this screen is for; a selection narrows every number on it to those goals.
  const { goalIds } = useLocalSearchParams<{ goalIds?: string }>();
  const selectedGoalIds = useMemo(() => new Set(parseGoalIds(goalIds)), [goalIds]);
  // Back to the list to change the selection, carrying it so the boxes are already
  // ticked. Choosing goals belongs where the goals are; this screen only reports on
  // whichever ones were picked.
  // Always carries the parameter, empty included: arriving from the whole-portfolio
  // view means "nothing is selected", and the list has to be told that rather than
  // left showing whatever was ticked the last time it was open.
  const chooseGoals = (): void => {
    router.push(`/(tabs)/goals?selected=${[...selectedGoalIds].join(',')}` as Href);
  };
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
                <ScopeChip label="Change" onPress={chooseGoals} />
                <ScopeChip label="Show all" onPress={() => router.setParams({ goalIds: '' })} />
              </View>
            ) : allGoals.length > 1 ? (
              <View className="flex-row items-center" style={{ gap: 8, marginTop: 5 }}>
                <ThemedText style={{ fontSize: 12, color: theme.textSecondary }}>
                  Across all {allGoals.length} goals
                </ThemedText>
                <ScopeChip label="Pick goals" onPress={chooseGoals} />
              </View>
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
            positionById={progress.positionById}
            onFindRoutes={() => router.push('/(tabs)/routes')}
            onOpenPositions={() => router.push('/positions')}
            onOpenPosition={(betId) => router.push(`/positions?betId=${betId}` as Href)}
            onResolve={resolveBet}
          />

          {/* The shape of the portfolio, under the size of it. Each answers a question
              the headline cannot: what can actually be lost, what has produced the
              progress, when the money comes free, and what a dollar of progress costs. */}
          <CapitalSplitCard bets={bets} />
          <GoalContributionCard bets={bets} positionById={progress.positionById} />
          <MaturityTimelineCard bets={bets} goals={goals} />
          <CheapestPathCard
            bets={bets}
            conservative={preferences.conservativeProjections}
            remainingToGoal={outstanding > 0 ? outstanding : null}
          />

          <ThemedText style={{ fontSize: 11, color: theme.textTertiary, textAlign: 'center', opacity: 0.6 }}>
            AI-generated · Not financial advice · Informational only
          </ThemedText>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

/** Small pill beside the scope line: the controls for what this screen is reporting on. */
function ScopeChip({ label, onPress }: { label: string; onPress: () => void }): React.ReactElement {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      hitSlop={8}
      className="active:opacity-60"
      style={{
        borderRadius: Radius.pill,
        borderWidth: 1,
        borderColor: theme.border,
        paddingHorizontal: 10,
        paddingVertical: 3,
      }}>
      <ThemedText style={{ fontSize: 11, fontWeight: '800', color: Brand[500] }}>{label}</ThemedText>
    </Pressable>
  );
}
