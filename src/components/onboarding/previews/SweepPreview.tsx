import React, { useEffect, useState } from "react";
import { Animated, Easing, View } from "react-native";

import { SWEEP_MARKETS } from "@/components/onboarding/onboarding-data";
import { Caption, Mark, Spine, useCompact, type PreviewProps } from "@/components/onboarding/previews/primitives";
import { ThemedText } from "@/components/themed-text";
import { Icon } from "@/components/ui/Icon";
import { Brand, OnBrand } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

/* ------------------------------------------------------------------ slide 1: sweep */

/** How long the check takes to travel from one way to the next. */
const SWEEP_STEP_MS = 520;
/** Extra steps spent on the finished list before the check starts over. */
const SWEEP_HOLD_STEPS = 4;

/**
 * The sweep, shown rather than described: a line fills down the spine and each
 * mark lights and ticks as it arrives, then the whole thing loops.
 *
 * Driven by a plain interval over an integer step rather than by Animated's own
 * looping — Animated loops parked after one pass here (a timing nested in a
 * sequence ignores `resetBeforeIteration`), and a counter that wraps cannot stick.
 *
 * No prices or counts: a number here would read as a claim about what the app
 * found today, and nothing on this screen is live.
 */
export function SweepPreview({ active }: PreviewProps): React.ReactElement {
  const compact = useCompact();
  const total = SWEEP_MARKETS.length + SWEEP_HOLD_STEPS;
  const [step, setStep] = useState(0);
  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setStep((current) => (current + 1) % total), SWEEP_STEP_MS);
    return () => clearInterval(id);
  }, [active, total]);

  const reached = Math.min(step, SWEEP_MARKETS.length);
  useEffect(() => {
    // Filling down glides; the wrap back to the top is instant.
    Animated.timing(progress, {
      toValue: reached,
      duration: reached === 0 ? 0 : SWEEP_STEP_MS,
      easing: Easing.inOut(Easing.quad),
      useNativeDriver: false,
    }).start();
  }, [progress, reached]);

  const rowHeight = compact ? 52 : 60;
  const rail = 56;
  const count = SWEEP_MARKETS.length;
  const done = step >= count;

  return (
    <View className="flex-1 justify-center" style={{ opacity: active ? 1 : 0.98, paddingHorizontal: 6 }}>
      <View>
        <Spine rows={count} rowHeight={rowHeight} rail={rail} />
        {/* The solid line that fills the spine as each way is checked. */}
        <Animated.View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: rail / 2 - 1,
            top: rowHeight / 2,
            width: 2,
            borderRadius: 1,
            backgroundColor: Brand[500],
            height: progress.interpolate({
              inputRange: [0, 1, count],
              outputRange: [0, 0, rowHeight * (count - 1)],
            }),
          }}
        />
        {SWEEP_MARKETS.map((market, index) => (
          <SweepRow key={market.label} market={market} lit={step > index} height={rowHeight} rail={rail} />
        ))}
      </View>
      <Caption>
        {done
          ? `All ${count} ways checked for your goal, at once.`
          : `Checking ${Math.min(step + 1, count)} of ${count} ways…`}
      </Caption>
    </View>
  );
}

/** One way in the sweep: a muted mark until the check reaches it, then lit with a tick. */
function SweepRow({
  market,
  lit,
  height,
  rail,
}: {
  market: (typeof SWEEP_MARKETS)[number];
  lit: boolean;
  height: number;
  rail: number;
}): React.ReactElement {
  const theme = useTheme();
  const [anim] = useState(() => new Animated.Value(lit ? 1 : 0));

  useEffect(() => {
    Animated.timing(anim, {
      toValue: lit ? 1 : 0,
      duration: lit ? 240 : 0,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [anim, lit]);

  return (
    <View className="flex-row items-center" style={{ height, gap: 14 }}>
      <View style={{ width: rail, alignItems: "center" }}>
        <Mark glyph={market.emoji} size={42} strength={0.2} muted={!lit} />
        <Animated.View
          style={{
            position: "absolute",
            right: rail / 2 - 24,
            bottom: -2,
            width: 18,
            height: 18,
            borderRadius: 999,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: Brand[500],
            borderWidth: 2,
            borderColor: theme.background,
            opacity: anim,
            transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }],
          }}
        >
          <Icon glyph="✓" size={10} color={OnBrand} strokeWidth={3.2} />
        </Animated.View>
      </View>
      <View className="flex-1" style={{ gap: 2 }}>
        <Animated.Text
          numberOfLines={1}
          style={{
            fontSize: 14,
            fontWeight: "800",
            color: anim.interpolate({ inputRange: [0, 1], outputRange: [theme.textTertiary, theme.text] }),
          }}
        >
          {market.label}
        </Animated.Text>
        <ThemedText style={{ fontSize: 12, color: theme.textSecondary }} numberOfLines={1}>
          {market.note}
        </ThemedText>
      </View>
    </View>
  );
}
