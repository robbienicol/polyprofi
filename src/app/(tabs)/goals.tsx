import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { Plus } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useGoalsProgress } from '@/api/hooks/useGoalProgress';
import { useSavingsGoal } from '@/api/hooks/useSavingsGoal';
import { Haptic } from '@/lib/haptics';
import { useTrackedBets } from '@/api/hooks/useTrackedBets';
import { EmptyGoals } from '@/components/goals/EmptyGoals';
import { GoalRow } from '@/components/goals/GoalRow';
import { SelectionBar } from '@/components/goals/SelectionBar';
import { Icon } from '@/components/ui/Icon';
import { ThemedText } from '@/components/themed-text';
import { Brand, OnBrand, Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { parseGoalIds } from '@/lib/savings-goal';
import { ListRowsSkeleton } from '@/components/ui/loaders';
import { withTabSkeleton } from '@/components/ui/with-tab-skeleton';
import { usePullRefresh } from '@/hooks/use-pull-refresh';

function GoalsScreen(): React.ReactElement {
  const theme = useTheme();
  const router = useRouter();
  const { goals, achievedCount, isLoading, removeGoals } = useSavingsGoal();
  const { reassignBets } = useTrackedBets();
  const progress = useGoalsProgress(goals);
  const pull = usePullRefresh(progress.refresh);

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
  // Selecting goals is an occasional task — comparing a few in the portfolio, or
  // clearing several out — so it lives behind Edit instead of putting a checkbox on
  // every row. Arriving with `selected` (the portfolio's "Pick goals") opens in it.
  const [selection, setSelection] = useState(() => ({
    fromParam: selectedParam,
    ids: parseGoalIds(selectedParam),
    editing: selectedParam !== undefined,
  }));
  if (selection.fromParam !== selectedParam) {
    setSelection({ fromParam: selectedParam, ids: parseGoalIds(selectedParam), editing: selectedParam !== undefined });
  }
  const editing = selection.editing;
  const selectedIds = selection.ids;
  const setSelectedIds = (update: (prev: string[]) => string[]): void => {
    setSelection((prev) => ({ ...prev, ids: update(prev.ids) }));
  };
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [swipeDeletingId, setSwipeDeletingId] = useState<string | null>(null);
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

  const setEditing = (next: boolean): void => {
    setConfirmingDelete(false);
    setSelection((prev) => ({ ...prev, editing: next, ids: next ? prev.ids : [] }));
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
      setEditing(false);
    } finally {
      setDeleting(false);
    }
  };

  // Same reassign-then-remove shape as deleteSelected, for the single goal a swipe
  // exposes. Guarded by swipeDeletingId rather than the shared `deleting` flag, so
  // swiping one row never gets blocked by a bulk delete in flight on another.
  const deleteSwiped = async (goalId: string): Promise<void> => {
    if (swipeDeletingId) return;
    setSwipeDeletingId(goalId);
    try {
      const fallback = goals.find((goal) => goal.id !== goalId)?.id;
      await reassignBets({ fromGoalId: goalId, toGoalId: fallback });
      removeGoals([goalId]);
    } finally {
      setSwipeDeletingId(null);
    }
  };

  const addGoal = (): void => {
    Haptic.tap();
    router.push('/goal-setup');
  };

  return (
    <View className="flex-1" style={{ backgroundColor: theme.background }}>
      <SafeAreaView className="flex-1">
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={(
            <RefreshControl refreshing={pull.refreshing} onRefresh={pull.onRefresh} tintColor={Brand[500]} />
          )}
          contentContainerClassName="px-4 pt-4 pb-16 gap-3">

          <View className="flex-row items-start justify-between" style={{ paddingHorizontal: 2, marginBottom: 1 }}>
            <View className="flex-1">
              <ThemedText style={{ fontSize: 11, fontWeight: '900', color: Brand[500], letterSpacing: 1.1 }}>
                GOALS
              </ThemedText>
              <ThemedText style={{ fontSize: 26, fontWeight: '800', color: theme.text, letterSpacing: -0.5, marginTop: 3 }}>
                {goals.length > 0 ? 'What you\'re saving for' : 'Saving for something?'}
              </ThemedText>
              {achievedCount > 0 ? (
                <ThemedText style={{ fontSize: 12, color: theme.textSecondary, marginTop: 3 }}>
                  {achievedCount} reached so far
                </ThemedText>
              ) : null}
            </View>

            <View className="flex-row items-center" style={{ gap: 12 }}>
              {goals.length > 0 ? (
                <Pressable
                  onPress={() => setEditing(!editing)}
                  accessibilityRole="button"
                  hitSlop={8}
                  className="active:opacity-60">
                  <ThemedText style={{ fontSize: 14, fontWeight: '800', color: Brand[500] }}>
                    {editing ? 'Done' : 'Edit'}
                  </ThemedText>
                </Pressable>
              ) : null}
              {!editing ? (
                <Pressable
                  onPress={addGoal}
                  accessibilityRole="button"
                  accessibilityLabel="Add a goal"
                  hitSlop={8}
                  className="active:opacity-75"
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: Radius.pill,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: Brand[500],
                  }}>
                  <Icon icon={Plus} size={19} color={OnBrand} strokeWidth={2.5} />
                </Pressable>
              ) : null}
            </View>
          </View>

          {editing ? (
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

          {isLoading ? <ListRowsSkeleton rows={3} /> : goals.length === 0 ? (
            <EmptyGoals onAdd={addGoal} />
          ) : (
            goals.map((goal) => (
              <GoalRow
                key={goal.id}
                goal={goal}
                progress={progress.byGoalId[goal.id]}
                editing={editing}
                selected={selectedIds.includes(goal.id)}
                onToggleSelected={() => toggleSelected(goal.id)}
                onPress={() => router.push(`/goal/${goal.id}`)}
                onSwipeDelete={() => void deleteSwiped(goal.id)}
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

export default withTabSkeleton(GoalsScreen, 'list');
