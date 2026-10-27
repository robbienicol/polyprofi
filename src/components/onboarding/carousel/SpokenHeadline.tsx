import React, { useEffect, useState } from "react";
import { Animated, Easing, View } from "react-native";

import { useSpokenLine } from "@/components/onboarding/quiz-kit";
import { ThemedText } from "@/components/themed-text";

/** A headline revealed word by word, off a shared clock. */
export function SpokenHeadline({
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
