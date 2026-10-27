import React, { useEffect, useState } from "react";
import { Animated, Easing, View } from "react-native";

import { SpokenHeadline } from "@/components/onboarding/carousel/SpokenHeadline";
import { useSpokenLine } from "@/components/onboarding/quiz-kit";
import { BrandMark } from "@/components/ui/BrandMark";
import { Radius, Shadow } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

/**
 * The greeting, and the only slide with one thing on it.
 *
 * It pays off the name that was just typed, and it is the beat that turns the
 * rest of the run into a conversation. The line arrives a word at a time and
 * only starts once the slide is actually on screen, so it plays *for* you rather
 * than having already happened somewhere off to the right.
 */
export function WelcomeSlide({
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
          opacity: mark,
          transform: [
            {
              scale: mark.interpolate({
                inputRange: [0, 1],
                outputRange: [0.8, 1],
              }),
            },
          ],
          borderRadius: Radius.xl,
          ...Shadow.float,
        }}
      >
        <BrandMark size={short ? 62 : 74} />
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
