import { useRouter, type Href } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSavingsGoal } from '@/api/hooks/useSavingsGoal';
import { OnboardingGlow } from '@/components/onboarding/OnboardingPreviews';
import { Icon } from '@/components/ui/Icon';
import { ThemedText } from '@/components/themed-text';
import { bodyFontFamily, Brand, displayFontFamily, OnBrand, Radius, Semantic, Shadow } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { Haptic } from '@/lib/haptics';
import { goalByLabel } from '@/lib/savings-goal';

/**
 * Two ways to set a goal, and nothing pre-picked. The preset grid (headphones, a
 * surfboard, a car…) put six stranger's goals between the user and their own, and
 * its dollar figures were guesses. Now it is: name it and set the number, or skip
 * the finish line entirely.
 */
type Mode = 'target' | 'open';

const TARGET_EMOJI = '🎯';
const OPEN_EMOJI = '💸';
/** What an unnamed open-ended goal is called on the Goals tab. */
const OPEN_DEFAULT_LABEL = 'Custom goal';
/** Widest amount the hero field shows without running off a small phone. */
const MAX_DIGITS = 7;

interface ChosenGoal {
  emoji: string;
  label: string;
  /** Absent for the open-ended goal. */
  targetAmount?: number;
}

function groupingCommas(digits: string): number {
  return Math.max(0, Math.ceil(digits.length / 3) - 1);
}

export default function GoalSetupScreen(): React.ReactElement {
  const theme = useTheme();
  const router = useRouter();
  const { allGoals, hasAnyGoal, isLoading, addGoalAsync } = useSavingsGoal();
  const amountRef = useRef<TextInput>(null);

  const [mode, setMode] = useState<Mode>('target');
  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState('');
  const [labelFocused, setLabelFocused] = useState(false);
  const [amountFocused, setAmountFocused] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const amountValue = Number(amount) || 0;
  const trimmedLabel = label.trim();
  // Read live rather than latched on mount: on mount the stored goals may still be
  // loading, which would make every visit look like the first one. Drafts count.
  const isFirstGoal = !hasAnyGoal;

  const chosen: ChosenGoal | null =
    mode === 'open'
      ? { emoji: OPEN_EMOJI, label: trimmedLabel || OPEN_DEFAULT_LABEL }
      : trimmedLabel && amountValue > 0
        ? { emoji: TARGET_EMOJI, label: trimmedLabel, targetAmount: amountValue }
        : null;

  // The goal is created here, on the tap, so it is on the Goals tab the moment
  // this screen closes — tapping "Add goal" and then finding nothing there read as
  // a broken button. The quiz then runs its search against that goal by id.
  //
  // A name that already exists continues that goal rather than opening a rival
  // with the same label, which is what the quiz did with a name before.
  const start = async (): Promise<void> => {
    if (!chosen || saving) return;
    Haptic.press();
    setSaveError(null);

    // Only a goal still in play: a reached goal, or a hidden draft, reused here would
    // throw the new target away. The default open-ended name never matches, or a
    // second "Custom goal" could never be created.
    const live = allGoals.filter((goal) => !goal.draft && !goal.achievedAt);
    const existing = chosen.label === OPEN_DEFAULT_LABEL ? null : goalByLabel(live, chosen.label);
    if (existing) {
      Haptic.success();
      router.replace(`/quiz?goalId=${existing.id}` as Href);
      return;
    }

    setSaving(true);
    try {
      const { goal } = await addGoalAsync({
        label: chosen.label,
        emoji: chosen.emoji,
        ...(chosen.targetAmount != null ? { targetAmount: chosen.targetAmount } : null),
      });
      Haptic.success();
      router.replace(`/quiz?goalId=${goal.id}` as Href);
    } catch {
      Haptic.error();
      setSaving(false);
      setSaveError("Couldn't save that goal. Please try again.");
    }
  };

  // Existing goals decide the copy, so don't paint until they're known.
  if (isLoading) return <View className="flex-1" style={{ backgroundColor: theme.background }} />;

  const hint =
    mode === 'open'
      ? 'Routes ranked, earnings tracked'
      : !trimmedLabel
        ? 'Name your goal to continue'
        : amountValue <= 0
          ? 'Set how much to continue'
          : null;

  return (
    <View className="flex-1" style={{ backgroundColor: theme.background }}>
      <OnboardingGlow />
      <SafeAreaView className="flex-1">
        <KeyboardAvoidingView className="flex-1" behavior={Platform.select({ ios: 'padding', android: undefined })}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 20, paddingBottom: 28, gap: 26 }}>
            <View>
              {isFirstGoal ? null : (
                <Pressable
                  onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)' as Href))}
                  accessibilityRole="button"
                  hitSlop={8}
                  className="self-start active:opacity-60 py-1"
                  style={{ marginBottom: 10 }}>
                  <ThemedText style={{ fontSize: 14, fontWeight: '700', color: theme.textSecondary }}>← Cancel</ThemedText>
                </Pressable>
              )}
              <ThemedText style={{ fontSize: 36, lineHeight: 42, fontWeight: '700', color: theme.text, letterSpacing: -0.9 }}>
                {isFirstGoal ? <>What are you{'\n'}saving for?</> : <>What&apos;s the{'\n'}next goal?</>}
              </ThemedText>
              <ThemedText style={{ fontSize: 15, lineHeight: 22, color: theme.textSecondary, marginTop: 10, maxWidth: 330 }}>
                One goal. Every route. Ranked. Name it, set the number, and we price every way there.
              </ThemedText>
            </View>

            {/* The two ways in. A segmented switch rather than two cards, so the page
                reads as one form with a toggle, not a menu to choose from. */}
            <View
              className="flex-row"
              style={{ padding: 4, borderRadius: Radius.pill, backgroundColor: theme.backgroundSelected }}>
              {(
                [
                  { value: 'target', label: 'Set a target' },
                  { value: 'open', label: 'No finish line' },
                ] as const
              ).map((option) => {
                const selected = mode === option.value;
                return (
                  <Pressable
                    key={option.value}
                    onPress={() => {
                      if (mode !== option.value) Haptic.select();
                      setMode(option.value);
                    }}
                    accessibilityRole="tab"
                    accessibilityState={{ selected }}
                    className="flex-1 items-center active:opacity-80"
                    style={{
                      paddingVertical: 10,
                      borderRadius: Radius.pill,
                      backgroundColor: selected ? theme.backgroundElevated : 'transparent',
                      ...(selected ? Shadow.card : null),
                    }}>
                    <ThemedText
                      style={{ fontSize: 14, fontWeight: '700', color: selected ? theme.text : theme.textSecondary }}>
                      {option.label}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>

            <View
              style={{
                borderRadius: Radius.xl,
                borderWidth: 1,
                borderColor: theme.border,
                backgroundColor: theme.backgroundElevated,
                padding: 20,
                gap: 22,
                ...Shadow.card,
              }}>
              <Field label={mode === 'open' ? 'Call it (optional)' : "It's for"}>
                <TextInput
                  value={label}
                  onChangeText={(text) => {
                    setLabel(text);
                    setSaveError(null);
                  }}
                  onFocus={() => setLabelFocused(true)}
                  onBlur={() => setLabelFocused(false)}
                  onSubmitEditing={() => (mode === 'target' ? amountRef.current?.focus() : undefined)}
                  placeholder={mode === 'open' ? OPEN_DEFAULT_LABEL : 'A new laptop'}
                  placeholderTextColor={theme.textTertiary}
                  maxLength={40}
                  autoCapitalize="sentences"
                  returnKeyType={mode === 'target' ? 'next' : 'done'}
                  accessibilityLabel="Goal name"
                  style={{
                    fontFamily: displayFontFamily('700'),
                    fontSize: 28,
                    lineHeight: 36,
                    color: theme.text,
                    paddingVertical: 6,
                    paddingHorizontal: 0,
                    borderBottomWidth: 2,
                    borderBottomColor: labelFocused ? Brand[500] : theme.borderStrong,
                  }}
                />
              </Field>

              {mode === 'target' ? (
                <Field label="How much">
                  <Pressable
                    onPress={() => amountRef.current?.focus()}
                    accessibilityRole="button"
                    accessibilityLabel={amountValue > 0 ? `Amount, ${amountValue} dollars` : 'Set an amount'}
                    className="flex-row items-end"
                    style={{
                      borderBottomWidth: 2,
                      borderBottomColor: amountFocused ? Brand[500] : theme.borderStrong,
                      paddingBottom: 2,
                    }}>
                    <ThemedText
                      style={{
                        fontFamily: bodyFontFamily('800'),
                        fontSize: 30,
                        lineHeight: 58,
                        color: amountValue > 0 ? Brand[500] : theme.textTertiary,
                        marginRight: 2,
                      }}>
                      $
                    </ThemedText>
                    <TextInput
                      ref={amountRef}
                      value={amountValue > 0 ? amountValue.toLocaleString() : ''}
                      onChangeText={(text) => setAmount(text.replace(/[^0-9]/g, '').slice(0, MAX_DIGITS))}
                      onFocus={() => setAmountFocused(true)}
                      onBlur={() => setAmountFocused(false)}
                      keyboardType="number-pad"
                      inputMode="numeric"
                      placeholder="0"
                      placeholderTextColor={theme.textTertiary}
                      style={{
                        fontFamily: bodyFontFamily('800'),
                        fontSize: 48,
                        lineHeight: 58,
                        color: Brand[500],
                        fontVariant: ['tabular-nums'],
                        padding: 0,
                        // TextInput can't hug its text, so the tap target is the whole
                        // row (the Pressable above) and the field just fills it.
                        flex: 1,
                        minWidth: Math.max(1, amount.length) * 30 + groupingCommas(amount) * 12 + 12,
                      }}
                    />
                  </Pressable>
                </Field>
              ) : (
                <View className="flex-row" style={{ gap: 12 }}>
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: Radius.md,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: Brand[500] + '18',
                    }}>
                    <Icon glyph={OPEN_EMOJI} size={20} color={Brand[500]} strokeWidth={1.75} />
                  </View>
                  <ThemedText style={{ flex: 1, fontSize: 13.5, lineHeight: 20, color: theme.textSecondary }}>
                    No target and no progress bar. Just the best routes for what you put in, and a running
                    total of what they earned.
                  </ThemedText>
                </View>
              )}
            </View>
          </ScrollView>

          {/* Sticky CTA, with the goal read back above it once it is complete. */}
          <View
            style={{
              paddingHorizontal: 24,
              paddingTop: 12,
              paddingBottom: 8,
              borderTopWidth: 1,
              borderTopColor: theme.border,
              backgroundColor: theme.background,
              gap: 10,
            }}>
            {saveError ? (
              <ThemedText style={{ fontSize: 13, color: Semantic.negative, paddingHorizontal: 2 }}>{saveError}</ThemedText>
            ) : chosen && mode === 'target' ? (
              <View className="flex-row items-center justify-between" style={{ paddingHorizontal: 2 }}>
                <ThemedText numberOfLines={1} style={{ flex: 1, fontSize: 13, color: theme.textSecondary }}>
                  Saving for {chosen.label}
                </ThemedText>
                <ThemedText
                  style={{ fontFamily: bodyFontFamily('800'), fontSize: 15, color: Brand[500], fontVariant: ['tabular-nums'] }}>
                  ${chosen.targetAmount?.toLocaleString()}
                </ThemedText>
              </View>
            ) : hint ? (
              <ThemedText style={{ fontSize: 13, color: theme.textTertiary, paddingHorizontal: 2 }}>{hint}</ThemedText>
            ) : null}
            <Pressable
              onPress={() => void start()}
              disabled={!chosen || saving}
              accessibilityRole="button"
              accessibilityState={{ disabled: !chosen || saving, busy: saving }}
              className="py-4 flex-row items-center justify-center active:opacity-85"
              style={{
                gap: 10,
                borderRadius: Radius.lg,
                backgroundColor: Brand[500],
                opacity: !chosen ? 0.4 : saving ? 0.8 : 1,
                ...Shadow.card,
              }}>
              {saving ? <ActivityIndicator size="small" color={OnBrand} /> : null}
              <ThemedText style={{ fontSize: 16, fontWeight: '800', color: OnBrand }}>
                {saving ? 'Saving your goal…' : isFirstGoal ? 'Find my routes →' : 'Add goal →'}
              </ThemedText>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

function Field({ label, children }: React.PropsWithChildren<{ label: string }>): React.ReactElement {
  const theme = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <ThemedText style={{ fontSize: 11, fontWeight: '800', letterSpacing: 0.8, color: theme.textTertiary }}>
        {label.toUpperCase()}
      </ThemedText>
      {children}
    </View>
  );
}
