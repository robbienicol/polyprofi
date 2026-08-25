import { useRouter, type Href } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  LayoutChangeEvent,
  Platform,
  Pressable,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useOnboarding } from "@/api/hooks/useOnboarding";
import { useOnboardingProfile } from "@/api/hooks/useOnboardingProfile";
import {
  OnboardingGlow,
  renderOnboardingPreview,
} from "@/components/onboarding/OnboardingPreviews";
import { ONBOARDING_SLIDES } from "@/components/onboarding/onboarding-data";
import { useSpokenLine } from "@/components/onboarding/quiz-kit";
import { ThemedText } from "@/components/themed-text";
import { Brand, Radius, Shadow } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

const SLIDE_COUNT = ONBOARDING_SLIDES.length;
const TRACK_GAP = 5;
const MONO = { fontVariant: ["tabular-nums" as const] };

/** How long the slide across to the next one takes. */
const SLIDE_MS = 460;

/**
 * Progress track: one segment per slide, each filling as the track carries into it.
 * Driven off the same value as the slides, so the fill moves with them rather than
 * snapping when they land. We translate a full-width bar inside a clipped segment
 * rather than animating width — that keeps it on the native driver.
 */
function ProgressTrack({
  position,
}: {
  position: Animated.Value;
}): React.ReactElement {
  const theme = useTheme();
  const [trackWidth, setTrackWidth] = useState(0);
  const segmentWidth =
    trackWidth > 0
      ? (trackWidth - TRACK_GAP * (SLIDE_COUNT - 1)) / SLIDE_COUNT
      : 0;

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

export default function OnboardingScreen(): React.ReactElement {
  const theme = useTheme();
  const router = useRouter();
  const { completeOnboarding, isCompleting } = useOnboarding();
  const { profile, patchProfile } = useOnboardingProfile();
  // Slides live side by side on one long track, and advancing carries the track
  // sideways. This used to be a paging ScrollView, which reads better — you can
  // swipe it — but three separate React Native Web behaviours make a scroll-driven
  // carousel unreliable in the browser: a mandatory scroll-snap fights every
  // programmatic smooth scroll, and a scroll event bound to an Animated value
  // stops updating after the first re-render. Driving the position ourselves is
  // deterministic on both platforms, and it is what the quiz screen already does.
  const [position] = useState(() => new Animated.Value(0));
  const [activeIndex, setActiveIndex] = useState(0);
  const [listHeight, setListHeight] = useState(0);
  // Held locally through the carousel and written on the way out, so a keystroke
  // is not a disk write.
  const [name, setName] = useState(profile.name);
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
  // The name is the only answer any slide is waiting on; everywhere else the
  // button is purely informational.
  const canAdvance = slide.kind !== "name" || trimmedName.length > 0;

  const finish = useCallback(() => {
    // Consent was given on the first slide: its button says so directly above the
    // Terms and Privacy links, which is the standard "by continuing" agreement.
    patchProfile({ name: trimmedName, consented: true });
    completeOnboarding(undefined, {
      onSuccess: () => router.replace("/" as Href),
    });
  }, [completeOnboarding, patchProfile, router, trimmedName]);

  const goNext = useCallback(() => {
    if (isLast) {
      finish();
      return;
    }
    setActiveIndex((current) => Math.min(SLIDE_COUNT - 1, current + 1));
  }, [finish, isLast]);

  const goBack = useCallback(() => {
    setActiveIndex((current) => Math.max(0, current - 1));
  }, []);

  useEffect(() => {
    Animated.timing(position, {
      toValue: activeIndex,
      duration: SLIDE_MS,
      easing: Easing.bezier(0.32, 0.72, 0, 1),
      useNativeDriver: true,
    }).start();
  }, [activeIndex, position]);

  const onListLayout = useCallback((event: LayoutChangeEvent) => {
    setListHeight(event.nativeEvent.layout.height);
  }, []);

  return (
    <View className="flex-1" style={{ backgroundColor: theme.background }}>
      <OnboardingGlow />
      <SafeAreaView className="flex-1">
        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.select({ ios: "padding", android: undefined })}
        >
          {/* Brand + position. No skip: the pitch is the product, so every slide
              earns its tap. Back exists because two of these slides ask for
              something, and one of them can send you looking for the other. */}
          <View className="px-6 pt-2 gap-3">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <Pressable
                  onPress={goBack}
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
                <View
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: Radius.sm,
                    backgroundColor: Brand[500],
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <ThemedText
                    style={{
                      fontSize: 14,
                      fontWeight: "900",
                      color: "#06140C",
                    }}
                  >
                    $
                  </ThemedText>
                </View>
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
              {ONBOARDING_SLIDES.map((entry, index) => {
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
                    key={entry.id}
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
                        <WelcomeSlide
                          name={trimmedName}
                          short={short}
                          active={index === activeIndex}
                        />
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
                          <View
                            className="flex-row items-center self-start"
                            style={{
                              gap: 6,
                              paddingHorizontal: 9,
                              paddingVertical: 4,
                              borderRadius: Radius.pill,
                              backgroundColor: Brand[500] + "14",
                              borderWidth: 1,
                              borderColor: Brand[500] + "3D",
                            }}
                          >
                            <View
                              style={{
                                width: 5,
                                height: 5,
                                borderRadius: 999,
                                backgroundColor: Brand[500],
                              }}
                            />
                            <ThemedText
                              style={{
                                fontSize: 9.5,
                                fontWeight: "900",
                                color: Brand[500],
                                letterSpacing: 0.8,
                              }}
                            >
                              {entry.eyebrow}
                            </ThemedText>
                          </View>
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
                            <NameSlide
                              value={name}
                              onChangeText={setName}
                              onSubmit={goNext}
                            />
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
                              {renderOnboardingPreview(
                                entry.kind,
                                index === activeIndex,
                              )}
                            </View>
                          )}
                        </Animated.View>
                      </>
                    )}
                  </View>
                );
              })}
            </Animated.View>
          </View>

          {/* Footer */}
          <View className="px-6 pb-3 pt-3 gap-2.5">
            <Pressable
              onPress={goNext}
              disabled={isCompleting || !canAdvance}
              accessibilityRole="button"
              accessibilityState={{ disabled: isCompleting || !canAdvance }}
              className="py-4 items-center active:opacity-85"
              style={{
                borderRadius: Radius.lg,
                backgroundColor: Brand[500],
                opacity: isCompleting || !canAdvance ? 0.4 : 1,
                ...Shadow.card,
              }}
            >
              <ThemedText
                style={{
                  fontSize: 16,
                  fontWeight: "800",
                  color: "#06140C",
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
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

/**
 * The greeting, and the only slide with one thing on it.
 *
 * It pays off the name that was just typed, and it is the beat that turns the
 * rest of the run into a conversation. The line arrives a word at a time and
 * only starts once the slide is actually on screen, so it plays *for* you rather
 * than having already happened somewhere off to the right.
 */
function WelcomeSlide({
  name,
  short,
  active,
}: {
  name: string;
  short: boolean;
  active: boolean;
}): React.ReactElement {
  const theme = useTheme();
  // Held once it has played: sliding back to the name field and returning should
  // not replay the greeting from nothing.
  const [started, setStarted] = useState(active);
  if (active && !started) setStarted(true);

  const greeting = name ? `Hi, ${name}.` : "Hi there.";
  const promise = "Let me show you what Pathey does.";

  const hello = useSpokenLine(
    started ? greeting : null,
    `hello-${started}-${name}`,
  );
  // The second line waits for the first: two sentences arriving together is a
  // paragraph, not someone talking.
  const pitch = useSpokenLine(
    hello.finished && started ? promise : null,
    `pitch-${hello.finished}`,
  );

  const [mark] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.timing(mark, {
      toValue: started ? 1 : 0,
      duration: 560,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [mark, started]);

  return (
    <View className="flex-1 justify-center" style={{ gap: short ? 20 : 28 }}>
      <Animated.View
        style={{
          width: short ? 62 : 74,
          height: short ? 62 : 74,
          borderRadius: Radius.xl,
          backgroundColor: Brand[500],
          alignItems: "center",
          justifyContent: "center",
          opacity: mark,
          transform: [
            {
              scale: mark.interpolate({
                inputRange: [0, 1],
                outputRange: [0.8, 1],
              }),
            },
          ],
          ...Shadow.float,
        }}
      >
        <ThemedText
          style={{
            fontSize: short ? 32 : 38,
            fontWeight: "900",
            color: "#06140C",
          }}
        >
          $
        </ThemedText>
      </Animated.View>

      <View style={{ gap: 10 }}>
        <SpokenHeadline speech={hello} short={short} color={theme.text} />
        <SpokenHeadline
          speech={pitch}
          short={short}
          color={theme.textSecondary}
        />
      </View>
    </View>
  );
}

/** A headline revealed word by word, off a shared clock. */
function SpokenHeadline({
  speech,
  short,
  color,
}: {
  speech: ReturnType<typeof useSpokenLine>;
  short: boolean;
  color: string;
}): React.ReactElement | null {
  if (speech.words.length === 0) return null;

  return (
    <View className="flex-row flex-wrap">
      {speech.words.map((word, index) => (
        <FadingWord
          key={`${index}-${word}`}
          word={word}
          visible={index < speech.spoken}
          size={short ? 30 : 36}
          color={color}
        />
      ))}
    </View>
  );
}

function FadingWord({
  word,
  visible,
  size,
  color,
}: {
  word: string;
  visible: boolean;
  size: number;
  color: string;
}): React.ReactElement {
  const [anim] = useState(() => new Animated.Value(visible ? 1 : 0));

  useEffect(() => {
    Animated.timing(anim, {
      toValue: visible ? 1 : 0,
      duration: 300,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [anim, visible]);

  return (
    <Animated.View
      style={{
        opacity: anim,
        transform: [
          {
            translateY: anim.interpolate({
              inputRange: [0, 1],
              outputRange: [10, 0],
            }),
          },
        ],
      }}
    >
      <ThemedText
        style={{
          fontSize: size,
          lineHeight: size * 1.22,
          fontWeight: "800",
          letterSpacing: -1,
          color,
        }}
      >
        {`${word} `}
      </ThemedText>
    </Animated.View>
  );
}

/**
 * The agreement, under the button that gives it.
 *
 * This is the whole consent step now: it sits on the very first slide, so the
 * terms are agreed to before a name, an answer, or anything else is collected —
 * which is not true of a tick box somewhere in the middle of the run.
 */
function LegalLine(): React.ReactElement {
  const theme = useTheme();
  const router = useRouter();

  const link = {
    fontSize: 10.5,
    lineHeight: 15,
    color: Brand[500],
    fontWeight: "700" as const,
  };
  const plain = { fontSize: 10.5, lineHeight: 15, color: theme.textTertiary };

  return (
    <View
      className="flex-row flex-wrap items-center justify-center"
      style={{ minHeight: 14 }}
    >
      <ThemedText style={plain}>By continuing you agree to our </ThemedText>
      <Pressable
        onPress={() => router.push("/terms" as Href)}
        accessibilityRole="link"
        className="active:opacity-60"
      >
        <ThemedText style={link}>Terms</ThemedText>
      </Pressable>
      <ThemedText style={plain}> and </ThemedText>
      <Pressable
        onPress={() => router.push("/privacy" as Href)}
        accessibilityRole="link"
        className="active:opacity-60"
      >
        <ThemedText style={link}>Privacy Policy</ThemedText>
      </Pressable>
      <ThemedText style={plain}>.</ThemedText>
    </View>
  );
}

/**
 * The name. Asked first, before anything at all is explained, because it is what
 * makes every screen after it read as a conversation rather than a form.
 */
function NameSlide({
  value,
  onChangeText,
  onSubmit,
}: {
  value: string;
  onChangeText: (text: string) => void;
  onSubmit: () => void;
}): React.ReactElement {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);

  return (
    <View className="flex-1" style={{ gap: 12 }}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onSubmitEditing={onSubmit}
        placeholder="First name"
        placeholderTextColor={theme.textTertiary}
        autoCapitalize="words"
        autoComplete="given-name"
        autoCorrect={false}
        maxLength={24}
        returnKeyType="done"
        accessibilityLabel="Your first name"
        style={{
          borderWidth: 2,
          borderRadius: Radius.lg,
          borderColor: focused ? Brand[500] : theme.borderStrong,
          backgroundColor: theme.backgroundElement,
          color: theme.text,
          fontSize: 22,
          fontWeight: "700",
          paddingVertical: 18,
          paddingHorizontal: 18,
        }}
      />
    </View>
  );
}
