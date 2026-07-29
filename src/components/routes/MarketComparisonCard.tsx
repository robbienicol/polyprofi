import { View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { Brand, Radius, Shadow } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import type { MarketComparison } from "@/lib/market-comparison";

interface MarketComparisonCardProps {
  comparison: MarketComparison;
}

export function MarketComparisonCard({
  comparison,
}: MarketComparisonCardProps): React.ReactElement {
  const theme = useTheme();
  const { betterPlatform, edgeCents } = comparison;

  return (
    <View
      style={{
        borderRadius: Radius.xl,
        backgroundColor: theme.backgroundElevated,
        borderWidth: 1,
        borderColor: theme.border,
        padding: 16,
        gap: 12,
        ...Shadow.card,
      }}
    >
      <View className="flex-row items-center justify-between">
        <ThemedText style={{ fontSize: 15, fontWeight: "800", color: theme.text }}>
          Kalshi vs Polymarket
        </ThemedText>
        {betterPlatform !== "tie" && (
          <View
            style={{
              paddingHorizontal: 10,
              paddingVertical: 5,
              borderRadius: Radius.pill,
              backgroundColor: Brand[500] + "20",
            }}
          >
            <ThemedText style={{ fontSize: 11, fontWeight: "900", color: Brand[500] }}>
              +{edgeCents}¢ ON {betterPlatform.toUpperCase()}
            </ThemedText>
          </View>
        )}
      </View>

      <View className="flex-row gap-2">
        <PlatformRow
          label="Polymarket"
          priceCents={Math.round(comparison.polymarketPrice * 100)}
          highlighted={betterPlatform === "polymarket"}
        />
        <PlatformRow
          label="Kalshi"
          priceCents={Math.round(comparison.kalshiPrice * 100)}
          highlighted={betterPlatform === "kalshi"}
        />
      </View>

      <ThemedText style={{ fontSize: 11.5, lineHeight: 16, color: theme.textTertiary }}>
        Same-side price to enter this bet on each platform, net of an estimated
        Kalshi trading fee (Polymarket has no explicit trading fee, so its cost
        is really the bid/ask spread). Directional signal only, not exact.
      </ThemedText>
    </View>
  );
}

function PlatformRow({
  label,
  priceCents,
  highlighted,
}: {
  label: string;
  priceCents: number;
  highlighted: boolean;
}): React.ReactElement {
  const theme = useTheme();
  return (
    <View
      className="flex-1"
      style={{
        borderRadius: Radius.md,
        backgroundColor: highlighted ? Brand[500] + "18" : theme.backgroundSelected,
        borderWidth: highlighted ? 1 : 0,
        borderColor: Brand[500],
        paddingHorizontal: 12,
        paddingVertical: 10,
        gap: 2,
      }}
    >
      <ThemedText style={{ fontSize: 10, color: theme.textTertiary, fontWeight: "800" }}>
        {label.toUpperCase()}
      </ThemedText>
      <ThemedText
        style={{
          fontSize: 20,
          fontWeight: "900",
          color: highlighted ? Brand[500] : theme.text,
        }}
      >
        {priceCents}¢
      </ThemedText>
    </View>
  );
}

