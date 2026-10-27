import React from 'react';
import { Pressable, View } from 'react-native';

import type { GoalProgress } from '@/api/hooks/useGoalProgress';
import { useMoney } from '@/api/hooks/usePreferences';
import { Icon } from '@/components/ui/Icon';
import { ThemedText } from '@/components/themed-text';
import { Brand, Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { MONO } from '@/lib/portfolio-format';
import { goalProgressFraction, goalRemaining, isOpenEnded } from '@/lib/savings-goal';
import type { SavingsGoal } from '@/types/bets';

/**
 * One goal, reduced to the only thing Home has to say about it: how far it still is.
 * The Goals tab carries the full card — staked, positions, the tick box — so repeating
 * any of that here would make two screens compete to be the place goals are managed.
 */
export function GoalTrack({
  goal,
  progress,
  onPress,
}: {
  goal: SavingsGoal;
  progress: GoalProgress;
  onPress: () => void;
}): React.ReactElement {
  const theme = useTheme();
  const money = useMoney();
  const openEnded = isOpenEnded(goal);
  const fraction = goalProgressFraction(progress.netGain, goal);
  const remaining = goalRemaining(progress.netGain, goal);
  const pct = Math.round(fraction * 100);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={
        openEnded
          ? `${goal.label}, open-ended, ${money(progress.netGain, { decimals: 0, signed: true })} in net gains`
          : `${goal.label}, ${pct} percent there, ${money(remaining, { decimals: 0 })} to go`
      }
      className="active:opacity-80"
      style={{
        borderRadius: Radius.lg,
        borderWidth: 1,
        borderColor: theme.border,
        backgroundColor: theme.backgroundElevated,
        paddingHorizontal: 14,
        paddingVertical: 12,
        gap: 9,
      }}>
      <View className="flex-row items-center" style={{ gap: 10 }}>
        <Icon glyph={goal.emoji} size={17} color={theme.textSecondary} />
        <ThemedText
          style={{ flex: 1, fontSize: 14, fontWeight: '700', color: theme.text, letterSpacing: -0.2 }}
          numberOfLines={1}>
          {goal.label}
        </ThemedText>
        {/* An open-ended goal has no finish line to be a fraction of, so it reports what
            it has earned instead of a percentage it can never complete. */}
        <ThemedText style={{ fontSize: 13, fontWeight: '800', color: theme.text, ...MONO }}>
          {openEnded
            ? money(progress.netGain, { decimals: 0, signed: true })
            : `${money(remaining, { decimals: 0 })} to go`}
        </ThemedText>
      </View>

      {openEnded ? null : (
        <View className="flex-row items-center" style={{ gap: 9 }}>
          <View
            className="flex-1"
            style={{ height: 6, borderRadius: Radius.pill, backgroundColor: theme.backgroundSelected, overflow: 'hidden' }}>
            {/* Empty stays empty. A minimum-width sliver would draw progress that has
                not happened, which is exactly the number this screen must not invent. */}
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
          <ThemedText style={{ fontSize: 11, fontWeight: '800', color: theme.textSecondary, ...MONO }}>
            {pct}%
          </ThemedText>
        </View>
      )}
    </Pressable>
  );
}
