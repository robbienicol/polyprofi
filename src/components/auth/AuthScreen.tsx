import { Link, type Href } from 'expo-router';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Accent, Brand, Radius, Shadow } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Shared chrome for sign-in / sign-up / reset: logo, title, keyboard handling,
 * and a footer link. The three screens keep only their own fields and logic.
 */
export function AuthScreen({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}): React.ReactElement {
  const theme = useTheme();

  return (
    <View className="flex-1" style={{ backgroundColor: theme.background }}>
      <SafeAreaView className="flex-1">
        <KeyboardAvoidingView
          behavior={Platform.select({ ios: 'padding', android: undefined })}
          className="flex-1">
          <ScrollView
            contentContainerStyle={{
              flexGrow: 1,
              justifyContent: 'center',
              paddingHorizontal: 24,
              paddingVertical: 32,
              gap: 36,
            }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
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
                style={{ fontSize: 30, fontWeight: '800', letterSpacing: -0.8, color: theme.text }}>
                {title}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" className="text-center">
                {subtitle}
              </ThemedText>
            </View>

            {children}

            {footer}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

/** Primary green action button with a built-in loading state. */
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
  const off = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      accessibilityRole="button"
      className="py-4 items-center mt-1 active:opacity-80"
      style={{
        borderRadius: Radius.lg,
        backgroundColor: Brand[500],
        opacity: off ? 0.45 : 1,
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

/** Inline error line. Renders nothing when there's no message. */
export function AuthError({ message }: { message?: string }): React.ReactElement | null {
  if (!message) return null;
  return (
    <ThemedText type="small" className="text-center" style={{ color: Accent.red }}>
      {message}
    </ThemedText>
  );
}

/** Small green text button, e.g. "Resend code". */
export function AuthTextButton({
  label,
  onPress,
  disabled,
  align = 'center',
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  align?: 'center' | 'end';
}): React.ReactElement {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      className={`active:opacity-60 ${align === 'end' ? 'self-end' : 'items-center'}`}
      style={{ opacity: disabled ? 0.4 : 1 }}>
      <ThemedText type="small" style={{ color: Brand[500], fontWeight: '700' }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

/** Footer nav line, e.g. "Don't have an account? Sign up". */
export function AuthFooterLink({
  prompt,
  action,
  href,
}: {
  prompt: string;
  action: string;
  href: Href;
}): React.ReactElement {
  return (
    <Link href={href} asChild>
      <Pressable className="items-center active:opacity-60">
        <ThemedText type="small" themeColor="textSecondary">
          {prompt}{' '}
          <ThemedText type="small" style={{ color: Brand[500], fontWeight: '700' }}>
            {action}
          </ThemedText>
        </ThemedText>
      </Pressable>
    </Link>
  );
}
