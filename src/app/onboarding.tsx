import { useRouter } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import {
  Animated,
  FlatList,
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useOnboarding } from '@/api/hooks/useOnboarding';
import { ONBOARDING_SLIDES } from '@/components/onboarding/onboarding-data';
import { OnboardingGlow, renderOnboardingPreview } from '@/components/onboarding/OnboardingPreviews';
import { ThemedText } from '@/components/themed-text';
import { Brand, Radius, Shadow } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const SLIDE_COUNT = ONBOARDING_SLIDES.length;
const TRACK_GAP = 5;
const MONO = { fontVariant: ['tabular-nums' as const] };

/**
 * Progress track: one segment per slide, each filling as you scroll into it. Driven off
 * the same scrollX as the slides so the fill tracks a half-swipe, not just the settle.
 * We translate a full-width bar inside a clipped segment rather than animating width —
 * keeps it on the native driver.
 */
function ProgressTrack({ scrollX, slideWidth }: { scrollX: Animated.Value; slideWidth: number }): React.ReactElement {
  const theme = useTheme();
  const [trackWidth, setTrackWidth] = useState(0);
  const segmentWidth = trackWidth > 0 ? (trackWidth - TRACK_GAP * (SLIDE_COUNT - 1)) / SLIDE_COUNT : 0;

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    setTrackWidth(event.nativeEvent.layout.width);
  }, []);

  return (
    <View className="flex-row" style={{ gap: TRACK_GAP }} onLayout={onLayout}>
      {ONBOARDING_SLIDES.map((slide, index) => (
        <View
          key={slide.id}
          style={{
            width: segmentWidth,
            height: 3,
            borderRadius: Radius.pill,
            backgroundColor: theme.backgroundSelected,
            overflow: 'hidden',
          }}>
          {segmentWidth > 0 ? (
            <Animated.View
              style={{
                width: segmentWidth,
                height: 3,
                borderRadius: Radius.pill,
                backgroundColor: Brand[500],
                transform: [
                  {
                    translateX: scrollX.interpolate({
                      inputRange: [(index - 1) * slideWidth, index * slideWidth],
                      outputRange: [-segmentWidth, 0],
                      extrapolate: 'clamp',
                    }),
                  },
                ],
              }}
            />
          ) : null}
        </View>
      ))}
    </View>
  );
}

export default function OnboardingScreen(): React.ReactElement {
  const theme = useTheme();
  const router = useRouter();
  const { completeOnboarding, isCompleting } = useOnboarding();
  const listRef = useRef<FlatList>(null);
  const [scrollX] = useState(() => new Animated.Value(0));
  const [activeIndex, setActiveIndex] = useState(0);
  const [listHeight, setListHeight] = useState(0);
  // Width has to come from the hook, not module-level Dimensions: on web's static
  // render pass it is 0, which collapses every slide and breaks the interpolations.
  const { width, height } = useWindowDimensions();
  const slideWidth = Math.max(width, 1);
  // Short screens (SE-class) shrink the headline and scale the preview panel to fit
  // rather than letting it slide under the CTA.
  const short = height > 0 && height < 700;
  const previewFit = short ? 0.84 : height > 0 && height < 780 ? 0.93 : 1;

  const isLast = activeIndex === SLIDE_COUNT - 1;

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
    listRef.current?.scrollToOffset({ offset: slideWidth * (activeIndex + 1), animated: true });
  }, [activeIndex, finish, isLast, slideWidth]);

  // Settle handler rather than onViewableItemsChanged: VirtualizedList throws if that
  // callback's identity ever changes, and the progress track already follows mid-swipe
  // through scrollX. Drag-end covers slow swipes that never build momentum.
  const onSettle = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const index = Math.round(e.nativeEvent.contentOffset.x / slideWidth);
      setActiveIndex(Math.min(Math.max(index, 0), SLIDE_COUNT - 1));
    },
    [slideWidth]
  );

  const onScroll = Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
    useNativeDriver: true,
  });

  const onListLayout = useCallback((event: LayoutChangeEvent) => {
    setListHeight(event.nativeEvent.layout.height);
  }, []);

  return (
    <View className="flex-1" style={{ backgroundColor: theme.background }}>
      <OnboardingGlow />
      <SafeAreaView className="flex-1">
        {/* Brand + position. No skip: the pitch is the product, so every slide earns its swipe. */}
        <View className="px-6 pt-2 gap-3">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <View
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: Radius.sm,
                  backgroundColor: Brand[500],
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <ThemedText style={{ fontSize: 14, fontWeight: '900', color: '#06140C' }}>$</ThemedText>
              </View>
              <ThemedText style={{ fontSize: 15, fontWeight: '800', color: theme.text, letterSpacing: -0.3 }}>
                PolyProfit
              </ThemedText>
            </View>
            <ThemedText style={{ fontSize: 11, fontWeight: '700', color: theme.textTertiary, ...MONO }}>
              {String(activeIndex + 1).padStart(2, '0')} / {String(SLIDE_COUNT).padStart(2, '0')}
            </ThemedText>
          </View>
          <ProgressTrack scrollX={scrollX} slideWidth={slideWidth} />
        </View>

        {/* The list is measured so each slide gets a definite height — without one, a
            slide sizes to its own content and the preview's flex:1 can't bound it. */}
        <View style={{ flex: 1 }} onLayout={onListLayout}>
          <Animated.FlatList
            // Animated.FlatList's ref type is the animated wrapper's; the instance it
            // hands back is the FlatList itself, hence the cast.
            ref={listRef as unknown as React.Ref<Animated.FlatList>}
            data={ONBOARDING_SLIDES}
            keyExtractor={(item) => item.id}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            bounces={false}
            style={{ flex: 1 }}
            // Slides are sized by width alone (never flex — in a row container flex would
            // fight the fixed page width); flexGrow on the content container is what lets
            // them stretch to full height.
            contentContainerStyle={{ flexGrow: 1 }}
            scrollEventThrottle={16}
            onScroll={onScroll}
            onMomentumScrollEnd={onSettle}
            onScrollEndDrag={onSettle}
            getItemLayout={(_, index) => ({ length: slideWidth, offset: slideWidth * index, index })}
            renderItem={({ item, index }) => {
              const inputRange = [(index - 1) * slideWidth, index * slideWidth, (index + 1) * slideWidth];
              const opacity = scrollX.interpolate({ inputRange, outputRange: [0, 1, 0], extrapolate: 'clamp' });
              const copyShift = scrollX.interpolate({
                inputRange,
                outputRange: [36, 0, -36],
                extrapolate: 'clamp',
              });
              const previewShift = scrollX.interpolate({
                inputRange,
                outputRange: [72, 0, -72],
                extrapolate: 'clamp',
              });
              const previewScale = scrollX.interpolate({
                inputRange,
                outputRange: [0.92, 1, 0.92],
                extrapolate: 'clamp',
              });

              return (
                <View
                  style={{ width: slideWidth, height: listHeight || undefined, flexGrow: 0, flexShrink: 0 }}
                  className="px-6 pb-2">
                  <Animated.View
                    style={{
                      flexShrink: 0,
                      gap: short ? 8 : 10,
                      paddingTop: short ? 16 : 24,
                      paddingBottom: short ? 12 : 16,
                      opacity,
                      transform: [{ translateX: copyShift }],
                    }}>
                    <View
                      className="flex-row items-center self-start"
                      style={{
                        gap: 6,
                        paddingHorizontal: 9,
                        paddingVertical: 4,
                        borderRadius: Radius.pill,
                        backgroundColor: Brand[500] + '14',
                        borderWidth: 1,
                        borderColor: Brand[500] + '3D',
                      }}>
                      <View style={{ width: 5, height: 5, borderRadius: 999, backgroundColor: Brand[500] }} />
                      <ThemedText style={{ fontSize: 9.5, fontWeight: '900', color: Brand[500], letterSpacing: 0.8 }}>
                        {item.eyebrow}
                      </ThemedText>
                    </View>
                    <ThemedText
                      style={{
                        fontSize: short ? 27 : 31,
                        lineHeight: short ? 32 : 37,
                        fontWeight: '800',
                        color: theme.text,
                        letterSpacing: -1,
                      }}>
                      {item.title}
                    </ThemedText>
                    <ThemedText
                      style={{
                        fontSize: short ? 13.5 : 14.5,
                        lineHeight: short ? 19 : 21,
                        color: theme.textSecondary,
                        maxWidth: 340,
                      }}>
                      {item.body}
                    </ThemedText>
                  </Animated.View>

                  <Animated.View
                    style={{
                      flex: 1,
                      minHeight: 0,
                      overflow: 'hidden',
                      opacity,
                      transform: [{ translateX: previewShift }, { scale: previewScale }],
                    }}>
                    {/* Scaling alone would still overflow, since layout is unaware of the
                        transform — so the inner box is inflated by 1/fit and scaled from
                        its top edge, landing exactly on the available height. */}
                    <View
                      style={{
                        height: `${100 / previewFit}%`,
                        transform: [{ scale: previewFit }],
                        transformOrigin: 'top center',
                      }}>
                      {renderOnboardingPreview(item.kind, index === activeIndex)}
                    </View>
                  </Animated.View>
                </View>
              );
            }}
          />
        </View>

        {/* Footer */}
        <View className="px-6 pb-3 pt-3 gap-2.5">
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
            <ThemedText style={{ fontSize: 16, fontWeight: '800', color: '#06140C', letterSpacing: -0.2 }}>
              {isLast ? 'Build my plan →' : 'Continue'}
            </ThemedText>
          </Pressable>
          <ThemedText style={{ fontSize: 10.5, color: theme.textTertiary, textAlign: 'center' }}>
            {isLast ? 'About a minute to set up · not financial advice' : 'Swipe to keep going'}
          </ThemedText>
        </View>
      </SafeAreaView>
    </View>
  );
}
