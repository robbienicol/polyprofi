import { View } from "react-native";

import { formatMaturity, formatProbability } from "@/components/molecules/RouteCard";
import { Fact, Outcome, RiskRow, Section } from "@/components/routes/route-opportunity/card-parts";
import { InvestmentFacts } from "@/components/routes/route-opportunity/InvestmentFacts";
import { ThemedText } from "@/components/themed-text";
import { RiskScale, Semantic } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import {
  formatMarketLiquidity,
  liquidityLabel,
  pricePositionLabel,
} from "@/lib/route-detail";
import {
  downsideAtStake,
  downsidePercent,
  expectedValue,
} from "@/lib/route-expected-value";
import { isDebtRoute } from "@/lib/route-investment-metrics";
import type { Route } from "@/types/routes";

interface RouteDetailsProps {
  route: Route;
  stake: number;
  /** Calendar days until the user's goal deadline, when a goal is in context. */
  deadlineDays?: number | null;
}

/**
 * Everything behind the summary: the facts an experienced investor checks, kept on
 * the screen but folded away, so the first read is the trade rather than its working.
 */
export function RouteDetails({
  route,
  stake,
  deadlineDays,
}: RouteDetailsProps): React.ReactElement {
  const theme = useTheme();
  const binary = route.lossProfile === "binary";
  const routeExpectedValue = expectedValue(route, stake);
  const liquidity = liquidityLabel(route);
  const marketQuality = route.marketQuality;
  const liquidityPercent =
    marketQuality?.executionScore ??
    (liquidity === "High" ? 95 : liquidity === "Medium" ? 62 : 32);
  const debt = isDebtRoute(route);

  return (
    <View style={{ gap: 12 }}>
      {/* Only the two measures with real backing. Volatility fell back to
          riskLevel × 20 whenever a market carried no price history, which restates the
          risk level rather than measuring volatility; correlation was a hardcoded
          category match with nothing to correlate against. Both were noise.
          Debt skips this entirely: its probability is ~100% by construction, and yield,
          term and issuer are what decide it — see Investment Facts below. */}
      {debt || marketQuality ? null : (
        <Section title="Risk Breakdown">
          {/* The bar took Semantic.positive regardless of the value, so a 12% chance
              drew a green bar — a semantic colour used as decoration, and the one
              place on this screen where a hue contradicted the number beside it.
              It follows the risk ramp now, which is what a chance actually maps to. */}
          <RiskRow
            label="Probability"
            value={formatProbability(route.probability)}
            percent={route.probability}
            color={RiskScale[Math.min(4, Math.max(0, Math.floor((100 - route.probability) / 20)))]}
          />
          <RiskRow
            label="Liquidity"
            value={liquidity}
            percent={liquidityPercent}
            color={
              liquidity === "Low"
                ? Semantic.negative
                : liquidity === "Medium"
                  ? Semantic.caution
                  : Semantic.positive
            }
          />
        </Section>
      )}

      {route.exitPlan?.kind === "bracket" && (
        <Section title="Exit Plan">
          <View className="flex-row gap-2">
            <Fact
              label="Buy / sell"
              value={`${route.exitPlan.entryCents}¢ → ${route.exitPlan.takeProfitCents}¢`}
            />
            <Fact label="Stop" value={`${route.exitPlan.stopCents}¢`} />
          </View>
          <View className="flex-row gap-2">
            <Fact
              label="Sell hit first"
              value={`${route.exitPlan.barrierProbability}%`}
            />
            <Fact
              label="Break-even needs"
              value={`${route.exitPlan.breakevenProbability}%`}
            />
          </View>
          <View className="flex-row gap-2">
            <Fact
              label="Most you can lose"
              value={`~${Math.round(route.exitPlan.effectiveLossFraction * 100)}% of capital`}
            />
            <Fact
              label="Typical exit"
              value={formatMaturity(route.exitPlan.expectedExitDays)}
            />
          </View>
          {/* The disclosure has to sit next to the numbers, not in a footnote: the plan is
              zero-EV before costs and negative after, so anything that reads as an edge is
              a lie. See @/lib/prediction-swing. */}
          <ThemedText
            style={{ fontSize: 11.5, lineHeight: 17, color: theme.textSecondary }}>
            {`Hitting ${route.exitPlan.takeProfitCents}¢ before ${route.exitPlan.stopCents}¢ happens ` +
              `${route.exitPlan.barrierProbability}% of the time, and you need ` +
              `${route.exitPlan.breakevenProbability}% just to cover the ` +
              `${route.exitPlan.roundTripCostCents}¢ round-trip spread — a ` +
              `${Math.abs(route.exitPlan.costEdgePts).toFixed(1)}-point drag. A busier market ` +
              `does not improve that probability, only how fast you find out. What the plan buys is the ` +
              `capped loss and the earlier exit.`}
          </ThemedText>
        </Section>
      )}

      {marketQuality && (
        <Section title="Market Quality">
          {/* Resolution is already the chip up top, and liquidity's label and dollar
              figure were split across two sections; each fact now appears once. */}
          <View className="flex-row gap-2">
            <Fact
              label="Liquidity"
              value={`${liquidity} · ${formatMarketLiquidity(marketQuality.liquidityUsd)}`}
            />
            <Fact
              label="Spread"
              value={
                marketQuality.spreadCents != null
                  ? `${marketQuality.spreadCents}¢`
                  : "Unavailable"
              }
            />
          </View>
          <View className="flex-row gap-2">
            <Fact
              label="Bid / ask"
              value={
                marketQuality.bestBidCents != null &&
                marketQuality.bestAskCents != null
                  ? `${marketQuality.bestBidCents}¢ / ${marketQuality.bestAskCents}¢`
                  : "Unavailable"
              }
            />
            <Fact
              label="Price position"
              value={pricePositionLabel(route)}
              subLabel={
                marketQuality.recentRangePts != null
                  ? `${marketQuality.recentRangePts} pt recent range`
                  : undefined
              }
            />
          </View>
          <ThemedText
            style={{
              fontSize: 11.5,
              lineHeight: 17,
              color: theme.textSecondary,
            }}
          >
            Liquidity is total market liquidity, not guaranteed exit depth.
            Price position compares today with available 1-day, 1-week, and
            1-month checkpoints; it is context, not a value signal.
          </ThemedText>
        </Section>
      )}

      {debt && (
        <InvestmentFacts route={route} stake={stake} deadlineDays={deadlineDays} />
      )}

      {/* A binary contract and a bond fund do not have the same shape of downside, and
          showing both in one identical grey panel is what flattens the difference: a
          T-bill's bad day is a decline in something you still hold, where a contract
          resolving against you leaves nothing to hold at all. So the binary case gets
          its own title, its own accent, and a closing line that says outright there is
          no middle outcome — rather than being the same component with a redder dot. */}
      <Section
        title={binary ? "Settlement · two outcomes" : "Potential outcome"}
        accent={binary ? Semantic.negative : undefined}
      >
        <Outcome
          color={Semantic.positive}
          label={binary ? "Resolves in your favour" : "Target hit"}
          chance={`${formatProbability(route.probability)} chance`}
          value={`+$${route.expectedReturn}`}
        />
        {binary ? (
          <Outcome
            color={Semantic.negative}
            label="Resolves against you"
            chance={`${formatProbability(100 - route.probability)} chance`}
            value={`−$${stake}`}
          />
        ) : (
          <Outcome
            color={Semantic.negative}
            label="Rough downside if it goes wrong"
            chance={`~${downsidePercent(route)}% drawdown`}
            value={`−$${Math.round(downsideAtStake(route, stake))}`}
          />
        )}
        {/* Both legs weighted by their probability. Shown for every route, binaries most
            of all: an all-or-nothing return is the one that looks best unweighted. */}
        <Outcome
          color={routeExpectedValue >= 0 ? Semantic.caution : Semantic.negative}
          label="Probability-weighted average"
          chance="what this is worth on average"
          value={`${routeExpectedValue >= 0 ? '+' : '−'}$${Math.abs(Math.round(routeExpectedValue))}`}
        />
        <ThemedText
          style={{ fontSize: 11.5, lineHeight: 17, color: theme.textSecondary }}
        >
          {binary
            ? "There is no middle outcome. The contract settles at its full value or at nothing, so a wrong answer leaves no position to hold and nothing to recover."
            : "You keep the position either way. A bad outcome here is a decline in something you still own, not a total loss."}
        </ThemedText>
      </Section>

    </View>
  );
}
