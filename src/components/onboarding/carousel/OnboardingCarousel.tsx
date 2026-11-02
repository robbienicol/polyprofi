import { useRouter, type Href } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Animated,
  Easing,
  Keyboard,
  KeyboardAvoidingView,
  LayoutChangeEvent,
  Platform,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useOnboarding } from "@/api/hooks/useOnboarding";
import { useOnboardingProfile } from "@/api/hooks/useOnboardingProfile";
import { CarouselFooter } from "@/components/onboarding/carousel/CarouselFooter";
import { CarouselHeader } from "@/components/onboarding/carousel/CarouselHeader";
import { CarouselSlide } from "@/components/onboarding/carousel/CarouselSlide";
import { NameSlide } from "@/components/onboarding/carousel/NameSlide";
import { OnboardingGlow } from "@/components/onboarding/OnboardingPreviews";
import { WelcomeHero } from "@/components/onboarding/WelcomeHero";
import { ONBOARDING_SLIDES } from "@/components/onboarding/onboarding-data";
import { useTheme } from "@/hooks/use-theme";

const SLIDE_COUNT = ONBOARDING_SLIDES.length;

/** How long the slide across to the next one takes. */
const SLIDE_MS = 460;

export function OnboardingCarousel({
  initialName,
  initialAgeConfirmed,
}: {
  initialName: string;
  initialAgeConfirmed: boolean;
}): React.ReactElement {
  const theme = useTheme();
  const router = useRouter();
  const { completeOnboarding, isCompleting } = useOnboarding();
  const { patchProfile } = useOnboardingProfile();
  // Slides live side by side on one long track, and advancing carries the track
  // sideways. This used to be a paging ScrollView, which reads better — you can
  // swipe it — but three separate React Native Web behaviours make a scroll-driven
  // carousel unreliable in the browser: a mandatory scroll-snap fights every
  // programmatic smooth scroll, and a scroll event bound to an Animated value
  // stops updating after the first re-render. Driving the position ourselves is
  // deterministic on both platforms, and it is what the quiz screen already does.
  const [position] = useState(() => new Animated.Value(0));
  const [activeIndex, setActiveIndex] = useState(0);
  const [started, setStarted] = useState(false);
  const [listHeight, setListHeight] = useState(0);
  // Held locally through the carousel and written on the way out, so a keystroke
  // is not a disk write.
  const [name, setName] = useState(initialName);
  const [ageConfirmed, setAgeConfirmed] = useState(initialAgeConfirmed);
  // Width has to come from the hook, not module-level Dimensions: on web's static
  // render pass it is 0, which collapses every slide and breaks the interpolations.
  const { width, height } = useWindowDimensions();
  const slideWidth = Math.max(width, 1);
  // Short screens (SE-class) shrink the headline and scale the preview panel to fit
  // rather than letting it slide under the CTA.
  const short = height > 0 && height < 700;
  const previewFit = short ? 0.84 : height > 0 && height < 780 ? 0.93 : 1;

  const slide = ONBOARDING_SLIDES[activeIndex];
  const isLast = activeIndex === SLIDE_COUNT - 1;
  const trimmedName = name.trim();
  // The name slide is the only one waiting on anything: a name, and the 18+
  // confirmation. Everywhere else the button is purely informational.
  const canAdvance =
    slide.kind !== "name" || (trimmedName.length > 0 && ageConfirmed);

  const finish = () => {
    // Consent was given on the first slide: its button says so directly above the
    // Terms and Privacy links, which is the standard "by continuing" agreement.
    patchProfile({ name: trimmedName, consented: true, ageConfirmed });
    completeOnboarding(undefined, {
      onSuccess: () => router.replace("/" as Href),
    });
  };

  const goNext = () => {
    // The name field keeps focus when its slide moves off screen, so the keyboard
    // stayed up over the next slide.
    Keyboard.dismiss();
    if (isLast) {
      finish();
      return;
    }
    setActiveIndex((current) => Math.min(SLIDE_COUNT - 1, current + 1));
  };

  const goBack = () => {
    Keyboard.dismiss();
    setActiveIndex((current) => Math.max(0, current - 1));
  };

  useEffect(() => {
    Animated.timing(position, {
      toValue: activeIndex,
      duration: SLIDE_MS,
      easing: Easing.bezier(0.32, 0.72, 0, 1),
      useNativeDriver: true,
    }).start();
  }, [activeIndex, position]);

  const onListLayout = (event: LayoutChangeEvent) => {
    setListHeight(event.nativeEvent.layout.height);
  };

  if (!started) {
    return (
      <WelcomeHero
        onStart={() => setStarted(true)}
        // Their name and answers come back with the account once they sign in.
        onSignIn={() =>
          completeOnboarding(undefined, {
            // Through `index`, not straight to sign-in: an already signed-in user
            // can't reach the sign-in screen, and `index` knows where each belongs.
            onSuccess: () => router.replace("/" as Href),
          })
        }
      />
    );
  }

  const nameSlide = (
    <NameSlide
      value={name}
      onChangeText={setName}
      onSubmit={goNext}
      ageConfirmed={ageConfirmed}
      onToggleAge={() => setAgeConfirmed((v) => !v)}
    />
  );

  return (
    <View className="flex-1" style={{ backgroundColor: theme.background }}>
      <OnboardingGlow />
      <SafeAreaView className="flex-1">
        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.select({ ios: "padding", android: undefined })}
        >
          <CarouselHeader
            activeIndex={activeIndex}
            position={position}
            onBack={goBack}
          />

          {/* The list is measured so each slide gets a definite height — without one, a
              slide sizes to its own content and the preview's flex:1 can't bound it. */}
          <View style={{ flex: 1, overflow: "hidden" }} onLayout={onListLayout}>
            <Animated.View
              style={{
                flex: 1,
                flexDirection: "row",
                width: slideWidth * SLIDE_COUNT,
                transform: [
                  {
                    translateX: position.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, -slideWidth],
                    }),
                  },
                ],
              }}
            >
              {ONBOARDING_SLIDES.map((entry, index) => (
                <CarouselSlide
                  key={entry.id}
                  entry={entry}
                  index={index}
                  active={index === activeIndex}
                  position={position}
                  slideWidth={slideWidth}
                  listHeight={listHeight}
                  short={short}
                  previewFit={previewFit}
                  welcomeName={trimmedName}
                  nameSlide={nameSlide}
                />
              ))}
            </Animated.View>
          </View>

          <CarouselFooter
            slide={slide}
            isLast={isLast}
            disabled={isCompleting || !canAdvance}
            onNext={goNext}
          />
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
