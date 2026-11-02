import React, { useState } from "react";
import { Pressable, TextInput, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { Icon } from "@/components/ui/Icon";
import { Brand, OnBrand, Radius } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

/**
 * The name. Asked first, before anything at all is explained, because it is what
 * makes every screen after it read as a conversation rather than a form.
 */
export function NameSlide({
  value,
  onChangeText,
  onSubmit,
  ageConfirmed,
  onToggleAge,
}: {
  value: string;
  onChangeText: (text: string) => void;
  onSubmit: () => void;
  ageConfirmed: boolean;
  onToggleAge: () => void;
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
      {/* Sits with the name and the terms line under the button: the three things
          agreed to before anything else is shown. Unticked by default — an
          age check that starts ticked confirms nothing. */}
      <Pressable
        onPress={onToggleAge}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: ageConfirmed }}
        accessibilityLabel="I'm 18 or older"
        className="flex-row items-center active:opacity-70"
        style={{ gap: 10, paddingVertical: 6 }}
        hitSlop={6}
      >
        <View
          style={{
            width: 22,
            height: 22,
            borderRadius: Radius.sm,
            borderWidth: 2,
            borderColor: ageConfirmed ? Brand[500] : theme.borderStrong,
            backgroundColor: ageConfirmed ? Brand[500] : "transparent",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {ageConfirmed ? (
            <Icon glyph="✓" size={12} color={OnBrand} strokeWidth={3} />
          ) : null}
        </View>
        <ThemedText
          style={{ fontSize: 14, fontWeight: "600", color: theme.text }}
        >
          I&apos;m 18 or older
        </ThemedText>
      </Pressable>
    </View>
  );
}
