import { Platform, Pressable, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Brand, Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface TrackRouteFormProps {
  amount: string;
  onAmountChange: (amount: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export function TrackRouteForm({ amount, onAmountChange, onConfirm, onCancel }: TrackRouteFormProps): React.ReactElement {
  const theme = useTheme();
  const buttonPadding = Platform.select({ ios: 10, android: 6 }) ?? 10;
  return (
    <View className="gap-3" style={{ borderRadius: Radius.lg, padding: 14, backgroundColor: theme.backgroundElevated, borderWidth: 1, borderColor: theme.border }}>
      <ThemedText style={{ fontSize: 12, fontWeight: '700', color: theme.textSecondary, letterSpacing: 0.3 }}>HOW MUCH ARE YOU STAKING?</ThemedText>
      <View className="flex-row items-center gap-2">
        <View className="flex-1 flex-row items-center px-3 border" style={{ borderRadius: Radius.md, borderColor: theme.borderStrong, paddingVertical: buttonPadding, backgroundColor: theme.background }}>
          <ThemedText style={{ color: theme.textTertiary, fontSize: 16 }}>$</ThemedText>
          <TextInput value={amount} onChangeText={onAmountChange} keyboardType="numeric" placeholder="0" placeholderTextColor={theme.textTertiary} className="flex-1" style={{ color: theme.text, fontSize: 16, fontWeight: '700', fontVariant: ['tabular-nums'] }} autoFocus />
        </View>
        <Pressable onPress={onConfirm} className="px-4 active:opacity-80" style={{ borderRadius: Radius.md, backgroundColor: Brand[500], paddingVertical: buttonPadding }}>
          <ThemedText style={{ fontSize: 14, fontWeight: '800', color: '#06140C' }}>Confirm</ThemedText>
        </Pressable>
        <Pressable onPress={onCancel} className="px-3 border active:opacity-70" style={{ borderRadius: Radius.md, borderColor: theme.border, paddingVertical: buttonPadding }}>
          <ThemedText type="small" themeColor="textSecondary">Cancel</ThemedText>
        </Pressable>
      </View>
    </View>
  );
}
