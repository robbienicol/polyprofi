import React, { useEffect, useState } from "react";
import { Animated, Easing, View } from "react-native";
import { Sparkles } from "lucide-react-native";

import { COACH_SCRIPT } from "@/components/onboarding/onboarding-data";
import { FadeIn } from "@/components/onboarding/previews/motion";
import { Caption, Mark, useCompact, type PreviewProps } from "@/components/onboarding/previews/primitives";
import { ThemedText } from "@/components/themed-text";
import { Brand } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

/* ------------------------------------------------------------------ slide 4: coach */

function TypingDots(): React.ReactElement {
  const theme = useTheme();
  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(progress, { toValue: 1, duration: 1050, easing: Easing.linear, useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [progress]);

  return (
    <View
      className="flex-row items-center"
      style={{
        alignSelf: "flex-start",
        gap: 4,
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderRadius: 18,
        backgroundColor: theme.backgroundSelected,
      }}
    >
      {[0, 1, 2].map((index) => (
        <Animated.View
          key={index}
          style={{
            width: 5,
            height: 5,
            borderRadius: 999,
            backgroundColor: Brand[500],
            opacity: progress.interpolate({
              inputRange: [0, index / 3, (index + 1) / 3, 1],
              outputRange: [0.3, 1, 0.3, 0.3],
            }),
          }}
        />
      ))}
    </View>
  );
}

/**
 * The coach, as a short scripted exchange about one pick. Just the two bubbles and
 * the coach's mark — no input bar, no Send button, no tappable starter chips, since
 * none of them would do anything here.
 */
export function CoachPreview({ active }: PreviewProps): React.ReactElement {
  const theme = useTheme();
  const compact = useCompact();
  // 0: nothing yet · 1: question · 2: coach typing · 3: answer (rests here)
  const [stage, setStage] = useState(0);

  useEffect(() => {
    if (!active || stage >= 3) return;
    const timer = setTimeout(() => setStage(stage + 1), [600, 600, 1300][stage]);
    return () => clearTimeout(timer);
  }, [active, stage]);

  const [question, answer] = COACH_SCRIPT;

  return (
    <View className="flex-1 justify-center" style={{ paddingHorizontal: 6 }}>
      <View className="flex-row items-center" style={{ gap: 12, marginBottom: 16 }}>
        <Mark icon={Sparkles} size={44} strength={0.2} />
        <View className="flex-1">
          <ThemedText style={{ fontSize: 14, fontWeight: "800", color: theme.text }}>Your AI coach</ThemedText>
          <ThemedText style={{ fontSize: 12, color: theme.textSecondary }}>Looking at VOO, scored 82</ThemedText>
        </View>
      </View>

      <View style={{ gap: 10, minHeight: compact ? 150 : 176, justifyContent: "flex-start" }}>
        {stage >= 1 ? (
          <FadeIn>
            <View
              style={{
                alignSelf: "flex-end",
                maxWidth: "84%",
                paddingHorizontal: 14,
                paddingVertical: 10,
                borderRadius: 18,
                borderBottomRightRadius: 6,
                backgroundColor: Brand[500] + "24",
              }}
            >
              <ThemedText style={{ fontSize: 13, fontWeight: "700", color: theme.text, lineHeight: 18 }}>
                {question.text}
              </ThemedText>
            </View>
          </FadeIn>
        ) : null}

        {stage === 2 ? <TypingDots /> : null}

        {stage >= 3 ? (
          <FadeIn>
            <View
              style={{
                alignSelf: "flex-start",
                maxWidth: "92%",
                paddingHorizontal: 14,
                paddingVertical: 11,
                borderRadius: 18,
                borderBottomLeftRadius: 6,
                backgroundColor: theme.backgroundSelected,
              }}
            >
              <ThemedText style={{ fontSize: 13, color: theme.text, lineHeight: 19 }}>{answer.text}</ThemedText>
            </View>
          </FadeIn>
        ) : null}
      </View>
      <Caption>Ask about any pick, in plain English, any time.</Caption>
    </View>
  );
}
