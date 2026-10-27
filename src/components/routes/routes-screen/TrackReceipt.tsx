import { Pressable, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Brand, OnBrand, Radius, Semantic } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * What the app just wrote down, in the user's words. Shown before any handoff, because
 * the alternative — write a position, switch to Safari, say nothing — is the single
 * worst moment in the flow for someone whose whole worry is being scammed.
 */
export interface Receipt {
  routeId: string;
  /** Label / value pairs, read top to bottom. */
  lines: [string, string][];
  /** The venue handoff, offered rather than performed. Null when there is nowhere to go. */
  actionLabel: string | null;
  onAction: (() => void) | null;
}

/**
 * What was just recorded, before anything opens. The app took an action with the
 * user's money; this is it saying so, in the same words the card used, with the
 * downside stated rather than implied. The handoff is a button here, not a side
 * effect of confirming — see `Receipt`.
 */
export function TrackReceipt({ receipt, onDone }: { receipt: Receipt; onDone: () => void }): React.ReactElement {
  const theme = useTheme();

  return (
    <View
      accessible
      accessibilityRole="summary"
      accessibilityLabel={`Added to your plan. ${receipt.lines.map(([label, value]) => `${label}: ${value}`).join('. ')}`}
      style={{
        borderRadius: Radius.lg,
        borderWidth: 1,
        borderColor: Semantic.positive + '3D',
        backgroundColor: Semantic.positive + '12',
        paddingHorizontal: 16,
        paddingVertical: 14,
        gap: 10,
      }}>
      <ThemedText style={{ fontSize: 15, fontWeight: '800', color: theme.text }}>Added to your plan</ThemedText>
      <View style={{ gap: 6 }}>
        {receipt.lines.map(([label, value]) => (
          <View key={label} style={{ gap: 1 }}>
            <ThemedText style={{ fontSize: 11, fontWeight: '800', color: theme.textSecondary, letterSpacing: 0.4 }}>
              {label.toUpperCase()}
            </ThemedText>
            <ThemedText style={{ fontSize: 14, lineHeight: 20, color: theme.text }}>{value}</ThemedText>
          </View>
        ))}
      </View>
      <View className="flex-row" style={{ gap: 8, marginTop: 2 }}>
        {receipt.actionLabel && receipt.onAction ? (
          <Pressable
            onPress={() => { receipt.onAction?.(); onDone(); }}
            accessibilityRole="button"
            accessibilityHint="Leaves Pathey and opens the venue in your browser"
            className="active:opacity-85"
            style={{ borderRadius: Radius.md, paddingHorizontal: 16, minHeight: 44, justifyContent: 'center', backgroundColor: Brand[500] }}>
            <ThemedText style={{ fontSize: 14, fontWeight: '800', color: OnBrand }}>{receipt.actionLabel} →</ThemedText>
          </Pressable>
        ) : null}
        <Pressable
          onPress={onDone}
          accessibilityRole="button"
          className="active:opacity-70"
          style={{ borderRadius: Radius.md, paddingHorizontal: 16, minHeight: 44, justifyContent: 'center', borderWidth: 1, borderColor: theme.borderControl }}>
          <ThemedText style={{ fontSize: 14, fontWeight: '800', color: theme.text }}>Done</ThemedText>
        </Pressable>
      </View>
    </View>
  );
}
