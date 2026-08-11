import { Stack } from 'expo-router';
import React from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

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
 * Good-faith draft Terms of Service reflecting how the app actually works
 * today (informational routes only, no in-app trading or real billing yet).
 * Not legal advice — have counsel review before relying on it.
 */
export default function TermsScreen(): React.ReactElement {
  const theme = useTheme();
  return (
    <View className="flex-1" style={{ backgroundColor: theme.background }}>
      <Stack.Screen options={{ title: 'Terms of Service', headerShown: true }} />
      <SafeAreaView className="flex-1" edges={['bottom']}>
        <ScrollView contentContainerClassName="px-5 py-6" showsVerticalScrollIndicator={false}>
          <ThemedText style={{ fontSize: 22, fontWeight: '800', color: theme.text }}>Terms of Service</ThemedText>
          <P>Last updated: 2026-08-10.</P>

          <H>What PolyProfit is</H>
          <P>
            PolyProfit shows AI-generated, informational &quot;routes&quot; — ways you could try to reach a
            money goal across markets like Polymarket, stocks, crypto, and treasuries. Routes are ranked
            by estimated risk and probability using historical and live market data plus AI-assisted
            analysis.
          </P>

          <H>Not financial advice</H>
          <P>
            Nothing in the app is financial, investment, tax, or legal advice, and PolyProfit is not a
            registered investment adviser or broker-dealer. Routes are for entertainment and informational
            purposes only. Always do your own research before acting on anything you see here.
          </P>

          <H>No trading or money movement in-app</H>
          <P>
            PolyProfit does not execute trades, place bets, or move money on your behalf. Where a route
            points to an external platform (like Polymarket or a brokerage), tapping through takes you to
            that platform, where you decide whether to act, at your own risk and subject to that
            platform&apos;s own terms.
          </P>

          <H>Your account</H>
          <P>
            You&apos;re responsible for keeping your login credentials secure. You can delete your account at
            any time from Profile → Delete account, which permanently removes your data as described in
            our Privacy Policy.
          </P>

          <H>No guarantees</H>
          <P>
            Markets are unpredictable. Probabilities and expected returns shown in the app are estimates,
            not guarantees, and past performance of any strategy doesn&apos;t predict future results. You can
            lose money acting on anything shown in the app.
          </P>

          <H>Changes</H>
          <P>We may update these terms as the app changes. Continued use after an update means you accept the revised terms.</P>

          <H>Contact</H>
          <P>Questions about these terms: creators@tryzalt.com</P>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
