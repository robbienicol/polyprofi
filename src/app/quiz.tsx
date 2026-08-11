import { useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useQuizAnswers } from '@/api/hooks/useQuizAnswers';
import { useSavedRoutes } from '@/api/hooks/useSavedRoutes';
import { requestAppRating } from '@/lib/app-rating';
import { ThemedText } from '@/components/themed-text';
import { Brand, Radius, Shadow } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { buildRouteParams } from '@/lib/quiz-profile';
import { AcquisitionPlatform, QuizAnswers } from '@/types/bets';

const TIMEFRAMES = [
  { value: 'today', label: 'Today', sub: '24 hours' },
  { value: 'week', label: 'This Week', sub: '7 days' },
  { value: 'month', label: 'This Month', sub: '30 days' },
  { value: '3months', label: '3 Months', sub: '90 days' },
  { value: '1year', label: '1 Year', sub: '365 days' },
  { value: '5years', label: '5 Years', sub: 'Long term' },
] as const;

const CATEGORIES = ['Sports Predictions', 'Crypto', 'Stocks', 'Polymarket', 'Forex'] as const;

const PLATFORMS: { value: AcquisitionPlatform; label: string; sub: string }[] = [
  { value: 'robinhood', label: 'Robinhood', sub: 'Stocks, ETFs, crypto & prediction markets' },
  { value: 'polymarket', label: 'Polymarket', sub: 'Prediction markets' },
  { value: 'kalshi', label: 'Kalshi', sub: 'Prediction markets' },
];

const DEFAULT_RISK_TOLERANCE: QuizAnswers['riskTolerance'] = 'balanced';

const STEPS = ['target', 'timeframe', 'categories', 'platforms'] as const;
type Step = (typeof STEPS)[number];

// Invest amount is no longer asked up front — it's a live slider on the results
// screen. We still need a reference stake to generate the avenue pool; pick one
// generous enough that the pool spans treasuries → longshots for any target.
const genStakeFor = (target: number) => Math.max(1000, (target || 100) * 10);

export default function QuizScreen(): React.ReactElement {
  const { saveAnswers, quizAnswers, isLoading: quizLoading } = useQuizAnswers();
  const { history, isLoading: historyLoading } = useSavedRoutes();
  const prefill = quizAnswers ?? history[0]?.quizSnapshot;
  if (quizLoading || historyLoading) return <View className="flex-1" />;
  const formKey = prefill
    ? `${prefill.target}-${prefill.timeframe}-${prefill.categories.join('|')}-${prefill.preferredPlatforms?.join('|') ?? ''}`
    : 'new';
  return <QuizForm key={formKey} prefill={prefill} saveAnswers={saveAnswers} />;
}

function QuizForm({ prefill, saveAnswers }: { prefill?: QuizAnswers; saveAnswers: ReturnType<typeof useQuizAnswers>['saveAnswers'] }): React.ReactElement {
  const router = useRouter();
  const theme = useTheme();

  const [step, setStep] = useState<Step>('target');
  const [target, setTarget] = useState(String(prefill?.target ?? 100));
  const [timeframe, setTimeframe] = useState<QuizAnswers['timeframe']>(prefill?.timeframe ?? 'week');
  const [categories, setCategories] = useState<string[]>(prefill?.categories ?? []);
  const [preferredPlatforms, setPreferredPlatforms] = useState<AcquisitionPlatform[]>(prefill?.preferredPlatforms ?? []);

  const stepIndex = STEPS.indexOf(step);
  const progress = (stepIndex + 1) / STEPS.length;

  const toggleCategory = useCallback((cat: string) => {
    setCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  }, []);

  const togglePlatform = useCallback((platform: AcquisitionPlatform) => {
    setPreferredPlatforms((prev) =>
      prev.includes(platform) ? prev.filter((item) => item !== platform) : [...prev, platform]
    );
  }, []);

  const handleNext = useCallback(() => {
    const nextStep = STEPS[stepIndex + 1];
    if (nextStep) {
      setStep(nextStep);
    } else {
      requestAppRating();
      saveAnswers(
        buildRouteParams({
          balance: genStakeFor(Number(target)),
          target: Number(target) || 100,
          timeframe,
          riskTolerance: prefill?.riskTolerance ?? DEFAULT_RISK_TOLERANCE,
          categories,
          preferredPlatforms,
        }),
        {
          onSuccess: () => router.replace('/(tabs)/routes?generate=1'),
        }
      );
    }
  }, [stepIndex, target, timeframe, prefill?.riskTolerance, categories, preferredPlatforms, saveAnswers, router]);

  const canAdvance = useMemo(() => {
    if (step === 'target') return Number(target) > 0;
    if (step === 'platforms') return preferredPlatforms.length > 0;
    return true;
  }, [step, target, preferredPlatforms]);

  const stepTitles: Record<Step, string> = {
    target: 'How much do you\nwant to make?',
    timeframe: "What's your\ntimeframe?",
    categories: 'Any prediction\nmarket preference?',
    platforms: 'Which investing apps\ndo you use?',
  };

  const stepDescriptions: Record<Step, string> = {
    target: "Set your goal. On the results you'll slide how much to invest and see every way to hit it.",
    timeframe: 'Your deadline decides which routes we show: VOO and treasuries for long goals, prediction markets for short ones.',
    categories: "Leave blank for all markets, or narrow the search to your favorite areas.",
    platforms: 'Choose every app you use. After you set an amount, we\'ll open the best available match.',
  };

  return (
    <View className="flex-1" style={{ backgroundColor: theme.background }}>
      <SafeAreaView className="flex-1">

        {/* Header */}
        <View className="px-6 pt-4 pb-2 gap-4">
          <Pressable onPress={() => router.back()} className="self-start active:opacity-60 py-1">
            <ThemedText style={{ fontSize: 14, fontWeight: '600', color: theme.textSecondary }}>← Cancel</ThemedText>
          </Pressable>
          <View className="flex-row items-center gap-3">
            <View className="flex-1 rounded-full overflow-hidden" style={{ height: 5, backgroundColor: theme.backgroundSelected }}>
              <View className="h-full rounded-full" style={{ width: `${progress * 100}%`, backgroundColor: Brand[500] }} />
            </View>
            <ThemedText style={{ fontSize: 12, color: theme.textTertiary, fontVariant: ['tabular-nums'] }}>{stepIndex + 1} / {STEPS.length}</ThemedText>
          </View>
          <ThemedText style={{ fontSize: 28, fontWeight: '800', lineHeight: 36, letterSpacing: -0.6, color: theme.text }}>
            {stepTitles[step]}
          </ThemedText>
          <ThemedText style={{ fontSize: 13, color: theme.textSecondary, lineHeight: 19 }}>
            {stepDescriptions[step]}
          </ThemedText>
        </View>

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingTop: 16, paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled">

          {/* Target — how much you want to make */}
          {step === 'target' && (
            <View className="flex-1 justify-center items-center gap-4">
              <View
                className="flex-row items-center px-8 py-5"
                style={{ borderRadius: Radius.xl, backgroundColor: theme.backgroundElevated, borderWidth: 1.5, borderColor: Brand[500] + '44', ...Shadow.card }}>
                <ThemedText style={{ fontSize: 40, fontWeight: '300', color: theme.textTertiary }}>+$</ThemedText>
                <TextInput
                  value={target}
                  onChangeText={setTarget}
                  keyboardType="numeric"
                  style={{ color: theme.text, fontSize: 48, fontWeight: '800', minWidth: 120, fontVariant: ['tabular-nums'] }}
                  selectTextOnFocus
                  autoFocus
                />
              </View>
              <ThemedText style={{ fontSize: 13, color: theme.textTertiary }}>the profit you&apos;re aiming for</ThemedText>
            </View>
          )}

          {/* Timeframe */}
          {step === 'timeframe' && (
            <View className="gap-3">
              {TIMEFRAMES.map((tf) => {
                const selected = timeframe === tf.value;
                return (
                  <Pressable
                    key={tf.value}
                    onPress={() => setTimeframe(tf.value)}
                    className="flex-row items-center px-5 py-4 border active:opacity-70"
                    style={{
                      borderRadius: Radius.lg,
                      borderColor: selected ? Brand[500] : theme.border,
                      backgroundColor: selected ? Brand[500] + '12' : theme.backgroundElement,
                    }}>
                    <View className="flex-1">
                      <ThemedText style={{ fontWeight: '700', fontSize: 16, color: selected ? Brand[500] : theme.text }}>
                        {tf.label}
                      </ThemedText>
                      <ThemedText style={{ fontSize: 13, color: theme.textTertiary, marginTop: 1 }}>{tf.sub}</ThemedText>
                    </View>
                    {selected && (
                      <View className="w-6 h-6 rounded-full items-center justify-center" style={{ backgroundColor: Brand[500] }}>
                        <ThemedText style={{ fontSize: 12, color: '#06140C', fontWeight: '800' }}>✓</ThemedText>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
          )}

          {/* Categories */}
          {step === 'categories' && (
            <View className="gap-4">
              <ThemedText style={{ fontSize: 13, color: theme.textSecondary }}>
                Leave blank for all markets — we&apos;ll diversify across prediction markets and more
              </ThemedText>
              <View className="flex-row flex-wrap gap-2">
                {CATEGORIES.map((cat) => {
                  const selected = categories.includes(cat);
                  return (
                    <Pressable
                      key={cat}
                      onPress={() => toggleCategory(cat)}
                      className="px-5 border active:opacity-70"
                      style={{
                        borderRadius: Radius.pill,
                        paddingVertical: 11,
                        borderColor: selected ? Brand[500] : theme.border,
                        backgroundColor: selected ? Brand[500] + '18' : theme.backgroundElement,
                      }}>
                      <ThemedText style={{ fontSize: 14, fontWeight: selected ? '700' : '500', color: selected ? Brand[500] : theme.textSecondary }}>
                        {cat}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          {/* Preferred acquisition platforms */}
          {step === 'platforms' && (
            <View className="gap-3">
              {PLATFORMS.map((platform) => {
                const selected = preferredPlatforms.includes(platform.value);
                return (
                  <Pressable
                    key={platform.value}
                    onPress={() => togglePlatform(platform.value)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: selected }}
                    className="flex-row items-center px-5 py-4 border active:opacity-70"
                    style={{
                      borderRadius: Radius.lg,
                      borderColor: selected ? Brand[500] : theme.border,
                      backgroundColor: selected ? Brand[500] + '12' : theme.backgroundElement,
                    }}>
                    <View className="flex-1">
                      <ThemedText style={{ fontWeight: '700', fontSize: 16, color: selected ? Brand[500] : theme.text }}>
                        {platform.label}
                      </ThemedText>
                      <ThemedText style={{ fontSize: 13, color: theme.textTertiary, marginTop: 2 }}>
                        {platform.sub}
                      </ThemedText>
                    </View>
                    <View
                      className="w-6 h-6 rounded-full items-center justify-center"
                      style={{
                        borderWidth: 1.5,
                        borderColor: selected ? Brand[500] : theme.borderStrong,
                        backgroundColor: selected ? Brand[500] : 'transparent',
                      }}>
                      {selected ? (
                        <ThemedText style={{ fontSize: 12, color: '#06140C', fontWeight: '800' }}>✓</ThemedText>
                      ) : null}
                    </View>
                  </Pressable>
                );
              })}
              <ThemedText style={{ fontSize: 12, color: theme.textTertiary, lineHeight: 18 }}>
                If a route isn&apos;t available on your picks, we&apos;ll open the closest supported marketplace.
              </ThemedText>
            </View>
          )}
        </ScrollView>

        <View className="px-6 pb-8 pt-2">
          <Pressable
            onPress={handleNext}
            disabled={!canAdvance}
            className="py-4 items-center active:opacity-80"
            style={{ borderRadius: Radius.lg, backgroundColor: Brand[500], opacity: !canAdvance ? 0.4 : 1, ...Shadow.card }}>
            <ThemedText style={{ fontSize: 16, fontWeight: '800', color: '#06140C' }}>
              {stepIndex === STEPS.length - 1 ? 'Find my routes →' : 'Next →'}
            </ThemedText>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}
