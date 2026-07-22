import Slider from '@react-native-community/slider';
import { Pressable, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Brand, Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const SLIDER_FLOOR = 10_000;

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
  const maximum = Math.max(SLIDER_FLOOR, referenceStake, amount);
  const step = sliderStep(maximum);
  const presets = [
    { label: '25%', value: Math.max(1, Math.round(referenceStake * 0.25)) },
    { label: '50%', value: Math.max(1, Math.round(referenceStake * 0.5)) },
    { label: 'All', value: Math.max(1, Math.round(referenceStake)) },
  ];

  return (
    <View className="gap-3">
      <View className="flex-row justify-between items-center">
        <ThemedText style={{ fontSize: 12, color: theme.textSecondary, fontWeight: '600' }}>Amount to invest</ThemedText>
        <ThemedText style={{ fontSize: 11, color: theme.textTertiary }}>
          {autoSize ? 'Sized separately for each route' : 'Enter an exact amount'}
        </ThemedText>
      </View>
      <View className="flex-row items-center" style={{ gap: 10 }}>
        <View className="flex-1 flex-row items-center" style={{ minHeight: 48, borderRadius: Radius.md, borderWidth: 1, borderColor: autoSize ? theme.border : Brand[500], backgroundColor: theme.background, paddingHorizontal: 14, opacity: autoSize ? 0.55 : 1 }}>
          {autoSize ? (
            <ThemedText style={{ color: theme.textTertiary, fontSize: 16, fontWeight: '700' }}>Amount varies by route</ThemedText>
          ) : (
            <>
              <ThemedText style={{ color: Brand[500], fontSize: 20, fontWeight: '800' }}>$</ThemedText>
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
                style={{ flex: 1, color: theme.text, fontSize: 22, fontWeight: '800', fontVariant: ['tabular-nums'], paddingVertical: 9, paddingHorizontal: 7 }}
              />
            </>
          )}
        </View>
        <Pressable
          onPress={() => onAutoSizeChange(!autoSize)}
          accessibilityRole="button"
          accessibilityState={{ selected: autoSize }}
          className="active:opacity-75"
          style={{ minHeight: 48, justifyContent: 'center', borderRadius: Radius.md, borderWidth: 1, borderColor: autoSize ? Brand[500] : theme.borderStrong, backgroundColor: autoSize ? Brand[500] + '1A' : theme.background, paddingHorizontal: 14 }}>
          <ThemedText style={{ fontSize: 13, fontWeight: '800', color: autoSize ? Brand[500] : theme.textSecondary }}>
            {autoSize ? 'Use exact' : 'Auto-size'}
          </ThemedText>
        </Pressable>
      </View>
      {autoSize ? (
        <ThemedText style={{ fontSize: 12, lineHeight: 17, color: theme.textSecondary }}>
          Each route now shows the amount needed to reach your +${target} goal.
        </ThemedText>
      ) : (
        <>
          <View className="flex-row" style={{ gap: 8 }}>
            {presets.map((preset) => (
              <Pressable key={preset.label} onPress={() => onAmountChange(preset.value)} accessibilityRole="button" accessibilityState={{ selected: amount === preset.value }} className="flex-1 items-center active:opacity-70" style={{ borderRadius: Radius.pill, borderWidth: 1, borderColor: amount === preset.value ? Brand[500] : theme.border, backgroundColor: amount === preset.value ? Brand[500] + '14' : theme.backgroundElement, paddingVertical: 8 }}>
                <ThemedText style={{ fontSize: 10, fontWeight: '700', color: amount === preset.value ? Brand[500] : theme.textTertiary }}>{preset.label}</ThemedText>
                <ThemedText style={{ fontSize: 12, fontWeight: '800', color: amount === preset.value ? Brand[500] : theme.textSecondary, fontVariant: ['tabular-nums'] }}>${preset.value.toLocaleString()}</ThemedText>
              </Pressable>
            ))}
          </View>
          <Slider style={{ width: '100%', height: 34 }} minimumValue={1} maximumValue={maximum} step={step} value={Math.min(amount || target, maximum)} onValueChange={onAmountChange} minimumTrackTintColor={Brand[500]} maximumTrackTintColor={theme.backgroundSelected} thumbTintColor={Brand[500]} accessibilityLabel="Investment amount shortcut" />
          <View className="flex-row justify-between">
            <ThemedText style={{ fontSize: 11, color: theme.textTertiary }}>$1</ThemedText>
            <ThemedText style={{ fontSize: 11, color: theme.textTertiary }}>Slider moves in ${step} steps · ${maximum.toLocaleString()} max</ThemedText>
          </View>
        </>
      )}
      <ThemedText style={{ fontSize: 11, color: theme.textTertiary }}>{routeCount} ways to make +${target} {goalWhen}</ThemedText>
    </View>
  );
}

function sliderStep(maximum: number): number {
  if (maximum <= 500) return 5;
  if (maximum <= 2_000) return 10;
  if (maximum <= 10_000) return 50;
  return 100;
}
