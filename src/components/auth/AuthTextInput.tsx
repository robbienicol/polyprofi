import { useState } from 'react';
import { TextInput, View, type TextInputProps } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Brand, Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface AuthTextInputProps extends TextInputProps {
  /** Optional label shown above the field. */
  label?: string;
}

type FocusArg = Parameters<NonNullable<TextInputProps['onFocus']>>[0];
type BlurArg = Parameters<NonNullable<TextInputProps['onBlur']>>[0];

/**
 * Shared auth field with a label and a green focus ring.
 * Base typography/padding can be overridden via `style` (e.g. the 6-digit code input).
 */
export function AuthTextInput({ label, style, onFocus, onBlur, ...rest }: AuthTextInputProps): React.ReactElement {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);

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
      {label && (
        <ThemedText style={{ fontSize: 12, fontWeight: '700', color: theme.textSecondary, marginLeft: 2, letterSpacing: 0.2 }}>
          {label}
        </ThemedText>
      )}
      <TextInput
        placeholderTextColor={theme.textTertiary}
        onFocus={handleFocus}
        onBlur={handleBlur}
        style={[
          {
            borderWidth: 1.5,
            borderRadius: Radius.md,
            borderColor: focused ? Brand[500] : theme.borderStrong,
            backgroundColor: theme.backgroundElement,
            color: theme.text,
            fontSize: 16,
            fontWeight: '600',
            paddingVertical: 15,
            paddingHorizontal: 16,
          },
          style,
        ]}
        {...rest}
      />
    </View>
  );
}
