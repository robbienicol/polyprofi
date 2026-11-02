import type { LucideIcon } from 'lucide-react-native';
import { Pressable, ScrollView, View } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { Haptic } from '@/lib/haptics';
import { ThemedText } from '@/components/themed-text';
import { Brand, Radius } from '@/constants/theme';
import { useSemanticText, useTheme } from '@/hooks/use-theme';

/** A thin rule between filter sections — the whole panel is one card now, so the
 * sections need their own separation instead of the gaps between stacked boxes. */
export function Divider(): React.ReactElement {
  const theme = useTheme();
  return <View style={{ height: 1, backgroundColor: theme.border }} />;
}

/** One labelled block inside the Filters card. */
export function Section({ label, children }: React.PropsWithChildren<{ label: string }>): React.ReactElement {
  const theme = useTheme();
  return (
    <View style={{ gap: 8 }}>
      <ThemedText style={{ fontSize: 11, fontWeight: '800', letterSpacing: 0.6, color: theme.textSecondary }}>
        {label.toUpperCase()}
      </ThemedText>
      {children}
    </View>
  );
}

export function FilterRow({ children }: React.PropsWithChildren): React.ReactElement {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 2 }}>
      {children}
    </ScrollView>
  );
}

/**
 * A chip is 44pt tall and its selected state is readable at arm's length: the active
 * ink is the text-safe counterpart of the chip's hue, not the fill colour, which sat
 * at 3.2:1 on its own tint. Selection is carried by weight and border as well as by
 * colour, so it survives a screen reader and a colour-blind reader both.
 */
export function FilterChip({ label, icon, glyph, active, activeColor = Brand[500], activeTextColor, onPress }: { label: string; icon?: LucideIcon; glyph?: string; active: boolean; activeColor?: string; activeTextColor?: string; onPress: () => void }): React.ReactElement {
  const theme = useTheme();
  const semantic = useSemanticText();
  const tint = active ? activeTextColor ?? semantic.brand : theme.textSecondary;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={() => { Haptic.select(); onPress(); }}
      className="flex-row items-center active:opacity-70"
      style={{ gap: 6, paddingHorizontal: 14, minHeight: 44, borderRadius: Radius.pill, borderWidth: active ? 2 : 1, borderColor: active ? activeColor : theme.borderControl, backgroundColor: active ? activeColor + '1A' : theme.backgroundElement }}>
      {icon || glyph ? <Icon icon={icon} glyph={glyph} size={14} color={tint} /> : null}
      <ThemedText style={{ fontSize: 14, fontWeight: active ? '800' : '600', color: tint }}>{label}</ThemedText>
    </Pressable>
  );
}
