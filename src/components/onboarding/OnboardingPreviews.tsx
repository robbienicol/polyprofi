import React from "react";
import { View } from "react-native";

import { OnboardingSlide } from "@/components/onboarding/onboarding-data";
import { CoachPreview } from "@/components/onboarding/previews/CoachPreview";
import { MathPreview, QuizPreview, ScorePreview } from "@/components/onboarding/previews/FactorPreviews";
import { BreakdownPreview, RankPreview } from "@/components/onboarding/previews/RankPreviews";
import { SweepPreview } from "@/components/onboarding/previews/SweepPreview";

export { OnboardingGlow } from "@/components/onboarding/OnboardingGlow";

/* ------------------------------------------------------------------ */

/**
 * The `key` swap is deliberate: flipping active remounts the preview, which restarts its
 * reveal from a clean state without any reset-in-effect gymnastics.
 */
export function renderOnboardingPreview(
  kind: OnboardingSlide["kind"],
  active: boolean,
): React.ReactElement {
  const key = active ? "active" : "idle";
  switch (kind) {
    case "quiz":
      return <QuizPreview key={key} active={active} />;
    case "score":
      return <ScorePreview key={key} active={active} />;
    case "scan":
      return <SweepPreview key={key} active={active} />;
    case "rank":
      return <RankPreview key={key} active={active} />;
    case "breakdown":
      return <BreakdownPreview key={key} active={active} />;
    case "coach":
      return <CoachPreview key={key} active={active} />;
    case "math":
      return <MathPreview key={key} active={active} />;
    // The hero, consent, and name slides draw themselves end to end.
    default:
      return <View className="flex-1" />;
  }
}
