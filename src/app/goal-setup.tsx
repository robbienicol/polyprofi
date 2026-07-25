import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSavingsGoal } from '@/api/hooks/useSavingsGoal';
import { OnboardingGlow } from '@/components/onboarding/OnboardingPreviews';
import { ThemedText } from '@/components/themed-text';
import { Brand, Radius, Shadow } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface GoalPreset {
  emoji: string;
  label: string;
  targetAmount: number;
  note: string;
}

// A spectrum from small, near-term wins to life-sized goals — the range itself is the pitch.
const GOAL_PRESETS: GoalPreset[] = [
  { emoji: '🎧', label: 'Headphones', targetAmount: 350, note: 'A quick first win' },
  { emoji: '🏄', label: 'A surfboard', targetAmount: 1_200, note: 'Treat yourself' },
  { emoji: '✈️', label: 'A dream trip', targetAmount: 4_000, note: 'Somewhere new' },
  { emoji: '🛟', label: 'Emergency fund', targetAmount: 6_000, note: 'Peace of mind' },
  { emoji: '🚗', label: 'A car', targetAmount: 12_000, note: 'Keys in hand' },
  { emoji: '🏠', label: 'House deposit', targetAmount: 30_000, note: 'The big one' },
];

const CUSTOM_ID = 'custom';

export default function GoalSetupScreen(): React.ReactElement {
  const theme = useTheme();
  const router = useRouter();
  const { setGoal } = useSavingsGoal();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [customLabel, setCustomLabel] = useState('');
  const [customAmount, setCustomAmount] = useState('');
  const [amountFocused, setAmountFocused] = useState(false);
  const [labelFocused, setLabelFocused] = useState(false);

  const isCustom = selectedId === CUSTOM_ID;
  const customAmountValue = Number(customAmount.replace(/[^0-9]/g, '')) || 0;

  const chosen = useMemo(() => {
    if (isCustom) {
      return customLabel.trim() && customAmountValue > 0
        ? { emoji: '🎯', label: customLabel.trim(), targetAmount: customAmountValue }
        : null;
    }
    const preset = GOAL_PRESETS.find((goal) => goal.label === selectedId);
    return preset ? { emoji: preset.emoji, label: preset.label, targetAmount: preset.targetAmount } : null;
  }, [isCustom, customLabel, customAmountValue, selectedId]);

  const start = (): void => {
    if (!chosen) return;
    setGoal(chosen);
    router.replace('/(tabs)');
  };

  return (
    <View className="flex-1" style={{ backgroundColor: theme.background }}>
      <OnboardingGlow />
      <SafeAreaView className="flex-1">
        <KeyboardAvoidingView className="flex-1" behavior={Platform.select({ ios: 'padding', android: undefined })}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 24, paddingBottom: 24 }}>

            <ThemedText style={{ fontSize: 12, fontWeight: '800', color: Brand[500], letterSpacing: 1 }}>
              LET&apos;S MAKE IT REAL
            </ThemedText>
            <ThemedText style={{ fontSize: 34, lineHeight: 40, fontWeight: '800', color: theme.text, letterSpacing: -0.8, marginTop: 8 }}>
              What are you{'\n'}saving for?
            </ThemedText>
            <ThemedText style={{ fontSize: 15, lineHeight: 22, color: theme.textSecondary, marginTop: 10, maxWidth: 320 }}>
              Pick a goal and we&apos;ll map the routes — safe to bold — that get you there.
            </ThemedText>

            <View className="flex-row flex-wrap" style={{ marginTop: 24, gap: 12 }}>
              {GOAL_PRESETS.map((goal) => {
                const selected = selectedId === goal.label;
                return (
                  <Pressable
                    key={goal.label}
                    onPress={() => setSelectedId(goal.label)}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    className="active:opacity-90"
                    style={{
                      width: '47%',
                      flexGrow: 1,
                      borderRadius: Radius.lg,
                      borderWidth: 1.5,
                      borderColor: selected ? Brand[500] : theme.border,
                      backgroundColor: selected ? Brand[500] + '14' : theme.backgroundElement,
                      padding: 16,
                      transform: [{ scale: selected ? 1.02 : 1 }],
                      ...(selected ? Shadow.card : null),
                    }}>
                    <View className="flex-row items-start justify-between">
                      <View style={{ width: 46, height: 46, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: selected ? Brand[500] + '22' : theme.backgroundSelected }}>
                        <ThemedText style={{ fontSize: 24 }}>{goal.emoji}</ThemedText>
                      </View>
                      {selected ? (
                        <View style={{ width: 22, height: 22, borderRadius: 999, backgroundColor: Brand[500], alignItems: 'center', justifyContent: 'center' }}>
                          <ThemedText style={{ fontSize: 12, fontWeight: '900', color: '#06140C' }}>✓</ThemedText>
                        </View>
                      ) : null}
                    </View>
                    <ThemedText numberOfLines={1} style={{ fontSize: 15, fontWeight: '800', color: theme.text, marginTop: 12 }}>
                      {goal.label}
                    </ThemedText>
                    <ThemedText style={{ fontSize: 11, color: theme.textTertiary, marginTop: 2 }}>{goal.note}</ThemedText>
                    <ThemedText style={{ fontSize: 18, fontWeight: '900', color: selected ? Brand[500] : theme.textSecondary, marginTop: 8, fontVariant: ['tabular-nums'] }}>
                      ${goal.targetAmount.toLocaleString()}
                    </ThemedText>
                  </Pressable>
                );
              })}

              {/* Custom goal */}
              <Pressable
                onPress={() => setSelectedId(CUSTOM_ID)}
                accessibilityRole="button"
                accessibilityState={{ selected: isCustom }}
                className="active:opacity-90"
                style={{
                  width: '100%',
                  borderRadius: Radius.lg,
                  borderWidth: 1.5,
                  borderColor: isCustom ? Brand[500] : theme.border,
                  backgroundColor: isCustom ? Brand[500] + '14' : theme.backgroundElement,
                  padding: 16,
                  gap: isCustom ? 14 : 0,
                }}>
                <View className="flex-row items-center" style={{ gap: 12 }}>
                  <View style={{ width: 46, height: 46, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: isCustom ? Brand[500] + '22' : theme.backgroundSelected }}>
                    <ThemedText style={{ fontSize: 24 }}>🎯</ThemedText>
                  </View>
                  <View className="flex-1">
                    <ThemedText style={{ fontSize: 15, fontWeight: '800', color: theme.text }}>Something else</ThemedText>
                    <ThemedText style={{ fontSize: 11, color: theme.textTertiary, marginTop: 2 }}>Name your own goal</ThemedText>
                  </View>
                  {isCustom ? (
                    <View style={{ width: 22, height: 22, borderRadius: 999, backgroundColor: Brand[500], alignItems: 'center', justifyContent: 'center' }}>
                      <ThemedText style={{ fontSize: 12, fontWeight: '900', color: '#06140C' }}>✓</ThemedText>
                    </View>
                  ) : null}
                </View>

                {isCustom ? (
                  <View style={{ gap: 10 }}>
                    <TextInput
                      value={customLabel}
                      onChangeText={setCustomLabel}
                      onFocus={() => setLabelFocused(true)}
                      onBlur={() => setLabelFocused(false)}
                      placeholder="What is it? (e.g. New laptop)"
                      placeholderTextColor={theme.textTertiary}
                      maxLength={40}
                      style={{ borderWidth: 1.5, borderRadius: Radius.md, borderColor: labelFocused ? Brand[500] : theme.borderStrong, backgroundColor: theme.background, color: theme.text, fontSize: 15, fontWeight: '600', paddingVertical: 13, paddingHorizontal: 14 }}
                    />
                    <View className="flex-row items-center" style={{ borderWidth: 1.5, borderRadius: Radius.md, borderColor: amountFocused ? Brand[500] : theme.borderStrong, backgroundColor: theme.background, paddingHorizontal: 14 }}>
                      <ThemedText style={{ fontSize: 18, fontWeight: '800', color: Brand[500], marginRight: 4 }}>$</ThemedText>
                      <TextInput
                        value={customAmount}
                        onChangeText={(text) => setCustomAmount(text.replace(/[^0-9]/g, ''))}
                        onFocus={() => setAmountFocused(true)}
                        onBlur={() => setAmountFocused(false)}
                        placeholder="How much?"
                        placeholderTextColor={theme.textTertiary}
                        keyboardType="number-pad"
                        inputMode="numeric"
                        style={{ flex: 1, color: theme.text, fontSize: 18, fontWeight: '800', fontVariant: ['tabular-nums'], paddingVertical: 13 }}
                      />
                    </View>
                  </View>
                ) : null}
              </Pressable>
            </View>
          </ScrollView>

          {/* Sticky CTA */}
          <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8, borderTopWidth: 1, borderTopColor: theme.border, backgroundColor: theme.background }}>
            {chosen ? (
              <View className="flex-row items-center justify-between" style={{ marginBottom: 10, paddingHorizontal: 2 }}>
                <ThemedText style={{ fontSize: 13, color: theme.textSecondary }}>
                  Saving for {chosen.emoji} {chosen.label}
                </ThemedText>
                <ThemedText style={{ fontSize: 15, fontWeight: '900', color: Brand[500], fontVariant: ['tabular-nums'] }}>
                  ${chosen.targetAmount.toLocaleString()}
                </ThemedText>
              </View>
            ) : (
              <ThemedText style={{ fontSize: 13, color: theme.textTertiary, marginBottom: 10, paddingHorizontal: 2 }}>
                Choose a goal to continue
              </ThemedText>
            )}
            <Pressable
              onPress={start}
              disabled={!chosen}
              accessibilityRole="button"
              className="py-4 items-center active:opacity-85"
              style={{ borderRadius: Radius.lg, backgroundColor: Brand[500], opacity: chosen ? 1 : 0.4, ...Shadow.card }}>
              <ThemedText style={{ fontSize: 16, fontWeight: '900', color: '#06140C' }}>
                {chosen ? 'Start saving →' : 'Start saving'}
              </ThemedText>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
