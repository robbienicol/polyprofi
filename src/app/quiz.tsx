import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, KeyboardAvoidingView, Platform, Pressable, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { timeframeCalendarDays } from '@/api/client/playbook';
import { useGoalsProgress } from '@/api/hooks/useGoalProgress';
import { usePreferences } from '@/api/hooks/usePreferences';
import { useQuizAnswers } from '@/api/hooks/useQuizAnswers';
import { useSavedRoutes } from '@/api/hooks/useSavedRoutes';
import { useOnboardingProfile } from '@/api/hooks/useOnboardingProfile';
import { useUserProfile } from '@/api/hooks/useUserProfile';
import { useSavingsGoal, type SavingsGoalInput } from '@/api/hooks/useSavingsGoal';
import { OnboardingGlow } from '@/components/onboarding/OnboardingPreviews';
import { Icon } from '@/components/ui/Icon';
import { ThemedText } from '@/components/themed-text';
import { Brand, OnBrand, Radius, Shadow } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { Haptic } from '@/lib/haptics';
import {
  excludedSearchCategoriesFor,
  riskToleranceFor,
  searchCategoriesFor,
  searchTimeframeFor,
} from '@/lib/onboarding-profile';
import { buildRouteParams, referenceStakeFor, surveyAmountCeiling } from '@/lib/quiz-profile';
import { goalByLabel, goalRemaining, isOpenEnded } from '@/lib/savings-goal';
import type { AcquisitionPlatform, QuizAnswers, SavingsGoal } from '@/types/bets';

/** `label` sits in the one-row picker, so it has to stay short. */
const TIMEFRAMES = [
  { value: 'today', label: '1 day' },
  { value: 'week', label: '1 wk' },
  { value: 'month', label: '1 mo' },
  { value: '3months', label: '3 mo' },
  { value: '1year', label: '1 yr' },
  { value: '5years', label: '5 yr' },
] as const;

/** Icon for a seeded goal that did not carry one of its own. */
const CUSTOM_GOAL_EMOJI = '🎯';

/** A goal chosen in goal setup, carried here in the URL and not yet saved anywhere. */
interface GoalSeed {
  label: string;
  emoji: string;
  /** Null for the open-ended goal, which has no finish line. */
  target: number | null;
}

/**
 * The seeded goal, or null when the quiz was opened any other way. Goal setup hands
 * the choice over rather than writing it, so a goal only ever reaches the Goals tab
 * by way of a search.
 */
function goalSeedFrom(label?: string, emoji?: string, target?: string): GoalSeed | null {
  const trimmed = label?.trim();
  if (!trimmed) return null;
  const amount = Number(target);
  return {
    label: trimmed,
    emoji: emoji?.trim() || CUSTOM_GOAL_EMOJI,
    target: Number.isFinite(amount) && amount > 0 ? Math.round(amount) : null,
  };
}

/** Widest goal the hero number can show without running off a small phone. */
const MAX_TARGET_DIGITS = 7;

/** How many thousands separators toLocaleString will add to this many digits. */
function groupingCommas(digits: string): number {
  return Math.max(0, Math.ceil(digits.length / 3) - 1);
}

export default function QuizScreen(): React.ReactElement {
  // A goal can be named by whoever sent us here (the Goals tab, a goal detail
  // screen); otherwise the quiz picks the sensible default itself.
  const { goalId, goalLabel, goalEmoji: goalEmojiParam, goalTarget } = useLocalSearchParams<{
    goalId?: string;
    goalLabel?: string;
    goalEmoji?: string;
    goalTarget?: string;
  }>();
  const { saveAnswers, quizAnswers, isLoading: quizLoading } = useQuizAnswers();
  const { history, isLoading: historyLoading } = useSavedRoutes();
  const { preferences, isLoading: preferencesLoading } = usePreferences();
  // Drafts are included: re-searching the same name before acquiring should
  // continue that draft rather than stack a second one beside it.
  const { allGoals, addGoalAsync, isLoading: goalsLoading } = useSavingsGoal();
  const goalsProgress = useGoalsProgress(allGoals);
  // What the user said they can put in, from the profile survey. Null when they
  // skipped it, which leaves the stake goal-derived exactly as before.
  const { profile, isLoading: profileLoading } = useUserProfile();
  // The markets they said they were drawn to, minus the ones they ruled out.
  // Only a starting point for the first search — a prefill from a previous
  // search is what they last actually chose, so it wins.
  const { profile: onboarding, isLoading: onboardingLoading } = useOnboardingProfile();

  const prefill = quizAnswers ?? history[0]?.quizSnapshot;
  // A search belongs to a goal only when it was started from one (the goal screen,
  // goal setup). Otherwise it stands on its own: goals are something you can aim a
  // search at, not something every search has to be filed under.
  // A goal picked in goal setup and handed over unsaved: it becomes real here, as a
  // draft, when the search is saved. A seed names a specific goal, so it wins over
  // the "resume what you were working on" default — otherwise adding a second goal
  // would open the quiz on the first one. No target means the open-ended goal.
  const seed = goalSeedFrom(goalLabel, goalEmojiParam, goalTarget);
  const seededExistingGoal = seed ? goalByLabel(allGoals, seed.label) : null;
  const startingGoal = seed
    ? seededExistingGoal
    : goalId ? allGoals.find((goal) => goal.id === goalId) ?? null : null;

  // The survey answers seed the form's own state, and `formKey` does not name
  // them — so a form mounted before they arrive keeps the defaults for good.
  if (quizLoading || historyLoading || preferencesLoading || goalsLoading || profileLoading || onboardingLoading) {
    return <View className="flex-1" />;
  }
  const formKey = `${startingGoal?.id ?? 'none'}-${seed?.label ?? ''}-${seed?.target ?? ''}-${prefill?.target ?? 0}-${prefill?.timeframe ?? ''}`;
  return (
    <QuizForm
      key={formKey}
      prefill={prefill}
      goals={allGoals}
      startingGoalId={startingGoal?.id ?? null}
      newGoalSeed={seededExistingGoal ? null : seed}
      remainingFor={(goal) => goalRemaining(goalsProgress.progressFor(goal.id).netGain, goal)}
      preferredPlatforms={preferences.preferredPlatforms}
      investmentCeiling={surveyAmountCeiling(profile?.investmentAmount)}
      preferredCategories={searchCategoriesFor(onboarding.answers)}
      excludedCategories={excludedSearchCategoriesFor(onboarding.answers)}
      defaultTimeframe={searchTimeframeFor(onboarding.answers)}
      defaultRiskTolerance={riskToleranceFor(onboarding.answers)}
      saveAnswers={saveAnswers}
      addGoalAsync={addGoalAsync}
    />
  );
}

function QuizForm({
  prefill,
  goals,
  startingGoalId,
  newGoalSeed,
  remainingFor,
  preferredPlatforms,
  investmentCeiling,
  preferredCategories,
  excludedCategories,
  defaultTimeframe,
  defaultRiskTolerance,
  saveAnswers,
  addGoalAsync,
}: {
  prefill?: QuizAnswers;
  goals: SavingsGoal[];
  startingGoalId: string | null;
  /** A goal chosen in goal setup that does not exist yet. See `goalSeedFrom`. */
  newGoalSeed: GoalSeed | null;
  /** What is left to earn on a goal, which is what a search for it should target. */
  remainingFor: (goal: SavingsGoal) => number;
  preferredPlatforms: AcquisitionPlatform[];
  /** Top of the survey's amount range, or null if it was skipped. */
  investmentCeiling: number | null;
  /** Markets from onboarding, used only when there is no previous search to resume. */
  preferredCategories: string[];
  /**
   * Markets ruled out in onboarding. Unlike the three defaults around it this is
   * not a starting point a prefill can overwrite — it rides on every search until
   * they change it in the quiz itself.
   */
  excludedCategories: string[];
  /** Their stated horizon, as the timeframe a first search opens on. */
  defaultTimeframe: QuizAnswers['timeframe'];
  /** Derived from how they said they'd handle a loss. See riskToleranceFor. */
  defaultRiskTolerance: QuizAnswers['riskTolerance'];
  saveAnswers: ReturnType<typeof useQuizAnswers>['saveAnswers'];
  addGoalAsync: (input: SavingsGoalInput) => Promise<{ goal: SavingsGoal }>;
}): React.ReactElement {
  const router = useRouter();
  const theme = useTheme();
  const amountRef = useRef<TextInput>(null);

  // Searching again for a goal you already have should continue it, so the name
  // and the amount both start from the goal the last search was for.
  const startingGoal = goals.find((goal) => goal.id === startingGoalId) ?? null;
  const startingTarget = startingGoal && !isOpenEnded(startingGoal)
    ? Math.max(1, Math.round(remainingFor(startingGoal)))
    : newGoalSeed?.target ?? prefill?.target ?? 100;

  // The goal this search is aimed at, if it was started from one. Removable, so
  // the same search can be run on its own.
  const [goalAttached, setGoalAttached] = useState(startingGoal != null || newGoalSeed != null);
  const goalLabelShown = startingGoal?.label ?? newGoalSeed?.label ?? null;
  // The amount is prefilled and set in the headline type, so it reads as a printed
  // figure rather than a field. The hint beside it says otherwise until it is used.
  const [target, setTarget] = useState(String(startingTarget));
  const [timeframe, setTimeframe] = useState<QuizAnswers['timeframe']>(prefill?.timeframe ?? defaultTimeframe);
  // Not asked here any more: markets are a filter on the results screen, so the
  // search keeps whatever the last one or onboarding picked.
  const categories = prefill?.categories ?? preferredCategories;
  const [isSaving, setIsSaving] = useState(false);
  // Seeded from the last search, else from the signup survey, else blank. Blank is fine:
  // it falls back to the goal-derived stake, which is what the app did before this asked.
  const [invest, setInvest] = useState(String(prefill?.investmentCeiling ?? investmentCeiling ?? ''));
  const [investFocused, setInvestFocused] = useState(false);

  const targetValue = Number(target.replace(/[^0-9]/g, '')) || 0;
  const investValue = Number(invest.replace(/[^0-9]/g, '')) || 0;
  const investCeiling = investValue || investmentCeiling;
  const attachedLabel = goalAttached ? goalLabelShown : null;

  const submit = useCallback(() => {
    if (targetValue <= 0 || isSaving) return;
    Haptic.press();
    Keyboard.dismiss();
    // Asked from the routes screen now, while the analyzing loader gives it a
    // natural pause to land in — not here, before anything has even happened.
    setIsSaving(true);

    const run = async (): Promise<void> => {
      // Only a search started from a goal is filed under one. A goal handed over by
      // goal setup becomes real here, as a draft that joins the Goals tab on the
      // first acquire; its open-ended form has no finish line of its own.
      const searchGoalId = !goalAttached
        ? undefined
        : startingGoal
          ? startingGoal.id
          : newGoalSeed
            ? (await addGoalAsync({
              label: newGoalSeed.label,
              emoji: newGoalSeed.emoji || CUSTOM_GOAL_EMOJI,
              ...(newGoalSeed.target == null ? null : { targetAmount: targetValue }),
              draft: true,
              deadline: new Date(Date.now() + timeframeCalendarDays(timeframe) * 86_400_000).toISOString(),
            })).goal.id
            : undefined;

      saveAnswers(
        buildRouteParams({
          balance: referenceStakeFor(targetValue, investCeiling),
          investmentCeiling: investCeiling ?? undefined,
          target: targetValue,
          timeframe,
          riskTolerance: prefill?.riskTolerance ?? defaultRiskTolerance,
          categories,
          excludedCategories,
          // Where the user can actually trade is a standing preference, set in Settings.
          preferredPlatforms,
        }),
        {
          // The goal rides along as a parameter, so the routes screen can stamp it
          // onto the search it saves and onto every position taken from it.
          onSuccess: () => router.replace(
            (searchGoalId ? `/(tabs)/routes?generate=1&goalId=${searchGoalId}` : '/(tabs)/routes?generate=1') as Href,
          ),
          // Never latch on "Finding routes…" — if the save fails, hand the button back.
          onError: () => {
            Haptic.error();
            setIsSaving(false);
          },
        }
      );
    };

    void run().catch(() => {
      Haptic.error();
      setIsSaving(false);
    });
  }, [targetValue, isSaving, goalAttached, startingGoal, newGoalSeed, addGoalAsync, timeframe, saveAnswers, prefill?.riskTolerance, defaultRiskTolerance, categories, excludedCategories, preferredPlatforms, investCeiling, router]);

  return (
    <View className="flex-1" style={{ backgroundColor: theme.background }}>
      <OnboardingGlow />
      <SafeAreaView className="flex-1">
        <KeyboardAvoidingView className="flex-1" behavior={Platform.select({ ios: 'padding', android: undefined })}>
          {/* One screen, no scroll: three answers and the button. Tapping the empty
              space puts the keyboard away, since there is no scroll to drag it off. */}
          <Pressable
            accessible={false}
            onPress={Keyboard.dismiss}
            className="flex-1"
            style={{ paddingHorizontal: 24, paddingTop: 4, paddingBottom: 16 }}>
            <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)' as Href))} accessibilityRole="button" className="self-start active:opacity-60 py-1">
              <ThemedText style={{ fontSize: 14, fontWeight: '600', color: theme.textSecondary }}>← Cancel</ThemedText>
            </Pressable>

            <View className="flex-1 justify-center" style={{ gap: 32 }}>
              <View>
                <ThemedText style={{ fontSize: 24, lineHeight: 32, fontWeight: '600', color: theme.textSecondary }}>
                  I want to make
                </ThemedText>
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
                    onChangeText={(text) => setTarget(text.replace(/[^0-9]/g, '').slice(0, MAX_TARGET_DIGITS))}
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

                {attachedLabel ? (
                  <View
                    className="flex-row items-center self-start"
                    style={{ gap: 8, paddingLeft: 12, paddingRight: 6, paddingVertical: 6, borderRadius: Radius.pill, backgroundColor: theme.backgroundSelected, marginTop: 14 }}>
                    <ThemedText style={{ fontSize: 13, fontWeight: '700', color: theme.textSecondary }}>
                      Toward {attachedLabel}
                    </ThemedText>
                    <Pressable
                      onPress={() => setGoalAttached(false)}
                      accessibilityRole="button"
                      accessibilityLabel={`Search without ${attachedLabel}`}
                      hitSlop={8}
                      className="active:opacity-60"
                      style={{ width: 22, height: 22, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.background }}>
                      <Icon glyph="✕" size={12} color={theme.textSecondary} strokeWidth={2.5} />
                    </Pressable>
                  </View>
                ) : null}
              </View>

              <Field label="Within">
                <View
                  className="flex-row"
                  accessibilityRole="radiogroup"
                  style={{ padding: 4, borderRadius: Radius.pill, backgroundColor: theme.backgroundSelected }}>
                  {TIMEFRAMES.map((tf) => {
                    const selected = timeframe === tf.value;
                    return (
                      <Pressable
                        key={tf.value}
                        onPress={() => {
                          Keyboard.dismiss();
                          if (!selected) Haptic.select();
                          setTimeframe(tf.value);
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
              </Field>

              <Field label="Investing up to">
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
                    onChangeText={(text) => setInvest(text.replace(/[^0-9]/g, '').slice(0, MAX_TARGET_DIGITS))}
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
              </Field>
            </View>
          </Pressable>

          <View style={{ paddingHorizontal: 24, paddingTop: 12, paddingBottom: 8 }}>
            <Pressable
              onPress={submit}
              disabled={targetValue <= 0 || isSaving}
              accessibilityRole="button"
              accessibilityState={{ disabled: targetValue <= 0 || isSaving }}
              className="py-4 flex-row items-center justify-center active:opacity-85"
              style={{ gap: 10, borderRadius: Radius.lg, backgroundColor: Brand[500], opacity: targetValue > 0 ? 1 : 0.4, ...Shadow.card }}>
              {isSaving ? <ActivityIndicator size="small" color={OnBrand} /> : null}
              <ThemedText style={{ fontSize: 16, fontWeight: '900', color: OnBrand }}>
                {isSaving ? 'Finding routes…' : targetValue <= 0 ? 'Enter an amount' : 'Find my routes →'}
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
    <View style={{ gap: 10 }}>
      <ThemedText style={{ fontSize: 11, fontWeight: '800', letterSpacing: 0.9, color: theme.textTertiary }}>
        {label.toUpperCase()}
      </ThemedText>
      {children}
    </View>
  );
}
