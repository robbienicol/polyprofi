import { useRouter, type Href } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Animated, Easing, Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useOnboardingProfile } from '@/api/hooks/useOnboardingProfile';
import { OnboardingGlow } from '@/components/onboarding/OnboardingPreviews';
import { SOMETHING_ELSE } from '@/components/onboarding/quiz-pages';
import { ThemedText } from '@/components/themed-text';
import { Brand, Radius, Shadow } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { deviceCountry } from '@/lib/device-region';
import { HORIZONS, LOSS_REACTIONS, type SurveyAnswers } from '@/lib/onboarding-profile';

/** Each row lands after the one above it, so the card assembles rather than appearing. */
const ROW_STAGGER_MS = 110;

/**
 * The payoff screen. Everything the run collected, handed back as a plan rather
 * than as a receipt — the rows are phrased as what Pathey will now do, not as
 * what was typed in.
 */
export default function PlanReadyScreen(): React.ReactElement {
  const theme = useTheme();
  const router = useRouter();
  const { height } = useWindowDimensions();
  const compact = height > 0 && height < 740;
  const { profile, name, isLoading } = useOnboardingProfile();

  const rows = isLoading ? [] : planRows(profile.answers);

  const next = useCallback(() => router.replace('/goal-setup' as Href), [router]);

  return (
    <View className="flex-1" style={{ backgroundColor: theme.background }}>
      <OnboardingGlow />
      <SafeAreaView className="flex-1">
        {/* Scrollable: six rows and a headline do not fit an SE-class screen, and
            the CTA below stays pinned so the way forward is never scrolled off. */}
        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            flexGrow: 1,
            paddingHorizontal: 24,
            paddingTop: compact ? 24 : 40,
            paddingBottom: 16,
            gap: compact ? 18 : 26,
          }}>
          <View style={{ gap: 10 }}>
            <View
              className="flex-row items-center self-start"
              style={{
                gap: 6,
                paddingHorizontal: 10,
                paddingVertical: 5,
                borderRadius: Radius.pill,
                backgroundColor: Brand[500] + '18',
                borderWidth: 1,
                borderColor: Brand[500] + '3D',
              }}>
              <View style={{ width: 5, height: 5, borderRadius: 999, backgroundColor: Brand[500] }} />
              <ThemedText style={{ fontSize: 9.5, fontWeight: '900', color: Brand[500], letterSpacing: 0.9 }}>
                PLAN READY
              </ThemedText>
            </View>
            <ThemedText
              style={{
                fontSize: compact ? 29 : 34,
                lineHeight: compact ? 34 : 40,
                fontWeight: '800',
                letterSpacing: -1,
                color: theme.text,
              }}>
              {name ? `You're set up,\n${name}.` : "You're all set up."}
            </ThemedText>
          </View>

          <View style={{ gap: 10 }}>
            {rows.map((row, index) => (
              <PlanRow key={row.label} row={row} delay={index * ROW_STAGGER_MS} />
            ))}
          </View>
        </ScrollView>

        <View className="px-6" style={{ gap: 10, paddingBottom: 22 }}>
          <Pressable
            onPress={next}
            accessibilityRole="button"
            className="py-4 items-center active:opacity-85"
            style={{ borderRadius: Radius.lg, backgroundColor: Brand[500], ...Shadow.card }}>
            <ThemedText style={{ fontSize: 16, fontWeight: '800', color: '#06140C', letterSpacing: -0.2 }}>
              Set my first goal →
            </ThemedText>
          </Pressable>
          <ThemedText style={{ fontSize: 10.5, color: theme.textTertiary, textAlign: 'center' }}>
            Nothing here is locked in — change any of it in Settings
          </ThemedText>
        </View>
      </SafeAreaView>
    </View>
  );
}

interface Row {
  emoji: string;
  label: string;
  value: string;
}

/** Reads the answers back as consequences: what the app will do, not what was picked. */
function planRows(answers: SurveyAnswers): Row[] {
  const outcome = answers.outcome === SOMETHING_ELSE ? answers.outcomeOther.trim() : answers.outcome;
  const horizon = HORIZONS.find((item) => item.value === answers.horizon);
  const reaction = LOSS_REACTIONS.find((item) => item.value === answers.lossReaction);

  return [
    {
      emoji: '🎯',
      // Left in its own case: the labels are verb phrases, so folding them down
      // and hanging them off a preposition reads wrong.
      label: 'Your goal',
      value: outcome || 'Grow what you have',
    },
    {
      emoji: '🧭',
      label: 'We check',
      // Left as written: "Stocks & ETFs" folded down reads "stocks & etfs".
      value: answers.markets.length > 0 ? answers.markets.join(', ') : 'every market we can price',
    },
    {
      emoji: '⏱️',
      label: 'Timeframe',
      value: horizon?.label ?? 'No rush',
    },
    {
      emoji: '⚖️',
      label: 'Risk',
      value: reaction ? riskSentence(reaction.value) : 'Middle of the road',
    },
    {
      emoji: '💰',
      label: 'Your limit',
      value: answers.amount ?? 'whatever you set each time',
    },
    {
      emoji: '📍',
      label: 'You are in',
      value: deviceCountry() || 'Wherever you are',
    },
    {
      emoji: '🔔',
      label: 'Alerts',
      value: 'When a position moves, or you hit a milestone',
    },
  ];
}

function riskSentence(reaction: (typeof LOSS_REACTIONS)[number]['value']): string {
  switch (reaction) {
    case 'sell':
      return 'Safe picks first';
    case 'hold':
      return 'Slower picks are fine';
    case 'buy':
      return 'Risky picks are in too';
    default:
      return 'We show the risk up front';
  }
}

function PlanRow({ row, delay }: { row: Row; delay: number }): React.ReactElement {
  const theme = useTheme();
  const [anim] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 380,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [anim, delay]);

  // Layout goes in the style rather than a class: NativeWind does not reach
  // inside an Animated component, so a className here quietly does nothing.
  return (
    <Animated.View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        opacity: anim,
        transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
        gap: 12,
        paddingHorizontal: 14,
        paddingVertical: 13,
        borderRadius: Radius.md,
        borderWidth: 1,
        borderColor: theme.border,
        backgroundColor: theme.backgroundElement,
      }}>
      <ThemedText style={{ fontSize: 18 }}>{row.emoji}</ThemedText>
      <View style={{ flex: 1, gap: 2 }}>
        <ThemedText style={{ fontSize: 10.5, fontWeight: '900', letterSpacing: 0.8, color: theme.textTertiary }}>
          {row.label.toUpperCase()}
        </ThemedText>
        <ThemedText style={{ fontSize: 14, fontWeight: '700', color: theme.text }}>{row.value}</ThemedText>
      </View>
    </Animated.View>
  );
}
