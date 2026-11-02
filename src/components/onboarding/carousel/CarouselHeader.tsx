import React from "react";
import { Animated, Pressable, View } from "react-native";

import { ProgressTrack } from "@/components/onboarding/carousel/ProgressTrack";
import { ONBOARDING_SLIDES } from "@/components/onboarding/onboarding-data";
import { ThemedText } from "@/components/themed-text";
import { BrandMark } from "@/components/ui/BrandMark";
import { useTheme } from "@/hooks/use-theme";

const SLIDE_COUNT = ONBOARDING_SLIDES.length;
const MONO = { fontVariant: ["tabular-nums" as const] };

/**
 * Brand + position. No skip: the pitch is the product, so every slide earns its
 * tap. Back exists because two of these slides ask for something, and one of
 * them can send you looking for the other.
 */
export function CarouselHeader({
  activeIndex,
  position,
  onBack,
}: {
  activeIndex: number;
  position: Animated.Value;
  onBack: () => void;
}): React.ReactElement {
  const theme = useTheme();

  return (
    <View className="px-6 pt-2 gap-3">
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          <Pressable
            onPress={onBack}
            disabled={activeIndex === 0}
            accessibilityRole="button"
            accessibilityLabel="Back"
            className="active:opacity-60"
            style={{
              opacity: activeIndex === 0 ? 0 : 1,
              paddingVertical: 4,
              paddingRight: 6,
            }}
          >
            <ThemedText
              style={{
                fontSize: 15,
                fontWeight: "700",
                color: theme.textSecondary,
              }}
            >
              ←
            </ThemedText>
          </Pressable>
          <BrandMark size={26} />
          <ThemedText
            style={{
              fontSize: 15,
              fontWeight: "800",
              color: theme.text,
              letterSpacing: -0.3,
            }}
          >
            Pathey
          </ThemedText>
        </View>
        <ThemedText
          style={{
            fontSize: 11,
            fontWeight: "700",
            color: theme.textTertiary,
            ...MONO,
          }}
        >
          {String(activeIndex + 1).padStart(2, "0")} /{" "}
          {String(SLIDE_COUNT).padStart(2, "0")}
        </ThemedText>
      </View>
      <ProgressTrack position={position} />
    </View>
  );
}
