import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Brand, OnBrand, Radius, Shadow } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { explainerFor, type MetricKey } from '@/lib/metric-glossary';

/**
 * The ⓘ that sits beside a metric, and the sheet it opens.
 *
 * Finance words are the app's biggest comprehension problem: "expected value"
 * reads as a verdict on the portfolio rather than as an average, and a mildly
 * negative one looks like money lost. Rather than dumb the numbers down, every
 * one of them can say what it is on request — the explanation is one tap away
 * and never in the way of someone who already knows.
 *
 * Kept deliberately quiet: tertiary colour, no fill, no badge. It is an offer of
 * help, not a warning, and a row of loud icons would read as a row of problems.
 */
export function MetricInfo({
  metric,
  size = 15,
}: {
  metric: MetricKey;
  /** Diameter of the button. 15 suits caption rows; 17–18 suits card titles. */
  size?: number;
}): React.ReactElement {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const explainer = explainerFor(metric);

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`What is ${explainer.title.toLowerCase()}?`}
        accessibilityHint="Opens a plain-language explanation"
        // Generous, because the button itself is small on purpose.
        hitSlop={12}
        className="items-center justify-center active:opacity-60"
        style={{
          width: size,
          height: size,
          borderRadius: Radius.pill,
          borderWidth: 1,
          borderColor: theme.textTertiary,
        }}>
        <ThemedText
          style={{
            fontSize: size * 0.62,
            lineHeight: size,
            fontWeight: '800',
            color: theme.textTertiary,
            textAlign: 'center',
          }}>
          i
        </ThemedText>
      </Pressable>

      <MetricInfoSheet metric={metric} visible={open} onClose={() => setOpen(false)} />
    </>
  );
}

/**
 * The sheet on its own, for a caller that already has something to tap — a whole
 * tile, say — and does not want a second target inside it.
 */
export function MetricInfoSheet({
  metric,
  visible,
  onClose,
}: {
  metric: MetricKey;
  visible: boolean;
  onClose: () => void;
}): React.ReactElement {
  const theme = useTheme();
  const explainer = explainerFor(metric);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      {/* Tapping the dimmed area closes it. The card stops the press so a tap
          inside — selecting text, scrolling — does not dismiss what you are reading. */}
      <Pressable
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close"
        className="flex-1 justify-end"
        style={{ backgroundColor: '#00000099' }}>
        <Pressable
          onPress={() => {}}
          accessibilityRole="none"
          style={{
            backgroundColor: theme.backgroundElevated,
            borderTopLeftRadius: Radius.xl,
            borderTopRightRadius: Radius.xl,
            borderWidth: 1,
            borderColor: theme.border,
            paddingHorizontal: 22,
            paddingTop: 18,
            paddingBottom: 34,
            gap: 16,
            ...Shadow.card,
          }}>
          <View className="items-center">
            <View style={{ width: 38, height: 4, borderRadius: Radius.pill, backgroundColor: theme.borderStrong }} />
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 16 }} style={{ maxHeight: 460 }}>
            <ThemedText style={{ fontSize: 21, fontWeight: '800', color: theme.text, letterSpacing: -0.4 }}>
              {explainer.title}
            </ThemedText>

            <ThemedText style={{ fontSize: 15, lineHeight: 22, color: theme.text }}>
              {explainer.what}
            </ThemedText>

            <Passage label="Why it is here" body={explainer.why} />
            {explainer.reading ? <Passage label="Easy to misread" body={explainer.reading} /> : null}
            {explainer.workedOut ? <Passage label="How it is worked out" body={explainer.workedOut} /> : null}
          </ScrollView>

          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            className="items-center active:opacity-85"
            style={{ borderRadius: Radius.lg, backgroundColor: Brand[500], paddingVertical: 14 }}>
            <ThemedText style={{ fontSize: 15, fontWeight: '800', color: OnBrand }}>Got it</ThemedText>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function Passage({ label, body }: { label: string; body: string }): React.ReactElement {
  const theme = useTheme();
  return (
    <View style={{ gap: 5 }}>
      <ThemedText style={{ fontSize: 10.5, fontWeight: '900', letterSpacing: 1, color: theme.textTertiary }}>
        {label.toUpperCase()}
      </ThemedText>
      <ThemedText style={{ fontSize: 14, lineHeight: 21, color: theme.textSecondary }}>{body}</ThemedText>
    </View>
  );
}
