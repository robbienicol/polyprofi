import { Redirect, useRouter, type Href } from 'expo-router';
import React, { useCallback } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useQuizAnswers } from '@/api/hooks/useQuizAnswers';
import { useSubscription } from '@/api/hooks/useSubscription';
import { ThemedText } from '@/components/themed-text';
import { Accent, Brand, Radius, Shadow } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { FEATURE_FLAGS } from '@/lib/feature-flags';

const FEATURES = [
  { emoji: '🧠', text: 'Live opportunities from our real-time market engine', color: Brand[500] },
  { emoji: '📊', text: 'Compare risk from conservative to aggressive', color: '#84CC16' },
  { emoji: '📍', text: 'Monitor every position and see your P&L in real time', color: Accent.gold },
  { emoji: '🔄', text: 'Refresh routes anytime, as many times as you want', color: Accent.violet },
] as const;

export default function PaywallScreen(): React.ReactElement {
  const router = useRouter();
  const theme = useTheme();
  const { subscribe, isSubscribing } = useSubscription();
  const { quizAnswers } = useQuizAnswers();

  const handleSubscribe = useCallback(() => {
    subscribe(undefined, {
      onSuccess: () => {
        if (quizAnswers) router.replace('/(tabs)/routes?generate=1');
        else router.replace('/(tabs)');
      },
    });
  }, [subscribe, router, quizAnswers]);

  const handleClose = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)');
  }, [router]);

  // Paywall is disabled — there's no real payment behind it yet (see
  // FEATURE_FLAGS.paywallEnabled). Bounce out instead of rendering it.
  if (!FEATURE_FLAGS.paywallEnabled) return <Redirect href="/(tabs)" />;

  return (
    <View className="flex-1" style={{ backgroundColor: theme.background }}>
      <SafeAreaView className="flex-1">
        <Pressable
          onPress={handleClose}
          className="active:opacity-60"
          style={{ position: 'absolute', top: 8, right: 16, zIndex: 10, width: 34, height: 34, borderRadius: Radius.pill, backgroundColor: theme.backgroundElement, borderWidth: 1, borderColor: theme.border, alignItems: 'center', justifyContent: 'center' }}>
          <ThemedText style={{ fontSize: 17, color: theme.textSecondary, lineHeight: 18 }}>×</ThemedText>
        </Pressable>
        <ScrollView
          contentContainerClassName="px-6 pt-16 pb-16 gap-9 items-center"
          showsVerticalScrollIndicator={false}>

          <View className="items-center gap-4">
            <View style={{ width: 72, height: 72, borderRadius: Radius.xl, backgroundColor: Brand[500], alignItems: 'center', justifyContent: 'center', ...Shadow.float }}>
              <ThemedText style={{ fontSize: 38, fontWeight: '900', color: '#06140C' }}>$</ThemedText>
            </View>
            <ThemedText style={{ fontSize: 28, fontWeight: '800', letterSpacing: -0.6, color: theme.text }} className="text-center">
              Your routes are ready
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" className="text-center" style={{ maxWidth: 290, lineHeight: 20 }}>
              We ran the numbers across thousands of live data points to build your plays. Unlock Pro to see every one.
            </ThemedText>
          </View>

          <View className="self-stretch gap-2.5">
            {FEATURES.map((f) => (
              <View
                key={f.emoji}
                className="flex-row items-center gap-3 border"
                style={{ borderRadius: Radius.lg, padding: 12, backgroundColor: theme.backgroundElement, borderColor: theme.border }}>
                <View
                  className="items-center justify-center"
                  style={{ width: 40, height: 40, borderRadius: Radius.md, backgroundColor: f.color + '22' }}>
                  <ThemedText style={{ fontSize: 18 }}>{f.emoji}</ThemedText>
                </View>
                <ThemedText style={{ fontSize: 13.5, color: theme.text, flex: 1, lineHeight: 19 }}>{f.text}</ThemedText>
              </View>
            ))}
          </View>

          <View
            className="self-stretch items-center gap-1 border"
            style={{ borderRadius: Radius.xl, padding: 24, backgroundColor: theme.backgroundElevated, borderColor: Brand[500] + '33', ...Shadow.card }}>
            <ThemedText
              className="text-center"
              style={{ color: Brand[500], fontSize: 44, lineHeight: 56, fontWeight: '800', letterSpacing: -1, fontVariant: ['tabular-nums'] }}>
              $9.99
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">per month · cancel anytime</ThemedText>
          </View>

          <Pressable
            onPress={handleSubscribe}
            disabled={isSubscribing}
            className="self-stretch py-4 items-center active:opacity-80"
            style={{ borderRadius: Radius.lg, backgroundColor: Brand[500], opacity: isSubscribing ? 0.7 : 1, ...Shadow.card }}>
            {isSubscribing
              ? <ActivityIndicator color="#06140C" />
              : <ThemedText style={{ fontWeight: '800', fontSize: 16, color: '#06140C' }}>
                  Subscribe — $9.99/mo
                </ThemedText>}
          </Pressable>

          <ThemedText type="small" themeColor="textSecondary" className="text-center" style={{ opacity: 0.5 }}>
            By subscribing you agree to our{' '}
            <ThemedText type="small" style={{ opacity: 1, textDecorationLine: 'underline' }} onPress={() => router.push('/terms' as Href)}>
              Terms of Service
            </ThemedText>{' '}
            and{' '}
            <ThemedText type="small" style={{ opacity: 1, textDecorationLine: 'underline' }} onPress={() => router.push('/privacy' as Href)}>
              Privacy Policy
            </ThemedText>
            . AI-generated · Not financial advice.
          </ThemedText>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
