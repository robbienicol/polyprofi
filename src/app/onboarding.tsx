import React from "react";
import { View } from "react-native";

import { useOnboardingProfile } from "@/api/hooks/useOnboardingProfile";
import { OnboardingCarousel } from "@/components/onboarding/carousel/OnboardingCarousel";
import { useTheme } from "@/hooks/use-theme";

/**
 * Holds the carousel until the stored profile has been read.
 *
 * The name slide seeds a text input from that profile, and `useState` only ever
 * looks at its argument on the first render — so mounting before the read
 * resolved left a returning user looking at an empty field with their name
 * already on disk. The wait is a local read, not a network one.
 */
export default function OnboardingScreen(): React.ReactElement {
  const theme = useTheme();
  const { profile, isLoading } = useOnboardingProfile();

  if (isLoading)
    return (
      <View className="flex-1" style={{ backgroundColor: theme.background }} />
    );
  return (
    <OnboardingCarousel
      initialName={profile.name}
      initialAgeConfirmed={profile.ageConfirmed}
    />
  );
}
