import { View } from "react-native";

import { formatMaturity } from "@/components/molecules/RouteCard";
import { Fact, Section } from "@/components/routes/route-opportunity/card-parts";
import { Icon } from "@/components/ui/Icon";
import { ThemedText } from "@/components/themed-text";
import { Radius, Semantic } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import {
  deadlineFitLabel,
  debtLiquidityLabel,
  debtYieldLabel,
} from "@/lib/route-investment-metrics";
import type { Route } from "@/types/routes";

/** Yield, term, issuer and terms: what decides a debt route, in place of a risk breakdown. */
export function InvestmentFacts({
  route,
  stake,
  deadlineDays,
}: {
  route: Route;
  stake: number;
  deadlineDays?: number | null;
}): React.ReactElement {
  const theme = useTheme();
  // The fund fee is levied on the yield, so net is what the user actually earns.
  const grossYieldPct = route.investmentFacts?.yieldPct;
  const expenseRatioPct = route.investmentFacts?.expenseRatioPct;
  const netYieldPct = grossYieldPct != null && expenseRatioPct != null
    ? Math.max(0, grossYieldPct - expenseRatioPct)
    : null;
  // A bill or CD fixes its rate the moment you buy; a savings account or a bond fund
  // does not. The distinction decides whether the quoted yield is a promise or a
  // snapshot, so it is read off the yield's own label rather than guessed.
  const rateFixed = /coupon-equivalent|contractual|locked|fixed/i.test(
    route.investmentFacts?.yieldLabel ?? "",
  );
  const yieldIsEstimate = route.investmentFacts?.yieldIsEstimate === true
    // Older saved batches carry the caveat in the label rather than the flag.
    || /proxy|not a live/i.test(route.investmentFacts?.yieldLabel ?? "");
  // A bill that pays out after the goal date is the wrong instrument however good
  // the yield is, so the comparison is stated rather than left to the user.
  const deadlineFit = deadlineFitLabel(route.maturesInDays, deadlineDays);

  return (
    <Section title="Investment Facts">
      <View className="flex-row gap-2">
        <Fact
          label="Yield (annual)"
          value={debtYieldLabel(route, stake) ?? "Check quote"}
          subLabel={route.investmentFacts?.projectionBasis}
        />
        <Fact
          label="Maturity"
          value={
            route.maturesInDays
              ? formatMaturity(route.maturesInDays)
              : "Flexible"
          }
        />
      </View>
      <View className="flex-row gap-2">
        <Fact
          label="Capital risk"
          value={
            route.lossProfile === "partial"
              ? "Capital preservation"
              : "Capital at risk"
          }
        />
        <Fact
          label="Liquidity"
          value={debtLiquidityLabel(route) ?? "Check exit terms"}
        />
      </View>
      <View className="flex-row gap-2">
        <Fact
          label="Source"
          value={route.investmentFacts?.yieldSource ?? "Unavailable"}
        />
        <Fact
          label="As of"
          value={route.investmentFacts?.yieldAsOf ?? "Unavailable"}
        />
      </View>
      {/* A fund fee is charged against the yield every year, so the headline rate
          is not what reaches the user. Shown as the net rate rather than the fee
          alone, because "4.73% after the 0.09% fee" is the number that matters. */}
      {netYieldPct != null && (
        <View className="flex-row gap-2">
          <Fact
            label="After fees"
            value={`${netYieldPct.toFixed(2)}% net`}
            subLabel={`${route.investmentFacts?.expenseRatioPct?.toFixed(2)}% expense ratio`}
          />
          <Fact
            label="Rate can change"
            value={rateFixed ? "No — locked at purchase" : "Yes — can move"}
          />
        </View>
      )}
      <View className="flex-row gap-2">
        <Fact
          label="Who owes you"
          value={route.investmentFacts?.issuer ?? "Not stated"}
        />
        {deadlineFit && <Fact label="Vs your deadline" value={deadlineFit.label} />}
      </View>
      {deadlineFit?.misses && (
        <ThemedText
          style={{ fontSize: 12, lineHeight: 17, color: Semantic.negative, fontWeight: "700" }}
        >
          Pays out after your goal date — the money is locked up past the point you
          wanted it.
        </ThemedText>
      )}
      {yieldIsEstimate && (
        <View
          style={{
            flexDirection: "row",
            gap: 8,
            borderRadius: Radius.md,
            borderWidth: 1,
            borderColor: Semantic.caution + "66",
            backgroundColor: Semantic.caution + "14",
            paddingHorizontal: 12,
            paddingVertical: 10,
          }}
        >
          <Icon glyph="⚠️" size={14} color={Semantic.caution} />
          <ThemedText
            style={{ flex: 1, fontSize: 12, lineHeight: 17, color: theme.text }}
          >
            This yield is an estimate, not a quote. Nobody has offered you this
            rate — check the advertised APY before committing.
          </ThemedText>
        </View>
      )}
      {route.investmentFacts?.projectionBasis && (
        <ThemedText
          style={{
            fontSize: 12,
            lineHeight: 17,
            color: theme.textSecondary,
          }}
        >
          Projection: {route.investmentFacts.projectionBasis}.
        </ThemedText>
      )}
      <ThemedText
        style={{ fontSize: 12, lineHeight: 17, color: theme.textSecondary }}
      >
        Also compare after-tax yield, fees, lockup/early-exit terms,
        issuer/backing, and whether the maturity matches your goal date.
      </ThemedText>
    </Section>
  );
}
