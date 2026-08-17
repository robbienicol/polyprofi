import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { timeframeCalendarDays } from "@/api/client/playbook";
import { useMarketComparison } from "@/api/hooks/useMarketComparison";
import { useSavedRoutes } from "@/api/hooks/useSavedRoutes";
import { useSavingsGoal } from "@/api/hooks/useSavingsGoal";
import { useTrackedBets } from "@/api/hooks/useTrackedBets";
import { MarketComparisonCard } from "@/components/routes/MarketComparisonCard";
import { RelatedRoutes } from "@/components/routes/RelatedRoutes";
import { RouteCoach } from "@/components/routes/RouteCoach";
import { RouteOpportunityCard } from "@/components/routes/RouteOpportunityCard";
import { ScoreMathCard } from "@/components/routes/ScoreMathCard";
import { TrackRouteForm } from "@/components/routes/TrackRouteForm";
import { ThemedText } from "@/components/themed-text";
import { Brand, Radius } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { betOutcomeSide } from "@/lib/bet-monitor-match";
import { parseEntryPrice } from "@/lib/parse-bet-line";
import {
  openTradeDestination,
  preferredTradeDestination,
  tradeDestinationLabel,
} from "@/lib/route-actions";
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
  const { history } = useSavedRoutes();
  const { allGoals, confirmGoal } = useSavingsGoal();
  const { trackBet, isTracking } = useTrackedBets();
  const [added, setAdded] = useState(false);
  const [showAcquireForm, setShowAcquireForm] = useState(false);
  const [acquireAmount, setAcquireAmount] = useState("");

  const batch = history.find((item) =>
    item.routes.some((route) => route.id === id),
  );
  const savedRoute = batch?.routes.find((route) => route.id === id);
  // A goal swept away since the search is dropped rather than left dangling on a
  // position that would then belong to nothing.
  const routeGoalId = batch?.goalId && allGoals.some((goal) => goal.id === batch.goalId)
    ? batch.goalId
    : undefined;
  const { comparison } = useMarketComparison(savedRoute);
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
  const scoreBreakdown = goalEffectivenessScore(route, {
    target: targetProfit,
    requiredInvestment: neededToHitGoal,
    availableInvestment,
    deadlineDays: timeframeCalendarDays(batch?.quizSnapshot.timeframe ?? ""),
  });
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
        id: `${route.id}-${Date.now()}`,
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
              THE PLAY
            </ThemedText>
            <ThemedText
              style={{ fontSize: 13.5, color: theme.text, lineHeight: 20 }}
            >
              {route.strategy}
            </ThemedText>
          </View>

          <View className="flex-row gap-2">
            <TradeLink
              label={`Open in ${tradeDestinationLabel(destination)} ↗`}
              onPress={() => openTradeDestination(route, destination, destinationOptions)}
            />
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
          <ScoreMathCard
            scoreBreakdown={scoreBreakdown}
            requiredInvestment={neededToHitGoal}
            availableInvestment={availableInvestment}
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
            AI-generated · Not financial advice · For entertainment only
          </ThemedText>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function TradeLink({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}): React.ReactElement {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      className="flex-1 active:opacity-75"
      style={{
        borderRadius: Radius.md,
        paddingVertical: 11,
        alignItems: "center",
        backgroundColor: theme.backgroundElement,
        borderWidth: 1,
        borderColor: theme.border,
      }}
    >
      <ThemedText
        style={{ fontSize: 13, fontWeight: "800", color: Brand[500] }}
      >
        {label}
      </ThemedText>
    </Pressable>
  );
}
