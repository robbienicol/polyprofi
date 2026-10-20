import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useMarketComparison } from "@/api/hooks/useMarketComparison";
import { useRoutePreview } from "@/api/hooks/useRoutePreview";
import { useSavedRoutes } from "@/api/hooks/useSavedRoutes";
import { usePreferences } from "@/api/hooks/usePreferences";
import { useSavingsGoal } from "@/api/hooks/useSavingsGoal";
import { RelatedRoutes } from "@/components/routes/RelatedRoutes";
import { RouteLiveChart } from "@/components/routes/RouteLiveChart";
import { RouteCoach } from "@/components/routes/RouteCoach";
import { RouteOpportunityCard } from "@/components/routes/RouteOpportunityCard";
import { AcquireBar } from "@/components/routes/route-detail/AcquireBar";
import { HowItWorks, RouteDetailHeader } from "@/components/routes/route-detail/RouteDetailHeader";
import { RouteDetailsPanel } from "@/components/routes/route-detail/RouteDetailsPanel";
import { relatedRouteStake, routeDetailModel } from "@/components/routes/route-detail/route-detail-model";
import { TradeVenues } from "@/components/routes/route-detail/TradeVenues";
import { useRouteDetailAcquire } from "@/components/routes/route-detail/use-route-detail-acquire";
import { ThemedText } from "@/components/themed-text";
import { RouteDetailSkeleton, SkeletonBlocks } from "@/components/ui/loaders";
import { KEYBOARD_AWARE_SCROLL_PROPS } from "@/constants/keyboard";
import { Brand } from "@/constants/theme";
import { useAfterTransition } from "@/hooks/use-after-transition";
import { useTheme } from "@/hooks/use-theme";
import { openTradeDestination, tradeDestinationLabel } from "@/lib/route-actions";

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
  const acquire = useRouteDetailAcquire(confirmGoal);
  const { preferences } = usePreferences();
  const [showDetails, setShowDetails] = useState(false);
  // Below the fold waits for the push to finish, so the tap answers at once.
  const transitioned = useAfterTransition();

  // The list this row was tapped from first, then saved history. Route ids repeat
  // across searches that share a daily pool, so history alone can resolve to another
  // goal's batch; the preview is the exact list (and goal) the tap came from. Keyword
  // hits merged in live are only ever in the preview.
  const batch = (preview?.routes.some((route) => route.id === id) ? preview : undefined)
    ?? history.find((item) => item.routes.some((route) => route.id === id));
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
    return <RouteDetailSkeleton />;
  }
  if (!savedRoute) {
    return (
      <View
        className="flex-1 items-center justify-center"
        style={{ backgroundColor: theme.background }}
      >
        <ThemedText themeColor="textSecondary">
          This route is no longer available.
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

  const model = routeDetailModel({
    savedRoute,
    batch,
    stakeParam,
    availableParam,
    scoreWeights: preferences.scoreWeights,
    comparison,
  });
  const { route, stake, destination, destinationOptions, availableInvestment } = model;

  return (
    <View className="flex-1" style={{ backgroundColor: theme.background }}>
      <SafeAreaView className="flex-1">
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerClassName="px-4 pt-3 pb-8 gap-4"
          {...KEYBOARD_AWARE_SCROLL_PROPS}
        >
          <RouteDetailHeader
            onBack={() => router.back()}
            onShare={() =>
              openTradeDestination(route, destination, destinationOptions)
            }
          />

          <RouteOpportunityCard
            route={route}
            stake={stake}
            neededToHitGoal={model.neededToHitGoal}
            deadlineDays={model.goalDeadlineDays}
          />

          {/* The live line where there is a market to draw; the plain-words strategy
              for routes with no price (a T-bill, a spending cut). */}
          <RouteLiveChart
            route={route}
            fallback={<HowItWorks strategy={route.strategy} />}
          />

          <TradeVenues
            venues={model.venues}
            onOpen={(venue) => openTradeDestination(route, venue.destination, destinationOptions)}
          />

          <RouteDetailsPanel
            open={showDetails}
            onToggle={() => setShowDetails((open) => !open)}
            model={model}
            comparison={comparison}
            onChangeWeights={() => router.push("/(tabs)/routes")}
          />

          {transitioned ? (
            <>
            <RouteCoach route={route} />

            <RelatedRoutes
              routes={model.relatedRoutes}
              onSelect={(selected) => {
                const selectedStake = relatedRouteStake(
                  selected,
                  model.baseStake,
                  model.targetProfit,
                  availableInvestment,
                );
                router.push(
                  `/route/${selected.id}?stake=${selectedStake}&available=${availableInvestment}`,
                );
              }}
            />
            </>
          ) : (
            <SkeletonBlocks heights={[96, 180]} />
          )}
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

        <AcquireBar
          route={route}
          showForm={acquire.showAcquireForm}
          amount={acquire.acquireAmount}
          destinationLabel={model.cutActionLabel ?? tradeDestinationLabel(destination)}
          onAmountChange={acquire.setAcquireAmount}
          onConfirm={() => acquire.confirmAcquire({
            route,
            stake,
            targetProfit: model.targetProfit,
            timeframe: batch?.quizSnapshot.timeframe,
            goalId: routeGoalId,
            destination,
            destinationOptions,
          })}
          onCancel={() => acquire.setShowAcquireForm(false)}
          cutPercent={acquire.cutPercent}
          onCutPercentChange={acquire.setCutPercent}
          added={acquire.added}
          isTracking={acquire.isTracking}
          onBegin={() => acquire.beginAcquire(stake)}
        />
      </SafeAreaView>
    </View>
  );
}
