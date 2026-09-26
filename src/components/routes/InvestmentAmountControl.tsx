import Slider from '@react-native-community/slider';
import { useState } from 'react';
import { TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Brand, Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface InvestmentAmountControlProps {
  amount: number;
  /**
   * Top of the track. Deliberately not the same number as the default amount: the
   * caller sizes this above what it expects the user to invest so the thumb has
   * somewhere to go. See investmentSliderMaximum in `@/lib/quiz-profile`.
   */
  maximum: number;
  onAmountChange: (amount: number) => void;
}

/**
 * Round increments that keep the slider's stops readable at any budget — 24-ish
 * steps across the range, landing on numbers a person would actually type.
 */
function stepFor(maximum: number): number {
  if (maximum <= 500) return 10;
  if (maximum <= 2_000) return 50;
  if (maximum <= 10_000) return 100;
  if (maximum <= 50_000) return 500;
  return 1_000;
}

/**
 * How much the user is willing to invest, set either by dragging or by typing —
 * the same number, two ways in, because a slider can't hit an exact figure and a
 * keyboard is slow for rough ones. It is a ceiling: each route uses only what it
 * needs to reach the target, and never more than this.
 *
 * No card chrome of its own — this lives inside the Filters panel now, which
 * supplies the border and background for every section alike.
 */
export function InvestmentAmountControl({
  amount,
  maximum,
  onAmountChange,
}: InvestmentAmountControlProps): React.ReactElement {
  const theme = useTheme();
  const step = stepFor(maximum);
  // Where the thumb is *right now*, while a drag is in flight. Committing every
  // intermediate value re-ranked and re-scored the whole route pool on each of the
  // many events a drag fires, which is what made the slider feel stuck: the thumb
  // was waiting on a full re-render before it could move again. The number on
  // screen still tracks the drag; only the re-rank waits for the finger to lift.
  // The drag in flight, tagged with the amount it started from. It shows while the
  // committed amount is still that one, and stops the moment the parent commits a
  // new amount — so it clears itself without an effect, and a value the parent
  // clamps is shown as clamped rather than as whatever the finger last touched.
  const [drag, setDrag] = useState<{ from: number; value: number } | null>(null);
  const displayed = drag && drag.from === amount ? drag.value : amount;
  // Typing can exceed the slider's range, so the track ends at whichever is
  // larger rather than snapping a deliberately bigger number back down.
  const trackMaximum = Math.max(step, Math.round(maximum), displayed);

  return (
    <View style={{ gap: 6 }}>
      {/* Label and input share a row so the whole card is one compact strip
          instead of stacking to three lines. */}
      <View className="flex-row items-center justify-between" style={{ gap: 10 }}>
        <ThemedText style={{ fontSize: 12, fontWeight: '700', color: theme.textSecondary, flexShrink: 1 }}>
          Willing to invest
        </ThemedText>
        <View
          className="flex-row items-center"
          style={{ borderRadius: Radius.md, borderWidth: 1.5, borderColor: theme.borderStrong, backgroundColor: theme.background, paddingHorizontal: 10 }}>
          <ThemedText style={{ fontSize: 17, fontWeight: '800', color: Brand[500], marginRight: 2 }}>$</ThemedText>
          <TextInput
            value={displayed > 0 ? displayed.toLocaleString('en-US') : ''}
            onChangeText={(text) => {
              setDrag(null);
              onAmountChange(Number(text.replace(/[^0-9]/g, '')) || 0);
            }}
            onBlur={() => amount < 1 && onAmountChange(1)}
            keyboardType="number-pad"
            inputMode="numeric"
            returnKeyType="done"
            selectTextOnFocus
            accessibilityLabel="Amount you are willing to invest, in dollars"
            placeholder="0"
            placeholderTextColor={theme.textTertiary}
            style={{ minWidth: 70, color: theme.text, fontSize: 17, fontWeight: '800', fontVariant: ['tabular-nums'], paddingVertical: 7, textAlign: 'right' }}
          />
        </View>
      </View>

      <Slider
        style={{ width: '100%', height: 26 }}
        minimumValue={step}
        maximumValue={trackMaximum}
        step={step}
        // Driven by the committed amount only. Feeding the in-flight drag back in
        // made every frame re-set the native thumb from JS, so it fought the finger.
        value={Math.min(Math.max(amount, step), trackMaximum)}
        onValueChange={(value) => setDrag({ from: amount, value: Math.round(value) })}
        onSlidingComplete={(value) => onAmountChange(Math.round(value))}
        accessibilityLabel="Amount you are willing to invest"
        minimumTrackTintColor={Brand[500]}
        maximumTrackTintColor={theme.backgroundSelected}
        thumbTintColor={Brand[500]}
      />
    </View>
  );
}
