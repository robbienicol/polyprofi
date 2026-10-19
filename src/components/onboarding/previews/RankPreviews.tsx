import React from "react";
import { View } from "react-native";

import { BREAKDOWN_FACTORS, RANKED_PREVIEW } from "@/components/onboarding/onboarding-data";
import { ScoreRing } from "@/components/onboarding/previews/motion";
import {
  Caption,
  Mark,
  MarkText,
  MONO,
  Spine,
  useCompact,
  type PreviewProps,
} from "@/components/onboarding/previews/primitives";
import { ThemedText } from "@/components/themed-text";
import { Semantic } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

/* ------------------------------------------------------------------ slide 2: rank */

// Same good / fair / poor bands as the real route card's score badge.
const scoreColor = (score: number): string =>
  score >= 75 ? Semantic.positive : score >= 50 ? Semantic.caution : Semantic.negative;

/**
 * One board for everything: each option as a mark on the spine with its score as
 * a small ring, highest first — so a spending cut sitting above a stock is
 * something you see rather than read.
 */
export function RankPreview({ active }: PreviewProps): React.ReactElement {
  const compact = useCompact();
  const rowHeight = compact ? 52 : 60;
  const rail = 56;

  return (
    <View className="flex-1 justify-center" style={{ opacity: active ? 1 : 0.98, paddingHorizontal: 6 }}>
      <View>
        <Spine rows={RANKED_PREVIEW.length} rowHeight={rowHeight} rail={rail} />
        {RANKED_PREVIEW.map((row, index) => (
          <View key={row.name} className="flex-row items-center" style={{ height: rowHeight, gap: 14 }}>
            <View style={{ width: rail, alignItems: "center" }}>
              <Mark glyph={row.emoji} size={42} strength={0.2 - index * 0.025} />
            </View>
            <MarkText
              title={row.name}
              note={row.guaranteed ? row.note : `${row.platform} · ${row.note}`}
            />
            <ScoreRing score={row.score} size={40} stroke={3.5} color={scoreColor(row.score)} fontSize={13} />
          </View>
        ))}
      </View>
      <Caption>
        Spending smarter, saving and investing on the same board, best score first. Using the right card can outrank a stock.
      </Caption>
    </View>
  );
}

/* ------------------------------------------------------------------ slide 3: breakdown */

/**
 * What opening a pick shows: the pick itself, then each fact behind its score on
 * the spine, and what happens if it goes wrong — nothing kept back.
 */
export function BreakdownPreview({ active }: PreviewProps): React.ReactElement {
  const theme = useTheme();
  const compact = useCompact();
  const rowHeight = compact ? 46 : 52;
  const rail = 56;

  return (
    <View className="flex-1 justify-center" style={{ opacity: active ? 1 : 0.98, paddingHorizontal: 6 }}>
      <View className="flex-row items-center" style={{ gap: 14, marginBottom: 12 }}>
        <View style={{ width: rail, alignItems: "center" }}>
          <Mark glyph="📈" size={54} strength={0.22} />
        </View>
        <View className="flex-1">
          <ThemedText style={{ fontSize: 22, fontWeight: "900", color: theme.text, letterSpacing: -0.4 }}>VOO</ThemedText>
          <ThemedText style={{ fontSize: 12, color: theme.textSecondary }}>A fund that owns the S&amp;P 500</ThemedText>
        </View>
      </View>

      <View>
        <Spine rows={BREAKDOWN_FACTORS.length} rowHeight={rowHeight} rail={rail} />
        {BREAKDOWN_FACTORS.map((factor) => (
          <View key={factor.label} className="flex-row items-center" style={{ height: rowHeight, gap: 14 }}>
            <View style={{ width: rail, alignItems: "center" }}>
              <Mark glyph={factor.emoji} size={34} strength={0.14} />
            </View>
            <ThemedText style={{ flex: 1, fontSize: 13, color: theme.textSecondary }} numberOfLines={1}>
              {factor.label}
            </ThemedText>
            <ThemedText style={{ fontSize: 14, fontWeight: "800", color: theme.text, ...MONO }} numberOfLines={1}>
              {factor.value}
            </ThemedText>
          </View>
        ))}
      </View>

      {compact ? null : (
        <View className="flex-row items-start" style={{ gap: 14, marginTop: 10 }}>
          <View style={{ width: rail, alignItems: "center" }}>
            <Mark glyph="⚠️" size={34} strength={0.16} color={Semantic.caution} />
          </View>
          <ThemedText style={{ flex: 1, fontSize: 12, lineHeight: 17, color: theme.textSecondary, paddingTop: 1 }}>
            <ThemedText style={{ fontWeight: "800", color: theme.text }}>If it goes against you: </ThemedText>
            the fund drops for a while, but it doesn&apos;t go to zero. Picks that can lose everything say so right here.
          </ThemedText>
        </View>
      )}
      <Caption>Every number shows where it came from and when it was checked.</Caption>
    </View>
  );
}
