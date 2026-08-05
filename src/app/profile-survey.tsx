import { useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useUserProfile } from '@/api/hooks/useUserProfile';
import { ThemedText } from '@/components/themed-text';
import { Brand, Radius, Shadow } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const SKIP = 'Prefer not to say';
const OTHER = 'Other';
const SOMETHING_ELSE = 'Something else';

const AGE_RANGES = ['18-24', '25-34', '35-44', '45-54', '55-64', '65+', SKIP] as const;
const COUNTRIES = ['United States', 'Canada', 'United Kingdom', 'Australia', OTHER, SKIP] as const;
const EXPERIENCE_LEVELS = ['New to investing', 'Some experience', 'Experienced', 'Professional', SKIP] as const;
const REASONS = [
  'Find the best route',
  'Compare investments',
  'Understand risk',
  'See if I’m on track',
  'Just exploring',
  SKIP,
] as const;
const GOALS = [
  'Grow long-term wealth',
  'Build an emergency fund',
  'Learn how investing works',
  'Beat inflation on my savings',
  'Extra income on the side',
  SOMETHING_ELSE,
  SKIP,
] as const;
const AMOUNTS = ['Under $1,000', '$1,000 - $5,000', '$5,000 - $25,000', '$25,000 - $100,000', '$100,000+', SKIP] as const;
const MARKETS = ['Stocks & ETFs', 'Crypto', 'Sports betting / prediction markets', 'Forex', 'Bonds & savings'] as const;

const STEPS = ['age', 'country', 'experience', 'reason', 'goal', 'amount', 'markets'] as const;
type Step = (typeof STEPS)[number];

const STEP_TITLES: Record<Step, string> = {
  age: 'How old are you?',
  country: 'Where are you\nbased?',
  experience: 'How experienced\nare you investing?',
  reason: 'What brought you\nto PolyProfit?',
  goal: "What's your main\ngoal right now?",
  amount: 'How much are you\nstarting with?',
  markets: 'Any markets you\ncare about?',
};

const STEP_DESCRIPTIONS: Record<Step, string> = {
  age: 'Helps us tailor which routes we lead with.',
  country: 'Some routes (T-bills, HYSAs) are US-specific — this keeps recommendations relevant.',
  experience: "We'll pitch things differently for a first-timer than a pro.",
  reason: 'Tells us which part of the app to put in front of you first.',
  goal: 'The big picture behind the goals you set.',
  amount: "A ballpark is fine — this shapes which routes we lead with.",
  markets: "Leave blank if you're not sure yet — pick as many as apply.",
};

export default function ProfileSurveyScreen(): React.ReactElement {
  const router = useRouter();
  const theme = useTheme();
  const { saveProfile, isSaving } = useUserProfile();

  const [step, setStep] = useState<Step>('age');
  const [age, setAge] = useState<string | null>(null);
  const [country, setCountry] = useState<string | null>(null);
  const [countryOther, setCountryOther] = useState('');
  const [experience, setExperience] = useState<string | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [goal, setGoal] = useState<string | null>(null);
  const [goalOther, setGoalOther] = useState('');
  const [amount, setAmount] = useState<string | null>(null);
  const [markets, setMarkets] = useState<string[]>([]);

  const stepIndex = STEPS.indexOf(step);
  const progress = (stepIndex + 1) / STEPS.length;

  const toggleMarket = useCallback((market: string) => {
    setMarkets((prev) => (prev.includes(market) ? prev.filter((m) => m !== market) : [...prev, market]));
  }, []);

  const finish = useCallback(() => {
    saveProfile(
      {
        ageRange: age,
        country: country === OTHER ? (countryOther.trim() || OTHER) : country,
        financialGoal: goal === SOMETHING_ELSE ? (goalOther.trim() || SOMETHING_ELSE) : goal,
        investingExperience: experience,
        marketsInterested: markets,
        signupReason: reason,
        investmentAmount: amount,
      },
      { onSettled: () => router.replace('/goal-setup') }
    );
  }, [age, country, countryOther, goal, goalOther, experience, reason, amount, markets, saveProfile, router]);

  const handleNext = useCallback(() => {
    const nextStep = STEPS[stepIndex + 1];
    if (nextStep) setStep(nextStep);
    else finish();
  }, [stepIndex, finish]);

  const skipAll = useCallback(() => {
    saveProfile(
      {
        ageRange: null,
        country: null,
        financialGoal: null,
        investingExperience: null,
        marketsInterested: [],
        signupReason: null,
        investmentAmount: null,
      },
      { onSettled: () => router.replace('/goal-setup') }
    );
  }, [saveProfile, router]);

  function renderChips<T extends string>(options: readonly T[], selected: string | null, onSelect: (value: T) => void) {
    return (
      <View className="flex-row flex-wrap gap-2">
        {options.map((option) => {
          const isSelected = selected === option;
          return (
            <Pressable
              key={option}
              onPress={() => onSelect(option)}
              className="px-5 border active:opacity-70"
              style={{
                borderRadius: Radius.pill,
                paddingVertical: 11,
                borderColor: isSelected ? Brand[500] : theme.border,
                backgroundColor: isSelected ? Brand[500] + '18' : theme.backgroundElement,
              }}>
              <ThemedText style={{ fontSize: 14, fontWeight: isSelected ? '700' : '500', color: isSelected ? Brand[500] : theme.textSecondary }}>
                {option}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
    );
  }

  return (
    <View className="flex-1" style={{ backgroundColor: theme.background }}>
      <SafeAreaView className="flex-1">
        <View className="px-6 pt-4 pb-2 gap-4">
          <View className="flex-row items-center justify-between">
            <View className="flex-1 rounded-full overflow-hidden mr-3" style={{ height: 5, backgroundColor: theme.backgroundSelected }}>
              <View className="h-full rounded-full" style={{ width: `${progress * 100}%`, backgroundColor: Brand[500] }} />
            </View>
            <Pressable onPress={skipAll} className="active:opacity-60 py-1">
              <ThemedText style={{ fontSize: 13, fontWeight: '600', color: theme.textTertiary }}>Skip</ThemedText>
            </Pressable>
          </View>
          <ThemedText style={{ fontSize: 28, fontWeight: '800', lineHeight: 36, letterSpacing: -0.6, color: theme.text }}>
            {STEP_TITLES[step]}
          </ThemedText>
          <ThemedText style={{ fontSize: 13, color: theme.textSecondary, lineHeight: 19 }}>
            {STEP_DESCRIPTIONS[step]}
          </ThemedText>
        </View>

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingTop: 16, paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled">

          {step === 'age' && renderChips(AGE_RANGES, age, setAge)}

          {step === 'country' && (
            <View className="gap-4">
              {renderChips(COUNTRIES, country, setCountry)}
              {country === OTHER && (
                <TextInput
                  value={countryOther}
                  onChangeText={setCountryOther}
                  placeholder="Which country?"
                  placeholderTextColor={theme.textTertiary}
                  style={{
                    borderWidth: 1.5,
                    borderRadius: Radius.md,
                    borderColor: theme.borderStrong,
                    backgroundColor: theme.backgroundElement,
                    color: theme.text,
                    fontSize: 15,
                    fontWeight: '600',
                    paddingVertical: 13,
                    paddingHorizontal: 14,
                  }}
                />
              )}
            </View>
          )}

          {step === 'experience' && renderChips(EXPERIENCE_LEVELS, experience, setExperience)}

          {step === 'reason' && renderChips(REASONS, reason, setReason)}

          {step === 'goal' && (
            <View className="gap-4">
              {renderChips(GOALS, goal, setGoal)}
              {goal === SOMETHING_ELSE && (
                <TextInput
                  value={goalOther}
                  onChangeText={setGoalOther}
                  placeholder="What's the goal?"
                  placeholderTextColor={theme.textTertiary}
                  maxLength={60}
                  style={{
                    borderWidth: 1.5,
                    borderRadius: Radius.md,
                    borderColor: theme.borderStrong,
                    backgroundColor: theme.backgroundElement,
                    color: theme.text,
                    fontSize: 15,
                    fontWeight: '600',
                    paddingVertical: 13,
                    paddingHorizontal: 14,
                  }}
                />
              )}
            </View>
          )}

          {step === 'amount' && renderChips(AMOUNTS, amount, setAmount)}

          {step === 'markets' && (
            <View className="flex-row flex-wrap gap-2">
              {MARKETS.map((market) => {
                const selected = markets.includes(market);
                return (
                  <Pressable
                    key={market}
                    onPress={() => toggleMarket(market)}
                    className="px-5 border active:opacity-70"
                    style={{
                      borderRadius: Radius.pill,
                      paddingVertical: 11,
                      borderColor: selected ? Brand[500] : theme.border,
                      backgroundColor: selected ? Brand[500] + '18' : theme.backgroundElement,
                    }}>
                    <ThemedText style={{ fontSize: 14, fontWeight: selected ? '700' : '500', color: selected ? Brand[500] : theme.textSecondary }}>
                      {market}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
          )}
        </ScrollView>

        <View className="px-6 pb-8 pt-2">
          <Pressable
            onPress={handleNext}
            disabled={isSaving}
            className="py-4 items-center active:opacity-80"
            style={{ borderRadius: Radius.lg, backgroundColor: Brand[500], opacity: isSaving ? 0.6 : 1, ...Shadow.card }}>
            <ThemedText style={{ fontSize: 16, fontWeight: '800', color: '#06140C' }}>
              {stepIndex === STEPS.length - 1 ? "Let's go →" : 'Next →'}
            </ThemedText>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}
