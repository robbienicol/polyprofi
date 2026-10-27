import React, { useState } from 'react';
import { Pressable, View } from 'react-native';

import { PiggyBank } from 'lucide-react-native';

import { Icon } from '@/components/ui/Icon';
import { ThemedText } from '@/components/themed-text';
import { Radius } from '@/constants/theme';
import { useSemanticText, useTheme } from '@/hooks/use-theme';
import type { Route } from '@/types/routes';

/**
 * The spending cuts that did not make the main list, folded into one row. They are
 * not wrong — cuts stack, so each is still money — they are just not the first
 * thing someone looking for a way to reach a goal should have to scroll past.
 */
export function MoreWaysToSave({
  cuts,
  renderRoute,
}: {
  cuts: Route[];
  renderRoute: (route: Route) => React.ReactElement | null;
}): React.ReactElement | null {
  const theme = useTheme();
  const semantic = useSemanticText();
  const [open, setOpen] = useState(false);
  if (cuts.length === 0) return null;

  // They stack, so the honest summary is the sum.
  const together = Math.round(cuts.reduce((sum, route) => sum + route.expectedReturn, 0));

  return (
    <View className="gap-3">
      <Pressable
        onPress={() => setOpen((value) => !value)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        className="flex-row items-center justify-between active:opacity-70"
        style={{
          borderRadius: Radius.lg,
          borderWidth: 1,
          borderColor: theme.border,
          backgroundColor: theme.backgroundElement,
          paddingHorizontal: 14,
          paddingVertical: 12,
          gap: 10,
        }}>
        <Icon icon={PiggyBank} size={18} color={theme.textSecondary} strokeWidth={1.75} />
        <View className="flex-1">
          <ThemedText style={{ fontSize: 13, fontWeight: '800', color: theme.text }}>
            {cuts.length} more way{cuts.length === 1 ? '' : 's'} to save
          </ThemedText>
          <ThemedText style={{ fontSize: 11, color: theme.textSecondary, marginTop: 2 }}>
            {`$${together.toLocaleString()} more if you took every one of them`}
          </ThemedText>
        </View>
        <ThemedText style={{ fontSize: 14, fontWeight: '800', color: semantic.brand }}>
          {open ? 'Hide' : 'Show'}
        </ThemedText>
      </Pressable>
      {open ? cuts.map(renderRoute) : null}
    </View>
  );
}
