import type { LucideIcon } from 'lucide-react-native';
import { Pressable } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { Haptic } from '@/lib/haptics';
import { ThemedText } from '@/components/themed-text';
import { Radius, Semantic } from '@/constants/theme';
import { useSemanticText, useTheme } from '@/hooks/use-theme';
import type { ChanceTone } from '@/components/molecules/route-card/route-card-format';

const MONO = { fontVariant: ['tabular-nums' as const] };

/**
 * A big outlined pill in the outcome's colour, word and chance side by side. Sized
 * and tinted to read as the thing to tap — the card's actions, not its footnotes.
 */
export function OutcomePill({ tone, icon, label, value, onPress, accessibilityLabel, accessibilityHint }: {
  tone: ChanceTone | null;
  icon?: LucideIcon;
  label: string;
  value?: string;
  onPress?: () => void;
  accessibilityLabel: string;
  accessibilityHint?: string;
}) {
  const theme = useTheme();
  const ink = useSemanticText();
  const color = tone ? ink[tone] : theme.text;
  const fill = tone ? Semantic[tone] : theme.text;
  return (
    <Pressable
      onPress={onPress ? () => { Haptic.tap(); onPress(); } : undefined}
      disabled={!onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      className="active:opacity-70"
      style={{
        flex: 1,
        minHeight: 48,
        borderRadius: Radius.pill,
        borderWidth: 1.5,
        borderColor: fill + '59',
        backgroundColor: fill + '12',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingHorizontal: 12,
      }}>
      {icon ? <Icon icon={icon} size={15} color={color} strokeWidth={2.5} /> : null}
      <ThemedText style={{ fontSize: 15, fontWeight: '800', color, ...MONO }} numberOfLines={1}>
        {value ? `${label} · ${value}` : label}
      </ThemedText>
    </Pressable>
  );
}
