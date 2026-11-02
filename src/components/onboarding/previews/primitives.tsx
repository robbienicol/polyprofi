import React from "react";
import { View, useWindowDimensions } from "react-native";
import { type LucideIcon } from "lucide-react-native";
import Svg, { Line } from "react-native-svg";

import { SCORE_FACTORS } from "@/components/onboarding/onboarding-data";
import { ThemedText } from "@/components/themed-text";
import { Icon } from "@/components/ui/Icon";
import { Brand } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

export const MONO = { fontVariant: ["tabular-nums" as const] };

/**
 * `active` is true only for the slide currently on screen. Previews use it to replay
 * their reveal when the user lands on them — an animation that already finished while
 * the user was three slides back is a wasted one — and to idle when off screen.
 */
export interface PreviewProps {
  active: boolean;
}

/** Small phones (SE-class) tighten rows and drop the optional ones rather than squeezing. */
export function useCompact(): boolean {
  const { height } = useWindowDimensions();
  return height > 0 && height < 740;
}

/* ------------------------------------------------------------------ primitives */

/*
 * Every slide is an illustration, never a mock of a control. Earlier versions drew
 * framed panels of bordered rows, drag handles, chips and a Send button — a slice of
 * UI on a screen where nothing can be touched, so people tried to touch it. The
 * shared vocabulary now: soft orange marks with line icons, a dotted spine that
 * ties them together, plain text beside them, and one quiet caption underneath.
 */


/** A soft round mark holding a line icon. `strength` 0–1 sets how strongly it is tinted. */
export function Mark({
  glyph,
  icon,
  size,
  strength = 0.2,
  color = Brand[500],
  muted = false,
}: {
  glyph?: string;
  icon?: LucideIcon;
  size: number;
  strength?: number;
  color?: string;
  muted?: boolean;
}): React.ReactElement {
  const theme = useTheme();
  const alpha = Math.round(Math.min(1, Math.max(0, strength)) * 255)
    .toString(16)
    .padStart(2, "0");
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: 999,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: theme.background,
      }}
    >
      <View
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: 999,
          backgroundColor: muted ? theme.backgroundSelected : color + alpha,
        }}
      />
      <Icon
        glyph={glyph}
        icon={icon}
        size={Math.round(size * 0.42)}
        color={muted ? theme.textTertiary : color}
        strokeWidth={1.75}
      />
    </View>
  );
}

/** The dotted line a column of marks hangs on, from the first row's centre to the last's. */
export function Spine({
  rows,
  rowHeight,
  rail,
}: {
  rows: number;
  rowHeight: number;
  rail: number;
}): React.ReactElement {
  return (
    <Svg
      width={rail}
      height={rowHeight * rows}
      style={{ position: "absolute", left: 0, top: 0 }}
      pointerEvents="none"
    >
      <Line
        x1={rail / 2}
        y1={rowHeight / 2}
        x2={rail / 2}
        y2={rowHeight * (rows - 1) + rowHeight / 2}
        stroke={Brand[500]}
        strokeOpacity={0.35}
        strokeWidth={2}
        strokeLinecap="round"
        strokeDasharray="0.1 6"
      />
    </Svg>
  );
}

/** Label over a one- or two-line explanation — the text beside every mark. */
export function MarkText({
  title,
  note,
  lead,
}: {
  title: string;
  note?: string;
  lead?: string;
}): React.ReactElement {
  const theme = useTheme();
  return (
    <View className="flex-1" style={{ gap: 2 }}>
      <ThemedText
        style={{ fontSize: 14, fontWeight: "800", color: theme.text }}
        numberOfLines={1}
      >
        {lead ? (
          <ThemedText style={{ color: Brand[500], ...MONO }}>
            {lead}
            {"  "}
          </ThemedText>
        ) : null}
        {title}
      </ThemedText>
      {note ? (
        <ThemedText
          style={{ fontSize: 12, lineHeight: 16, color: theme.textSecondary }}
          numberOfLines={2}
        >
          {note}
        </ThemedText>
      ) : null}
    </View>
  );
}

/** The one quiet line under an illustration. */
export function Caption({ children }: { children: React.ReactNode }): React.ReactElement {
  const theme = useTheme();
  return (
    <ThemedText
      style={{
        fontSize: 11.5,
        lineHeight: 16,
        color: theme.textTertiary,
        textAlign: "center",
        marginTop: 14,
        paddingHorizontal: 12,
      }}
    >
      {children}
    </ThemedText>
  );
}

/** The score factors heaviest first — the order they actually count in, by default. */
export const FACTORS_BY_WEIGHT = [...SCORE_FACTORS].sort((a, b) => b.weight - a.weight);
