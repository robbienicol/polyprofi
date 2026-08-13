import { Redirect, Stack, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Animated, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSavingsGoal } from '@/api/hooks/useSavingsGoal';
import { OnboardingGlow } from '@/components/onboarding/OnboardingPreviews';
import { ThemedText } from '@/components/themed-text';
import { Confetti } from '@/components/ui/Confetti';
import { Accent, Brand, Radius, Shadow } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const MONO = { fontVariant: ['tabular-nums' as const] };

/**
 * The congratulations screen for a reached savings goal. Presented from persisted
 * state (see shouldPresentCelebration in @/lib/savings-goal), so it survives a
 * cold start from the notification and shows exactly once per goal.
 */
export default function GoalAchievedScreen(): React.ReactElement {
  const theme = useTheme();
  const router = useRouter();
  const { goal, achievedCount, markCelebrated, isLoading } = useSavingsGoal();
  const [entrance] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.spring(entrance, { toValue: 1, friction: 6, tension: 60, useNativeDriver: true }).start();
  }, [entrance]);

  // Claim the celebration as soon as it is on screen, so a crash or a swipe-away
  // can't leave the user stuck being congratulated on every app open.
  useEffect(() => {
    if (goal?.achievedAt && !goal.celebratedAt) markCelebrated();
  }, [goal?.achievedAt, goal?.celebratedAt, markCelebrated]);

  if (isLoading) return <View style={{ flex: 1, backgroundColor: theme.background }} />;
  if (!goal?.achievedAt) return <Redirect href="/(tabs)" />;

  const close = (): void => router.replace('/(tabs)');
  const setNewGoal = (): void => router.replace('/goal-setup');

  return (
    <View className="flex-1" style={{ backgroundColor: theme.background }}>
      <Stack.Screen options={{ presentation: 'fullScreenModal', animation: 'fade', gestureEnabled: false }} />
      <OnboardingGlow />
      <Confetti />
      <SafeAreaView className="flex-1">
        <View className="flex-1 items-center justify-center" style={{ paddingHorizontal: 28, gap: 8 }}>
          <Animated.View
            style={{
              opacity: entrance,
              transform: [{ scale: entrance.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }],
              width: 132,
              height: 132,
              borderRadius: 999,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: Brand[500] + '22',
              borderWidth: 2,
              borderColor: Brand[500],
              ...Shadow.card,
            }}>
            <ThemedText style={{ fontSize: 64 }}>{goal.emoji}</ThemedText>
          </Animated.View>

          <ThemedText
            style={{ fontSize: 12, fontWeight: '900', color: Brand[500], letterSpacing: 1.4, marginTop: 26 }}>
            GOAL REACHED
          </ThemedText>
          <ThemedText
            style={{
              fontSize: 40,
              lineHeight: 46,
              fontWeight: '900',
              color: theme.text,
              letterSpacing: -1,
              textAlign: 'center',
              marginTop: 6,
            }}>
            Congratulations!
          </ThemedText>
          <ThemedText
            style={{ fontSize: 18, lineHeight: 26, color: theme.text, textAlign: 'center', marginTop: 10 }}>
            You earned enough for{' '}
            <ThemedText style={{ fontSize: 18, lineHeight: 26, fontWeight: '900', color: Brand[500] }}>
              {goal.label}
            </ThemedText>
          </ThemedText>

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'baseline',
              gap: 8,
              marginTop: 18,
              paddingHorizontal: 20,
              paddingVertical: 12,
              borderRadius: Radius.pill,
              backgroundColor: theme.backgroundElevated,
              borderWidth: 1,
              borderColor: Brand[500] + '55',
            }}>
            <ThemedText style={{ fontSize: 30, fontWeight: '900', color: Brand[500], ...MONO }}>
              +${goal.targetAmount.toLocaleString()}
            </ThemedText>
            <ThemedText style={{ fontSize: 13, color: theme.textSecondary }}>in net gains</ThemedText>
          </View>

          {achievedCount > 0 ? (
            <ThemedText style={{ fontSize: 13, fontWeight: '700', color: Accent.gold, marginTop: 16 }}>
              🏆 {achievedCount} goal{achievedCount === 1 ? '' : 's'} reached
            </ThemedText>
          ) : null}
        </View>

        <View style={{ paddingHorizontal: 20, paddingBottom: 12, gap: 10 }}>
          <Pressable
            onPress={setNewGoal}
            accessibilityRole="button"
            className="py-4 items-center active:opacity-85"
            style={{ borderRadius: Radius.lg, backgroundColor: Brand[500], ...Shadow.card }}>
            <ThemedText style={{ fontSize: 16, fontWeight: '900', color: '#06140C' }}>Set new goal →</ThemedText>
          </Pressable>
          <Pressable
            onPress={close}
            accessibilityRole="button"
            className="py-4 items-center active:opacity-70"
            style={{
              borderRadius: Radius.lg,
              backgroundColor: theme.backgroundElement,
              borderWidth: 1,
              borderColor: theme.border,
            }}>
            <ThemedText style={{ fontSize: 16, fontWeight: '800', color: theme.textSecondary }}>Dismiss</ThemedText>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}
