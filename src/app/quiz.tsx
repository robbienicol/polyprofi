import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
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
import { ThemedText } from '@/components/themed-text';
import { Brand, OnBrand, Radius, Shadow } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { requestAppRating } from '@/lib/app-rating';
import { ACQUISITION_PLATFORMS } from '@/lib/preferences';
import {
  excludedSearchCategoriesFor,
  riskToleranceFor,
  searchCategoriesFor,
  searchTimeframeFor,
} from '@/lib/onboarding-profile';
import { buildRouteParams, referenceStakeFor, surveyAmountCeiling } from '@/lib/quiz-profile';
import { defaultQuizGoal, goalByLabel, goalRemaining, isOpenEnded } from '@/lib/savings-goal';
import type { AcquisitionPlatform, QuizAnswers, SavingsGoal } from '@/types/bets';

/**
 * `word` completes the sentence; `label` sits in the picker; `deadlineWord` names
 * an unnamed search's goal the way a person would ("$50 by tomorrow").
 */
const TIMEFRAMES = [
  { value: 'today', word: 'within 24 hours', label: 'Today', deadlineWord: 'by tomorrow' },
  { value: 'week', word: 'within a week', label: 'This week', deadlineWord: 'this week' },
  { value: 'month', word: 'within a month', label: 'This month', deadlineWord: 'this month' },
  { value: '3months', word: 'within 3 months', label: '3 months', deadlineWord: 'in 3 months' },
  { value: '1year', word: 'within a year', label: '1 year', deadlineWord: 'this year' },
  { value: '5years', word: 'within 5 years', label: '5 years', deadlineWord: 'in 5 years' },
] as const;

/**
 * One tap to the goals people actually name, so the field is optional. Amounts
 * are deliberately not set from these: the amount is the sentence's own control,
 * and having a chip silently rewrite it would be a nasty surprise.
 */
const GOAL_PRESETS = [
  { emoji: '🎧', label: 'Headphones' },
  { emoji: '✈️', label: 'A trip' },
  { emoji: '🛟', label: 'Emergency fund' },
  { emoji: '🚗', label: 'A car' },
  { emoji: '🏠', label: 'House deposit' },
] as const;

/** Emoji for a goal the user named themselves. */
const CUSTOM_GOAL_EMOJI = '🎯';
/** Emoji for an unnamed search — money for its own sake. */
const UNNAMED_GOAL_EMOJI = '⚡';

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

/**
 * `value` must stay in sync with QUIZ_TO_ROUTE_CATEGORIES in lib/quiz-profile —
 * it's the string the route filter matches on.
 *
 * Only classes something actually builds routes for belong here. Sports and Forex were
 * offered for a long time and nothing ever emitted a route in either: Forex has no
 * builder at all, and "Sports" mapped onto the whole Polymarket pool, so picking it
 * narrowed nothing. Sport is still reachable — as a topic facet on prediction markets,
 * where the routes genuinely are — but it is not an asset class of its own.
 */
const MARKETS = [
  // `word` goes into the sentence, which joins picks with "&" — so no entry may
  // carry its own conjunction, or two markets read as "stocks & treasuries & crypto".
  { value: 'Stocks', word: 'stocks', label: 'Stocks, ETFs & T-bills', emoji: '📈' },
  { value: 'Crypto', word: 'crypto', label: 'Crypto', emoji: '₿' },
  { value: 'Polymarket', word: 'prediction markets', label: 'Prediction markets', emoji: '🔮' },
] as const;

/** One tap to the amounts most people actually pick, so the keyboard is optional. */
const QUICK_AMOUNTS = [100, 500, 1_000, 5_000] as const;

/** Widest goal the hero number can show without running off a small phone. */
const MAX_TARGET_DIGITS = 7;

/**
 * Capital the user has on hand, offered as a ceiling. A different question from the goal
 * above and both are load-bearing: the goal is the profit wanted, this is the money
 * available to earn it, and the same $300 goal is a T-bill or a long shot depending
 * entirely on this number. Asked per search because it changes between searches — the
 * profile survey's answer is only the starting suggestion.
 */
const INVEST_AMOUNTS = [500, 1_000, 5_000, 25_000, 100_000] as const;

/** How many thousands separators toLocaleString will add to this many digits. */
function groupingCommas(digits: string): number {
  return Math.max(0, Math.ceil(digits.length / 3) - 1);
}

/** Joins names the way a person would: "a", "a & b", "a, b & c". */
function joinWords(words: readonly string[]): string {
  if (words.length <= 1) return words[0] ?? '';
  return `${words.slice(0, -1).join(', ')} & ${words[words.length - 1]}`;
}

function marketsWord(selected: string[]): string {
  const words = MARKETS.filter((market) => selected.includes(market.value)).map((market) => market.word);
  if (words.length === 0) return 'anything';
  // Past three the sentence stops being readable, so count instead of listing.
  return words.length > 3 ? `${words.length} markets` : joinWords(words);
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
  // The goal of the last search, so returning to the quiz resumes what you were
  // working on rather than the oldest thing on the list.
  const lastSearchGoalId = goalId ?? history[0]?.goalId;
  // A goal picked in goal setup and handed over unsaved: it becomes real here, as a
  // draft, when the search is saved. A seed names a specific goal, so it wins over
  // the "resume what you were working on" default — otherwise adding a second goal
  // would open the quiz on the first one. No target means the open-ended goal.
  const seed = goalSeedFrom(goalLabel, goalEmojiParam, goalTarget);
  const seededExistingGoal = seed ? goalByLabel(allGoals, seed.label) : null;
  const startingGoal = seed ? seededExistingGoal : defaultQuizGoal(allGoals, lastSearchGoalId);

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

  const [goalName, setGoalName] = useState(startingGoal?.label ?? newGoalSeed?.label ?? '');
  const [goalEmoji, setGoalEmoji] = useState(startingGoal?.emoji ?? newGoalSeed?.emoji ?? CUSTOM_GOAL_EMOJI);
  const [nameFocused, setNameFocused] = useState(false);
  const [target, setTarget] = useState(String(startingTarget));
  const [timeframe, setTimeframe] = useState<QuizAnswers['timeframe']>(prefill?.timeframe ?? defaultTimeframe);
  const [categories, setCategories] = useState<string[]>(prefill?.categories ?? preferredCategories);
  const [isSaving, setIsSaving] = useState(false);
  // Seeded from the last search, else from the signup survey, else blank. Blank is fine:
  // it falls back to the goal-derived stake, which is what the app did before this asked.
  const [invest, setInvest] = useState(String(prefill?.investmentCeiling ?? investmentCeiling ?? ''));
  const [investFocused, setInvestFocused] = useState(false);

  const targetValue = Number(target.replace(/[^0-9]/g, '')) || 0;
  const investValue = Number(invest.replace(/[^0-9]/g, '')) || 0;
  const investCeiling = investValue || investmentCeiling;
  const selectedTimeframe = TIMEFRAMES.find((tf) => tf.value === timeframe) ?? TIMEFRAMES[1];
  const timeWord = selectedTimeframe.word;
  const marketWord = marketsWord(categories);
  const appWord = joinWords(
    ACQUISITION_PLATFORMS.filter((platform) => preferredPlatforms.includes(platform.value)).map((p) => p.label),
  );
  const trimmedName = goalName.trim();
  // A name the user already has is the same goal, not a rival with the same name.
  const existingGoal = useMemo(() => goalByLabel(goals, trimmedName), [goals, trimmedName]);

  const toggleMarket = useCallback((market: string) => {
    setCategories((prev) => (prev.includes(market) ? prev.filter((item) => item !== market) : [...prev, market]));
  }, []);

  /** A preset names the goal; if it names one you already have, it retargets at its remainder. */
  const choosePreset = useCallback((label: string, emoji: string) => {
    Keyboard.dismiss();
    setGoalName(label);
    setGoalEmoji(emoji);
    const existing = goalByLabel(goals, label);
    if (existing && !isOpenEnded(existing)) setTarget(String(Math.max(1, Math.round(remainingFor(existing)))));
  }, [goals, remainingFor]);

  const submit = useCallback(() => {
    if (targetValue <= 0 || isSaving) return;
    Keyboard.dismiss();
    requestAppRating();
    setIsSaving(true);

    const run = async (): Promise<void> => {
      // Every search gets a goal, but a search is not a commitment: a new one is
      // created as a draft and only joins the Goals tab once the user acquires
      // against it. An unnamed search is named after what was asked for.
      // "Just make me money" has no finish line, and the amount typed here is what the
      // search aims at rather than a target the goal is judged against. Only while the
      // name is still the one that was chosen: renaming it makes it an ordinary goal.
      const openEnded = newGoalSeed?.target == null && trimmedName === newGoalSeed?.label;
      const searchGoalId = existingGoal
        ? existingGoal.id
        : (await addGoalAsync({
          label: trimmedName || `$${targetValue.toLocaleString()} ${selectedTimeframe.deadlineWord}`,
          emoji: trimmedName ? goalEmoji : UNNAMED_GOAL_EMOJI,
          ...(openEnded ? null : { targetAmount: targetValue }),
          draft: true,
          deadline: new Date(Date.now() + timeframeCalendarDays(timeframe) * 86_400_000).toISOString(),
        })).goal.id;

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
          onSuccess: () => router.replace(`/(tabs)/routes?generate=1&goalId=${searchGoalId}` as Href),
          // Never latch on "Finding routes…" — if the save fails, hand the button back.
          onError: () => setIsSaving(false),
        }
      );
    };

    void run().catch(() => setIsSaving(false));
  }, [targetValue, isSaving, existingGoal, newGoalSeed, addGoalAsync, trimmedName, goalEmoji, selectedTimeframe.deadlineWord, timeframe, saveAnswers, prefill?.riskTolerance, defaultRiskTolerance, categories, excludedCategories, preferredPlatforms, investCeiling, router]);

  return (
    <View className="flex-1" style={{ backgroundColor: theme.background }}>
      <OnboardingGlow />
      <SafeAreaView className="flex-1">
        <KeyboardAvoidingView className="flex-1" behavior={Platform.select({ ios: 'padding', android: undefined })}>
          <ScrollView
            className="flex-1"
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingTop: 4, paddingBottom: 20, gap: 22 }}>

            <Pressable onPress={() => router.back()} accessibilityRole="button" className="self-start active:opacity-60 py-1">
              <ThemedText style={{ fontSize: 14, fontWeight: '600', color: theme.textSecondary }}>← Cancel</ThemedText>
            </Pressable>

            {/* The sentence: the amount is typed straight into it, the rest is written
                by the two pickers below, so nothing on the page is hidden behind a mode. */}
            <View>
              <ThemedText style={{ fontSize: 24, lineHeight: 32, fontWeight: '600', color: theme.textSecondary }}>
                {trimmedName ? 'I want to make' : 'I want to have'}
              </ThemedText>

              <Pressable
                onPress={() => amountRef.current?.focus()}
                accessibilityRole="button"
                accessibilityLabel={`Amount, ${targetValue} dollars`}
                className="flex-row items-end self-start active:opacity-80"
                style={{ marginTop: 2, marginBottom: 6, borderBottomWidth: 3, borderBottomColor: Brand[500], paddingBottom: 2 }}>
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

              {/* One flowing paragraph, so any combination of answers wraps like English.
                  The goal is part of the sentence, so what a position will count
                  toward is visible at the moment of asking. */}
              <ThemedText style={{ fontSize: 24, lineHeight: 34, fontWeight: '600', color: theme.textSecondary }}>
                {trimmedName ? 'toward ' : 'more in my account '}
                {trimmedName ? <Answer>{trimmedName}</Answer> : null}
                {trimmedName ? ' ' : ''}
                <Answer>{timeWord}</Answer>, investing in <Answer>{marketWord}</Answer>.
              </ThemedText>
            </View>

            <View className="flex-row" style={{ gap: 8 }}>
              {QUICK_AMOUNTS.map((amount) => {
                const selected = targetValue === amount;
                return (
                  <Pressable
                    key={amount}
                    onPress={() => {
                      setTarget(String(amount));
                      Keyboard.dismiss();
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    className="flex-1 items-center active:opacity-70"
                    style={{
                      borderRadius: Radius.pill,
                      paddingVertical: 10,
                      borderWidth: 1.5,
                      borderColor: selected ? Brand[500] : theme.border,
                      backgroundColor: selected ? Brand[500] + '18' : theme.backgroundElement,
                    }}>
                    <ThemedText style={{ fontSize: 14, fontWeight: '800', color: selected ? Brand[500] : theme.textSecondary, fontVariant: ['tabular-nums'] }}>
                      ${amount >= 1000 ? `${amount / 1000}k` : amount}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>

            {/* Spare height goes here, so the pickers stay within thumb reach on a tall
                phone and simply collapse to nothing on a short one. */}
            <View style={{ flexGrow: 1, minHeight: 4 }} />

            <SectionRule label="Your plan" />

            <Group label="Willing to invest" hint="Your ceiling — a route never uses more">
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
                <ThemedText style={{ fontSize: 15, fontWeight: '800', color: Brand[500] }}>$</ThemedText>
                <TextInput
                  value={investValue > 0 ? investValue.toLocaleString() : invest}
                  onChangeText={(text) => setInvest(text.replace(/[^0-9]/g, '').slice(0, MAX_TARGET_DIGITS))}
                  onFocus={() => setInvestFocused(true)}
                  onBlur={() => setInvestFocused(false)}
                  keyboardType="number-pad"
                  inputMode="numeric"
                  selectTextOnFocus
                  returnKeyType="done"
                  placeholder="How much can you put in?"
                  placeholderTextColor={theme.textTertiary}
                  accessibilityLabel="Amount you are willing to invest, in dollars"
                  style={{ flex: 1, color: theme.text, fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'], paddingVertical: 13 }}
                />
              </View>
              <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                {INVEST_AMOUNTS.map((amount) => (
                  <Chip
                    key={amount}
                    label={`$${amount >= 1000 ? `${amount / 1000}k` : amount}`}
                    selected={investValue === amount}
                    role="radio"
                    onPress={() => {
                      Keyboard.dismiss();
                      setInvest(String(amount));
                    }}
                  />
                ))}
              </View>
            </Group>

            <Group label="What for" hint="Optional">
              <View
                className="flex-row items-center"
                style={{
                  gap: 10,
                  paddingHorizontal: 14,
                  borderWidth: 1.5,
                  borderRadius: Radius.md,
                  borderColor: nameFocused ? Brand[500] : theme.borderStrong,
                  backgroundColor: theme.backgroundElement,
                }}>
                <ThemedText style={{ fontSize: 18 }}>{trimmedName ? goalEmoji : UNNAMED_GOAL_EMOJI}</ThemedText>
                <TextInput
                  value={goalName}
                  onChangeText={(text) => {
                    setGoalName(text);
                    // A typed name is the user's own, so it loses a preset's emoji.
                    if (!GOAL_PRESETS.some((preset) => preset.label === text)) setGoalEmoji(CUSTOM_GOAL_EMOJI);
                  }}
                  onFocus={() => setNameFocused(true)}
                  onBlur={() => setNameFocused(false)}
                  placeholder="Name this goal (or leave it blank)"
                  placeholderTextColor={theme.textTertiary}
                  maxLength={40}
                  returnKeyType="done"
                  style={{ flex: 1, color: theme.text, fontSize: 15, fontWeight: '600', paddingVertical: 13 }}
                />
                {existingGoal ? (
                  <ThemedText style={{ fontSize: 10.5, fontWeight: '800', color: Brand[500] }}>EXISTING</ThemedText>
                ) : null}
              </View>
              <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                {GOAL_PRESETS.map((preset) => (
                  <Chip
                    key={preset.label}
                    label={preset.label}
                    emoji={preset.emoji}
                    selected={trimmedName === preset.label}
                    role="radio"
                    onPress={() => choosePreset(preset.label, preset.emoji)}
                  />
                ))}
              </View>
            </Group>

            <Group label="By when">
              <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                {TIMEFRAMES.map((tf) => (
                  <Chip
                    key={tf.value}
                    label={tf.label}
                    selected={timeframe === tf.value}
                    role="radio"
                    onPress={() => {
                      Keyboard.dismiss();
                      setTimeframe(tf.value);
                    }}
                  />
                ))}
              </View>
            </Group>

            {/* Money questions above the rule, market questions below it. They were one
                unbroken run of identical pills, which read as a single form: how much,
                then what to put it on. They are different decisions and the rule says so. */}
            <SectionRule label="Where we look" />

            <Group label="Markets" hint="Leave blank for everything">
              <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                <Chip
                  label="Everything"
                  selected={categories.length === 0}
                  role="radio"
                  onPress={() => {
                    Keyboard.dismiss();
                    setCategories([]);
                  }}
                />
                {MARKETS.map((market) => (
                  <Chip
                    key={market.value}
                    label={market.label}
                    emoji={market.emoji}
                    selected={categories.includes(market.value)}
                    role="checkbox"
                    onPress={() => {
                      Keyboard.dismiss();
                      toggleMarket(market.value);
                    }}
                  />
                ))}
              </View>
            </Group>
          </ScrollView>

          {/* Sticky CTA */}
          <View style={{ paddingHorizontal: 24, paddingTop: 12, paddingBottom: 8, borderTopWidth: 1, borderTopColor: theme.border, backgroundColor: theme.background }}>
            <ThemedText numberOfLines={1} style={{ fontSize: 12, color: theme.textTertiary, marginBottom: 10, paddingHorizontal: 2 }}>
              {targetValue <= 0
                ? 'Enter an amount to continue'
                : existingGoal
                  ? `Continues ${existingGoal.label} · opens in ${appWord || 'your app'}`
                  : trimmedName
                    ? `Starts ${trimmedName} when you acquire · opens in ${appWord || 'your app'}`
                    : `Ranked safest first · opens in ${appWord || 'your app'}`}
            </ThemedText>
            <Pressable
              onPress={submit}
              disabled={targetValue <= 0 || isSaving}
              accessibilityRole="button"
              accessibilityState={{ disabled: targetValue <= 0 || isSaving }}
              className="py-4 items-center active:opacity-85"
              style={{ borderRadius: Radius.lg, backgroundColor: Brand[500], opacity: targetValue > 0 && !isSaving ? 1 : 0.4, ...Shadow.card }}>
              <ThemedText style={{ fontSize: 16, fontWeight: '900', color: OnBrand }}>
                {isSaving ? 'Finding routes…' : 'Find my routes →'}
              </ThemedText>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

/** A value the pickers wrote into the sentence. */
function Answer({ children }: React.PropsWithChildren): React.ReactElement {
  return <ThemedText style={{ fontSize: 24, lineHeight: 34, fontWeight: '800', color: Brand[500] }}>{children}</ThemedText>;
}

/**
 * A labelled divider between the two halves of the form. The money questions and the
 * market question are separate decisions, and running them together as one column of
 * identical pills made "how much" and "what on" read as a single ticket being filled in.
 */
function SectionRule({ label }: { label: string }): React.ReactElement {
  const theme = useTheme();
  return (
    <View className="flex-row items-center" style={{ gap: 10, marginTop: 2 }}>
      <View style={{ flex: 1, height: 1, backgroundColor: theme.border }} />
      <ThemedText style={{ fontSize: 10.5, fontWeight: '900', letterSpacing: 1, color: theme.textTertiary }}>
        {label.toUpperCase()}
      </ThemedText>
      <View style={{ flex: 1, height: 1, backgroundColor: theme.border }} />
    </View>
  );
}

function Group({ label, hint, children }: React.PropsWithChildren<{ label: string; hint?: string }>): React.ReactElement {
  const theme = useTheme();
  return (
    <View style={{ gap: 10 }}>
      <View className="flex-row items-center" style={{ gap: 8 }}>
        <ThemedText style={{ fontSize: 11, fontWeight: '800', letterSpacing: 0.9, color: theme.textTertiary }}>
          {label.toUpperCase()}
        </ThemedText>
        {hint ? (
          <ThemedText style={{ fontSize: 11, color: theme.textTertiary, opacity: 0.7 }}>{hint}</ThemedText>
        ) : null}
      </View>
      {children}
    </View>
  );
}

function Chip({
  label,
  emoji,
  selected,
  role,
  onPress,
}: {
  label: string;
  emoji?: string;
  selected: boolean;
  role: 'radio' | 'checkbox';
  onPress: () => void;
}): React.ReactElement {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={role}
      accessibilityState={role === 'radio' ? { selected } : { checked: selected }}
      className="flex-row items-center active:opacity-70"
      style={{
        gap: 6,
        paddingHorizontal: 14,
        paddingVertical: 11,
        borderRadius: Radius.pill,
        borderWidth: 1.5,
        borderColor: selected ? Brand[500] : theme.border,
        backgroundColor: selected ? Brand[500] + '18' : theme.backgroundElement,
      }}>
      {emoji ? <ThemedText style={{ fontSize: 14 }}>{emoji}</ThemedText> : null}
      <ThemedText style={{ fontSize: 14, fontWeight: '700', color: selected ? Brand[500] : theme.textSecondary }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}
