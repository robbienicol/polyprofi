import React from 'react';
import { Pressable, View } from 'react-native';

import { PAGE_IDS, SOMETHING_ELSE, type PageId } from '@/components/onboarding/quiz-pages';
import { ThemedText } from '@/components/themed-text';
import { Brand, Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { HORIZONS, type SurveyAnswers } from '@/lib/onboarding-profile';
import { ACQUISITION_PLATFORMS } from '@/lib/preferences';
import { residenceLabel } from '@/lib/us-states';

/** The last page: everything read back, and every line jumps to where it was set. */
export function ReviewPage({
  answers,
  onJumpTo,
}: {
  answers: SurveyAnswers;
  onJumpTo: (index: number) => void;
}): React.ReactElement {
  const theme = useTheme();

  const rows: { label: string; value: string; page: PageId }[] = [
    {
      label: 'Goal',
      value: (answers.outcome === SOMETHING_ELSE ? answers.outcomeOther.trim() : answers.outcome) || '—',
      page: 'outcome',
    },
    { label: 'Ways', value: answers.markets.join(', ') || 'Everything', page: 'markets' },
    { label: 'Can put in', value: answers.amount || '—', page: 'capital' },
    {
      label: 'Timeframe',
      value: HORIZONS.find((item) => item.value === answers.horizon)?.label ?? '—',
      page: 'horizon',
    },
    { label: 'State', value: residenceLabel(answers.residenceState) ?? '—', page: 'residence' },
    {
      label: 'Services',
      value: [
        ...ACQUISITION_PLATFORMS.filter((p) => !answers.avoidPlatforms.includes(p.value)).map((p) => p.label),
        answers.bankConnected ? 'bank connected' : null,
      ].filter((item): item is string => Boolean(item)).join(', ') || 'None added',
      page: 'platforms',
    },
  ];

  return (
    <View
      style={{
        borderRadius: Radius.lg,
        borderWidth: 1,
        borderColor: theme.border,
        backgroundColor: theme.backgroundElement,
        overflow: 'hidden',
      }}>
      {rows.map((row, rowIndex) => (
        <Pressable
          key={row.label}
          onPress={() => onJumpTo(PAGE_IDS.indexOf(row.page))}
          accessibilityRole="button"
          accessibilityLabel={`${row.label}: ${row.value}. Tap to change.`}
          className="flex-row items-center active:opacity-70"
          style={{
            gap: 12,
            paddingHorizontal: 14,
            paddingVertical: 12,
            borderTopWidth: rowIndex === 0 ? 0 : 1,
            borderTopColor: theme.border,
          }}>
          <ThemedText style={{ width: 86, fontSize: 11.5, fontWeight: '800', color: theme.textTertiary }}>
            {row.label.toUpperCase()}
          </ThemedText>
          <ThemedText style={{ flex: 1, fontSize: 13.5, fontWeight: '700', color: theme.text }}>
            {row.value}
          </ThemedText>
          <ThemedText style={{ fontSize: 13, color: Brand[500], fontWeight: '800' }}>edit</ThemedText>
        </Pressable>
      ))}
    </View>
  );
}
