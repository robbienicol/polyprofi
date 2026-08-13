import { Pressable, View } from 'react-native';

import { useMoney } from '@/api/hooks/usePreferences';
import { ThemedText } from '@/components/themed-text';
import { Brand, Radius, Shadow } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { SavingsGoal } from '@/types/bets';

const MONO = { fontVariant: ['tabular-nums' as const] };

interface SavingsGoalCardProps {
  goal: SavingsGoal;
  value: number; // net gains only; invested principal never counts
  achievedCount: number;
  onSetNew: () => void;
}

export function SavingsGoalCard({ goal, value, achievedCount, onSetNew }: SavingsGoalCardProps): React.ReactElement {
  const theme = useTheme();
  const money = useMoney();
  const netGain = value;
  const achieved = netGain >= goal.targetAmount;
  const progress = Math.max(0, Math.min(1, netGain / goal.targetAmount));
  const remaining = Math.max(0, goal.targetAmount - netGain);
  const netGainLabel = money(netGain, { decimals: 0, signed: true });
  const targetLabel = money(goal.targetAmount, { decimals: 0, signed: true });

  if (achieved) {
    return (
      <View style={{ borderRadius: Radius.xl, backgroundColor: theme.backgroundElevated, borderWidth: 1.5, borderColor: Brand[500], padding: 20, gap: 12, ...Shadow.card }}>
        <View className="flex-row items-center" style={{ gap: 12 }}>
          <View style={{ width: 52, height: 52, borderRadius: Radius.lg, alignItems: 'center', justifyContent: 'center', backgroundColor: Brand[500] + '22' }}>
            <ThemedText style={{ fontSize: 28 }}>{goal.emoji}</ThemedText>
          </View>
          <View className="flex-1">
            <ThemedText style={{ fontSize: 12, fontWeight: '800', color: Brand[500], letterSpacing: 0.4 }}>PROFIT GOAL HIT 🎉</ThemedText>
            <ThemedText style={{ fontSize: 18, fontWeight: '800', color: theme.text, marginTop: 2 }} numberOfLines={1}>
              You earned enough for {goal.label}
            </ThemedText>
          </View>
        </View>
        <ThemedText style={{ fontSize: 13, lineHeight: 19, color: theme.textSecondary }}>
          {netGainLabel} in net gains reached your {targetLabel} goal. Your invested principal is not included.
        </ThemedText>
        <Pressable
          onPress={onSetNew}
          accessibilityRole="button"
          className="py-3.5 items-center active:opacity-85"
          style={{ borderRadius: Radius.lg, backgroundColor: Brand[500], marginTop: 2 }}>
          <ThemedText style={{ fontSize: 15, fontWeight: '900', color: '#06140C' }}>Set your next goal →</ThemedText>
        </Pressable>
        {achievedCount > 0 ? (
          <ThemedText style={{ fontSize: 12, color: theme.textTertiary, textAlign: 'center' }}>
            🏆 {achievedCount} goal{achievedCount === 1 ? '' : 's'} reached
          </ThemedText>
        ) : null}
      </View>
    );
  }

  return (
    <Pressable
      onPress={onSetNew}
      accessibilityRole="button"
      accessibilityLabel={`Profit goal: ${goal.label}. ${netGainLabel} net profit and loss. ${Math.round(progress * 100)} percent there. Tap to change.`}
      className="active:opacity-95"
      style={{ borderRadius: Radius.xl, backgroundColor: theme.backgroundElevated, borderWidth: 1, borderColor: theme.border, padding: 20, gap: 16, ...Shadow.card }}>
      <View className="flex-row items-center" style={{ gap: 12 }}>
        <View style={{ width: 52, height: 52, borderRadius: Radius.lg, alignItems: 'center', justifyContent: 'center', backgroundColor: Brand[500] + '18' }}>
          <ThemedText style={{ fontSize: 28 }}>{goal.emoji}</ThemedText>
        </View>
        <View className="flex-1">
          <ThemedText style={{ fontSize: 11, fontWeight: '800', color: theme.textTertiary, letterSpacing: 0.5 }}>PROFIT GOAL</ThemedText>
          <ThemedText style={{ fontSize: 18, fontWeight: '800', color: theme.text, marginTop: 1, letterSpacing: -0.2 }} numberOfLines={1}>
            {goal.label}
          </ThemedText>
        </View>
        <ThemedText style={{ fontSize: 26, fontWeight: '900', color: Brand[500], ...MONO }}>
          {Math.round(progress * 100)}%
        </ThemedText>
      </View>

      <View style={{ gap: 8 }}>
        <View style={{ height: 12, borderRadius: Radius.pill, backgroundColor: theme.backgroundSelected, overflow: 'hidden' }}>
          <View style={{ width: `${Math.max(progress * 100, 2)}%`, height: '100%', borderRadius: Radius.pill, backgroundColor: Brand[500] }} />
        </View>
        <View className="flex-row items-baseline justify-between">
          <ThemedText style={{ fontSize: 15, fontWeight: '800', color: theme.text, ...MONO }}>
            {netGainLabel}
            <ThemedText style={{ fontSize: 13, fontWeight: '600', color: theme.textTertiary }}> net P&amp;L of {targetLabel}</ThemedText>
          </ThemedText>
          <ThemedText style={{ fontSize: 12, fontWeight: '700', color: theme.textSecondary, ...MONO }}>
            {money(remaining, { decimals: 0 })} to go
          </ThemedText>
        </View>
      </View>
    </Pressable>
  );
}
