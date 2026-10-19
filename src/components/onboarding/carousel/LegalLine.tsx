import { useRouter, type Href } from "expo-router";
import React from "react";
import { Pressable, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { Brand } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

/**
 * The agreement, under the button that gives it.
 *
 * This is the whole consent step now: it sits on the very first slide, so the
 * terms are agreed to before a name, an answer, or anything else is collected —
 * which is not true of a tick box somewhere in the middle of the run.
 */
export function LegalLine(): React.ReactElement {
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
