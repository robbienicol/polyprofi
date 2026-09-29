import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import React, { useRef, useState } from 'react';
import { Animated, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { Plus, Target } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GoalProgress, useGoalsProgress } from '@/api/hooks/useGoalProgress';
import { useMoney } from '@/api/hooks/usePreferences';
import { useSavingsGoal } from '@/api/hooks/useSavingsGoal';
import { Haptic } from '@/lib/haptics';
import { useTrackedBets } from '@/api/hooks/useTrackedBets';
import { Icon } from '@/components/ui/Icon';
import { ThemedText } from '@/components/themed-text';
import { Brand, OnBrand, Radius, Semantic } from '@/constants/theme';
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
            <RefreshControl refreshing={progress.isRefreshing} onRefresh={progress.refresh} tintColor={Brand[500]} />
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

          {isLoading ? null : goals.length === 0 ? (
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

/** When the goal ends, or how long it has been going when it has no end date. */
function timeLabel(goal: SavingsGoal, now: number): string {
  const short = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  if (goal.achievedAt) return `Reached ${short(goal.achievedAt)}`;
  if (goal.deadline) {
    return Date.parse(goal.deadline) < now ? `Ended ${short(goal.deadline)}` : `by ${short(goal.deadline)}`;
  }
  const days = Math.max(0, Math.floor((now - Date.parse(goal.createdAt)) / (24 * 60 * 60 * 1_000)));
  if (days < 1) return 'Started today';
  if (days < 14) return `${days} day${days === 1 ? '' : 's'} in`;
  if (days < 60) return `${Math.round(days / 7)} weeks in`;
  return `${Math.round(days / 30)} months in`;
}

function GoalRow({
  goal,
  progress,
  editing,
  selected,
  onToggleSelected,
  onPress,
  onSwipeDelete,
}: {
  goal: SavingsGoal;
  progress: GoalProgress | undefined;
  editing: boolean;
  selected: boolean;
  onToggleSelected: () => void;
  onPress: () => void;
  onSwipeDelete: () => void;
}): React.ReactElement {
  const theme = useTheme();
  const money = useMoney();
  const swipeableRef = useRef<Swipeable>(null);
  const openRef = useRef(false);
  const [now] = useState(() => Date.now());

  const netGain = progress?.netGain ?? 0;
  const staked = progress?.staked ?? 0;
  const activeCount = progress?.activeCount ?? 0;
  const openEnded = isOpenEnded(goal);
  const achieved = !!goal.achievedAt;
  const fraction = goalProgressFraction(netGain, goal);
  const gainColor = netGain > 0 ? Semantic.positive : netGain < 0 ? Semantic.negative : theme.text;

  return (
    <Swipeable
      ref={swipeableRef}
      enabled={!editing}
      renderRightActions={(_progress, dragX) => (
        <SwipeDeleteAction dragX={dragX} onPress={onSwipeDelete} />
      )}
      overshootRight={false}
      rightThreshold={40}
      onSwipeableWillOpen={() => { openRef.current = true; }}
      onSwipeableClose={() => { openRef.current = false; }}
      containerStyle={{ marginBottom: 0, borderRadius: Radius.xl }}>
      <Pressable
        onPress={() => {
          // In Edit the whole row selects; otherwise it opens the goal.
          if (editing) {
            onToggleSelected();
            return;
          }
          if (openRef.current) {
            swipeableRef.current?.close();
            return;
          }
          onPress();
        }}
        accessibilityRole={editing ? 'checkbox' : 'button'}
        accessibilityState={editing ? { checked: selected } : undefined}
        accessibilityLabel={
          openEnded
            ? `${goal.label}, ${money(netGain, { decimals: 0, signed: true })} so far`
            : `${goal.label}, ${money(netGain, { decimals: 0 })} of ${money(goal.targetAmount ?? 0, { decimals: 0 })}`
        }
        className="active:opacity-90"
        style={{
          borderRadius: Radius.xl,
          backgroundColor: theme.backgroundElevated,
          borderWidth: achieved || selected ? 1.5 : 1,
          borderColor: selected ? Brand[500] : achieved ? Semantic.positive : theme.border,
          padding: 16,
          gap: 14,
        }}>
        <View className="flex-row items-center" style={{ gap: 12 }}>
          {editing ? (
            <View
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
              {selected ? <Icon glyph="✓" size={13} color={OnBrand} strokeWidth={3} /> : null}
            </View>
          ) : null}

          <View className="flex-1" style={{ gap: 3 }}>
            <View className="flex-row items-center" style={{ gap: 6 }}>
              <ThemedText style={{ fontSize: 16, fontWeight: '800', color: theme.text, letterSpacing: -0.2, flexShrink: 1 }} numberOfLines={1}>
                {goal.label}
              </ThemedText>
              {achieved ? <Tag label="REACHED" color={Semantic.positive} /> : null}
            </View>
            <ThemedText style={{ fontSize: 12, color: theme.textTertiary, ...MONO }} numberOfLines={1}>
              {activeCount > 0
                ? `${activeCount} position${activeCount === 1 ? '' : 's'}${staked > 0 ? ` · ${money(staked, { decimals: 0 })} invested` : ''}`
                : 'Nothing working on it yet'}
            </ThemedText>
          </View>
        </View>

        {/* One statement of progress: the bar, and the dollars it stands for. */}
        {openEnded ? null : (
          <View style={{ height: 8, borderRadius: Radius.pill, backgroundColor: theme.backgroundSelected, overflow: 'hidden' }}>
            {/* An empty bar stays empty — a minimum-width sliver reads as progress
                that hasn't happened. */}
            {fraction > 0 ? (
              <View
                style={{
                  width: `${Math.max(fraction * 100, 2)}%`,
                  height: '100%',
                  borderRadius: Radius.pill,
                  backgroundColor: achieved ? Semantic.positive : Brand[500],
                }}
              />
            ) : null}
          </View>
        )}

        <View className="flex-row items-baseline justify-between" style={{ marginTop: openEnded ? -4 : -6 }}>
          <ThemedText style={{ fontSize: 15, fontWeight: '800', color: gainColor, ...MONO }}>
            {money(netGain, { decimals: 0, signed: openEnded })}
            <ThemedText style={{ fontSize: 13, fontWeight: '600', color: theme.textTertiary }}>
              {openEnded ? ' so far' : ` of ${money(goal.targetAmount ?? 0, { decimals: 0 })}`}
            </ThemedText>
          </ThemedText>
          <ThemedText style={{ fontSize: 12, fontWeight: '700', color: theme.textSecondary }}>
            {timeLabel(goal, now)}
          </ThemedText>
        </View>
      </Pressable>
    </Swipeable>
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
          {count > 0 ? `${goalWord} selected` : 'Tap goals to select them'}
        </ThemedText>
        {count > 0 ? (
          <Pressable onPress={onClear} accessibilityRole="button" hitSlop={8} className="active:opacity-60">
            <ThemedText style={{ fontSize: 12, fontWeight: '700', color: theme.textSecondary }}>Clear</ThemedText>
          </Pressable>
        ) : null}
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
        <View className="flex-row" style={{ gap: 8, opacity: count > 0 ? 1 : 0.4 }} pointerEvents={count > 0 ? 'auto' : 'none'}>
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

/**
 * The red panel a leftward swipe reveals behind a goal row. No extra confirm step —
 * the swipe itself, plus a deliberate tap on the button it uncovers, is friction
 * enough, same as swiping a Mail message.
 */
function SwipeDeleteAction({
  dragX,
  onPress,
}: {
  dragX: Animated.AnimatedInterpolation<number>;
  onPress: () => void;
}): React.ReactElement {
  const trans = dragX.interpolate({ inputRange: [-88, 0], outputRange: [0, 88], extrapolate: 'clamp' });
  return (
    <Animated.View style={{ width: 88, transform: [{ translateX: trans }] }}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel="Delete goal"
        className="flex-1 items-center justify-center active:opacity-80"
        style={{ flex: 1, borderRadius: Radius.xl, backgroundColor: Semantic.negative }}>
        <ThemedText style={{ fontSize: 13, fontWeight: '800', color: '#FFFFFF' }}>Delete</ThemedText>
      </Pressable>
    </Animated.View>
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
        <Icon icon={Target} size={26} color={Brand[500]} strokeWidth={1.75} />
      </View>
      <ThemedText style={{ fontSize: 17, fontWeight: '800', color: theme.text }}>Give it a name</ThemedText>
      <ThemedText className="text-center" style={{ fontSize: 13, lineHeight: 19, color: theme.textSecondary, maxWidth: 280 }}>
        A trip, a car, a cushion — name it and set a number, and we&apos;ll track what your routes add up to toward it. Completely optional.
      </ThemedText>
      <Pressable
        onPress={onAdd}
        className="items-center active:opacity-85"
        style={{ borderRadius: Radius.lg, backgroundColor: Brand[500], paddingVertical: 13, paddingHorizontal: 22, marginTop: 4 }}>
        <ThemedText style={{ fontSize: 14, fontWeight: '800', color: OnBrand }}>Add a goal</ThemedText>
      </Pressable>
    </View>
  );
}
