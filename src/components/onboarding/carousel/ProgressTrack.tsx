import React, { useState } from "react";
import { Animated, LayoutChangeEvent, View } from "react-native";

import {
  ONBOARDING_SLIDES,
  type OnboardingSlide,
} from "@/components/onboarding/onboarding-data";
import { Brand, Radius } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

const SLIDE_COUNT = ONBOARDING_SLIDES.length;
const TRACK_GAP = 5;

/**
 * Progress track: one segment per slide, each filling as the track carries into it.
 * Driven off the same value as the slides, so the fill moves with them rather than
 * snapping when they land. We translate a full-width bar inside a clipped segment
 * rather than animating width — that keeps it on the native driver.
 */
export function ProgressTrack({
  position,
}: {
  position: Animated.Value;
}): React.ReactElement {
  const theme = useTheme();
  const [trackWidth, setTrackWidth] = useState<number>(0);
  const segmentWidth: number =
    trackWidth > 0
      ? (trackWidth - TRACK_GAP * (SLIDE_COUNT - 1)) / SLIDE_COUNT
      : 0;

  const onLayout = (event: LayoutChangeEvent) => {
    setTrackWidth(event.nativeEvent.layout.width);
  };

  return (
    <View className="flex-row" style={{ gap: TRACK_GAP }} onLayout={onLayout}>
      {ONBOARDING_SLIDES.map((slide: OnboardingSlide, index: number) => (
        <View
          key={slide.id}
          style={{
            width: segmentWidth,
            height: 3,
            borderRadius: Radius.pill,
            backgroundColor: theme.backgroundSelected,
            overflow: "hidden",
          }}
        >
          {segmentWidth > 0 ? (
            <Animated.View
              style={{
                width: segmentWidth,
                height: 3,
                borderRadius: Radius.pill,
                backgroundColor: Brand[500],
                transform: [
                  {
                    translateX: position.interpolate({
                      inputRange: [index - 1, index],
                      outputRange: [-segmentWidth, 0],
                      extrapolate: "clamp",
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
