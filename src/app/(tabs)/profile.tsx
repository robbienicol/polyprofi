import { useAuth, useUser } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';
import React, { useCallback, useMemo } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSavedRoutes } from '@/api/hooks/useSavedRoutes';
import { ThemedText } from '@/components/themed-text';
import { Accent, Brand, Radius, Shadow } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const MONO = { fontVariant: ['tabular-nums' as const] };

export default function ProfileScreen(): React.ReactElement {
  const theme = useTheme();
  const router = useRouter();
  const { user } = useUser();
  const { signOut } = useAuth();
  const { history } = useSavedRoutes();
  const latestSearch = history[0] ?? null;
  const initials = useMemo(() => {
    const first = user?.firstName?.[0] ?? '';
    const last = user?.lastName?.[0] ?? '';
    return (first + last || user?.primaryEmailAddress?.emailAddress?.[0] || 'P').toUpperCase();
  }, [user]);

  const handleSignOut = useCallback(async () => {
    await signOut();
    router.replace('/sign-in');
  }, [signOut, router]);

  return (
    <View className="flex-1" style={{ backgroundColor: theme.background }}>
      <SafeAreaView className="flex-1">
        <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="px-4 pt-6 pb-16 gap-4">
          <View
            style={{
              borderRadius: Radius.xl,
              backgroundColor: theme.backgroundElevated,
              borderWidth: 1,
              borderColor: theme.border,
              padding: 18,
              gap: 16,
              ...Shadow.card,
            }}>
            <View className="flex-row items-center gap-4">
              <View
                style={{
                  width: 62,
                  height: 62,
                  borderRadius: Radius.xl,
                  backgroundColor: Brand[500],
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <ThemedText style={{ fontSize: 22, fontWeight: '900', color: '#06140C' }}>{initials}</ThemedText>
              </View>
              <View className="flex-1 gap-1">
                <ThemedText style={{ fontSize: 24, fontWeight: '800', color: theme.text, letterSpacing: -0.4 }}>
                  {user?.fullName || user?.firstName || 'PolyProfit user'}
                </ThemedText>
                <ThemedText style={{ fontSize: 13, color: theme.textTertiary }} numberOfLines={1}>
                  {user?.primaryEmailAddress?.emailAddress ?? 'Signed in'}
                </ThemedText>
              </View>
            </View>

            <View
              className="flex-row items-center justify-between"
              style={{ borderRadius: Radius.lg, backgroundColor: theme.backgroundElement, borderWidth: 1, borderColor: theme.border, padding: 14 }}>
              <View>
                <ThemedText style={{ fontSize: 11, fontWeight: '800', color: theme.textTertiary, letterSpacing: 0.6 }}>PLAN</ThemedText>
                <ThemedText style={{ fontSize: 18, fontWeight: '800', color: theme.text, marginTop: 3 }}>
                  PolyProfit
                </ThemedText>
              </View>
            </View>
          </View>

          <View
            style={{
              borderRadius: Radius.xl,
              backgroundColor: theme.backgroundElevated,
              borderWidth: 1,
              borderColor: theme.border,
              padding: 18,
              gap: 12,
              ...Shadow.card,
            }}>
            <ThemedText style={{ fontSize: 16, fontWeight: '800', color: theme.text }}>Latest goal</ThemedText>
            {latestSearch ? (
              <>
                <View className="flex-row items-baseline gap-2">
                  <ThemedText style={{ fontSize: 30, fontWeight: '800', color: Brand[500], ...MONO }}>
                    ${latestSearch.quizSnapshot.balance + latestSearch.quizSnapshot.target}
                  </ThemedText>
                  <ThemedText style={{ fontSize: 13, color: theme.textTertiary, ...MONO }}>
                    from ${latestSearch.quizSnapshot.balance}
                  </ThemedText>
                </View>
                <ThemedText style={{ fontSize: 13, color: theme.textSecondary }}>
                  {latestSearch.routes.length} ranked routes · {latestSearch.quizSnapshot.riskTolerance ?? 'balanced'} risk
                </ThemedText>
                <Pressable onPress={() => router.push('/(tabs)/routes')} className="self-start active:opacity-70">
                  <ThemedText style={{ fontSize: 13, fontWeight: '800', color: Brand[500] }}>View routes</ThemedText>
                </Pressable>
              </>
            ) : (
              <>
                <ThemedText style={{ fontSize: 13, color: theme.textSecondary, lineHeight: 19 }}>
                  Set your first goal to generate ranked routes and build a portfolio.
                </ThemedText>
                <Pressable
                  onPress={() => router.push('/quiz')}
                  className="self-start px-4 py-2.5 active:opacity-80"
                  style={{ borderRadius: Radius.md, backgroundColor: Brand[500] }}>
                  <ThemedText style={{ fontSize: 13, fontWeight: '800', color: '#06140C' }}>Start quiz</ThemedText>
                </Pressable>
              </>
            )}
          </View>

          <Pressable
            onPress={handleSignOut}
            className="py-3 items-center active:opacity-75"
            style={{ borderRadius: Radius.lg, borderWidth: 1, borderColor: Accent.red + '44', backgroundColor: Accent.red + '10' }}>
            <ThemedText style={{ fontSize: 14, fontWeight: '800', color: Accent.red }}>Sign out</ThemedText>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
