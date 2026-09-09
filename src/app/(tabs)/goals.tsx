import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GoalProgress, useGoalsProgress } from '@/api/hooks/useGoalProgress';
import { useMoney } from '@/api/hooks/usePreferences';
import { useSavingsGoal } from '@/api/hooks/useSavingsGoal';
import { useTrackedBets } from '@/api/hooks/useTrackedBets';
import { ThemedText } from '@/components/themed-text';
import { Brand, OnBrand, Radius, Semantic, Shadow } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { goalProgressFraction, isOpenEnded, parseGoalIds } from '@/lib/savings-goal';
import type { SavingsGoal } from '@/types/bets';

const MONO = { fontVariant: ['tabular-nums' as const] };

export default function GoalsScreen(): React.ReactElement {
  const theme = useTheme();
  const router = useRouter();
  const { goals, achievedCount, isLoading, removeGoals } = useSavingsGoal();
  const { reassignBets } = useTrackedBets();
  const progress = useGoalsProgress(goals);

  // Ticked goals, for looking at their combined portfolio or clearing several out
  // at once. Ids rather than indexes, so a goal disappearing under the selection
  // (deleted, swept) takes itself out of it.
  //
  // Ticks are held in state so a tap lands on the frame it was made, and re-seeded
  // from the route parameter whenever the Portfolio tab sends a different selection
  // back here to be changed. A tab screen is not remounted on arrival, so without
  // that re-seeding the boxes would keep whatever they showed last time and disagree
  // with the screen that sent you; and driving them from the parameter alone loses a
  // tick when two land in the same render, since a parameter has no "update from
  // what it was" the way state does.
  const { selected: selectedParam } = useLocalSearchParams<{ selected?: string }>();
  const [selection, setSelection] = useState(() => ({
    fromParam: selectedParam,
    ids: parseGoalIds(selectedParam),
  }));
  if (selection.fromParam !== selectedParam) {
    setSelection({ fromParam: selectedParam, ids: parseGoalIds(selectedParam) });
  }
  const selectedIds = selection.ids;
  const setSelectedIds = (update: (prev: string[]) => string[]): void => {
    setSelection((prev) => ({ ...prev, ids: update(prev.ids) }));
  };
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const selected = goals.filter((goal) => selectedIds.includes(goal.id));

  const toggleSelected = (goalId: string): void => {
    setConfirmingDelete(false);
    setSelectedIds((prev) => (
      prev.includes(goalId) ? prev.filter((id) => id !== goalId) : [...prev, goalId]
    ));
  };

  const clearSelection = (): void => {
    setSelectedIds(() => []);
    setConfirmingDelete(false);
  };

  const viewSelectedPortfolio = (): void => {
    router.push(`/(tabs)/portfolio?goalIds=${selected.map((goal) => goal.id).join(',')}` as Href);
  };

  // Positions move first, exactly as the single-goal delete does: a goal that
  // disappears must not take the record of real money with it. They land on a goal
  // that is not itself being deleted, or on nothing if every goal was selected.
  const deleteSelected = async (): Promise<void> => {
    if (deleting || selected.length === 0) return;
    setDeleting(true);
    const doomed = selected.map((goal) => goal.id);
    const fallback = goals.find((goal) => !doomed.includes(goal.id))?.id;
    try {
      for (const goalId of doomed) {
        await reassignBets({ fromGoalId: goalId, toGoalId: fallback });
      }
      removeGoals(doomed);
      clearSelection();
    } finally {
      setDeleting(false);
    }
  };

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
              <ThemedText style={{ fontSize: 22, lineHeight: 25, fontWeight: '900', color: OnBrand }}>+</ThemedText>
            </Pressable>
          </View>

          {selected.length > 0 ? (
            <SelectionBar
              count={selected.length}
              confirming={confirmingDelete}
              deleting={deleting}
              onClear={clearSelection}
              onViewPortfolio={viewSelectedPortfolio}
              onAskDelete={() => setConfirmingDelete(true)}
              onCancelDelete={() => setConfirmingDelete(false)}
              onConfirmDelete={() => void deleteSelected()}
            />
          ) : null}

          {isLoading ? null : goals.length === 0 ? (
            <EmptyGoals onAdd={addGoal} />
          ) : (
            goals.map((goal) => (
              <GoalRow
                key={goal.id}
                goal={goal}
                progress={progress.byGoalId[goal.id]}
                selected={selectedIds.includes(goal.id)}
                onToggleSelected={() => toggleSelected(goal.id)}
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
  selected,
  onToggleSelected,
  onPress,
}: {
  goal: SavingsGoal;
  progress: GoalProgress | undefined;
  selected: boolean;
  onToggleSelected: () => void;
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
  const gainColor = netGain > 0 ? Semantic.positive : netGain < 0 ? Semantic.negative : theme.textSecondary;

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
        borderWidth: achieved || selected ? 1.5 : 1,
        borderColor: selected ? Brand[500] : achieved ? Semantic.positive : theme.border,
        padding: 16,
        gap: 14,
        ...Shadow.card,
      }}>
      <View className="flex-row items-center" style={{ gap: 12 }}>
        {/* The tick sits inside the row but takes its own taps, so selecting a goal
            and opening it stay separate gestures. */}
        <Pressable
          onPress={onToggleSelected}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: selected }}
          // react-native-web does not turn accessibilityState into aria-checked, so on
          // web the box announced as unchecked however it looked.
          aria-checked={selected}
          accessibilityLabel={`Select ${goal.label}`}
          hitSlop={10}
          className="active:opacity-60"
          style={{
            width: 24,
            height: 24,
            borderRadius: Radius.sm,
            borderWidth: 1.5,
            borderColor: selected ? Brand[500] : theme.borderStrong,
            backgroundColor: selected ? Brand[500] : 'transparent',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          {selected ? (
            <ThemedText style={{ fontSize: 13, fontWeight: '900', color: OnBrand, lineHeight: 16 }}>✓</ThemedText>
          ) : null}
        </Pressable>

        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: Radius.md,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: achieved ? Semantic.positive + '22' : theme.backgroundSelected,
          }}>
          <ThemedText style={{ fontSize: 25 }}>{goal.emoji}</ThemedText>
        </View>

        <View className="flex-1" style={{ gap: 3 }}>
          <View className="flex-row items-center" style={{ gap: 6 }}>
            <ThemedText style={{ fontSize: 16, fontWeight: '800', color: theme.text, letterSpacing: -0.2, flexShrink: 1 }} numberOfLines={1}>
              {goal.label}
            </ThemedText>
            {achieved ? <Tag label="REACHED 🎉" color={Semantic.positive} /> : null}
          </View>
          <ThemedText style={{ fontSize: 12, color: theme.textTertiary, ...MONO }} numberOfLines={1}>
            {openEnded ? 'No finish line' : `${money(goal.targetAmount ?? 0, { decimals: 0 })} target`}
            {activeCount > 0
              ? ` · ${activeCount} position${activeCount === 1 ? '' : 's'}`
              : ' · nothing working yet'}
          </ThemedText>
        </View>

        {openEnded ? null : (
          <ThemedText style={{ fontSize: 22, fontWeight: '900', color: achieved ? Semantic.positive : theme.text, ...MONO }}>
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
            {staked > 0 ? `on ${money(staked, { decimals: 0 })} invested` : 'nothing invested yet'}
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

/**
 * What you can do with the ticked goals. Delete confirms in place rather than in an
 * Alert, which is a no-op on web — the same reason the single-goal delete does.
 */
function SelectionBar({
  count,
  confirming,
  deleting,
  onClear,
  onViewPortfolio,
  onAskDelete,
  onCancelDelete,
  onConfirmDelete,
}: {
  count: number;
  confirming: boolean;
  deleting: boolean;
  onClear: () => void;
  onViewPortfolio: () => void;
  onAskDelete: () => void;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
}): React.ReactElement {
  const theme = useTheme();
  const goalWord = `${count} goal${count === 1 ? '' : 's'}`;

  return (
    <View
      style={{
        borderRadius: Radius.lg,
        backgroundColor: theme.backgroundElevated,
        borderWidth: 1,
        borderColor: Brand[500] + '4D',
        paddingHorizontal: 14,
        paddingVertical: 12,
        gap: 10,
      }}>
      <View className="flex-row items-center justify-between">
        <ThemedText style={{ fontSize: 13, fontWeight: '800', color: theme.text }}>
          {goalWord} selected
        </ThemedText>
        <Pressable onPress={onClear} accessibilityRole="button" hitSlop={8} className="active:opacity-60">
          <ThemedText style={{ fontSize: 12, fontWeight: '700', color: theme.textSecondary }}>Clear</ThemedText>
        </Pressable>
      </View>

      {confirming ? (
        <View style={{ gap: 8 }}>
          <ThemedText style={{ fontSize: 12, lineHeight: 17, color: theme.textSecondary }}>
            Delete {goalWord}? Any positions move to another goal — nothing about the money
            is lost.
          </ThemedText>
          <View className="flex-row" style={{ gap: 8 }}>
            <Pressable
              onPress={onCancelDelete}
              accessibilityRole="button"
              className="flex-1 items-center active:opacity-70"
              style={{ borderRadius: Radius.md, borderWidth: 1, borderColor: theme.border, paddingVertical: 10 }}>
              <ThemedText style={{ fontSize: 13, fontWeight: '700', color: theme.textSecondary }}>Cancel</ThemedText>
            </Pressable>
            <Pressable
              onPress={onConfirmDelete}
              disabled={deleting}
              accessibilityRole="button"
              className="flex-1 items-center active:opacity-70"
              style={{ borderRadius: Radius.md, backgroundColor: Semantic.negative, paddingVertical: 10, opacity: deleting ? 0.6 : 1 }}>
              <ThemedText style={{ fontSize: 13, fontWeight: '800', color: '#FFFFFF' }}>
                {deleting ? 'Deleting…' : `Delete ${goalWord}`}
              </ThemedText>
            </Pressable>
          </View>
        </View>
      ) : (
        <View className="flex-row" style={{ gap: 8 }}>
          <Pressable
            onPress={onViewPortfolio}
            accessibilityRole="button"
            className="flex-1 items-center active:opacity-80"
            style={{ borderRadius: Radius.md, backgroundColor: Brand[500], paddingVertical: 10 }}>
            <ThemedText style={{ fontSize: 13, fontWeight: '800', color: OnBrand }}>View portfolio</ThemedText>
          </Pressable>
          <Pressable
            onPress={onAskDelete}
            accessibilityRole="button"
            className="items-center active:opacity-70"
            style={{ borderRadius: Radius.md, borderWidth: 1, borderColor: Semantic.negative + '66', paddingVertical: 10, paddingHorizontal: 18 }}>
            <ThemedText style={{ fontSize: 13, fontWeight: '800', color: Semantic.negative }}>Delete</ThemedText>
          </Pressable>
        </View>
      )}
    </View>
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
        <ThemedText style={{ fontSize: 14, fontWeight: '800', color: OnBrand }}>Add a goal →</ThemedText>
      </Pressable>
    </View>
  );
}
