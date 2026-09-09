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
 * Real, accurate privacy policy reflecting what this app actually collects
 * and does today — update it as data practices change (e.g. if bank-linking
 * or IAP billing is added). This is a good-faith draft, not legal advice;
 * have counsel review before relying on it for App Store submission.
 */
export default function PrivacyScreen(): React.ReactElement {
  const theme = useTheme();
  return (
    <View className="flex-1" style={{ backgroundColor: theme.background }}>
      <Stack.Screen options={{ title: 'Privacy Policy', headerShown: true }} />
      <SafeAreaView className="flex-1" edges={['bottom']}>
        <ScrollView contentContainerClassName="px-5 py-6" showsVerticalScrollIndicator={false}>
          <ThemedText style={{ fontSize: 22, fontWeight: '800', color: theme.text }}>Privacy Policy</ThemedText>
          <P>Last updated: 2026-08-10.</P>

          <H>What this covers</H>
          <P>
            This policy explains what Pathey collects when you use the app, why, and how you can
            delete it. Pathey shows AI-generated, informational routes across markets (Polymarket,
            stocks, crypto, treasuries, etc.) — it does not hold funds, place trades, or move money on
            your behalf, and it does not currently connect to your bank or brokerage accounts.
          </P>

          <H>Information we collect</H>
          <P>• Account info: your email address, via our authentication provider (Clerk), when you sign up.</P>
          <P>
            • Profile survey answers: age range, country, investing experience, goals, and markets
            you&apos;re interested in — collected once after sign-up, stored in our database, and used to
            personalize the app.
          </P>
          <P>
            • Goals and activity you enter: your profit target, timeframe, risk preference, and any
            routes you save or mark as tracked. This is stored locally on your device, not on our servers.
          </P>
          <P>• Device diagnostics: basic crash/error info if the app encounters an unexpected error.</P>

          <H>What we don&apos;t collect</H>
          <P>
            We don&apos;t collect bank account numbers, card numbers, or brokerage credentials — the app
            doesn&apos;t connect to financial institutions. We don&apos;t use advertising trackers, and we don&apos;t
            sell your data.
          </P>

          <H>How we use it</H>
          <P>
            To generate and rank the routes we show you, to remember your preferences, and to improve the
            app. Your goal and survey inputs may be sent to our AI provider (OpenAI) to help generate
            recommendations — this is used only to build your results, not to train models on your data
            beyond what OpenAI&apos;s own API terms specify.
          </P>

          <H>Who we share it with</H>
          <P>
            Clerk (authentication), Neon (database hosting), and OpenAI (route generation) process data on
            our behalf as service providers. We don&apos;t share your data with advertisers or data brokers.
          </P>

          <H>Your controls</H>
          <P>
            You can delete your account at any time from Profile → Delete account. This permanently
            removes your profile from our database, deletes your sign-in identity, and clears everything
            saved on your device. You can also just sign out or uninstall the app to clear local data
            without deleting your account.
          </P>

          <H>Contact</H>
          <P>Questions about this policy: creators@tryzalt.com</P>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
