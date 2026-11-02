import React from 'react';
import { Pressable, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Brand, OnBrand, Radius, Semantic } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * What you can do with the ticked goals. Delete confirms in place rather than in an
 * Alert, which is a no-op on web — the same reason the single-goal delete does.
 */
export function SelectionBar({
  count,
  confirming,
  deleting,
  onClear,
  onViewPortfolio,
  onAskDelete,
  onCancelDelete,
  onConfirmDelete,
}: {
  count: number;
  confirming: boolean;
  deleting: boolean;
  onClear: () => void;
  onViewPortfolio: () => void;
  onAskDelete: () => void;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
}): React.ReactElement {
  const theme = useTheme();
  const goalWord = `${count} goal${count === 1 ? '' : 's'}`;

  return (
    <View
      style={{
        borderRadius: Radius.lg,
        backgroundColor: theme.backgroundElevated,
        borderWidth: 1,
        borderColor: Brand[500] + '4D',
        paddingHorizontal: 14,
        paddingVertical: 12,
        gap: 10,
      }}>
      <View className="flex-row items-center justify-between">
        <ThemedText style={{ fontSize: 13, fontWeight: '800', color: theme.text }}>
          {count > 0 ? `${goalWord} selected` : 'Tap goals to select them'}
        </ThemedText>
        {count > 0 ? (
          <Pressable onPress={onClear} accessibilityRole="button" hitSlop={8} className="active:opacity-60">
            <ThemedText style={{ fontSize: 12, fontWeight: '700', color: theme.textSecondary }}>Clear</ThemedText>
          </Pressable>
        ) : null}
      </View>

      {confirming ? (
        <View style={{ gap: 8 }}>
          <ThemedText style={{ fontSize: 12, lineHeight: 17, color: theme.textSecondary }}>
            Delete {goalWord}? Any positions move to another goal — nothing about the money
            is lost.
          </ThemedText>
          <View className="flex-row" style={{ gap: 8 }}>
            <Pressable
              onPress={onCancelDelete}
              accessibilityRole="button"
              className="flex-1 items-center active:opacity-70"
              style={{ borderRadius: Radius.md, borderWidth: 1, borderColor: theme.border, paddingVertical: 10 }}>
              <ThemedText style={{ fontSize: 13, fontWeight: '700', color: theme.textSecondary }}>Cancel</ThemedText>
            </Pressable>
            <Pressable
              onPress={onConfirmDelete}
              disabled={deleting}
              accessibilityRole="button"
              className="flex-1 items-center active:opacity-70"
              style={{ borderRadius: Radius.md, backgroundColor: Semantic.negative, paddingVertical: 10, opacity: deleting ? 0.6 : 1 }}>
              <ThemedText style={{ fontSize: 13, fontWeight: '800', color: '#FFFFFF' }}>
                {deleting ? 'Deleting…' : `Delete ${goalWord}`}
              </ThemedText>
            </Pressable>
          </View>
        </View>
      ) : (
        <View className="flex-row" style={{ gap: 8, opacity: count > 0 ? 1 : 0.4 }} pointerEvents={count > 0 ? 'auto' : 'none'}>
          <Pressable
            onPress={onViewPortfolio}
            accessibilityRole="button"
            className="flex-1 items-center active:opacity-80"
            style={{ borderRadius: Radius.md, backgroundColor: Brand[500], paddingVertical: 10 }}>
            <ThemedText style={{ fontSize: 13, fontWeight: '800', color: OnBrand }}>View portfolio</ThemedText>
          </Pressable>
          <Pressable
            onPress={onAskDelete}
            accessibilityRole="button"
            className="items-center active:opacity-70"
            style={{ borderRadius: Radius.md, borderWidth: 1, borderColor: Semantic.negative + '66', paddingVertical: 10, paddingHorizontal: 18 }}>
            <ThemedText style={{ fontSize: 13, fontWeight: '800', color: Semantic.negative }}>Delete</ThemedText>
          </Pressable>
        </View>
      )}
    </View>
  );
}
