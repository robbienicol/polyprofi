import { Pressable, View } from "react-native";

import {
  formatMaturity,
  riskColor,
  riskLabel,
} from "@/components/molecules/RouteCard";
import { ThemedText } from "@/components/themed-text";
import { Accent, Brand, Radius, Shadow } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import {
  formatMarketLiquidity,
  liquidityLabel,
  pricePositionLabel,
  routeDisplayTitle,
} from "@/lib/route-detail";
import { downsideAtStake, expectedValue } from "@/lib/route-expected-value";
import {
  deadlineFitLabel,
  debtLiquidityLabel,
  debtYieldLabel,
  isDebtRoute,
} from "@/lib/route-investment-metrics";
import type { Route } from "@/types/routes";

const MONO = { fontVariant: ["tabular-nums" as const] };

interface RouteOpportunityCardProps {
  route: Route;
  stake: number;
  neededToHitGoal: number | null;
  added: boolean;
  adding: boolean;
  onAdd: () => void;
  /** Calendar days until the user's goal deadline, when a goal is in context. */
  deadlineDays?: number | null;
}

export function RouteOpportunityCard({
  route,
  stake,
  neededToHitGoal,
  deadlineDays,
  added,
  adding,
  onAdd,
}: RouteOpportunityCardProps): React.ReactElement {
  const theme = useTheme();
  const color = riskColor(route.riskLevel);
  const binary = route.lossProfile === "binary";
  const returnPct = stake > 0 ? (route.expectedReturn / stake) * 100 : 0;
  const routeExpectedValue = expectedValue(route, stake);
  const liquidity = liquidityLabel(route);
  const marketQuality = route.marketQuality;
  const liquidityPercent =
    marketQuality?.executionScore ??
    (liquidity === "High" ? 95 : liquidity === "Medium" ? 62 : 32);
  const debt = isDebtRoute(route);
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
    <View
      style={{
        borderRadius: Radius.xl,
        overflow: "hidden",
        backgroundColor: theme.backgroundElevated,
        borderWidth: 1,
        borderColor: theme.border,
        padding: 16,
        gap: 14,
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
              {riskLabel(route.riskLevel).toUpperCase()}
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
              <ThemedText
                style={{
                  fontSize: 11,
                  color: theme.textSecondary,
                  fontWeight: "800",
                }}
              >
                ⏳ {formatMaturity(route.maturesInDays)}
              </ThemedText>
            </View>
          ) : null}
        </View>
        <ThemedText
          style={{ fontSize: 13, color: Brand[500], fontWeight: "700" }}
        >
          {route.platform || route.category}
        </ThemedText>
      </View>

      <View className="flex-row items-center gap-4">
        <View
          style={{
            width: 76,
            height: 76,
            borderRadius: Radius.xl,
            backgroundColor: color + "20",
            alignItems: "center",
            justifyContent: "center",
            ...Shadow.card,
          }}
        >
          <ThemedText style={{ fontSize: 38 }}>{route.emoji}</ThemedText>
        </View>
        <View className="flex-1">
          <ThemedText
            style={{
              fontSize: 19,
              lineHeight: 25,
              fontWeight: "900",
              color: Brand[500],
              letterSpacing: -0.2,
              ...MONO,
            }}
          >
            {routeDisplayTitle(route)}
          </ThemedText>
          <ThemedText
            style={{
              fontSize: 13,
              lineHeight: 18,
              color: theme.textSecondary,
              marginTop: 6,
            }}
          >
            {route.description}
          </ThemedText>
        </View>
      </View>

      <View className="flex-row items-center">
        <Metric
          value={route.meetsTarget ? `${route.probability}%` : "No"}
          label={route.meetsTarget ? "Chance of goal" : "Hits goal"}
          valueColor={theme.text}
        />
        <Divider />
        <Metric
          value={`+$${route.expectedReturn}`}
          label={debt ? "Projected profit" : "Potential profit"}
          subLabel={`(${returnPct.toFixed(1)}% return)`}
          valueColor={Brand[500]}
        />
        <Divider />
        <Metric
          value={
            neededToHitGoal != null
              ? `$${neededToHitGoal.toLocaleString()}`
              : "Met"
          }
          label="Need to hit goal"
          subLabel={
            neededToHitGoal != null
              ? `of $${stake.toLocaleString()} now`
              : undefined
          }
          valueColor={
            neededToHitGoal != null && !route.meetsTarget
              ? Accent.gold
              : Brand[500]
          }
        />
      </View>
      <ThemedText style={{ fontSize: 13, color: theme.textSecondary }}>
        Based on historical data & live market odds
      </ThemedText>

      {/* Only the two measures with real backing. Volatility fell back to
          riskLevel × 20 whenever a market carried no price history, which restates the
          risk level rather than measuring volatility; correlation was a hardcoded
          category match with nothing to correlate against. Both were noise.
          Debt skips this entirely: its probability is ~100% by construction, and yield,
          term and issuer are what decide it — see Investment Facts below. */}
      {debt ? null : (
        <Section title="Risk Breakdown">
          <RiskRow
            label="Probability"
            value={`${route.probability}%`}
            percent={route.probability}
            color={Brand[500]}
          />
          <RiskRow
            label="Liquidity"
            value={liquidity}
            percent={liquidityPercent}
            color={
              liquidity === "Low"
                ? Accent.red
                : liquidity === "Medium"
                  ? Accent.gold
                  : Brand[500]
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
              value={`~${Math.round(route.exitPlan.effectiveLossFraction * 100)}% of stake`}
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
              `does not improve those odds, only how fast you find out. What the plan buys is the ` +
              `capped loss and the earlier exit.`}
          </ThemedText>
        </Section>
      )}

      {marketQuality && (
        <Section title="Market Quality">
          <View className="flex-row gap-2">
            <Fact
              label="Resolution"
              value={
                route.maturesInDays
                  ? formatMaturity(route.maturesInDays)
                  : "Unavailable"
              }
            />
            <Fact
              label="Liquidity proxy"
              value={formatMarketLiquidity(marketQuality.liquidityUsd)}
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
              label="Spread"
              value={
                marketQuality.spreadCents != null
                  ? `${marketQuality.spreadCents}¢`
                  : "Unavailable"
              }
            />
          </View>
          <View className="flex-row gap-2">
            <Fact label="Price position" value={pricePositionLabel(route)} />
            <Fact
              label="Recent range"
              value={
                marketQuality.recentRangePts != null
                  ? `${marketQuality.recentRangePts} pts`
                  : "Unavailable"
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
        <Section title="Investment Facts">
          <View className="flex-row gap-2">
            <Fact
              label="Yield"
              value={debtYieldLabel(route, stake) ?? "Check quote"}
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
                  : "Stake at risk"
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
              style={{ fontSize: 12, lineHeight: 17, color: Accent.red, fontWeight: "700" }}
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
                borderColor: Accent.gold + "66",
                backgroundColor: Accent.gold + "14",
                paddingHorizontal: 12,
                paddingVertical: 10,
              }}
            >
              <ThemedText style={{ fontSize: 13 }}>⚠️</ThemedText>
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
      )}

      <Section title="Potential Outcome">
        <Outcome
          color={Brand[500]}
          label="Target hit"
          chance={`${route.probability}% chance`}
          value={`+$${route.expectedReturn}`}
        />
        {binary ? (
          <Outcome
            color={Accent.red}
            label="Target missed — stake gone"
            chance={`${100 - route.probability}% chance`}
            value={`−$${stake}`}
          />
        ) : (
          <Outcome
            color={Accent.red}
            label="Rough downside if it goes wrong"
            chance={`~${route.riskLevel * 8}% drawdown`}
            value={`−$${Math.round(downsideAtStake(route, stake))}`}
          />
        )}
        {/* Both legs weighted by the odds. Shown for every route, binaries most of
            all: an all-or-nothing payout is the one that looks best unweighted. */}
        <Outcome
          color={routeExpectedValue >= 0 ? Accent.gold : Accent.red}
          label="Probability-weighted average"
          chance="what this is worth on average"
          value={`${routeExpectedValue >= 0 ? '+' : '−'}$${Math.abs(Math.round(routeExpectedValue))}`}
        />
      </Section>

      <Pressable
        onPress={onAdd}
        disabled={added || adding}
        className="py-4 items-center active:opacity-85"
        style={{
          borderRadius: Radius.lg,
          backgroundColor: Brand[500],
          opacity: added || adding ? 0.65 : 1,
          ...Shadow.card,
        }}
      >
        <ThemedText
          style={{ fontSize: 16, fontWeight: "900", color: "#06140C" }}
        >
          {added
            ? "Acquisition saved"
            : adding
              ? "Saving..."
              : "Acquire →"}
        </ThemedText>
      </Pressable>
    </View>
  );
}

function Section({
  title,
  children,
}: React.PropsWithChildren<{ title: string }>): React.ReactElement {
  const theme = useTheme();
  return (
    <View
      style={{
        borderRadius: Radius.lg,
        backgroundColor: theme.backgroundElement,
        borderWidth: 1,
        borderColor: theme.border,
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
function Divider(): React.ReactElement {
  const theme = useTheme();
  return (
    <View style={{ width: 1, height: 58, backgroundColor: theme.border }} />
  );
}
function Metric({
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
  return (
    <View
      className="flex-1 items-center"
      style={{ gap: 3, paddingHorizontal: 2 }}
    >
      <ThemedText
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.5}
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
            color: Brand[500],
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
function RiskRow({
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
function Fact({
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
        style={{ fontSize: 10, color: theme.textTertiary, fontWeight: "800" }}
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
          style={{ fontSize: 10, color: theme.textTertiary, marginTop: 2 }}
          numberOfLines={1}
        >
          {subLabel}
        </ThemedText>
      )}
    </View>
  );
}
function Outcome({
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
