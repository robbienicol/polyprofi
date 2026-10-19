import { View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { Brand, Radius } from "@/constants/theme";
import { useSemanticText, useTheme } from "@/hooks/use-theme";

export const MONO = { fontVariant: ["tabular-nums" as const] };

/**
 * `accent` marks a section whose contents are a different kind of thing from the rest of
 * the card, not merely a worse one — today that is the binary settlement block. Every
 * other section stays neutral, so the tint means something when it appears.
 */
export function Section({
  title,
  accent,
  children,
}: React.PropsWithChildren<{ title: string; accent?: string }>): React.ReactElement {
  const theme = useTheme();
  return (
    <View
      style={{
        borderRadius: Radius.lg,
        backgroundColor: accent ? accent + "0D" : theme.backgroundElement,
        borderWidth: 1,
        borderColor: accent ? accent + "40" : theme.border,
        padding: 13,
        gap: 12,
      }}
    >
      <ThemedText
        style={{ fontSize: 15, fontWeight: "800", color: theme.text }}
      >
        {title}
      </ThemedText>
      {children}
    </View>
  );
}
export function Divider(): React.ReactElement {
  const theme = useTheme();
  return (
    <View style={{ width: 1, height: 58, backgroundColor: theme.border }} />
  );
}
export function Metric({
  value,
  label,
  subLabel,
  valueColor = Brand[500],
}: {
  value: string;
  label: string;
  subLabel?: string;
  valueColor?: string;
}): React.ReactElement {
  const theme = useTheme();
  const semantic = useSemanticText();
  return (
    <View
      className="flex-1 items-center"
      style={{ gap: 3, paddingHorizontal: 2 }}
    >
      {/* minimumFontScale was 0.5, which let a 22pt figure render at 11pt — under the
          iOS floor, under DISPLAY_MIN_SIZE, and still in the serif. Asking for larger
          text made the one number the screen exists for smaller. */}
      <ThemedText
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.85}
        style={{
          fontSize: 22,
          lineHeight: 27,
          fontWeight: "900",
          color: valueColor,
          ...MONO,
        }}
      >
        {value}
      </ThemedText>
      <ThemedText
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
        style={{
          fontSize: 12,
          color: theme.textSecondary,
          fontWeight: "600",
          textAlign: "center",
        }}
      >
        {label}
      </ThemedText>
      {subLabel && (
        <ThemedText
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.8}
          style={{
            fontSize: 11,
            color: semantic.brand,
            fontWeight: "700",
            textAlign: "center",
          }}
        >
          {subLabel}
        </ThemedText>
      )}
    </View>
  );
}
export function RiskRow({
  label,
  value,
  percent,
  color,
}: {
  label: string;
  value: string;
  percent: number;
  color: string;
}): React.ReactElement {
  const theme = useTheme();
  return (
    <View className="flex-row items-center gap-3">
      <ThemedText
        style={{
          width: 92,
          fontSize: 13,
          color: theme.textSecondary,
          fontWeight: "600",
        }}
      >
        {label}
      </ThemedText>
      <View
        className="flex-1"
        style={{
          height: 6,
          // Never collapses to nothing when the value beside it is a long phrase
          // like "4.82% contractual yield" rather than "62%".
          minWidth: 40,
          borderRadius: Radius.pill,
          backgroundColor: theme.backgroundSelected,
          overflow: "hidden",
        }}
      >
        <View
          style={{
            width: `${Math.max(0, Math.min(100, percent))}%`,
            height: "100%",
            borderRadius: Radius.pill,
            backgroundColor: color,
          }}
        />
      </View>
      <ThemedText
        numberOfLines={2}
        style={{
          maxWidth: "46%",
          flexShrink: 0,
          textAlign: "right",
          fontSize: 13,
          color: theme.text,
          fontWeight: "800",
          ...MONO,
        }}
      >
        {value}
      </ThemedText>
    </View>
  );
}
export function Fact({
  label,
  value,
  subLabel,
}: {
  label: string;
  value: string;
  /** Optional smaller line under the value, for the input behind a derived number. */
  subLabel?: string;
}): React.ReactElement {
  const theme = useTheme();
  return (
    <View
      className="flex-1"
      style={{
        borderRadius: Radius.md,
        backgroundColor: theme.backgroundSelected,
        paddingHorizontal: 12,
        paddingVertical: 10,
      }}
    >
      <ThemedText
        style={{ fontSize: 11, color: theme.textSecondary, fontWeight: "800" }}
      >
        {label.toUpperCase()}
      </ThemedText>
      <ThemedText
        style={{
          fontSize: 13,
          color: theme.text,
          fontWeight: "800",
          marginTop: 4,
        }}
        numberOfLines={2}
      >
        {value}
      </ThemedText>
      {subLabel && (
        <ThemedText
          style={{ fontSize: 11, color: theme.textSecondary, marginTop: 2 }}
          numberOfLines={1}
        >
          {subLabel}
        </ThemedText>
      )}
    </View>
  );
}
export function Outcome({
  color,
  label,
  chance,
  value,
}: {
  color: string;
  label: string;
  chance: string;
  value: string;
}): React.ReactElement {
  const theme = useTheme();
  return (
    <View className="flex-row items-center gap-3">
      <View
        style={{
          width: 9,
          height: 9,
          borderRadius: 999,
          backgroundColor: color,
        }}
      />
      <View className="flex-1">
        <ThemedText
          style={{ fontSize: 13, fontWeight: "700", color: theme.text }}
        >
          {label}
        </ThemedText>
        <ThemedText style={{ fontSize: 11, color: theme.textTertiary }}>
          {chance}
        </ThemedText>
      </View>
      <ThemedText style={{ fontSize: 15, fontWeight: "900", color, ...MONO }}>
        {value}
      </ThemedText>
    </View>
  );
}
