import { Pressable, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { Brand, Radius, Semantic } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import type { TradeVenue } from "@/lib/route-actions";

/**
 * Every venue that lists this exact contract, not just the one we would have
 * picked. Two order books on the same outcome genuinely differ in price, and
 * showing both turns the CTA from "act here" into "here is where you can look
 * at this, and here is what it costs at each".
 */
export function TradeVenues({
  venues,
  onOpen,
}: {
  venues: TradeVenue[];
  onOpen: (venue: TradeVenue) => void;
}): React.ReactElement {
  const theme = useTheme();
  return (
    <View style={{ gap: 8 }}>
      <View className="flex-row" style={{ gap: 8 }}>
        {venues.map((venue) => (
          <TradeLink
            key={venue.destination}
            venue={venue}
            onPress={() => onOpen(venue)}
          />
        ))}
      </View>
      {venues.length > 1 ? (
        <ThemedText
          style={{ fontSize: 11, lineHeight: 16, color: theme.textTertiary, textAlign: "center" }}
        >
          Same contract on both venues, priced net of estimated fees. Ranked on price
          alone — Pathey earns nothing from either.
        </ThemedText>
      ) : null}
    </View>
  );
}

function TradeLink({
  venue,
  onPress,
}: {
  venue: TradeVenue;
  onPress: () => void;
}): React.ReactElement {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      accessibilityLabel={
        venue.priceCents != null
          ? `Open ${venue.label}, ${venue.priceCents} cents${venue.cheapest ? ", cheapest" : ""}`
          : `Open ${venue.label}`
      }
      className="flex-1 active:opacity-75"
      style={{
        borderRadius: Radius.md,
        paddingVertical: 10,
        paddingHorizontal: 8,
        alignItems: "center",
        gap: 2,
        backgroundColor: venue.cheapest ? Semantic.positive + "14" : theme.backgroundElement,
        borderWidth: 1,
        borderColor: venue.cheapest ? Semantic.positive : theme.border,
      }}
    >
      <ThemedText
        style={{ fontSize: 13, fontWeight: "800", color: Brand[500] }}
      >
        Open {venue.label} ↗
      </ThemedText>
      {venue.priceCents != null ? (
        <ThemedText
          style={{
            fontSize: 11,
            fontWeight: "700",
            color: venue.cheapest ? Semantic.positive : theme.textTertiary,
            fontVariant: ["tabular-nums"],
          }}
        >
          {venue.priceCents}¢{venue.cheapest ? " · cheapest" : ""}
        </ThemedText>
      ) : null}
      {venue.feeCents != null ? (
        <ThemedText
          style={{ fontSize: 10, color: theme.textTertiary, fontVariant: ["tabular-nums"] }}
        >
          {venue.feeCents > 0 ? `+${venue.feeCents}¢ fee` : "no fee"}
        </ThemedText>
      ) : null}
    </Pressable>
  );
}
