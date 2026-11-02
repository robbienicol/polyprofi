import React from "react";
import { View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { MATH_DISCLAIMER } from "@/components/onboarding/onboarding-data";
import { ScoreRing } from "@/components/onboarding/previews/motion";
import {
  Caption,
  FACTORS_BY_WEIGHT,
  Mark,
  MarkText,
  MONO,
  Spine,
  useCompact,
  type PreviewProps,
} from "@/components/onboarding/previews/primitives";
import { ThemedText } from "@/components/themed-text";
import { Brand } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

/* ------------------------------------------------------------------ slide 0a: quiz */

/**
 * The four things a score weighs, as a ladder of shrinking marks, so the size
 * itself says "first counts most".
 */
export function QuizPreview({ active }: PreviewProps): React.ReactElement {
  const compact = useCompact();
  const rowHeight = compact ? 58 : 66;
  const rail = 64;
  const sizes = [52, 44, 37, 31];
  const strengths = [0.2, 0.15, 0.11, 0.08];

  return (
    <View className="flex-1 justify-center" style={{ opacity: active ? 1 : 0.98, paddingHorizontal: 6 }}>
      <View>
        <Spine rows={FACTORS_BY_WEIGHT.length} rowHeight={rowHeight} rail={rail} />
        {FACTORS_BY_WEIGHT.map((factor, index) => (
          <View key={factor.label} className="flex-row items-center" style={{ height: rowHeight, gap: 14 }}>
            <View style={{ width: rail, alignItems: "center" }}>
              <Mark glyph={factor.emoji} size={sizes[index] ?? 30} strength={strengths[index]} />
            </View>
            <MarkText lead={String(index + 1)} title={factor.label} note={factor.note} />
          </View>
        ))}
      </View>
      <Caption>
        Every route is scored on these four, and the ones at the top count the most. You can change the order anytime in Settings.
      </Caption>
    </View>
  );
}

/* ------------------------------------------------------------------ slide 0b: score */

/**
 * Four things in, one number out: the factors drawn across the top, dotted lines
 * running down into a ring that fills to the score. The percentages are the real
 * default weights (`DEFAULT_SCORE_WEIGHTS` in src/lib/score.ts).
 */
export function ScorePreview({ active }: PreviewProps): React.ReactElement {
  const theme = useTheme();
  const compact = useCompact();
  const width = 288;
  const spacing = 72;
  const markSize = compact ? 40 : 44;
  const markY = markSize / 2;
  const ringSize = compact ? 104 : 118;
  const linesTop = markSize + 30;
  const ringTop = linesTop + (compact ? 44 : 56);
  const height = ringTop + ringSize;
  const xs = FACTORS_BY_WEIGHT.map((_, index) => width / 2 - spacing * 1.5 + spacing * index);

  return (
    <View className="flex-1 justify-center items-center" style={{ opacity: active ? 1 : 0.98 }}>
      <View style={{ width, height }}>
        <Svg width={width} height={height} style={{ position: "absolute" }} pointerEvents="none">
          {xs.map((x) => (
            <Path
              key={x}
              d={`M${x},${linesTop} Q${x},${ringTop - 12} ${width / 2},${ringTop - 4}`}
              stroke={Brand[500]}
              strokeOpacity={0.35}
              strokeWidth={2}
              strokeLinecap="round"
              strokeDasharray="0.1 6"
              fill="none"
            />
          ))}
        </Svg>

        {FACTORS_BY_WEIGHT.map((factor, index) => (
          <View
            key={factor.label}
            style={{ position: "absolute", left: xs[index] - 40, top: markY - markSize / 2, width: 80, alignItems: "center", gap: 5 }}
          >
            <Mark glyph={factor.emoji} size={markSize} strength={0.18} />
            <ThemedText style={{ fontSize: 12, fontWeight: "900", color: Brand[500], ...MONO }}>
              {factor.weight}%
            </ThemedText>
          </View>
        ))}

        <View style={{ position: "absolute", top: ringTop, left: width / 2 - ringSize / 2, alignItems: "center" }}>
          <ScoreRing score={82} size={ringSize} stroke={9} animate={active} fontSize={compact ? 32 : 36} />
        </View>
        <ThemedText
          style={{
            position: "absolute",
            top: ringTop + ringSize / 2 + (compact ? 18 : 21),
            width,
            textAlign: "center",
            fontSize: 10.5,
            fontWeight: "800",
            color: theme.textTertiary,
          }}
        >
          out of 100
        </ThemedText>
      </View>
      <Caption>
        Chance it works, money you need, what you could lose and how long it takes, blended into one 0–100 score — the same scale for a card switch, a stock or a bet.
      </Caption>
    </View>
  );
}

/* ------------------------------------------------------------------ slide 6: math */

/**
 * The formula, written out: the four factors on the spine with the weight each is
 * multiplied by, then three plain lines on what the number is not.
 */
export function MathPreview({ active }: PreviewProps): React.ReactElement {
  const theme = useTheme();
  const compact = useCompact();
  const rowHeight = compact ? 44 : 50;
  const rail = 56;

  return (
    <View className="flex-1 justify-center" style={{ opacity: active ? 1 : 0.98, paddingHorizontal: 6 }}>
      <ThemedText style={{ fontSize: 22, fontWeight: "900", color: theme.text, marginBottom: 6, marginLeft: 4, ...MONO }}>
        Score =
      </ThemedText>
      <View>
        <Spine rows={FACTORS_BY_WEIGHT.length} rowHeight={rowHeight} rail={rail} />
        {FACTORS_BY_WEIGHT.map((factor) => (
          <View key={factor.label} className="flex-row items-center" style={{ height: rowHeight, gap: 14 }}>
            <View style={{ width: rail, alignItems: "center" }}>
              <Mark glyph={factor.emoji} size={36} strength={0.16} />
            </View>
            <ThemedText style={{ flex: 1, fontSize: 14, fontWeight: "700", color: theme.text }} numberOfLines={1}>
              {factor.label}
            </ThemedText>
            <ThemedText style={{ fontSize: 14, fontWeight: "900", color: Brand[500], ...MONO }}>
              × {(factor.weight / 100).toFixed(2)}
            </ThemedText>
          </View>
        ))}
      </View>

      <View style={{ gap: 8, marginTop: 16, paddingHorizontal: 4 }}>
        {MATH_DISCLAIMER.map((line) => (
          <View key={line} className="flex-row items-start" style={{ gap: 10 }}>
            <View style={{ width: 5, height: 5, borderRadius: 999, backgroundColor: Brand[500], opacity: 0.5, marginTop: 7 }} />
            <ThemedText style={{ flex: 1, fontSize: 12.5, lineHeight: 18, color: theme.textSecondary }}>{line}</ThemedText>
          </View>
        ))}
      </View>
    </View>
  );
}
