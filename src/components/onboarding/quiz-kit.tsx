/**
 * The parts every quiz page is built from.
 *
 * Two ideas do most of the work. First, a page opens by *reading back* the
 * previous answer as a spoken line before it asks anything — that is what makes
 * the flow feel answered rather than collected. Second, every page draws its
 * question, helper, and options through the same three primitives, so twelve
 * pages read as one screen changing its mind rather than twelve screens.
 */

import React from 'react';
import { Pressable, View } from 'react-native';

import { SpokenLine, type Speech } from '@/components/onboarding/spoken-line';
import { Icon } from '@/components/ui/Icon';
import { ThemedText } from '@/components/themed-text';
import { Brand, Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export { SpokenLine, useSpokenLine, type Speech } from '@/components/onboarding/spoken-line';
export { TaskRow, useTaskProgress } from '@/components/onboarding/task-progress';

export interface PageCopy {
  /** Reads the previous answer back. Omitted on pages that follow nothing worth echoing. */
  ack?: string | null;
  badge?: string;
  title: string;
  helper?: string | null;
}

/** Ack line, optional badge, question, helper — the top of every page. */
export function PageHead({
  copy,
  speech,
  compact,
}: {
  copy: PageCopy;
  speech: Speech;
  compact: boolean;
}): React.ReactElement {
  const theme = useTheme();
  // A short screen can't carry both. The ack is the line written for this
  // person; the helper below it is the same sentence for everybody.
  const helper = compact && copy.ack ? null : copy.helper;

  return (
    <View style={{ gap: compact ? 10 : 13 }}>
      {copy.ack ? <SpokenLine speech={speech} compact={compact} /> : null}
      <View style={{ gap: 7 }}>
        <ThemedText
          style={{
            fontSize: compact ? 25 : 29,
            lineHeight: compact ? 30 : 35,
            fontWeight: '800',
            letterSpacing: -0.7,
            color: theme.text,
          }}>
          {copy.title}
        </ThemedText>
        {helper ? (
          <ThemedText
            style={{
              fontSize: compact ? 13 : 14,
              lineHeight: compact ? 18.5 : 20,
              color: theme.textSecondary,
              maxWidth: 360,
            }}>
            {helper}
          </ThemedText>
        ) : null}
      </View>
    </View>
  );
}

/**
 * One option. Two per row by default so six choices are one glance rather than
 * a scroll; `wide` gives a row to itself when the label carries a note.
 */
export function Choice({
  label,
  note,
  emoji,
  selected,
  wide,
  multi,
  onPress,
}: {
  label: string;
  note?: string;
  emoji?: string;
  selected: boolean;
  wide?: boolean;
  multi?: boolean;
  onPress: () => void;
}): React.ReactElement {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={multi ? 'checkbox' : 'radio'}
      accessibilityState={multi ? { checked: selected } : { selected }}
      className="justify-center active:opacity-80"
      style={{
        flexBasis: wide ? '100%' : '47%',
        flexGrow: 1,
        minHeight: note ? 58 : 50,
        paddingHorizontal: 13,
        paddingVertical: 10,
        borderRadius: Radius.md,
        borderWidth: selected ? 2 : 1.5,
        borderColor: selected ? Brand[500] : theme.border,
        backgroundColor: selected ? Brand[500] + '18' : theme.backgroundElement,
      }}>
      <View className="flex-row items-center" style={{ gap: 7 }}>
        {emoji ? <Icon glyph={emoji} size={16} color={selected ? Brand[500] : theme.textSecondary} /> : null}
        <ThemedText
          style={{
            flex: 1,
            fontSize: 14,
            lineHeight: 18,
            fontWeight: '700',
            color: selected ? Brand[500] : theme.text,
          }}>
          {label}
        </ThemedText>
      </View>
      {note ? (
        <ThemedText style={{ fontSize: 11.5, lineHeight: 15, marginTop: 3, color: theme.textTertiary }}>
          {note}
        </ThemedText>
      ) : null}
    </Pressable>
  );
}

/** The wrapper every set of options sits in, so spacing never drifts page to page. */
export function Options({ children, gap = 8 }: { children: React.ReactNode; gap?: number }): React.ReactElement {
  return (
    <View className="flex-row flex-wrap" style={{ gap }}>
      {children}
    </View>
  );
}
