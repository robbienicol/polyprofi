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
  referenceStake: number;
  routeCount: number;
  onAmountChange: (amount: number) => void;
  onNewSearch: () => void;
  onBackToLatest: () => void;
}

/**
 * Two separate cards: what this search is for, and how much the user is willing to
 * put in. They answer different questions and one of them is an input, so sharing
 * a card made the goal read like a label on the control.
 */
export function RoutesHeader({
  goal,
  historical,
  batchLabel,
  amount,
  referenceStake,
  routeCount,
  onAmountChange,
  onNewSearch,
  onBackToLatest,
}: RoutesHeaderProps): React.ReactElement {
  const theme = useTheme();
  return (
    <>
      <View style={{ borderRadius: Radius.xl, backgroundColor: theme.backgroundElevated, borderWidth: 1, borderColor: theme.border, padding: 16, gap: 10, ...Shadow.card }}>
        <View className="flex-row justify-between items-center" style={{ gap: 10 }}>
          <ThemedText style={{ fontSize: 11, fontWeight: '700', color: Brand[500], letterSpacing: 0.8 }}>
            {historical ? 'SAVED SEARCH' : 'YOUR PREDICTION ROUTES'}
          </ThemedText>
          {!historical && (
            <Pressable
              onPress={onNewSearch}
              accessibilityRole="button"
              accessibilityLabel="Start a new goal"
              hitSlop={6}
              className="active:opacity-75"
              style={{ borderRadius: Radius.pill, paddingHorizontal: 18, paddingVertical: 11, backgroundColor: Brand[500] }}>
              <ThemedText style={{ fontSize: 14, fontWeight: '900', color: '#06140C' }}>+ New goal</ThemedText>
            </Pressable>
          )}
        </View>

        <View className="flex-row items-baseline gap-1.5">
          <ThemedText numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={{ fontSize: 32, fontWeight: '800', color: theme.text, letterSpacing: -0.8, fontVariant: ['tabular-nums'] }}>
            Make +${goal.target.toLocaleString()}
          </ThemedText>
          <ThemedText style={{ fontSize: 13, color: theme.textTertiary }}>{goal.when}</ThemedText>
        </View>

        <ThemedText style={{ fontSize: 12, color: theme.textTertiary }}>
          <ThemedText style={{ fontSize: 12, fontWeight: '800', color: theme.textSecondary, fontVariant: ['tabular-nums'] }}>{routeCount}</ThemedText>
          {` route${routeCount === 1 ? '' : 's'} to +$${goal.target.toLocaleString()} ${goal.when}`}
        </ThemedText>

        {batchLabel && <ThemedText style={{ fontSize: 12, color: theme.textTertiary }}>{batchLabel}</ThemedText>}
        {historical && (
          <Pressable onPress={onBackToLatest} className="self-start active:opacity-70">
            <ThemedText style={{ fontSize: 13, fontWeight: '700', color: Brand[500] }}>← Back to latest search</ThemedText>
          </Pressable>
        )}
      </View>

      <InvestmentAmountControl amount={amount} referenceStake={referenceStake} onAmountChange={onAmountChange} />
    </>
  );
}
