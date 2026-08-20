import Slider from '@react-native-community/slider';
import { TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Brand, Radius, Shadow } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface InvestmentAmountControlProps {
  amount: number;
  referenceStake: number;
  onAmountChange: (amount: number) => void;
}

/**
 * Round increments that keep the slider's stops readable at any budget — 24-ish
 * steps across the range, landing on numbers a person would actually type.
 */
function stepFor(referenceStake: number): number {
  if (referenceStake <= 500) return 10;
  if (referenceStake <= 2_000) return 50;
  if (referenceStake <= 10_000) return 100;
  if (referenceStake <= 50_000) return 500;
  return 1_000;
}

/**
 * How much the user is willing to invest, set either by dragging or by typing —
 * the same number, two ways in, because a slider can't hit an exact figure and a
 * keyboard is slow for rough ones. It is a ceiling: each route uses only what it
 * needs to reach the target, and never more than this.
 */
export function InvestmentAmountControl({
  amount,
  referenceStake,
  onAmountChange,
}: InvestmentAmountControlProps): React.ReactElement {
  const theme = useTheme();
  const step = stepFor(referenceStake);
  // Typing can exceed the slider's range, so the track ends at whichever is
  // larger rather than snapping a deliberately bigger number back down.
  const maximum = Math.max(step, Math.round(referenceStake), amount);

  return (
    <View style={{ borderRadius: Radius.xl, backgroundColor: theme.backgroundElevated, borderWidth: 1, borderColor: theme.border, paddingHorizontal: 16, paddingVertical: 14, gap: 8, ...Shadow.card }}>
      <ThemedText style={{ fontSize: 13, fontWeight: '700', color: theme.text }}>
        Amount you&apos;re willing to invest
      </ThemedText>

      {/* Full width so the number is a comfortable tap target and long figures
          never squeeze the label. */}
      <View
        className="flex-row items-center"
        style={{ borderRadius: Radius.md, borderWidth: 1.5, borderColor: theme.borderStrong, backgroundColor: theme.background, paddingHorizontal: 14 }}>
        <ThemedText style={{ fontSize: 20, fontWeight: '800', color: Brand[500], marginRight: 4 }}>$</ThemedText>
        <TextInput
          value={amount > 0 ? amount.toLocaleString('en-US') : ''}
          onChangeText={(text) => onAmountChange(Number(text.replace(/[^0-9]/g, '')) || 0)}
          onBlur={() => amount < 1 && onAmountChange(1)}
          keyboardType="number-pad"
          inputMode="numeric"
          returnKeyType="done"
          selectTextOnFocus
          accessibilityLabel="Amount you are willing to invest, in dollars"
          placeholder="0"
          placeholderTextColor={theme.textTertiary}
          style={{ flex: 1, color: theme.text, fontSize: 20, fontWeight: '800', fontVariant: ['tabular-nums'], paddingVertical: 11 }}
        />
      </View>

      <Slider
        style={{ width: '100%', height: 32 }}
        minimumValue={step}
        maximumValue={maximum}
        step={step}
        value={Math.min(Math.max(amount, step), maximum)}
        onValueChange={(value) => onAmountChange(Math.round(value))}
        accessibilityLabel="Amount you are willing to invest"
        minimumTrackTintColor={Brand[500]}
        maximumTrackTintColor={theme.backgroundSelected}
        thumbTintColor={Brand[500]}
      />
    </View>
  );
}
