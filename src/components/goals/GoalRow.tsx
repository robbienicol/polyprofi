import React, { useRef, useState } from 'react';
import { Animated, Pressable, View } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';

import type { GoalProgress } from '@/api/hooks/useGoalProgress';
import { useMoney } from '@/api/hooks/usePreferences';
import { Icon } from '@/components/ui/Icon';
import { ThemedText } from '@/components/themed-text';
import { Brand, OnBrand, Radius, Semantic } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { goalProgressFraction, isOpenEnded } from '@/lib/savings-goal';
import type { SavingsGoal } from '@/types/bets';

const MONO = { fontVariant: ['tabular-nums' as const] };

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

export function GoalRow({
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
