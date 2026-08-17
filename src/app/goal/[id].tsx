import { Redirect, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useGoalProgress } from '@/api/hooks/useGoalProgress';
import { useMoney } from '@/api/hooks/usePreferences';
import { useSavingsGoal } from '@/api/hooks/useSavingsGoal';
import { useTrackedBets } from '@/api/hooks/useTrackedBets';
import { PortfolioOverview } from '@/components/portfolio/PortfolioOverview';
import { ThemedText } from '@/components/themed-text';
import { Accent, Brand, Radius, Shadow } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { betsForGoal, goalProgressFraction, isOpenEnded } from '@/lib/savings-goal';

const MONO = { fontVariant: ['tabular-nums' as const] };

export default function GoalDetailScreen(): React.ReactElement {
  const theme = useTheme();
  const router = useRouter();
  const money = useMoney();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { goals, allGoals, isLoading, removeGoal } = useSavingsGoal();
  const { bets, reassignBets } = useTrackedBets();
  const progress = useGoalProgress(id ?? null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const goal = allGoals.find((candidate) => candidate.id === id) ?? null;
  const goalBets = useMemo(() => (id ? betsForGoal(bets, id) : []), [bets, id]);

  if (isLoading) return <View style={{ flex: 1, backgroundColor: theme.background }} />;
  // The goal was deleted (or never existed) — the list is the only sane place to be.
  if (!goal) return <Redirect href="/(tabs)/goals" />;

  const openEnded = isOpenEnded(goal);
  const netGain = progress.goalProgress;
  const fraction = goalProgressFraction(netGain, goal);
  const remaining = openEnded ? 0 : Math.max(0, (goal.targetAmount ?? 0) - netGain);
  const gainColor = netGain > 0 ? Brand[500] : netGain < 0 ? Accent.red : theme.textSecondary;
  const staked = goalBets
    .filter((bet) => bet.status === 'active')
    .reduce((sum, bet) => sum + bet.amountWagered, 0);

  // The goal travels into the quiz as an argument, which targets the search at
  // what this goal still needs and stamps it onto anything taken from it.
  const findRoutes = (): void => router.push(`/quiz?goalId=${goal.id}` as Href);

  const deleteGoal = (): void => {
    const fallback = goals.find((candidate) => candidate.id !== goal.id)?.id;
    // Move the positions first: a goal that disappears must not take the record of
    // real money with it.
    void reassignBets({ fromGoalId: goal.id, toGoalId: fallback }).then(() => {
      removeGoal(goal.id);
      router.replace('/(tabs)/goals');
    });
  };

  return (
    <View className="flex-1" style={{ backgroundColor: theme.background }}>
      <SafeAreaView className="flex-1">
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={(
            <RefreshControl refreshing={progress.isRefreshing} onRefresh={progress.refresh} tintColor={Brand[500]} />
          )}
          contentContainerClassName="px-4 pt-3 pb-16 gap-4">

          <View className="flex-row items-center justify-between">
            <Pressable onPress={() => router.back()} accessibilityRole="button" hitSlop={8} className="active:opacity-60 py-1">
              <ThemedText style={{ fontSize: 14, fontWeight: '700', color: theme.textSecondary }}>← Goals</ThemedText>
            </Pressable>
            {goal.draft ? (
              <View
                style={{
                  paddingHorizontal: 9,
                  paddingVertical: 4,
                  borderRadius: Radius.pill,
                  borderWidth: 1,
                  borderColor: theme.border,
                  backgroundColor: theme.backgroundElement,
                }}>
                <ThemedText style={{ fontSize: 9.5, fontWeight: '900', color: theme.textTertiary, letterSpacing: 0.7 }}>
                  NOT STARTED
                </ThemedText>
              </View>
            ) : null}
          </View>

          {/* Goal hero */}
          <View
            style={{
              borderRadius: Radius.xl,
              backgroundColor: theme.backgroundElevated,
              borderWidth: goal.achievedAt ? 1.5 : 1,
              borderColor: goal.achievedAt ? Brand[500] : theme.border,
              padding: 18,
              gap: 16,
              ...Shadow.card,
            }}>
            <View className="flex-row items-center" style={{ gap: 13 }}>
              <View
                style={{
                  width: 54,
                  height: 54,
                  borderRadius: Radius.lg,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: goal.achievedAt ? Brand[500] + '22' : theme.backgroundSelected,
                }}>
                <ThemedText style={{ fontSize: 28 }}>{goal.emoji}</ThemedText>
              </View>
              <View className="flex-1" style={{ gap: 3 }}>
                <ThemedText style={{ fontSize: 11, fontWeight: '800', color: theme.textTertiary, letterSpacing: 0.6 }}>
                  {goal.achievedAt ? 'GOAL REACHED 🎉' : openEnded ? 'OPEN-ENDED GOAL' : 'PROFIT GOAL'}
                </ThemedText>
                <ThemedText style={{ fontSize: 21, fontWeight: '800', color: theme.text, letterSpacing: -0.4 }} numberOfLines={2}>
                  {goal.label}
                </ThemedText>
              </View>
              {openEnded ? null : (
                <ThemedText style={{ fontSize: 26, fontWeight: '900', color: goal.achievedAt ? Brand[500] : theme.text, ...MONO }}>
                  {Math.round(fraction * 100)}%
                </ThemedText>
              )}
            </View>

            {openEnded ? (
              <View style={{ gap: 4 }}>
                <ThemedText style={{ fontSize: 30, fontWeight: '800', color: gainColor, letterSpacing: -1, ...MONO }}>
                  {money(netGain, { decimals: 0, signed: true })}
                </ThemedText>
                <ThemedText style={{ fontSize: 12, color: theme.textTertiary }}>
                  Net gains on {money(staked, { decimals: 0 })} staked. No target — this one just grows.
                </ThemedText>
              </View>
            ) : (
              <View style={{ gap: 8 }}>
                <View style={{ height: 12, borderRadius: Radius.pill, backgroundColor: theme.backgroundSelected, overflow: 'hidden' }}>
                  {fraction > 0 ? (
                    <View
                      style={{
                        width: `${Math.max(fraction * 100, 2)}%`,
                        height: '100%',
                        borderRadius: Radius.pill,
                        backgroundColor: Brand[500],
                      }}
                    />
                  ) : null}
                </View>
                <View className="flex-row items-baseline justify-between">
                  <ThemedText style={{ fontSize: 15, fontWeight: '800', color: gainColor, ...MONO }}>
                    {money(netGain, { decimals: 0, signed: true })}
                    <ThemedText style={{ fontSize: 13, fontWeight: '600', color: theme.textTertiary }}>
                      {' '}net of {money(goal.targetAmount ?? 0, { decimals: 0 })}
                    </ThemedText>
                  </ThemedText>
                  <ThemedText style={{ fontSize: 12, fontWeight: '700', color: theme.textSecondary, ...MONO }}>
                    {goal.achievedAt ? 'Done' : `${money(remaining, { decimals: 0 })} to go`}
                  </ThemedText>
                </View>
              </View>
            )}

            <Pressable
              onPress={findRoutes}
              accessibilityRole="button"
              className="py-3.5 items-center active:opacity-85"
              style={{ borderRadius: Radius.lg, backgroundColor: Brand[500] }}>
              <ThemedText style={{ fontSize: 15, fontWeight: '900', color: '#06140C' }}>
                {progress.activeCount > 0 ? 'Find another route →' : 'Find routes for this goal →'}
              </ThemedText>
            </Pressable>
          </View>

          <PortfolioOverview
            bets={goalBets}
            fallbackCash={0}
            targetValue={openEnded ? null : staked + (goal.targetAmount ?? 0)}
            onFindRoutes={findRoutes}
            onOpenPositions={() => router.push('/positions')}
            emptyTitle="Nothing working on this goal yet"
            emptyBody={`Take a route for ${goal.label} and its allocation, projected value, and odds of getting there all show up here.`}
          />

          {/* Delete, confirmed in place — an Alert would be a no-op on web. */}
          {confirmingDelete ? (
            <View
              style={{
                borderRadius: Radius.lg,
                borderWidth: 1,
                borderColor: Accent.red + '66',
                backgroundColor: Accent.red + '12',
                padding: 14,
                gap: 10,
              }}>
              <ThemedText style={{ fontSize: 13, lineHeight: 19, color: theme.text }}>
                Delete {goal.label}?{' '}
                {goalBets.length > 0
                  ? `Its ${goalBets.length} position${goalBets.length === 1 ? '' : 's'} stay tracked and move to your first goal.`
                  : 'It has no positions.'}
              </ThemedText>
              <View className="flex-row" style={{ gap: 10 }}>
                <Pressable
                  onPress={() => setConfirmingDelete(false)}
                  accessibilityRole="button"
                  className="flex-1 py-3 items-center active:opacity-75"
                  style={{ borderRadius: Radius.md, borderWidth: 1, borderColor: theme.borderStrong, backgroundColor: theme.backgroundElement }}>
                  <ThemedText style={{ fontSize: 13, fontWeight: '800', color: theme.text }}>Keep it</ThemedText>
                </Pressable>
                <Pressable
                  onPress={deleteGoal}
                  accessibilityRole="button"
                  className="flex-1 py-3 items-center active:opacity-75"
                  style={{ borderRadius: Radius.md, backgroundColor: Accent.red }}>
                  <ThemedText style={{ fontSize: 13, fontWeight: '800', color: '#FFFFFF' }}>Delete goal</ThemedText>
                </Pressable>
              </View>
            </View>
          ) : (
            <Pressable
              onPress={() => setConfirmingDelete(true)}
              accessibilityRole="button"
              className="items-center py-3 active:opacity-60">
              <ThemedText style={{ fontSize: 13, fontWeight: '700', color: Accent.red }}>Delete this goal</ThemedText>
            </Pressable>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
