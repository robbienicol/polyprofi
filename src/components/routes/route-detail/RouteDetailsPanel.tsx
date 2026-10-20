import { Pressable, View } from "react-native";

import type { useMarketComparison } from "@/api/hooks/useMarketComparison";
import { MarketComparisonCard } from "@/components/routes/MarketComparisonCard";
import { RouteDetails } from "@/components/routes/route-opportunity/RouteDetails";
import { ScoreMathCard } from "@/components/routes/ScoreMathCard";
import { TrackRecordCard } from "@/components/routes/TrackRecordCard";
import { ThemedText } from "@/components/themed-text";
import { Brand, Radius } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import type { routeDetailModel } from "@/components/routes/route-detail/route-detail-model";

type DetailModel = ReturnType<typeof routeDetailModel>;

/**
 * Folded, not removed: the score's working, the yield sources and the market
 * depth are what an experienced investor checks, and noise to everyone else.
 */
export function RouteDetailsPanel({
  open,
  onToggle,
  model,
  comparison,
  onChangeWeights,
}: {
  open: boolean;
  onToggle: () => void;
  model: DetailModel;
  comparison: ReturnType<typeof useMarketComparison>["comparison"];
  onChangeWeights: () => void;
}): React.ReactElement {
  const theme = useTheme();
  const { route, stake, goalDeadlineDays, primaryTrackRecord, calibrations, scoreBreakdown, neededToHitGoal, availableInvestment } = model;
  return (
    <>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        className="flex-row items-center justify-between active:opacity-70"
        style={{
          borderRadius: Radius.lg,
          borderWidth: 1,
          borderColor: theme.border,
          backgroundColor: theme.backgroundElement,
          paddingHorizontal: 14,
          paddingVertical: 14,
        }}
      >
        <View style={{ flex: 1, gap: 2 }}>
          <ThemedText style={{ fontSize: 14, fontWeight: "800", color: theme.text }}>
            {open ? "Hide the details" : "See the details"}
          </ThemedText>
          <ThemedText style={{ fontSize: 12, color: theme.textSecondary }}>
            Score breakdown, rates, sources and the fine print
          </ThemedText>
        </View>
        <ThemedText style={{ fontSize: 18, color: theme.textSecondary }}>
          {open ? "−" : "+"}
        </ThemedText>
      </Pressable>

      {open ? (
        <>
          <RouteDetails route={route} stake={stake} deadlineDays={goalDeadlineDays} />

          {comparison ? <MarketComparisonCard comparison={comparison} /> : null}

          {primaryTrackRecord ? (
            <TrackRecordCard primary={primaryTrackRecord} venues={calibrations} />
          ) : null}

          {/* The score, and the arithmetic behind it. This is the screen where money
              gets committed, so the weighting the number came from is shown here
              rather than left on the results list. */}
          <ScoreMathCard
            scoreBreakdown={scoreBreakdown}
            requiredInvestment={neededToHitGoal}
            availableInvestment={availableInvestment}
          />
          <Pressable
            onPress={onChangeWeights}
            accessibilityRole="button"
            className="active:opacity-70"
            hitSlop={6}
          >
            <ThemedText
              style={{ fontSize: 11, lineHeight: 16, color: theme.textTertiary, textAlign: "center" }}
            >
              Scored on what you said matters:{" "}
              {Math.round(scoreBreakdown.weights.reliability * 100)}% chance ·{" "}
              {Math.round(scoreBreakdown.weights.principalProtection * 100)}% safety ·{" "}
              {Math.round(scoreBreakdown.weights.capitalEfficiency * 100)}% capital ·{" "}
              {Math.round(scoreBreakdown.weights.timeEfficiency * 100)}% time.{" "}
              <ThemedText style={{ fontSize: 11, fontWeight: "800", color: Brand[500] }}>
                Change it
              </ThemedText>
            </ThemedText>
          </Pressable>

        </>
      ) : null}
    </>
  );
}
