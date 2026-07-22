import { useRouter } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  View,
  ViewToken,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useOnboarding } from '@/api/hooks/useOnboarding';
import { ONBOARDING_SLIDES } from '@/components/onboarding/onboarding-data';
import { OnboardingGlow, renderOnboardingPreview } from '@/components/onboarding/OnboardingPreviews';
import { ThemedText } from '@/components/themed-text';
import { Brand, Radius, Shadow } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const VIEWABILITY_CONFIG = { viewAreaCoveragePercentThreshold: 60 };

export default function OnboardingScreen(): React.ReactElement {
  const theme = useTheme();
  const router = useRouter();
  const { completeOnboarding, isCompleting } = useOnboarding();
  const listRef = useRef<FlatList>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const isLast = activeIndex === ONBOARDING_SLIDES.length - 1;

  const finish = useCallback(() => {
    completeOnboarding(undefined, {
      onSuccess: () => router.replace('/'),
    });
  }, [completeOnboarding, router]);

  const goNext = useCallback(() => {
    if (isLast) {
      finish();
      return;
    }
    listRef.current?.scrollToIndex({ index: activeIndex + 1, animated: true });
  }, [activeIndex, finish, isLast]);

  const onViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const index = viewableItems[0]?.index;
    if (index != null) setActiveIndex(index);
  }, []);

  const onMomentumScrollEnd = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    setActiveIndex(index);
  }, []);

  return (
    <View className="flex-1" style={{ backgroundColor: theme.background }}>
      <OnboardingGlow />
      <SafeAreaView className="flex-1">
        {/* Top bar */}
        <View className="flex-row items-center justify-between px-5 pt-2 pb-1">
          <View className="flex-row items-center gap-2">
            <View style={{ width: 28, height: 28, borderRadius: Radius.sm, backgroundColor: Brand[500], alignItems: 'center', justifyContent: 'center' }}>
              <ThemedText style={{ fontSize: 15, fontWeight: '900', color: '#06140C' }}>$</ThemedText>
            </View>
            <ThemedText style={{ fontSize: 16, fontWeight: '800', color: theme.text, letterSpacing: -0.3 }}>
              PolyProfit
            </ThemedText>
          </View>
          {!isLast && (
            <Pressable onPress={finish} disabled={isCompleting} className="active:opacity-60 px-2 py-1">
              <ThemedText style={{ fontSize: 14, fontWeight: '600', color: theme.textSecondary }}>Skip</ThemedText>
            </Pressable>
          )}
        </View>

        {/* Slides */}
        <View className="flex-1">
          <FlatList
            ref={listRef}
            data={ONBOARDING_SLIDES}
            keyExtractor={(item) => item.id}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            bounces={false}
            style={{ flex: 1 }}
            onMomentumScrollEnd={onMomentumScrollEnd}
            onViewableItemsChanged={onViewableItemsChanged}
            viewabilityConfig={VIEWABILITY_CONFIG}
            getItemLayout={(_, index) => ({ length: SCREEN_WIDTH, offset: SCREEN_WIDTH * index, index })}
            renderItem={({ item }) => (
              <View style={{ width: SCREEN_WIDTH, flex: 1 }} className="px-5 pb-4">
                <View className="gap-2 pt-4 pb-3" style={{ flexShrink: 0 }}>
                  <ThemedText style={{ fontSize: 11, fontWeight: '700', color: Brand[500], letterSpacing: 0.9 }}>
                    {item.eyebrow}
                  </ThemedText>
                  <ThemedText style={{ fontSize: 34, fontWeight: '800', color: theme.text, letterSpacing: -0.8, lineHeight: 40 }}>
                    {item.title}
                  </ThemedText>
                  <ThemedText style={{ fontSize: 15, color: theme.textSecondary, lineHeight: 22, maxWidth: 320 }}>
                    {item.body}
                  </ThemedText>
                </View>

                <View style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
                  {renderOnboardingPreview(item.kind)}
                </View>
              </View>
            )}
          />
        </View>

        {/* Footer */}
        <View className="px-5 pb-2 pt-3 gap-5">
          <View className="flex-row items-center justify-center gap-2">
            {ONBOARDING_SLIDES.map((slide, i) => {
              const active = i === activeIndex;
              return (
                <View
                  key={slide.id}
                  style={{
                    width: active ? 22 : 7,
                    height: 7,
                    borderRadius: Radius.pill,
                    backgroundColor: active ? Brand[500] : theme.backgroundSelected,
                  }}
                />
              );
            })}
          </View>

          <Pressable
            onPress={goNext}
            disabled={isCompleting}
            className="py-4 items-center active:opacity-85"
            style={{
              borderRadius: Radius.lg,
              backgroundColor: Brand[500],
              opacity: isCompleting ? 0.6 : 1,
              ...Shadow.card,
            }}>
            <ThemedText style={{ fontSize: 16, fontWeight: '800', color: '#06140C' }}>
              {isLast ? 'Get started →' : 'Continue'}
            </ThemedText>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}
