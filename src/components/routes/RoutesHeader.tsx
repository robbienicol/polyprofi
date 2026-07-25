import { Pressable, View } from 'react-native';

import { InvestmentAmountControl } from '@/components/routes/InvestmentAmountControl';
import { ThemedText } from '@/components/themed-text';
import { Brand, Radius, Shadow } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface GoalSummary {
  target: number;
  when: string;
}

interface RoutesHeaderProps {
  goal: GoalSummary;
  historical: boolean;
  batchLabel: string | null;
  amount: number;
  autoSize: boolean;
  referenceStake: number;
  routeCount: number;
  onAmountChange: (amount: number) => void;
  onAutoSizeChange: (autoSize: boolean) => void;
  onNewSearch: () => void;
  onBackToLatest: () => void;
}

export function RoutesHeader({
  goal,
  historical,
  batchLabel,
  amount,
  autoSize,
  referenceStake,
  routeCount,
  onAmountChange,
  onAutoSizeChange,
  onNewSearch,
  onBackToLatest,
}: RoutesHeaderProps): React.ReactElement {
  const theme = useTheme();
  return (
    <View style={{ borderRadius: Radius.xl, backgroundColor: theme.backgroundElevated, borderWidth: 1, borderColor: theme.border, padding: 18, gap: 14, ...Shadow.card }}>
      <View className="gap-1">
        <View className="flex-row justify-between items-center">
          <ThemedText style={{ fontSize: 11, fontWeight: '700', color: Brand[500], letterSpacing: 0.8 }}>
            {historical ? 'SAVED SEARCH' : 'YOUR PREDICTION ROUTES'}
          </ThemedText>
          {!historical && (
            <Pressable onPress={onNewSearch} className="active:opacity-60" style={{ borderRadius: Radius.pill, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: theme.backgroundSelected }}>
              <ThemedText style={{ fontSize: 12, fontWeight: '700', color: theme.textSecondary }}>New search</ThemedText>
            </Pressable>
          )}
        </View>
        <View className="flex-row items-baseline gap-1.5">
          <ThemedText numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={{ fontSize: 32, fontWeight: '800', color: theme.text, letterSpacing: -0.8, fontVariant: ['tabular-nums'] }}>Make +${goal.target.toLocaleString()}</ThemedText>
          <ThemedText style={{ fontSize: 13, color: theme.textTertiary }}>{goal.when}</ThemedText>
        </View>
      </View>
      <InvestmentAmountControl amount={amount} autoSize={autoSize} referenceStake={referenceStake} target={goal.target} routeCount={routeCount} goalWhen={goal.when} onAmountChange={onAmountChange} onAutoSizeChange={onAutoSizeChange} />
      {batchLabel && <ThemedText style={{ fontSize: 12, color: theme.textTertiary }}>{batchLabel}</ThemedText>}
      {historical && (
        <Pressable onPress={onBackToLatest} className="self-start active:opacity-70">
          <ThemedText style={{ fontSize: 13, fontWeight: '700', color: Brand[500] }}>← Back to latest search</ThemedText>
        </Pressable>
      )}
    </View>
  );
}
