import React from "react";
import { Animated, View } from "react-native";

import { WelcomeSlide } from "@/components/onboarding/carousel/WelcomeSlide";
import { renderOnboardingPreview } from "@/components/onboarding/OnboardingPreviews";
import type { OnboardingSlide } from "@/components/onboarding/onboarding-data";
import { ThemedText } from "@/components/themed-text";
import { useTheme } from "@/hooks/use-theme";

/** One slide on the carousel track: its copy, then its preview (or the name field). */
export function CarouselSlide({
  entry,
  index,
  active,
  position,
  slideWidth,
  listHeight,
  short,
  previewFit,
  welcomeName,
  nameSlide,
}: {
  entry: OnboardingSlide;
  index: number;
  active: boolean;
  position: Animated.Value;
  slideWidth: number;
  listHeight: number;
  short: boolean;
  previewFit: number;
  welcomeName: string;
  nameSlide: React.ReactElement;
}): React.ReactElement {
  const theme = useTheme();

  // Each slide's own content lags the track it rides on and fades
  // out as it leaves, so the carousel separates into layers instead
  // of sliding as one rigid sheet.
  const inputRange = [index - 1, index, index + 1];
  const opacity = position.interpolate({
    inputRange,
    outputRange: [0, 1, 0],
    extrapolate: "clamp",
  });
  const copyShift = position.interpolate({
    inputRange,
    outputRange: [36, 0, -36],
    extrapolate: "clamp",
  });
  const previewShift = position.interpolate({
    inputRange,
    outputRange: [72, 0, -72],
    extrapolate: "clamp",
  });
  const previewScale = position.interpolate({
    inputRange,
    outputRange: [0.92, 1, 0.92],
    extrapolate: "clamp",
  });

  return (
    <View
      style={{
        width: slideWidth,
        height: listHeight || undefined,
        flexGrow: 0,
        flexShrink: 0,
      }}
      className="px-6 pb-2"
    >
      {entry.kind === "welcome" ? (
        <Animated.View
          style={{
            flex: 1,
            opacity,
            transform: [{ translateX: copyShift }],
          }}
        >
          <WelcomeSlide name={welcomeName} short={short} active={active} />
        </Animated.View>
      ) : (
        <>
          <Animated.View
            style={{
              flexShrink: 0,
              gap: short ? 8 : 10,
              paddingTop: short ? 16 : 24,
              paddingBottom: short ? 12 : 16,
              opacity,
              transform: [{ translateX: copyShift }],
            }}
          >
            <ThemedText
              style={{
                fontSize: short ? 27 : 31,
                lineHeight: short ? 32 : 37,
                fontWeight: "800",
                color: theme.text,
                letterSpacing: -1,
              }}
            >
              {entry.title}
            </ThemedText>
            <ThemedText
              style={{
                fontSize: short ? 13.5 : 14.5,
                lineHeight: short ? 19 : 21,
                color: theme.textSecondary,
                maxWidth: 340,
              }}
            >
              {entry.body}
            </ThemedText>
          </Animated.View>

          <Animated.View
            style={{
              flex: 1,
              minHeight: 0,
              overflow: "hidden",
              opacity,
              transform: [
                { translateX: previewShift },
                { scale: previewScale },
              ],
            }}
          >
            {entry.kind === "name" ? (
              nameSlide
            ) : (
              /* Scaling alone would still overflow, since layout is unaware of the
                 transform — so the inner box is inflated by 1/fit and scaled from
                 its top edge, landing exactly on the available height. */
              <View
                style={{
                  height: `${100 / previewFit}%`,
                  transform: [{ scale: previewFit }],
                  transformOrigin: "top center",
                }}
              >
                {renderOnboardingPreview(entry.kind, active)}
              </View>
            )}
          </Animated.View>
        </>
      )}
    </View>
  );
}
