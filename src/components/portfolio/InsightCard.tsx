import React from 'react';
import { View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { MetricInfo } from '@/components/ui/MetricInfo';
import { Radius, Shadow } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { MetricKey } from '@/lib/metric-glossary';

/** Shared card shell, so the four insights below cannot drift apart visually. */
export function InsightCard({
  title,
  metric,
  subtitle,
  children,
}: React.PropsWithChildren<{ title: string; metric: MetricKey; subtitle?: string }>): React.ReactElement {
  const theme = useTheme();
  return (
    <View
      style={{
        borderRadius: Radius.xl,
        backgroundColor: theme.backgroundElevated,
        borderWidth: 1,
        borderColor: theme.border,
        padding: 18,
        gap: 14,
        ...Shadow.card,
      }}>
      <View style={{ gap: 4 }}>
        <View className="flex-row items-center" style={{ gap: 7 }}>
          <ThemedText style={{ fontSize: 15, fontWeight: '800', color: theme.text }}>{title}</ThemedText>
          <MetricInfo metric={metric} size={17} />
        </View>
        {subtitle ? (
          <ThemedText style={{ fontSize: 11, lineHeight: 15, color: theme.textTertiary }}>{subtitle}</ThemedText>
        ) : null}
      </View>
      {children}
    </View>
  );
}
