import { Stack } from 'expo-router';
import React from 'react';
import { Linking, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const SUPPORT_EMAIL = 'nicolrobbie017@gmail.com';

function H(props: { children: string }): React.ReactElement {
  const theme = useTheme();
  return (
    <ThemedText style={{ fontSize: 16, fontWeight: '800', color: theme.text, marginTop: 18 }}>
      {props.children}
    </ThemedText>
  );
}

function P(props: { children: React.ReactNode }): React.ReactElement {
  return (
    <ThemedText type="small" themeColor="textSecondary" style={{ lineHeight: 20, marginTop: 6 }}>
      {props.children}
    </ThemedText>
  );
}

/**
 * Support page. App Store review requires a URL where a person can actually
 * reach us, so this has to stay reachable and the address has to stay live.
 */
export default function SupportScreen(): React.ReactElement {
  const theme = useTheme();
  return (
    <View className="flex-1" style={{ backgroundColor: theme.background }}>
      <Stack.Screen options={{ title: 'Support', headerShown: true }} />
      <SafeAreaView className="flex-1" edges={['bottom']}>
        <ScrollView contentContainerClassName="px-5 py-6" showsVerticalScrollIndicator={false}>
          <ThemedText style={{ fontSize: 22, fontWeight: '800', color: theme.text }}>Support</ThemedText>
          <P>
            Pathey turns a money goal into ranked routes for reaching it — savings, U.S. Treasuries,
            stocks, crypto and prediction markets, side by side.
          </P>

          <H>Get in touch</H>
          <P>
            Email us and we&apos;ll reply within two business days. Tell us what you were doing and
            what happened; a screenshot helps.
          </P>
          <Pressable
            accessibilityRole="link"
            onPress={() => {
              void Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=Pathey%20support`);
            }}>
            <ThemedText style={{ fontSize: 16, fontWeight: '700', color: Brand[500], marginTop: 8 }}>
              {SUPPORT_EMAIL}
            </ThemedText>
          </Pressable>

          <H>Early access codes</H>
          <P>
            Pathey is invite-only for now. If your code is rejected, check for stray spaces — the
            code itself is not case-sensitive. Lost your code? Email us and we&apos;ll send it again.
          </P>

          <H>Common questions</H>
          <P>
            <ThemedText type="small" style={{ fontWeight: '700', color: theme.text }}>
              Does Pathey move my money?{' '}
            </ThemedText>
            No. Pathey is informational. It never places a trade, holds funds or takes a position on
            your behalf. When you choose a route, we hand you off to the venue that offers it and you
            transact there.
          </P>
          <P>
            <ThemedText type="small" style={{ fontWeight: '700', color: theme.text }}>
              Is this financial advice?{' '}
            </ThemedText>
            No. Pathey shows publicly available prices and probabilities so you can compare
            tradeoffs. Nothing in the app is a recommendation, and every route can lose money.
          </P>
          <P>
            <ThemedText type="small" style={{ fontWeight: '700', color: theme.text }}>
              How do I delete my account?{' '}
            </ThemedText>
            Email us from the address you signed up with and we&apos;ll delete the account and its
            data.
          </P>

          <H>Privacy and terms</H>
          <P>
            Our <ThemedText type="small" style={{ fontWeight: '700', color: theme.text }}>Privacy
            Policy</ThemedText> is at usepathey.com/privacy and our{' '}
            <ThemedText type="small" style={{ fontWeight: '700', color: theme.text }}>Terms</ThemedText>{' '}
            are at usepathey.com/terms.
          </P>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
