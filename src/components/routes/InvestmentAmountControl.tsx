import { Pressable, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Brand, Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface InvestmentAmountControlProps {
  amount: number;
  autoSize: boolean;
  referenceStake: number;
  target: number;
  routeCount: number;
  goalWhen: string;
  onAmountChange: (amount: number) => void;
  onAutoSizeChange: (autoSize: boolean) => void;
}

export function InvestmentAmountControl({
  amount,
  autoSize,
  referenceStake,
  target,
  routeCount,
  goalWhen,
  onAmountChange,
  onAutoSizeChange,
}: InvestmentAmountControlProps): React.ReactElement {
  const theme = useTheme();
  const presets = [
    { label: '25%', value: Math.max(1, Math.round(referenceStake * 0.25)) },
    { label: '50%', value: Math.max(1, Math.round(referenceStake * 0.5)) },
    { label: 'All', value: Math.max(1, Math.round(referenceStake)) },
  ];

  return (
    <View className="gap-3">
      <ThemedText style={{ fontSize: 12, fontWeight: '600', color: theme.textSecondary }}>
        {autoSize ? 'Amount per route' : 'Amount to invest'}
      </ThemedText>

      <View className="flex-row items-center" style={{ gap: 10 }}>
        <View
          className="flex-1 flex-row items-center"
          style={{ minHeight: 54, borderRadius: Radius.md, borderWidth: 1.5, borderColor: autoSize ? theme.border : Brand[500], backgroundColor: theme.background, paddingHorizontal: 16, opacity: autoSize ? 0.55 : 1 }}>
          {autoSize ? (
            <ThemedText style={{ color: theme.textTertiary, fontSize: 17, fontWeight: '700' }}>Sized per route</ThemedText>
          ) : (
            <>
              <ThemedText style={{ color: Brand[500], fontSize: 22, fontWeight: '800', marginRight: 4 }}>$</ThemedText>
              <TextInput
                value={amount > 0 ? String(amount) : ''}
                onChangeText={(text) => onAmountChange(Number(text.replace(/[^0-9]/g, '')) || 0)}
                onBlur={() => amount < 1 && onAmountChange(1)}
                keyboardType="number-pad"
                inputMode="numeric"
                returnKeyType="done"
                accessibilityLabel="Exact investment amount in dollars"
                placeholder="0"
                placeholderTextColor={theme.textTertiary}
                style={{ flex: 1, color: theme.text, fontSize: 26, fontWeight: '800', fontVariant: ['tabular-nums'], paddingVertical: 10 }}
              />
            </>
          )}
        </View>
        <Pressable
          onPress={() => onAutoSizeChange(!autoSize)}
          accessibilityRole="button"
          accessibilityState={{ selected: autoSize }}
          className="active:opacity-75"
          style={{ minHeight: 54, justifyContent: 'center', alignItems: 'center', borderRadius: Radius.md, borderWidth: 1.5, borderColor: autoSize ? Brand[500] : theme.borderStrong, backgroundColor: autoSize ? Brand[500] + '1A' : theme.background, paddingHorizontal: 16 }}>
          <ThemedText style={{ fontSize: 13, fontWeight: '800', color: autoSize ? Brand[500] : theme.textSecondary }}>
            {autoSize ? 'Use exact' : 'Auto-size'}
          </ThemedText>
        </Pressable>
      </View>

      {autoSize ? (
        <ThemedText style={{ fontSize: 12, lineHeight: 17, color: theme.textSecondary }}>
          Each route shows the amount needed to reach your +${target.toLocaleString()} goal.
        </ThemedText>
      ) : (
        <View className="flex-row" style={{ gap: 8 }}>
          {presets.map((preset) => {
            const active = amount === preset.value;
            return (
              <Pressable
                key={preset.label}
                onPress={() => onAmountChange(preset.value)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                className="flex-1 flex-row items-baseline justify-center active:opacity-70"
                style={{ gap: 5, borderRadius: Radius.pill, borderWidth: 1, borderColor: active ? Brand[500] : theme.border, backgroundColor: active ? Brand[500] + '14' : theme.backgroundElement, paddingVertical: 10 }}>
                <ThemedText style={{ fontSize: 11, fontWeight: '700', color: active ? Brand[500] : theme.textTertiary }}>{preset.label}</ThemedText>
                <ThemedText style={{ fontSize: 13, fontWeight: '800', color: active ? Brand[500] : theme.textSecondary, fontVariant: ['tabular-nums'] }}>${preset.value.toLocaleString()}</ThemedText>
              </Pressable>
            );
          })}
        </View>
      )}

      <ThemedText style={{ fontSize: 12, color: theme.textTertiary }}>
        <ThemedText style={{ fontSize: 12, fontWeight: '800', color: theme.textSecondary, fontVariant: ['tabular-nums'] }}>{routeCount}</ThemedText>
        {` route${routeCount === 1 ? '' : 's'} to +$${target.toLocaleString()} ${goalWhen}`}
      </ThemedText>
    </View>
  );
}
