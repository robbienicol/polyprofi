import React, { useRef, useState } from 'react';
import { Keyboard, Pressable, TextInput, View } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { ThemedText } from '@/components/themed-text';
import { Brand, Radius, Shadow } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { Haptic } from '@/lib/haptics';
import type { QuizAnswers } from '@/types/bets';

/** `label` sits in the one-row picker, so it has to stay short. */
const TIMEFRAMES = [
  { value: 'today', label: '1 day' },
  { value: 'week', label: '1 wk' },
  { value: 'month', label: '1 mo' },
  { value: '3months', label: '3 mo' },
  { value: '1year', label: '1 yr' },
  { value: '5years', label: '5 yr' },
] as const;

/** Widest goal the hero number can show without running off a small phone. */
const MAX_TARGET_DIGITS = 7;

/** How many thousands separators toLocaleString will add to this many digits. */
function groupingCommas(digits: string): number {
  return Math.max(0, Math.ceil(digits.length / 3) - 1);
}

/** Only the digits of what was typed, capped at the widest amount the screen shows. */
function digitsOf(text: string): string {
  return text.replace(/[^0-9]/g, '').slice(0, MAX_TARGET_DIGITS);
}

/** The headline amount: "$" and the number, set in display type with an underline. */
export function TargetAmountInput({
  target,
  targetValue,
  onChange,
}: {
  target: string;
  targetValue: number;
  onChange: (digits: string) => void;
}): React.ReactElement {
  const amountRef = useRef<TextInput>(null);

  return (
    <Pressable
      onPress={() => amountRef.current?.focus()}
      accessibilityRole="button"
      accessibilityLabel={`Amount, ${targetValue} dollars. Double tap to edit.`}
      className="flex-row items-end self-start active:opacity-80"
      style={{ marginTop: 2, borderBottomWidth: 3, borderBottomColor: Brand[500], paddingBottom: 2 }}>
      <ThemedText style={{ fontSize: 34, lineHeight: 66, fontWeight: '700', color: Brand[500] }}>$</ThemedText>
      <TextInput
        ref={amountRef}
        value={targetValue > 0 ? targetValue.toLocaleString() : target}
        // Cap digits here rather than with maxLength, which would count the
        // grouping commas and swallow the last two digits of a 7-figure goal.
        onChangeText={(text) => onChange(digitsOf(text))}
        keyboardType="number-pad"
        inputMode="numeric"
        selectTextOnFocus
        placeholder="0"
        placeholderTextColor={Brand[500] + '55'}
        style={{
          color: Brand[500],
          fontSize: 56,
          lineHeight: 66,
          fontWeight: '800',
          fontVariant: ['tabular-nums'],
          padding: 0,
          // TextInput can't hug its text, so size it from the character count —
          // otherwise the underline runs on past the number. Digits are wide and
          // the grouping commas are narrow; the slack covers the widest digit in
          // the platform font, since a tight fit clips.
          width: Math.max(1, target.length) * 37 + groupingCommas(target) * 14 + 12,
        }}
      />
    </Pressable>
  );
}

/** "Toward <goal>", with an ✕ that runs the same search on its own. */
export function GoalChip({ label, onRemove }: { label: string; onRemove: () => void }): React.ReactElement {
  const theme = useTheme();
  return (
    <View
      className="flex-row items-center self-start"
      style={{ gap: 8, paddingLeft: 12, paddingRight: 6, paddingVertical: 6, borderRadius: Radius.pill, backgroundColor: theme.backgroundSelected, marginTop: 14 }}>
      <ThemedText style={{ fontSize: 13, fontWeight: '700', color: theme.textSecondary }}>
        Toward {label}
      </ThemedText>
      <Pressable
        onPress={onRemove}
        accessibilityRole="button"
        accessibilityLabel={`Search without ${label}`}
        hitSlop={8}
        className="active:opacity-60"
        style={{ width: 22, height: 22, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.background }}>
        <Icon glyph="✕" size={12} color={theme.textSecondary} strokeWidth={2.5} />
      </Pressable>
    </View>
  );
}

/** The one-row segmented picker of timeframes. */
export function TimeframePicker({
  value,
  onChange,
}: {
  value: QuizAnswers['timeframe'];
  onChange: (timeframe: QuizAnswers['timeframe']) => void;
}): React.ReactElement {
  const theme = useTheme();
  return (
    <View
      className="flex-row"
      accessibilityRole="radiogroup"
      style={{ padding: 4, borderRadius: Radius.pill, backgroundColor: theme.backgroundSelected }}>
      {TIMEFRAMES.map((tf) => {
        const selected = value === tf.value;
        return (
          <Pressable
            key={tf.value}
            onPress={() => {
              Keyboard.dismiss();
              if (!selected) Haptic.select();
              onChange(tf.value);
            }}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            className="flex-1 items-center active:opacity-80"
            style={{
              paddingVertical: 10,
              borderRadius: Radius.pill,
              backgroundColor: selected ? theme.backgroundElevated : 'transparent',
              ...(selected ? Shadow.card : null),
            }}>
            <ThemedText
              style={{ fontSize: 13, fontWeight: '700', color: selected ? theme.text : theme.textSecondary }}>
              {tf.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

/** The most they would invest, in dollars. Blank means any amount. */
export function InvestInput({
  invest,
  investValue,
  onChange,
}: {
  invest: string;
  investValue: number;
  onChange: (digits: string) => void;
}): React.ReactElement {
  const theme = useTheme();
  const [investFocused, setInvestFocused] = useState(false);

  return (
    <View
      className="flex-row items-center"
      style={{
        gap: 6,
        paddingHorizontal: 14,
        borderWidth: 1.5,
        borderRadius: Radius.md,
        borderColor: investFocused ? Brand[500] : theme.borderStrong,
        backgroundColor: theme.backgroundElement,
      }}>
      <ThemedText style={{ fontSize: 17, fontWeight: '800', color: Brand[500] }}>$</ThemedText>
      <TextInput
        value={investValue > 0 ? investValue.toLocaleString() : invest}
        onChangeText={(text) => onChange(digitsOf(text))}
        onFocus={() => setInvestFocused(true)}
        onBlur={() => setInvestFocused(false)}
        keyboardType="number-pad"
        inputMode="numeric"
        selectTextOnFocus
        returnKeyType="done"
        placeholder="Any amount"
        placeholderTextColor={theme.textTertiary}
        accessibilityLabel="Most you would invest, in dollars"
        style={{ flex: 1, color: theme.text, fontSize: 17, fontWeight: '700', fontVariant: ['tabular-nums'], paddingVertical: 14 }}
      />
    </View>
  );
}

/** A small caps label over one of the form's answers. */
export function Field({ label, children }: React.PropsWithChildren<{ label: string }>): React.ReactElement {
  const theme = useTheme();
  return (
    <View style={{ gap: 10 }}>
      <ThemedText style={{ fontSize: 11, fontWeight: '800', letterSpacing: 0.9, color: theme.textTertiary }}>
        {label.toUpperCase()}
      </ThemedText>
      {children}
    </View>
  );
}
