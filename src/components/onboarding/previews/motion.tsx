import React, { useEffect, useState } from "react";
import { Animated, Easing, View } from "react-native";
import Svg, { Circle } from "react-native-svg";

import { MONO } from "@/components/onboarding/previews/primitives";
import { ThemedText } from "@/components/themed-text";
import { Brand } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** A score drawn as a ring filling to its value, the number in the middle. */
export function ScoreRing({
  score,
  size,
  stroke,
  color = Brand[500],
  animate = false,
  fontSize,
}: {
  score: number;
  size: number;
  stroke: number;
  color?: string;
  animate?: boolean;
  fontSize: number;
}): React.ReactElement {
  const theme = useTheme();
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const target = circumference * (1 - score / 100);
  const [offset] = useState(() => new Animated.Value(animate ? circumference : target));

  useEffect(() => {
    if (!animate) return;
    const animation = Animated.timing(offset, {
      toValue: target,
      duration: 900,
      delay: 250,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [animate, offset, target]);

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} style={{ position: "absolute" }}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={theme.backgroundSelected}
          strokeWidth={stroke}
          fill="none"
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <ThemedText style={{ fontSize, fontWeight: "900", color: theme.text, ...MONO }}>
        {score}
      </ThemedText>
    </View>
  );
}

/** Fades + lifts its children in once on mount. Used for the scripted coach exchange. */
export function FadeIn({
  children,
  delay = 0,
}: {
  children: React.ReactNode;
  delay?: number;
}): React.ReactElement {
  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: 320,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [delay, progress]);

  return (
    <Animated.View
      style={{
        opacity: progress,
        transform: [
          {
            translateY: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [10, 0],
            }),
          },
        ],
      }}
    >
      {children}
    </Animated.View>
  );
}
