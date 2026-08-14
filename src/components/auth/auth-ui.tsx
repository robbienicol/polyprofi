import React from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Accent, Brand, Radius, Shadow } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Logo + wordmark + subtitle, wrapped in the keyboard-aware page frame. */
export function AuthShell({
  subtitle,
  children,
}: {
  subtitle: string;
  children: React.ReactNode;
}): React.ReactElement {
  const theme = useTheme();
  return (
    <View className="flex-1" style={{ backgroundColor: theme.background }}>
      <SafeAreaView className="flex-1">
        <KeyboardAvoidingView
          behavior={Platform.select({ ios: 'padding', android: undefined })}
          className="flex-1 justify-center px-6 gap-10">
          <View className="items-center gap-3">
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: Radius.xl,
                backgroundColor: Brand[500],
                alignItems: 'center',
                justifyContent: 'center',
                ...Shadow.float,
              }}>
              <ThemedText style={{ fontSize: 34, fontWeight: '900', color: '#06140C' }}>$</ThemedText>
            </View>
            <ThemedText
              style={{ fontSize: 32, fontWeight: '800', letterSpacing: -0.8, color: theme.text }}>
              PolyProfit
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {subtitle}
            </ThemedText>
          </View>
          {children}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

/**
 * Text field for the auth screens. `autoCorrect`/`spellCheck` are off by
 * default: on iOS autocorrect is what turns a typed email into a "wrong" one.
 */
export function AuthField(
  props: TextInputProps & { ref?: React.Ref<TextInput> },
): React.ReactElement {
  const theme = useTheme();
  return (
    <TextInput
      autoCorrect={false}
      spellCheck={false}
      placeholderTextColor={theme.textSecondary}
      className="px-4 text-base border"
      {...props}
      style={[
        {
          borderRadius: Radius.lg,
          color: theme.text,
          borderColor: theme.border,
          backgroundColor: theme.backgroundElement,
          paddingVertical: 16,
        },
        props.style,
      ]}
    />
  );
}

/** Primary filled action button with a busy state. */
export function AuthButton({
  label,
  onPress,
  disabled,
  loading,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
}): React.ReactElement {
  const isDisabled = !!disabled || !!loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: !!loading }}
      className="py-4 items-center mt-1 active:opacity-80"
      style={{
        borderRadius: Radius.lg,
        backgroundColor: Brand[500],
        opacity: isDisabled ? 0.45 : 1,
        ...Shadow.card,
      }}>
      {loading ? (
        <ActivityIndicator color="#06140C" />
      ) : (
        <ThemedText style={{ fontWeight: '800', fontSize: 16, color: '#06140C' }}>{label}</ThemedText>
      )}
    </Pressable>
  );
}

/** Inline form error. Renders nothing when `message` is empty. */
export function AuthError({ message }: { message: string }): React.ReactElement | null {
  if (!message) return null;
  return (
    <ThemedText
      type="small"
      className="text-center"
      accessibilityLiveRegion="polite"
      style={{ color: Accent.red }}>
      {message}
    </ThemedText>
  );
}

/** Centred tappable footer text, e.g. "Don't have an account? Sign up". */
export function AuthLinkRow({
  prompt,
  action,
  onPress,
}: {
  prompt?: string;
  action: string;
  onPress: () => void;
}): React.ReactElement {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" className="items-center active:opacity-60">
      <ThemedText type="small" themeColor="textSecondary">
        {prompt ? `${prompt} ` : ''}
        <ThemedText type="small" style={{ color: Brand[500], fontWeight: '700' }}>
          {action}
        </ThemedText>
      </ThemedText>
    </Pressable>
  );
}
