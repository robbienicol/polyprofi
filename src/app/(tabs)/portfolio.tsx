import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useGoalsProgress } from '@/api/hooks/useGoalProgress';
import { useSavedRoutes } from '@/api/hooks/useSavedRoutes';
import { useSavingsGoal } from '@/api/hooks/useSavingsGoal';
import { useTrackedBets } from '@/api/hooks/useTrackedBets';
import { PortfolioOverview } from '@/components/portfolio/PortfolioOverview';
import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { goalRemaining } from '@/lib/savings-goal';

/**
 * Every position across every goal. The per-goal breakdown lives in the Goals
 * tab; this is the rollup.
 */
export default function PortfolioScreen(): React.ReactElement {
  const theme = useTheme();
  const router = useRouter();
  const { bets } = useTrackedBets();
  const { history } = useSavedRoutes();
  const { goals } = useSavingsGoal();
  const goalsProgress = useGoalsProgress(goals);

  const latestSearch = history[0] ?? null;
  const fallbackCash = latestSearch?.quizSnapshot.balance ?? 0;
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
            {goals.length > 1 && activeBets.length > 0 ? (
              <ThemedText style={{ fontSize: 12, color: theme.textSecondary, marginTop: 3 }}>
                Across all {goals.length} goals
              </ThemedText>
            ) : null}
          </View>

          <PortfolioOverview
            bets={bets}
            fallbackCash={fallbackCash}
            targetValue={targetValue}
            onFindRoutes={() => router.push('/(tabs)/routes')}
            onOpenPositions={() => router.push('/positions')}
          />

          <ThemedText style={{ fontSize: 11, color: theme.textTertiary, textAlign: 'center', opacity: 0.6 }}>
            AI-generated · Not financial advice · For entertainment only
          </ThemedText>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
