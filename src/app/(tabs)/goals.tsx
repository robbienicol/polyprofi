import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GoalProgress, useGoalsProgress } from '@/api/hooks/useGoalProgress';
import { useMoney } from '@/api/hooks/usePreferences';
import { useSavingsGoal } from '@/api/hooks/useSavingsGoal';
import { ThemedText } from '@/components/themed-text';
import { Accent, Brand, Radius, Shadow } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { goalProgressFraction, isOpenEnded } from '@/lib/savings-goal';
import type { SavingsGoal } from '@/types/bets';

const MONO = { fontVariant: ['tabular-nums' as const] };

export default function GoalsScreen(): React.ReactElement {
  const theme = useTheme();
  const router = useRouter();
  const { goals, achievedCount, isLoading } = useSavingsGoal();
  const progress = useGoalsProgress(goals);

  const addGoal = (): void => router.push('/goal-setup');

  return (
    <View className="flex-1" style={{ backgroundColor: theme.background }}>
      <SafeAreaView className="flex-1">
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={(
            <RefreshControl refreshing={progress.isRefreshing} onRefresh={progress.refresh} tintColor={Brand[500]} />
          )}
          contentContainerClassName="px-4 pt-4 pb-16 gap-3">

          <View className="flex-row items-start justify-between" style={{ paddingHorizontal: 2, marginBottom: 1 }}>
            <View className="flex-1">
              <ThemedText style={{ fontSize: 11, fontWeight: '900', color: Brand[500], letterSpacing: 1.1 }}>
                GOALS
              </ThemedText>
              <ThemedText style={{ fontSize: 26, fontWeight: '800', color: theme.text, letterSpacing: -0.5, marginTop: 3 }}>
                {goals.length > 0
                  ? `${goals.length} goal${goals.length === 1 ? '' : 's'} running`
                  : 'Nothing to aim at yet'}
              </ThemedText>
              {achievedCount > 0 ? (
                <ThemedText style={{ fontSize: 12, color: theme.textSecondary, marginTop: 3 }}>
                  🏆 {achievedCount} reached so far
                </ThemedText>
              ) : null}
            </View>

            <Pressable
              onPress={addGoal}
              accessibilityRole="button"
              accessibilityLabel="Add a goal"
              hitSlop={8}
              className="active:opacity-75"
              style={{
                width: 38,
                height: 38,
                borderRadius: Radius.md,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: Brand[500],
                ...Shadow.card,
              }}>
              <ThemedText style={{ fontSize: 22, lineHeight: 25, fontWeight: '900', color: '#06140C' }}>+</ThemedText>
            </Pressable>
          </View>

          {isLoading ? null : goals.length === 0 ? (
            <EmptyGoals onAdd={addGoal} />
          ) : (
            goals.map((goal) => (
              <GoalRow
                key={goal.id}
                goal={goal}
                progress={progress.byGoalId[goal.id]}
                onPress={() => router.push(`/goal/${goal.id}`)}
              />
            ))
          )}

          {goals.length > 0 ? (
            <ThemedText style={{ fontSize: 11, lineHeight: 16, color: theme.textTertiary, textAlign: 'center', marginTop: 6, paddingHorizontal: 14 }}>
              Only net gains count toward a goal — the money you put in doesn&apos;t.
            </ThemedText>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function GoalRow({
  goal,
  progress,
  onPress,
}: {
  goal: SavingsGoal;
  progress: GoalProgress | undefined;
  onPress: () => void;
}): React.ReactElement {
  const theme = useTheme();
  const money = useMoney();

  const netGain = progress?.netGain ?? 0;
  const staked = progress?.staked ?? 0;
  const activeCount = progress?.activeCount ?? 0;
  const openEnded = isOpenEnded(goal);
  const achieved = !!goal.achievedAt;
  const fraction = goalProgressFraction(netGain, goal);
  const remaining = openEnded ? 0 : Math.max(0, (goal.targetAmount ?? 0) - netGain);
  const gainColor = netGain > 0 ? Brand[500] : netGain < 0 ? Accent.red : theme.textSecondary;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={
        openEnded
          ? `${goal.label}, open-ended, ${money(netGain, { decimals: 0, signed: true })} in net gains`
          : `${goal.label}, ${Math.round(fraction * 100)} percent of ${money(goal.targetAmount ?? 0, { decimals: 0 })}`
      }
      className="active:opacity-90"
      style={{
        borderRadius: Radius.xl,
        backgroundColor: theme.backgroundElevated,
        borderWidth: achieved ? 1.5 : 1,
        borderColor: achieved ? Brand[500] : theme.border,
        padding: 16,
        gap: 14,
        ...Shadow.card,
      }}>
      <View className="flex-row items-center" style={{ gap: 12 }}>
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: Radius.md,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: achieved ? Brand[500] + '22' : theme.backgroundSelected,
          }}>
          <ThemedText style={{ fontSize: 25 }}>{goal.emoji}</ThemedText>
        </View>

        <View className="flex-1" style={{ gap: 3 }}>
          <View className="flex-row items-center" style={{ gap: 6 }}>
            <ThemedText style={{ fontSize: 16, fontWeight: '800', color: theme.text, letterSpacing: -0.2, flexShrink: 1 }} numberOfLines={1}>
              {goal.label}
            </ThemedText>
            {achieved ? <Tag label="REACHED 🎉" color={Accent.gold} /> : null}
          </View>
          <ThemedText style={{ fontSize: 12, color: theme.textTertiary, ...MONO }} numberOfLines={1}>
            {openEnded ? 'No finish line' : `${money(goal.targetAmount ?? 0, { decimals: 0 })} target`}
            {activeCount > 0
              ? ` · ${activeCount} position${activeCount === 1 ? '' : 's'}`
              : ' · nothing working yet'}
          </ThemedText>
        </View>

        {openEnded ? null : (
          <ThemedText style={{ fontSize: 22, fontWeight: '900', color: achieved ? Brand[500] : theme.text, ...MONO }}>
            {Math.round(fraction * 100)}%
          </ThemedText>
        )}
      </View>

      {/* An open-ended goal has nothing to fill, so it reports its gains instead. */}
      {openEnded ? (
        <View className="flex-row items-baseline justify-between">
          <ThemedText style={{ fontSize: 17, fontWeight: '800', color: gainColor, ...MONO }}>
            {money(netGain, { decimals: 0, signed: true })}
          </ThemedText>
          <ThemedText style={{ fontSize: 12, color: theme.textTertiary, ...MONO }}>
            {staked > 0 ? `on ${money(staked, { decimals: 0 })} staked` : 'nothing staked yet'}
          </ThemedText>
        </View>
      ) : (
        <View style={{ gap: 7 }}>
          <View style={{ height: 9, borderRadius: Radius.pill, backgroundColor: theme.backgroundSelected, overflow: 'hidden' }}>
            {/* An empty bar stays empty — a minimum-width sliver reads as progress
                that hasn't happened. */}
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
            <ThemedText style={{ fontSize: 13, fontWeight: '800', color: gainColor, ...MONO }}>
              {money(netGain, { decimals: 0, signed: true })} net
              {staked > 0 ? (
                <ThemedText style={{ fontSize: 12, fontWeight: '600', color: theme.textTertiary }}>
                  {' '}· {money(staked, { decimals: 0 })} staked
                </ThemedText>
              ) : null}
            </ThemedText>
            <ThemedText style={{ fontSize: 12, fontWeight: '700', color: theme.textSecondary, ...MONO }}>
              {achieved ? 'Goal reached' : `${money(remaining, { decimals: 0 })} to go`}
            </ThemedText>
          </View>
        </View>
      )}
    </Pressable>
  );
}

function Tag({ label, color }: { label: string; color: string }): React.ReactElement {
  return (
    <View
      style={{
        paddingHorizontal: 7,
        paddingVertical: 2,
        borderRadius: Radius.pill,
        backgroundColor: color + '1F',
        borderWidth: 1,
        borderColor: color + '4D',
      }}>
      <ThemedText style={{ fontSize: 9, fontWeight: '900', color, letterSpacing: 0.6 }}>{label}</ThemedText>
    </View>
  );
}

function EmptyGoals({ onAdd }: { onAdd: () => void }): React.ReactElement {
  const theme = useTheme();
  return (
    <View
      className="items-center"
      style={{
        borderRadius: Radius.xl,
        backgroundColor: theme.backgroundElevated,
        borderWidth: 1,
        borderColor: theme.border,
        padding: 24,
        gap: 12,
        ...Shadow.card,
      }}>
      <View
        style={{
          width: 60,
          height: 60,
          borderRadius: Radius.xl,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: Brand[500] + '18',
        }}>
        <ThemedText style={{ fontSize: 28 }}>🎯</ThemedText>
      </View>
      <ThemedText style={{ fontSize: 17, fontWeight: '800', color: theme.text }}>No goals yet</ThemedText>
      <ThemedText className="text-center" style={{ fontSize: 13, lineHeight: 19, color: theme.textSecondary, maxWidth: 270 }}>
        Every route you take and every position you hold works toward a goal. Add your first one to get started.
      </ThemedText>
      <Pressable
        onPress={onAdd}
        className="items-center active:opacity-85"
        style={{ borderRadius: Radius.lg, backgroundColor: Brand[500], paddingVertical: 13, paddingHorizontal: 22, marginTop: 4 }}>
        <ThemedText style={{ fontSize: 14, fontWeight: '800', color: '#06140C' }}>Add a goal →</ThemedText>
      </Pressable>
    </View>
  );
}
