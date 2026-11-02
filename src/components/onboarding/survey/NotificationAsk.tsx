import React from 'react';
import { Pressable, View } from 'react-native';

import { BrandMark } from '@/components/ui/BrandMark';
import { ThemedText } from '@/components/themed-text';
import { Brand, OnBrand, Radius, Shadow } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * The permission ask. It shows the actual banner rather than describing one, so
 * what is being agreed to is the thing that will really arrive.
 */
export function NotificationAsk({
  busy,
  onEnable,
  onSkip,
}: {
  busy: boolean;
  onEnable: () => void;
  onSkip: () => void;
}): React.ReactElement {
  const theme = useTheme();

  return (
    <View style={{ flex: 1, gap: 16, justifyContent: 'space-between' }}>
      <View style={{ gap: 10 }}>
        <PushPreview
          title="Pathey"
          body="SGOV now pays more than what you're holding. 4.9%, and you can pull out any time."
        />
        <PushPreview title="Pathey" body="Your safety net hit $6,000. Good time to cash out." muted />
      </View>

      <View style={{ gap: 9 }}>
        <Pressable
          onPress={onEnable}
          disabled={busy}
          accessibilityRole="button"
          className="py-4 items-center active:opacity-85"
          style={{ borderRadius: Radius.lg, backgroundColor: Brand[500], opacity: busy ? 0.6 : 1, ...Shadow.card }}>
          <ThemedText style={{ fontSize: 16, fontWeight: '800', color: OnBrand }}>
            {busy ? 'Waiting…' : 'Yes, keep me on track'}
          </ThemedText>
        </Pressable>
        <Pressable
          onPress={onSkip}
          disabled={busy}
          accessibilityRole="button"
          className="py-3 items-center active:opacity-60">
          <ThemedText style={{ fontSize: 14, fontWeight: '700', color: theme.textTertiary }}>Maybe later</ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

function PushPreview({ title, body, muted }: { title: string; body: string; muted?: boolean }): React.ReactElement {
  const theme = useTheme();
  return (
    <View
      className="flex-row"
      style={{
        gap: 11,
        padding: 12,
        borderRadius: Radius.lg,
        backgroundColor: theme.backgroundElevated,
        borderWidth: 1,
        borderColor: theme.border,
        opacity: muted ? 0.55 : 1,
        ...Shadow.card,
      }}>
      <BrandMark size={34} />
      <View style={{ flex: 1, gap: 2 }}>
        <View className="flex-row items-center justify-between">
          <ThemedText style={{ fontSize: 12, fontWeight: '800', color: theme.text }}>{title}</ThemedText>
          <ThemedText style={{ fontSize: 10.5, color: theme.textTertiary }}>now</ThemedText>
        </View>
        <ThemedText style={{ fontSize: 12.5, lineHeight: 17, color: theme.textSecondary }}>{body}</ThemedText>
      </View>
    </View>
  );
}
