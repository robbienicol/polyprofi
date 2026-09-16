import { View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { MetricInfo } from "@/components/ui/MetricInfo";
import { Radius, Semantic, Shadow } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import type { CalibrationReading } from "@/lib/calibration";
import type { VenueCalibration } from "@/lib/route-calibration";

/**
 * What happened to the markets that were priced like this one.
 *
 * The card exists because a prediction-market price is a claim about the world that
 * can be marked: 91¢ says 91% likely, and settled markets say how often that came
 * true. So the headline is the price and the realised rate side by side, and the bar
 * underneath shows the realised rate as the *band* the evidence supports rather than
 * a single confident number — with the price marked on the same scale, so whether it
 * sits inside or outside the band is the whole reading, at a glance.
 *
 * Deliberately not a recommendation. Every figure here describes a group of past
 * markets; this one has its own answer coming and the copy never implies otherwise.
 */
export function TrackRecordCard({
  primary,
  venues,
}: {
  primary: VenueCalibration;
  venues: readonly VenueCalibration[];
}): React.ReactElement {
  const theme = useTheme();
  const { reading } = primary;
  const tone = verdictTone(reading.verdict);

  // Most picks are priced about right, and a full card saying so on every one of them
  // trains people to scroll past this spot — which is exactly the spot that has to catch
  // the eye on the pick where the price is off. So an in-line reading gets one quiet line.
  if (reading.verdict === "in_line") {
    return (
      <View
        style={{
          borderRadius: Radius.xl,
          backgroundColor: theme.backgroundElevated,
          borderWidth: 1,
          borderColor: theme.border,
          paddingHorizontal: 16,
          paddingVertical: 13,
          gap: 4,
        }}
      >
        <View className="flex-row items-center" style={{ gap: 6 }}>
          <ThemedText style={{ fontSize: 13, fontWeight: "700", color: theme.text, flex: 1 }}>
            Priced about where markets like this have landed
          </ThemedText>
          <MetricInfo metric="historicalHitRate" size={15} />
        </View>
        <ThemedText style={{ fontSize: 11.5, lineHeight: 16, color: theme.textTertiary }}>
          {reading.sampleSize} settled markets — {reading.cohortLabel} — resolved{" "}
          {Math.round(reading.hitRatePct)}% of the time, against this pick&apos;s{" "}
          {formatCents(reading.priceCents)}¢.
        </ThemedText>
      </View>
    );
  }

  return (
    <View
      style={{
        borderRadius: Radius.xl,
        backgroundColor: theme.backgroundElevated,
        borderWidth: 1,
        borderColor: theme.border,
        padding: 16,
        gap: 14,
        ...Shadow.card,
      }}
    >
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center" style={{ gap: 6 }}>
          <ThemedText style={{ fontSize: 15, fontWeight: "800", color: theme.text }}>
            Track record
          </ThemedText>
          <MetricInfo metric="historicalHitRate" size={17} />
        </View>
        <View
          style={{
            paddingHorizontal: 10,
            paddingVertical: 5,
            borderRadius: Radius.pill,
            backgroundColor: tone.color + "20",
          }}
        >
          <ThemedText style={{ fontSize: 11, fontWeight: "900", color: tone.color }}>
            {tone.badge}
          </ThemedText>
        </View>
      </View>

      <View className="flex-row items-center" style={{ gap: 10 }}>
        <Figure label="PRICED AT" value={`${formatCents(reading.priceCents)}¢`} color={theme.text} />
        <ThemedText style={{ fontSize: 18, color: theme.textTertiary }}>→</ThemedText>
        <Figure
          label="ACTUALLY HAPPENED"
          value={`${Math.round(reading.hitRatePct)}%`}
          color={tone.color}
        />
      </View>

      <IntervalBar reading={reading} tone={tone.color} />

      <ThemedText style={{ fontSize: 11.5, lineHeight: 16, color: theme.textTertiary }}>
        From {reading.sampleSize} settled markets — {reading.cohortLabel}.
        The bar is the range the true rate is very likely to sit in; the marker is this
        pick's price on the same scale.
      </ThemedText>

      <View style={{ height: 1, backgroundColor: theme.border }} />

      <View className="flex-row items-center" style={{ gap: 6 }}>
        <ThemedText style={{ fontSize: 13, fontWeight: "800", color: theme.text }}>
          Buying every one of them
        </ThemedText>
        <MetricInfo metric="historicalReturn" size={15} />
      </View>

      {venues.map((venue) => (
        <VenueReturnRow key={venue.venue} venue={venue} />
      ))}

      <ThemedText style={{ fontSize: 11.5, lineHeight: 16, color: theme.textTertiary }}>
        Return per market, after estimated fees, on the group above — not a forecast for
        this pick, and not a return over time. This market has its own outcome coming and
        can land either way.
      </ThemedText>
    </View>
  );
}

function Figure({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
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
        gap: 2,
      }}
    >
      <ThemedText style={{ fontSize: 10, fontWeight: "800", color: theme.textTertiary }}>
        {label}
      </ThemedText>
      <ThemedText style={{ fontSize: 22, fontWeight: "900", color }}>{value}</ThemedText>
    </View>
  );
}

/**
 * The realised rate as a band, with the pick's price marked on the same axis.
 *
 * Scaled to a window around whichever of the two sits furthest out rather than to a
 * full 0–100%, because almost every pick clusters at one end and a full-width axis
 * would squash the only part anyone needs to see into a few pixels.
 */
function IntervalBar({
  reading,
  tone,
}: {
  reading: CalibrationReading;
  tone: string;
}): React.ReactElement {
  const theme = useTheme();
  const [low, high] = reading.intervalPct;
  const windowLow = Math.max(0, Math.min(low, reading.priceCents) - 8);
  const windowHigh = Math.min(100, Math.max(high, reading.priceCents) + 8);
  const span = Math.max(windowHigh - windowLow, 1);
  const position = (value: number) => ((value - windowLow) / span) * 100;

  return (
    <View style={{ gap: 6 }}>
      <View
        style={{
          height: 10,
          borderRadius: Radius.pill,
          backgroundColor: theme.backgroundSelected,
          overflow: "hidden",
        }}
      >
        <View
          style={{
            position: "absolute",
            left: `${position(low)}%`,
            width: `${position(high) - position(low)}%`,
            top: 0,
            bottom: 0,
            backgroundColor: tone + "55",
          }}
        />
        <View
          style={{
            position: "absolute",
            left: `${position(reading.priceCents)}%`,
            width: 3,
            top: 0,
            bottom: 0,
            marginLeft: -1.5,
            backgroundColor: theme.text,
          }}
        />
      </View>
      <View className="flex-row justify-between">
        <ThemedText style={{ fontSize: 10, color: theme.textTertiary, fontWeight: "700" }}>
          {Math.round(low)}%
        </ThemedText>
        <ThemedText style={{ fontSize: 10, color: theme.textTertiary, fontWeight: "700" }}>
          {Math.round(high)}%
        </ThemedText>
      </View>
    </View>
  );
}

function VenueReturnRow({ venue }: { venue: VenueCalibration }): React.ReactElement {
  const theme = useTheme();
  const net = venue.reading.trackRecord.netReturnPct;
  const color = net > 0 ? Semantic.positive : net < 0 ? Semantic.negative : theme.textSecondary;
  return (
    <View className="flex-row items-center justify-between">
      <View className="flex-row items-baseline" style={{ gap: 6, flex: 1 }}>
        <ThemedText style={{ fontSize: 13, fontWeight: "700", color: theme.text }}>
          {venue.label}
        </ThemedText>
        {venue.routedVia ? (
          <ThemedText style={{ fontSize: 10.5, color: theme.textTertiary }}>
            fills on {venue.routedVia}
          </ThemedText>
        ) : null}
      </View>
      <ThemedText style={{ fontSize: 15, fontWeight: "900", color }}>
        {formatSignedPercent(net)}
      </ThemedText>
    </View>
  );
}

function verdictTone(verdict: CalibrationReading["verdict"]): { color: string; badge: string } {
  switch (verdict) {
    case "rich":
      return { color: Semantic.negative, badge: "PRICED ABOVE ITS HISTORY" };
    case "cheap":
      return { color: Semantic.positive, badge: "PRICED BELOW ITS HISTORY" };
    case "in_line":
      return { color: Semantic.info, badge: "IN LINE WITH HISTORY" };
  }
}

/** Matches the typographic minus the rest of the app uses for money, not a hyphen. */
function formatSignedPercent(value: number): string {
  const sign = value > 0 ? "+" : value < 0 ? "\u2212" : "";
  return `${sign}${Math.abs(value).toFixed(1)}%`;
}

function formatCents(cents: number): string {
  return Number.isInteger(cents) ? String(cents) : cents.toFixed(1);
}
