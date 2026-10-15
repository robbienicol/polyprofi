import { View } from "react-native";

import {
  formatMaturity,
  formatProbability,
  displayRiskLevel,
  riskColor,
  riskLabel,
} from "@/components/molecules/RouteCard";
import { Icon } from "@/components/ui/Icon";
import { ThemedText } from "@/components/themed-text";
import { Brand, Radius, RiskScale, Semantic, Shadow } from "@/constants/theme";
import { useSemanticText, useTheme } from "@/hooks/use-theme";
import {
  formatMarketLiquidity,
  liquidityLabel,
  pricePositionLabel,
  routeDisplayTitle,
} from "@/lib/route-detail";
import {
  downsideAtStake,
  downsidePercent,
  expectedValue,
} from "@/lib/route-expected-value";
import {
  deadlineFitLabel,
  debtLiquidityLabel,
  debtYieldLabel,
  isDebtRoute,
} from "@/lib/route-investment-metrics";
import { maturityWords } from "@/lib/portfolio";
import type { Route } from "@/types/routes";

const MONO = { fontVariant: ["tabular-nums" as const] };

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

/**
 * Everything behind the summary: the facts an experienced investor checks, kept on
 * the screen but folded away, so the first read is the trade rather than its working.
 */
export function RouteDetails({
  route,
  stake,
  deadlineDays,
}: Omit<RouteOpportunityCardProps, "neededToHitGoal">): React.ReactElement {
  const theme = useTheme();
  const binary = route.lossProfile === "binary";
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

/** The bad outcome, as money, with a few words on when it happens. */
function worstCase(route: Route, stake: number, debt: boolean): { value: string; note: string } {
  if (route.noCapitalRequired) return { value: "$0", note: "no money in" };
  if (route.lossProfile === "binary") return { value: `−$${Math.round(stake).toLocaleString()}`, note: "if it loses" };
  if (debt) return route.maturesInDays
    ? { value: "$0", note: "held to the end" }
    : { value: "$0", note: "rate can drop" };
  return { value: `−$${Math.round(downsideAtStake(route, stake)).toLocaleString()}`, note: "in a bad stretch" };
}

/** One sentence on what can go wrong, for someone who has never bought any of this. */
function riskInPlainWords(route: Route, stake: number, debt: boolean): string {
  if (route.noCapitalRequired) return "Nothing to lose: this uses no money, only a change in what you already do.";
  if (route.lossProfile === "binary") {
    return `All or nothing. If it goes the other way, the $${Math.round(stake).toLocaleString()} is gone.`;
  }
  if (debt) {
    return route.maturesInDays
      ? "About as safe as it gets. Hold it to the end and you get it all back, plus the interest."
      : "Your money stays put and earns interest. The rate can move, but the money doesn't shrink.";
  }
  return "The value moves with the market. A bad stretch means it's worth less for a while, not that it's gone.";
}


/**
 * `accent` marks a section whose contents are a different kind of thing from the rest of
 * the card, not merely a worse one — today that is the binary settlement block. Every
 * other section stays neutral, so the tint means something when it appears.
 */
function Section({
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
