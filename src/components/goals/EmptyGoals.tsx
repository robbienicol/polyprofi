import React from 'react';
import { Pressable, View } from 'react-native';
import { Target } from 'lucide-react-native';

import { Icon } from '@/components/ui/Icon';
import { ThemedText } from '@/components/themed-text';
import { Brand, OnBrand, Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function EmptyGoals({ onAdd }: { onAdd: () => void }): React.ReactElement {
  const theme = useTheme();
  return (
    <View
      className="items-center"
      style={{
        borderRadius: Radius.xl,
        backgroundColor: theme.backgroundElevated,
        borderWidth: 1,
        borderColor: theme.border,
        padding: 24,
        gap: 12,
      }}>
      <View
        style={{
          width: 60,
          height: 60,
          borderRadius: Radius.xl,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: Brand[500] + '18',
        }}>
        <Icon icon={Target} size={26} color={Brand[500]} strokeWidth={1.75} />
      </View>
      <ThemedText style={{ fontSize: 17, fontWeight: '800', color: theme.text }}>Give it a name</ThemedText>
      <ThemedText className="text-center" style={{ fontSize: 13, lineHeight: 19, color: theme.textSecondary, maxWidth: 280 }}>
        A trip, a car, a cushion — name it and set a number, and we&apos;ll track what your routes add up to toward it. Completely optional.
      </ThemedText>
      <Pressable
        onPress={onAdd}
        className="items-center active:opacity-85"
        style={{ borderRadius: Radius.lg, backgroundColor: Brand[500], paddingVertical: 13, paddingHorizontal: 22, marginTop: 4 }}>
        <ThemedText style={{ fontSize: 14, fontWeight: '800', color: OnBrand }}>Add a goal</ThemedText>
      </Pressable>
    </View>
  );
}
