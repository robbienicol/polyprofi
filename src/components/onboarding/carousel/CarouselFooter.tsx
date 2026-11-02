import React from "react";
import { Pressable, View } from "react-native";

import { LegalLine } from "@/components/onboarding/carousel/LegalLine";
import type { OnboardingSlide } from "@/components/onboarding/onboarding-data";
import { ThemedText } from "@/components/themed-text";
import { Brand, OnBrand, Radius, Shadow } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

/** The advance button, with the terms or the slide's footnote beneath it. */
export function CarouselFooter({
  slide,
  isLast,
  disabled,
  onNext,
}: {
  slide: OnboardingSlide;
  isLast: boolean;
  disabled: boolean;
  onNext: () => void;
}): React.ReactElement {
  const theme = useTheme();

  return (
    <View className="px-6 pb-3 pt-3 gap-2.5">
      <Pressable
        onPress={onNext}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        className="py-4 items-center active:opacity-85"
        style={{
          borderRadius: Radius.lg,
          backgroundColor: Brand[500],
          opacity: disabled ? 0.4 : 1,
          ...Shadow.card,
        }}
      >
        <ThemedText
          style={{
            fontSize: 16,
            fontWeight: "800",
            color: OnBrand,
            letterSpacing: -0.2,
          }}
        >
          {isLast ? "Let's go →" : slide.cta}
        </ThemedText>
      </Pressable>
      {slide.kind === "name" ? (
        <LegalLine />
      ) : (
        <ThemedText
          style={{
            fontSize: 10.5,
            color: theme.textTertiary,
            textAlign: "center",
            minHeight: 14,
          }}
        >
          {slide.footnote ?? ""}
        </ThemedText>
      )}
    </View>
  );
}
