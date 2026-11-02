import React, { useState } from 'react';
import { Pressable, View } from 'react-native';

import { BankServiceCard } from '@/components/onboarding/survey/BankServiceCard';
import { CheckBadge, IconTile } from '@/components/onboarding/survey/service-parts';
import { ServicePitchModal } from '@/components/onboarding/survey/ServicePitchModal';
import { ThemedText } from '@/components/themed-text';
import { Brand, Radius, Shadow } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ACQUISITION_PLATFORMS } from '@/lib/preferences';
import type { AcquisitionPlatform } from '@/types/bets';

/**
 * One acquisition platform, added by default. Tapping an added card doesn't
 * remove it on the spot — it opens the full-screen pitch below, since that
 * tap is the one moment worth interrupting with the real case for keeping it.
 * A dropped card stays in the list as a plain, quiet "add it back" row.
 */
function ServiceCard({
  platform,
  avoided,
  onRequestRemove,
  onAddBack,
}: {
  platform: (typeof ACQUISITION_PLATFORMS)[number];
  avoided: boolean;
  onRequestRemove: () => void;
  onAddBack: () => void;
}): React.ReactElement {
  const theme = useTheme();

  if (!avoided) {
    return (
      <Pressable
        onPress={onRequestRemove}
        accessibilityRole="button"
        accessibilityLabel={`${platform.label}, added. Tap to remove.`}
        className="flex-row items-center active:opacity-80"
        style={{
          gap: 12,
          padding: 14,
          borderRadius: Radius.lg,
          borderWidth: 1.5,
          borderColor: Brand[500] + '55',
          backgroundColor: theme.backgroundElevated,
          ...Shadow.card,
        }}>
        <IconTile glyph={platform.icon} color={Brand[500]} backgroundColor={Brand[500] + '18'} />
        <View style={{ flex: 1, gap: 1 }}>
          <ThemedText style={{ fontSize: 14.5, fontWeight: '800', color: theme.text }}>{platform.label}</ThemedText>
          <ThemedText style={{ fontSize: 12, color: theme.textSecondary }}>{platform.description}</ThemedText>
        </View>
        <CheckBadge />
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onAddBack}
      accessibilityRole="button"
      accessibilityLabel={`${platform.label}, not added. Tap to add it back.`}
      className="flex-row items-center active:opacity-70"
      style={{
        gap: 12,
        padding: 14,
        borderRadius: Radius.lg,
        borderWidth: 1.5,
        borderStyle: 'dashed',
        borderColor: theme.border,
      }}>
      <IconTile glyph={platform.icon} color={theme.textTertiary} backgroundColor={theme.backgroundSelected} />
      <View style={{ flex: 1, gap: 1 }}>
        <ThemedText style={{ fontSize: 14.5, fontWeight: '800', color: theme.textTertiary }}>
          {platform.label} — not added
        </ThemedText>
        <ThemedText style={{ fontSize: 12, color: theme.textTertiary }}>Tap to add it back</ThemedText>
      </View>
    </Pressable>
  );
}

/** The platforms page: three acquisition platforms, added by default, plus bank connect. */
export function ServicesStep({
  avoidPlatforms,
  bankConnected,
  onTogglePlatform,
  onBankConnected,
}: {
  avoidPlatforms: string[];
  bankConnected: boolean;
  onTogglePlatform: (value: string) => void;
  onBankConnected: () => void;
}): React.ReactElement {
  // Which platform the pitch screen is up for, if any — set only by an actual
  // removal tap, never by re-adding one, which needs no convincing.
  const [pitchFor, setPitchFor] = useState<AcquisitionPlatform | null>(null);
  const pitchPlatform = ACQUISITION_PLATFORMS.find((platform) => platform.value === pitchFor) ?? null;

  return (
    <View style={{ gap: 10 }}>
      {/* First, not fourth: the platforms below are on by default and need no
          action, so burying the one card that asks for something under three
          that don't left most people scrolling past it without seeing it. */}
      <BankServiceCard connected={bankConnected} onConnected={onBankConnected} />
      {ACQUISITION_PLATFORMS.map((platform) => (
        <ServiceCard
          key={platform.value}
          platform={platform}
          avoided={avoidPlatforms.includes(platform.value)}
          onRequestRemove={() => setPitchFor(platform.value)}
          onAddBack={() => onTogglePlatform(platform.value)}
        />
      ))}
      <ServicePitchModal
        platform={pitchPlatform}
        onKeepIt={() => setPitchFor(null)}
        onRemoveAnyway={() => {
          if (pitchFor) onTogglePlatform(pitchFor);
          setPitchFor(null);
        }}
      />
    </View>
  );
}
