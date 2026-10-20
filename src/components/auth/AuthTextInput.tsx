import { forwardRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Brand, Radius, bodyFontFamily } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface AuthTextInputProps extends TextInputProps {
  /** Optional label shown above the field. */
  label?: string;
}

type FocusArg = Parameters<NonNullable<TextInputProps['onFocus']>>[0];
type BlurArg = Parameters<NonNullable<TextInputProps['onBlur']>>[0];

/**
 * Shared auth field with a label and a green focus ring.
 * Passing `secureTextEntry` adds a Show/Hide toggle — mistyped invisible
 * passwords were the most common reason sign-in failed.
 * Base typography/padding can be overridden via `style` (e.g. the 6-digit code input).
 */
export const AuthTextInput = forwardRef<TextInput, AuthTextInputProps>(function AuthTextInput(
  { label, style, onFocus, onBlur, secureTextEntry, ...rest },
  ref,
) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);
  // Callers override size and weight (the 6-digit code field), so the face and the
  // field height follow whatever they pass rather than the defaults.
  const override = StyleSheet.flatten(style) ?? {};
  const fontSize = override.fontSize ?? 16;

  const handleFocus = (e: FocusArg): void => {
    setFocused(true);
    onFocus?.(e);
  };
  const handleBlur = (e: BlurArg): void => {
    setFocused(false);
    onBlur?.(e);
  };

  return (
    <View style={{ gap: 7 }}>
      <View className="flex-row items-center justify-between" style={{ minHeight: label || secureTextEntry ? 16 : 0 }}>
        {label ? (
          <ThemedText
            style={{
              fontSize: 12,
              fontWeight: '700',
              color: theme.textSecondary,
              marginLeft: 2,
              letterSpacing: 0.2,
            }}>
            {label}
          </ThemedText>
        ) : (
          <View />
        )}
        {secureTextEntry && (
          <Pressable
            onPress={() => setRevealed((v) => !v)}
            hitSlop={10}
            accessibilityRole="button"
            className="active:opacity-60">
            <ThemedText style={{ fontSize: 12, fontWeight: '700', color: Brand[500] }}>
              {revealed ? 'Hide' : 'Show'}
            </ThemedText>
          </Pressable>
        )}
      </View>
      <TextInput
        ref={ref}
        placeholderTextColor={theme.textTertiary}
        onFocus={handleFocus}
        onBlur={handleBlur}
        secureTextEntry={secureTextEntry && !revealed}
        style={[
          {
            borderWidth: 1.5,
            borderRadius: Radius.md,
            borderColor: focused ? Brand[500] : theme.borderStrong,
            backgroundColor: theme.backgroundElement,
            color: theme.text,
            fontSize,
            // A TextInput never passes through ThemedText, so the custom face must be
            // named here. A fixed height with no vertical padding keeps iOS from
            // pushing the text below the field's bottom edge.
            fontFamily: bodyFontFamily(override.fontWeight ?? '600'),
            height: Math.max(54, Math.round(fontSize * 2)),
            paddingVertical: 0,
            paddingHorizontal: 16,
            textAlignVertical: 'center',
          },
          style,
        ]}
        {...rest}
      />
    </View>
  );
});
