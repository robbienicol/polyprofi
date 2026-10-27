import React from 'react';
import { Linking, Modal, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { OnboardingGlow } from '@/components/onboarding/OnboardingGlow';
import { Icon } from '@/components/ui/Icon';
import { ThemedText } from '@/components/themed-text';
import { Brand, OnBrand, Radius, Shadow } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ACQUISITION_PLATFORMS } from '@/lib/preferences';
import type { AcquisitionPlatform } from '@/types/bets';

/**
 * The full-screen interstitial a removal tap opens. Its own screen rather than
 * a card swap in the list — this is the one moment in the quiz with real money
 * behind it (Pathey earns a referral kickback on every one of these three that
 * signs up), so it gets a real takeover, not something easy to miss scrolling
 * past a list. No invented stat or performance number (see the FACTS comment
 * on building-plan.tsx): the persuasion is what they'd lose, true by
 * construction of the other two platforms.
 */
const SERVICE_PITCH: Record<AcquisitionPlatform, { headline: string; body: string }> = {
  robinhood: {
    headline: "Don't skip Robinhood",
    body: "It's the only one of these three that prices stocks, ETFs, and crypto — Polymarket and Kalshi are prediction markets only. Skip it and every one of those routes disappears from your plan.",
  },
  polymarket: {
    headline: "Don't skip Polymarket",
    body: 'It carries the largest, most liquid prediction markets we track. Skip it and every prediction pick left comes from a thinner, less liquid book.',
  },
  kalshi: {
    headline: "Don't skip Kalshi",
    body: "It's a CFTC-regulated exchange. When a sports contract lists on both, we show you whichever is cheaper — skip it and you only ever see the Polymarket price.",
  },
};

/**
 * Where "sign up" links out to. Plain public sites, not referral links —
 * Pathey isn't enrolled in any of these programs yet (Robinhood's runs through
 * Impact, Polymarket's through Dub, Kalshi has its own). Swap these for the
 * real affiliate/referral URL the moment that enrollment exists; nothing else
 * here needs to change.
 */
const SERVICE_LINKS: Record<AcquisitionPlatform, string> = {
  robinhood: 'https://robinhood.com',
  polymarket: 'https://polymarket.com',
  kalshi: 'https://kalshi.com',
};

export function ServicePitchModal({
  platform,
  onKeepIt,
  onRemoveAnyway,
}: {
  platform: (typeof ACQUISITION_PLATFORMS)[number] | null;
  onKeepIt: () => void;
  onRemoveAnyway: () => void;
}): React.ReactElement {
  const theme = useTheme();
  const pitch = platform ? SERVICE_PITCH[platform.value] : null;

  return (
    <Modal visible={platform != null} animationType="slide" presentationStyle="pageSheet" onRequestClose={onKeepIt}>
      <View className="flex-1" style={{ backgroundColor: theme.background }}>
        <OnboardingGlow />
        <SafeAreaView className="flex-1">
          <ScrollView
            contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 28, gap: 20 }}
            showsVerticalScrollIndicator={false}>
            {platform && pitch ? (
              <>
                <View style={{ alignSelf: 'center', width: 84, height: 84, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: Brand[500] + '1F' }}>
                  <Icon glyph={platform.icon} size={38} color={Brand[500]} strokeWidth={1.6} />
                </View>
                <ThemedText
                  style={{
                    fontSize: 27,
                    lineHeight: 32,
                    fontWeight: '900',
                    letterSpacing: -0.6,
                    color: theme.text,
                    textAlign: 'center',
                  }}>
                  {pitch.headline}
                </ThemedText>
                <ThemedText style={{ fontSize: 15.5, lineHeight: 22, color: theme.textSecondary, textAlign: 'center' }}>
                  {pitch.body}
                </ThemedText>
              </>
            ) : null}
          </ScrollView>
          <View className="px-7" style={{ gap: 10, paddingBottom: 22 }}>
            <Pressable
              onPress={() => {
                if (platform) void Linking.openURL(SERVICE_LINKS[platform.value]);
                onKeepIt();
              }}
              accessibilityRole="button"
              className="py-4 items-center active:opacity-85"
              style={{ borderRadius: Radius.lg, backgroundColor: Brand[500], ...Shadow.card }}>
              <ThemedText style={{ fontSize: 16, fontWeight: '800', color: OnBrand, letterSpacing: -0.2 }}>
                Sign up for {platform?.label} →
              </ThemedText>
            </Pressable>
            <Pressable onPress={onKeepIt} accessibilityRole="button" className="py-3 items-center active:opacity-60">
              <ThemedText style={{ fontSize: 14, fontWeight: '700', color: theme.textSecondary }}>
                I already use it — keep it on
              </ThemedText>
            </Pressable>
            <Pressable onPress={onRemoveAnyway} accessibilityRole="button" className="py-2 items-center active:opacity-60">
              <ThemedText style={{ fontSize: 13, fontWeight: '600', color: theme.textTertiary }}>
                No thanks, remove it
              </ThemedText>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}
