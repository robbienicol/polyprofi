import { View } from "react-native";

import {
  formatMaturity,
  formatProbability,
  displayRiskLevel,
  riskColor,
  riskLabel,
} from "@/components/molecules/RouteCard";
import { Divider, Metric, MONO } from "@/components/routes/route-opportunity/card-parts";
import { riskInPlainWords, worstCase } from "@/components/routes/route-opportunity/risk-words";
import { Icon } from "@/components/ui/Icon";
import { ThemedText } from "@/components/themed-text";
import { Radius, Semantic, Shadow } from "@/constants/theme";
import { useSemanticText, useTheme } from "@/hooks/use-theme";
import { routeDisplayTitle } from "@/lib/route-detail";
import { isDebtRoute } from "@/lib/route-investment-metrics";
import { maturityWords } from "@/lib/portfolio";
import type { Route } from "@/types/routes";

export { RouteDetails } from "@/components/routes/route-opportunity/RouteDetails";

interface RouteOpportunityCardProps {
  route: Route;
  stake: number;
  neededToHitGoal: number | null;
  /** Calendar days until the user's goal deadline, when a goal is in context. */
  deadlineDays?: number | null;
}

export function RouteOpportunityCard({
  route,
  stake,
  neededToHitGoal,
  deadlineDays,
}: RouteOpportunityCardProps): React.ReactElement {
  const theme = useTheme();
  const semantic = useSemanticText();
  const shownRisk = displayRiskLevel(route);
  const color = riskColor(shownRisk);
  const binary = route.lossProfile === "binary";
  const debt = isDebtRoute(route);
  const returnPeriodDays = route.maturesInDays ?? deadlineDays ?? null;
  const question = /“([^”]+)”/.exec(route.description)?.[1] ?? null;
  const traded = /(\$[\d.,]+[KMB]?) traded/.exec(route.description)?.[1] ?? null;
  const title = routeDisplayTitle(route);
  // The description often just restates the title with a full stop; showing both
  // was the first thing that made this screen read as a wall of text.
  const description = route.description.replace(/\.$/, "").trim() === title.replace(/\.$/, "").trim()
    ? null
    : route.description;
  const short = neededToHitGoal != null && neededToHitGoal > stake;
  const worst = worstCase(route, stake, debt);

  return (
    <View
      style={{
        borderRadius: Radius.xl,
        overflow: "hidden",
        backgroundColor: theme.backgroundElevated,
        borderWidth: 1,
        borderColor: theme.border,
        padding: 16,
        gap: 16,
        ...Shadow.card,
      }}
    >
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          <View
            style={{
              paddingHorizontal: 12,
              paddingVertical: 7,
              borderRadius: Radius.pill,
              backgroundColor: color + "18",
            }}
          >
            <ThemedText style={{ fontSize: 11, color, fontWeight: "900" }}>
              {riskLabel(shownRisk).toUpperCase()}
            </ThemedText>
          </View>
          {route.maturesInDays ? (
            <View
              style={{
                paddingHorizontal: 10,
                paddingVertical: 7,
                borderRadius: Radius.pill,
                backgroundColor: theme.backgroundElement,
                borderWidth: 1,
                borderColor: theme.border,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Icon glyph="⏳" size={11} color={theme.textSecondary} strokeWidth={2.4} />
                <ThemedText style={{ fontSize: 11, color: theme.textSecondary, fontWeight: "800" }}>
                  {formatMaturity(route.maturesInDays)}
                </ThemedText>
              </View>
            </View>
          ) : null}
        </View>
        <ThemedText numberOfLines={1} style={{ flexShrink: 1, fontSize: 13, color: semantic.brand, fontWeight: "700", marginLeft: 8 }}>
          {route.platform || route.category}
        </ThemedText>
      </View>

      {question ? (
        <View style={{ gap: 6 }}>
          <ThemedText style={{ fontSize: 13, fontWeight: "800", color: semantic.brand, ...MONO }}>
            {`Buy ${title}${traded ? ` · ${traded} traded` : ""}`}
          </ThemedText>
          <ThemedText style={{ fontSize: 20, lineHeight: 26, fontWeight: "800", color: theme.text, letterSpacing: -0.2 }}>
            {question}
          </ThemedText>
        </View>
      ) : (
        <View style={{ gap: 6 }}>
          <ThemedText style={{ fontSize: 20, lineHeight: 26, fontWeight: "800", color: theme.text, letterSpacing: -0.2 }}>
            {title}
          </ThemedText>
          {description ? (
            <ThemedText style={{ fontSize: 13, lineHeight: 18, color: theme.textSecondary }}>
              {description}
            </ThemedText>
          ) : null}
        </View>
      )}

      {/* The whole trade in one line a first-timer can read: money in, money out,
          and when. Everything else on the screen is detail behind this. */}
      {route.noCapitalRequired ? null : (
        <View
          className="flex-row items-center"
          style={{ borderRadius: Radius.lg, backgroundColor: theme.backgroundElement, padding: 14, gap: 10 }}
        >
          <View className="flex-1" style={{ gap: 2 }}>
            <ThemedText style={{ fontSize: 11, fontWeight: "800", letterSpacing: 0.5, color: theme.textTertiary }}>
              YOU PUT IN
            </ThemedText>
            <ThemedText numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85} style={{ fontSize: 22, lineHeight: 28, fontWeight: "900", color: theme.text, ...MONO }}>
              ${stake.toLocaleString()}
            </ThemedText>
          </View>
          <ThemedText style={{ fontSize: 20, color: theme.textTertiary }}>→</ThemedText>
          <View className="flex-1 items-end" style={{ gap: 2 }}>
            <ThemedText style={{ fontSize: 11, fontWeight: "800", letterSpacing: 0.5, color: theme.textTertiary }}>
              {binary ? "IF IT WINS" : "YOU GET BACK"}
            </ThemedText>
            <ThemedText numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85} style={{ fontSize: 22, lineHeight: 28, fontWeight: "900", color: theme.text, ...MONO }}>
              ${Math.round(stake + route.expectedReturn).toLocaleString()}
            </ThemedText>
            {returnPeriodDays != null ? (
              <ThemedText style={{ fontSize: 11, fontWeight: "700", color: semantic.brand }}>
                in {maturityWords(returnPeriodDays)}
              </ThemedText>
            ) : null}
          </View>
        </View>
      )}

      <View className="flex-row items-start">
        <Metric
          value={route.meetsTarget ? formatProbability(route.probability) : "No"}
          label={route.meetsTarget ? "Chance it works" : "Hits goal"}
          valueColor={theme.text}
        />
        <Divider />
        {/* Ink, not green: this is a projection, not a gain that happened. */}
        <Metric
          value={`+$${route.expectedReturn.toLocaleString()}`}
          label="Profit"
          valueColor={theme.text}
        />
        <Divider />
        <Metric value={worst.value} label="Worst case" subLabel={worst.note} valueColor={theme.text} />
      </View>

      {short ? (
        <ThemedText style={{ fontSize: 13, lineHeight: 18, fontWeight: "700", color: semantic.caution }}>
          Needs ${neededToHitGoal.toLocaleString()} to hit your goal. You set ${stake.toLocaleString()}.
        </ThemedText>
      ) : null}

      <View className="flex-row" style={{ gap: 10 }}>
        <Icon glyph={binary ? "⚠️" : "🛡"} size={16} color={binary ? Semantic.negative : theme.textSecondary} />
        <ThemedText style={{ flex: 1, fontSize: 13.5, lineHeight: 19, color: theme.textSecondary }}>
          {riskInPlainWords(route, stake, debt)}
        </ThemedText>
      </View>
    </View>
  );
}
