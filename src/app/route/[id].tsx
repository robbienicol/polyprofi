import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { timeframeCalendarDays } from "@/api/client/playbook";
import { useMarketComparison } from "@/api/hooks/useMarketComparison";
import { useRoutePreview } from "@/api/hooks/useRoutePreview";
import { useSavedRoutes } from "@/api/hooks/useSavedRoutes";
import { usePreferences } from "@/api/hooks/usePreferences";
import { useSavingsGoal } from "@/api/hooks/useSavingsGoal";
import { useTrackedBets } from "@/api/hooks/useTrackedBets";
import { MarketComparisonCard } from "@/components/routes/MarketComparisonCard";
import { RelatedRoutes } from "@/components/routes/RelatedRoutes";
import { RouteCoach } from "@/components/routes/RouteCoach";
import { RouteOpportunityCard } from "@/components/routes/RouteOpportunityCard";
import { ScoreMathCard } from "@/components/routes/ScoreMathCard";
import { TrackRouteForm } from "@/components/routes/TrackRouteForm";
import { ThemedText } from "@/components/themed-text";
import { BrandLoader } from "@/components/ui/loaders";
import { KEYBOARD_AWARE_SCROLL_PROPS } from "@/constants/keyboard";
import { Brand, Radius, Semantic } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { betOutcomeSide } from "@/lib/bet-monitor-match";
import { parseEntryPrice } from "@/lib/parse-bet-line";
import {
  openTradeDestination,
  preferredTradeDestination,
  tradeDestinationLabel,
  tradeVenuesForRoute,
} from "@/lib/route-actions";
import type { TradeVenue } from "@/lib/route-actions";
import { goalEffectivenessScore } from "@/lib/score";
import { rescoreForStake, stakeNeededForReturn } from "@/lib/stake-rescore";
import { trackedPositionFields } from "@/lib/tracked-assets";

export default function RouteDetailScreen(): React.ReactElement {
  const theme = useTheme();
  const router = useRouter();
  const {
    id,
    stake: stakeParam,
    available: availableParam,
  } = useLocalSearchParams<{
    id: string;
    stake?: string;
    available?: string;
  }>();
  const { history, isLoading: historyLoading } = useSavedRoutes();
  const { preview } = useRoutePreview();
  const { allGoals, confirmGoal } = useSavingsGoal();
  const { trackBet, isTracking } = useTrackedBets();
  const { preferences } = usePreferences();
  const [added, setAdded] = useState(false);
  const [showAcquireForm, setShowAcquireForm] = useState(false);
  const [acquireAmount, setAcquireAmount] = useState("");

  // Saved history first, then the list this row was tapped from: a keyword search
  // merges live Polymarket and asset hits into that list, and those were never
  // saved to a batch.
  const batch = history.find((item) => item.routes.some((route) => route.id === id))
    ?? (preview?.routes.some((route) => route.id === id) ? preview : undefined);
  const savedRoute = batch?.routes.find((route) => route.id === id);
  // A goal swept away since the search is dropped rather than left dangling on a
  // position that would then belong to nothing.
  const routeGoalId = batch?.goalId && allGoals.some((goal) => goal.id === batch.goalId)
    ? batch.goalId
    : undefined;
  const { comparison } = useMarketComparison(savedRoute);
  // History is read from disk, so a cold open here starts with an empty list. Calling
  // that a missing pick shows the dead end before we have looked.
  if (!savedRoute && historyLoading) {
    return <BrandLoader subtitle="Loading this pick…" />;
  }
  if (!savedRoute) {
    return (
      <View
        className="flex-1 items-center justify-center"
        style={{ backgroundColor: theme.background }}
      >
        <ThemedText themeColor="textSecondary">
          This pick is no longer available.
        </ThemedText>
        <Pressable
          onPress={() => router.back()}
          className="mt-3 active:opacity-60"
        >
          <ThemedText style={{ color: Brand[500], fontWeight: "700" }}>
            ← Back
          </ThemedText>
        </Pressable>
      </View>
    );
  }

  const baseStake = batch?.quizSnapshot.balance ?? 0;
  const targetProfit = batch?.quizSnapshot.target ?? savedRoute.expectedReturn;
  // The goal deadline of the search this route came from, so a debt maturity can be
  // compared against the date the user actually needs the money.
  const goalDeadlineDays = batch
    ? timeframeCalendarDays(batch.quizSnapshot.timeframe)
    : null;
  const defaultStake = Math.min(
    baseStake || 1,
    stakeNeededForReturn(savedRoute, baseStake || 1, targetProfit) ??
      (baseStake || 1),
  );
  const requestedStake = Number(stakeParam);
  const stake =
    Number.isFinite(requestedStake) && requestedStake > 0
      ? Math.round(requestedStake)
      : defaultStake;
  const requestedAvailable = Number(availableParam);
  const availableInvestment =
    Number.isFinite(requestedAvailable) && requestedAvailable > 0
      ? Math.round(requestedAvailable)
      : baseStake || stake;
  const route = rescoreForStake(
    [savedRoute],
    baseStake || stake || 1,
    stake || baseStake || 1,
    targetProfit,
  )[0];
  const neededToHitGoal = stakeNeededForReturn(
    savedRoute,
    baseStake || stake || 1,
    targetProfit,
  );
  // Scored with the user's own weights, so the breakdown below explains this number
  // the way they asked for it rather than the way the app used to insist on.
  const scoreBreakdown = goalEffectivenessScore(
    route,
    {
      target: targetProfit,
      requiredInvestment: neededToHitGoal,
      availableInvestment,
      deadlineDays: goalDeadlineDays ?? route.maturesInDays ?? 1,
    },
    preferences.scoreWeights,
  );
  const relatedRoutes = (batch?.routes ?? [])
    .filter((candidate) => candidate.id !== route.id)
    .sort(
      (a, b) =>
        Number(b.category === route.category) -
          Number(a.category === route.category) ||
        Math.abs(a.probability - route.probability) -
          Math.abs(b.probability - route.probability),
    )
    .slice(0, 3);

  const destination = preferredTradeDestination(
    route,
    batch?.quizSnapshot.preferredPlatforms,
  );
  const destinationOptions = {
    kalshiEventTicker: comparison?.kalshiEventTicker,
    kalshiSeriesTicker: comparison?.kalshiSeriesTicker,
  };
  // One entry for most routes; two when the same contract is listed on Kalshi as well,
  // cheapest first.
  const venues = tradeVenuesForRoute(
    route,
    batch?.quizSnapshot.preferredPlatforms,
    comparison,
  );

  function beginAcquire(): void {
    if (added || isTracking) return;
    setAcquireAmount(String(stake));
    setShowAcquireForm(true);
  }

  function confirmAcquire(): void {
    if (added || isTracking) return;
    const amount = Number(acquireAmount);
    if (!Number.isFinite(amount) || amount <= 0) return;
    const predictionMarket = /polymarket|prediction/i.test(
      `${route.category} ${route.platform}`,
    );
    const entryPrice =
      parseEntryPrice(route.line) ??
      (predictionMarket && route.probability > 0
        ? route.probability / 100
        : undefined);
    const openedAt = new Date().toISOString();
    trackBet(
      {
        // Derived from openedAt rather than a second clock read, so the id and the
        // recorded open time can never disagree.
        id: `${route.id}-${new Date(openedAt).getTime()}`,
        // The goal comes from the saved search that produced this route, so a
        // position opened from a deep link days later still lands on the right one.
        goalId: routeGoalId,
        category: route.category,
        emoji: route.emoji,
        description: route.description,
        platform: route.platform,
        strategy: route.strategy,
        riskLevel: route.riskLevel,
        probability: route.probability,
        expectedReturn: route.expectedReturn,
        amountWagered: amount,
        status: "active",
        createdAt: openedAt,
        profitGoal: targetProfit,
        line: route.line,
        entryPrice,
        monitorQuery: `${route.description} ${route.line ?? ""}`,
        sourceSlug: route.sourceSlug,
        outcomeSide: betOutcomeSide(route) ?? undefined,
        ...trackedPositionFields(route, amount, openedAt),
      },
      {
        onSuccess: () => {
          setAdded(true);
          setShowAcquireForm(false);
          // Acquiring is the commitment that turns a searched-for goal into a real one.
          if (routeGoalId) confirmGoal(routeGoalId);
          void openTradeDestination(route, destination, destinationOptions);
        },
      },
    );
  }

  return (
    <View className="flex-1" style={{ backgroundColor: theme.background }}>
      <SafeAreaView className="flex-1">
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerClassName="px-4 pt-3 pb-16 gap-4"
          {...KEYBOARD_AWARE_SCROLL_PROPS}
        >
          <View
            className="flex-row items-center justify-between"
            style={{ paddingVertical: 6 }}
          >
            <Pressable
              onPress={() => router.back()}
              className="active:opacity-60"
              hitSlop={12}
            >
              <ThemedText
                style={{
                  fontSize: 28,
                  color: theme.textSecondary,
                  lineHeight: 30,
                }}
              >
                ‹
              </ThemedText>
            </Pressable>
            <ThemedText
              style={{ fontSize: 18, fontWeight: "800", color: theme.text }}
            >
              Opportunity
            </ThemedText>
            <Pressable
              onPress={() =>
                openTradeDestination(route, destination, destinationOptions)
              }
              className="active:opacity-60"
              hitSlop={12}
            >
              <ThemedText style={{ fontSize: 20, color: theme.textSecondary }}>
                ⇧
              </ThemedText>
            </Pressable>
          </View>

          <RouteOpportunityCard
            route={route}
            stake={stake}
            neededToHitGoal={neededToHitGoal}
            added={added}
            adding={isTracking}
            onAdd={beginAcquire}
            deadlineDays={goalDeadlineDays}
          />

          {showAcquireForm ? (
            <TrackRouteForm
              amount={acquireAmount}
              destinationLabel={tradeDestinationLabel(destination)}
              onAmountChange={setAcquireAmount}
              onConfirm={confirmAcquire}
              onCancel={() => setShowAcquireForm(false)}
            />
          ) : null}

          {comparison ? <MarketComparisonCard comparison={comparison} /> : null}

          {/* The score, and the arithmetic behind it. This is the screen where money
              gets committed, so the weighting the number came from is shown here
              rather than left on the results list. */}
          <ScoreMathCard
            scoreBreakdown={scoreBreakdown}
            requiredInvestment={neededToHitGoal}
            availableInvestment={availableInvestment}
          />
          <Pressable
            onPress={() => router.push("/(tabs)/routes")}
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

          <View
            style={{
              backgroundColor: theme.backgroundElement,
              borderRadius: Radius.lg,
              padding: 14,
              borderWidth: 1,
              borderColor: theme.border,
            }}
          >
            <ThemedText
              style={{
                fontSize: 10,
                color: theme.textTertiary,
                fontWeight: "700",
                letterSpacing: 0.6,
                marginBottom: 4,
              }}
            >
              THE PLAN
            </ThemedText>
            <ThemedText
              style={{ fontSize: 13.5, color: theme.text, lineHeight: 20 }}
            >
              {route.strategy}
            </ThemedText>
          </View>

          {/* Every venue that lists this exact contract, not just the one we would have
              picked. Two order books on the same outcome genuinely differ in price, and
              showing both turns the CTA from "act here" into "here is where you can look
              at this, and here is what it costs at each". */}
          <View style={{ gap: 8 }}>
            <View className="flex-row" style={{ gap: 8 }}>
              {venues.map((venue) => (
                <TradeLink
                  key={venue.destination}
                  venue={venue}
                  onPress={() => openTradeDestination(route, venue.destination, destinationOptions)}
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

          <RouteCoach route={route} />

          <RelatedRoutes
            routes={relatedRoutes}
            onSelect={(selected) => {
              const selectedStake = Math.min(
                availableInvestment,
                stakeNeededForReturn(
                  selected,
                  baseStake || 1,
                  targetProfit,
                ) ?? availableInvestment,
              );
              router.push(
                `/route/${selected.id}?stake=${selectedStake}&available=${availableInvestment}`,
              );
            }}
          />
          <ThemedText
            className="text-center"
            style={{
              fontSize: 11,
              color: theme.textTertiary,
              opacity: 0.6,
              marginTop: 4,
            }}
          >
            AI-generated · Not financial advice · Informational only
          </ThemedText>
        </ScrollView>
      </SafeAreaView>
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
    </Pressable>
  );
}
