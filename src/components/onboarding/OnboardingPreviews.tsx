import React, { useEffect, useState } from 'react';
import { Animated, Dimensions, Easing, View } from 'react-native';

import { RouteCard, riskColor, riskLabel } from '@/components/molecules/RouteCard';
import { ThemedText } from '@/components/themed-text';
import { DEMO_ROUTES, DEMO_TRACKED_BETS, OnboardingSlide } from '@/components/onboarding/onboarding-data';
import { Accent, Brand, Radius, Shadow } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { goalEffectivenessScore } from '@/lib/score';
import { TrackedBet } from '@/types/bets';

export { OnboardingGlow } from '@/components/onboarding/OnboardingGlow';

const MONO = { fontVariant: ['tabular-nums' as const] };

function WelcomePreview(): React.ReactElement {
  const theme = useTheme();
  const [pulse] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 2200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 2200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] });
  const glowOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.7] });

  return (
    <View className="items-center justify-center flex-1 px-2">
      <Animated.View style={{ transform: [{ scale }] }}>
        <View style={{ width: 96, height: 96, borderRadius: Radius.xl, backgroundColor: Brand[500], alignItems: 'center', justifyContent: 'center', ...Shadow.float }}>
          <ThemedText style={{ fontSize: 48, fontWeight: '900', color: '#06140C' }}>$</ThemedText>
        </View>
        <Animated.View
          style={{
            position: 'absolute',
            inset: -12,
            borderRadius: Radius.xl + 12,
            borderWidth: 2,
            borderColor: Brand[500],
            opacity: glowOpacity,
          }}
        />
      </Animated.View>

      <View className="mt-8 gap-3 w-full">
        {[
          { emoji: '🎯', label: 'Goal + deadline in, routes out' },
          { emoji: '📊', label: 'Honest probability on every play' },
          { emoji: '🛡', label: 'Safest route first — always' },
        ].map(({ emoji, label }) => (
          <View
            key={label}
            className="flex-row items-center gap-3 px-4 py-3"
            style={{ borderRadius: Radius.lg, backgroundColor: theme.backgroundElevated, borderWidth: 1, borderColor: theme.border }}>
            <ThemedText style={{ fontSize: 18 }}>{emoji}</ThemedText>
            <ThemedText style={{ fontSize: 14, fontWeight: '600', color: theme.text }}>{label}</ThemedText>
          </View>
        ))}
      </View>
    </View>
  );
}

function GoalPreview(): React.ReactElement {
  const theme = useTheme();

  return (
    <View className="flex-1 justify-center gap-3 px-1">
      {[
        { emoji: '📅', when: '1 Year', from: 300, to: 330, lead: 'VOO · T-bills', color: Brand[500] },
        { emoji: '⚡', when: 'This Week', from: 300, to: 330, lead: 'Polymarket · PM sports', color: Accent.gold },
      ].map((row) => (
        <View
          key={row.when}
          style={{
            borderRadius: Radius.lg,
            backgroundColor: theme.backgroundElevated,
            borderWidth: 1,
            borderColor: theme.border,
            padding: 14,
            gap: 6,
            ...Shadow.card,
          }}>
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <ThemedText style={{ fontSize: 18 }}>{row.emoji}</ThemedText>
              <ThemedText style={{ fontSize: 14, fontWeight: '700', color: theme.text }}>{row.when}</ThemedText>
            </View>
            <ThemedText style={{ fontSize: 13, fontWeight: '800', color: row.color, fontVariant: ['tabular-nums'] }}>
              ${row.from} → ${row.to}
            </ThemedText>
          </View>
          <ThemedText style={{ fontSize: 12, color: theme.textSecondary }}>Top routes: {row.lead}</ThemedText>
        </View>
      ))}
      <ThemedText style={{ fontSize: 11, color: theme.textTertiary, textAlign: 'center', marginTop: 4 }}>
        Same goal · different deadline · different safest path
      </ThemedText>
    </View>
  );
}

function SafetyPreview(): React.ReactElement {
  const theme = useTheme();

  return (
    <View className="flex-1 justify-center gap-3 px-1">
      <View
        style={{
          borderRadius: Radius.lg,
          borderWidth: 1.5,
          borderColor: Brand[500] + '55',
          backgroundColor: Brand[500] + '10',
          padding: 14,
          gap: 8,
        }}>
        <View className="flex-row items-center gap-2">
          <ThemedText style={{ fontSize: 20 }}>📈</ThemedText>
          <ThemedText style={{ fontSize: 13, fontWeight: '800', color: Brand[500] }}>VOO · Very Safe</ThemedText>
        </View>
        <ThemedText style={{ fontSize: 12, color: theme.textSecondary, lineHeight: 18 }}>
          ~10% historical avg · capital preserved · 62% chance of hitting a modest year goal
        </ThemedText>
      </View>

      <View
        style={{
          borderRadius: Radius.lg,
          borderWidth: 1,
          borderColor: theme.border,
          backgroundColor: theme.backgroundElement,
          padding: 14,
          gap: 8,
          opacity: 0.85,
        }}>
        <View className="flex-row items-center gap-2">
          <ThemedText style={{ fontSize: 20 }}>🎲</ThemedText>
          <ThemedText style={{ fontSize: 13, fontWeight: '800', color: Accent.red }}>Longshot parlay · Very Aggressive</ThemedText>
        </View>
        <ThemedText style={{ fontSize: 12, color: theme.textSecondary, lineHeight: 18 }}>
          All-or-nothing · low true odds · still listed — ranked last, not hidden
        </ThemedText>
      </View>

      <View className="flex-row items-center gap-2 px-1">
        <ThemedText style={{ fontSize: 11, fontWeight: '700', color: Brand[500] }}>↑</ThemedText>
        <ThemedText style={{ fontSize: 11, color: theme.textTertiary, flex: 1 }}>
          We sort every route like this — safest first, hype last
        </ThemedText>
      </View>
    </View>
  );
}

function RoutesPreview(): React.ReactElement {
  const screenHeight = Dimensions.get('window').height;
  const scale = screenHeight < 700 ? 0.78 : screenHeight < 780 ? 0.84 : 0.88;
  const route = DEMO_ROUTES[0];
  const requiredInvestment = 300;
  const scoreBreakdown = goalEffectivenessScore(route, {
    target: 30,
    requiredInvestment,
    availableInvestment: 300,
    deadlineDays: 365,
  });

  return (
    <View className="flex-1 justify-center px-0" style={{ overflow: 'hidden' }}>
      <View style={{ transform: [{ scale }] }}>
        <ThemedText style={{ fontSize: 10, fontWeight: '700', color: Brand[500], letterSpacing: 0.6, marginBottom: 8, marginLeft: 4 }}>
          #1 BEST VALUE FOR YOUR GOAL
        </ThemedText>
        <RouteCard
          route={route}
          requiredInvestment={requiredInvestment}
          currentInvestment={300}
          scoreBreakdown={scoreBreakdown}
        />
      </View>
    </View>
  );
}

function PreviewBetCard({ bet }: { bet: TrackedBet }): React.ReactElement {
  const theme = useTheme();
  const rc = riskColor(bet.riskLevel);
  const statusMap = {
    active: { color: Accent.gold, label: 'Active' },
    won: { color: Brand[500], label: 'Won ✓' },
    lost: { color: Accent.red, label: 'Lost ✗' },
  };
  const { color, label } = statusMap[bet.status];

  return (
    <View
      style={{
        borderRadius: Radius.lg,
        overflow: 'hidden',
        backgroundColor: theme.backgroundElement,
        borderWidth: 1,
        borderColor: theme.border,
        ...Shadow.card,
      }}>
      <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, backgroundColor: rc }} />
      <View style={{ paddingLeft: 18, paddingRight: 14, paddingVertical: 12, gap: 8 }}>
        <View className="flex-row justify-between items-center">
          <View className="flex-row items-center gap-2">
            <ThemedText style={{ fontSize: 18 }}>{bet.emoji}</ThemedText>
            <View>
              <ThemedText style={{ fontSize: 13, fontWeight: '700', color: theme.text }}>{bet.category}</ThemedText>
              <ThemedText style={{ fontSize: 10, color: theme.textTertiary }}>{bet.platform} · {riskLabel(bet.riskLevel)}</ThemedText>
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.pill, backgroundColor: color + '1A' }}>
            <View style={{ width: 5, height: 5, borderRadius: 999, backgroundColor: color }} />
            <ThemedText style={{ fontSize: 10, fontWeight: '700', color }}>{label}</ThemedText>
          </View>
        </View>
        <View className="flex-row items-baseline gap-1">
          <ThemedText style={{ fontSize: 16, fontWeight: '800', color: theme.text, ...MONO }}>${bet.amountWagered}</ThemedText>
          <ThemedText style={{ fontSize: 11, color: theme.textTertiary }}>staked → </ThemedText>
          <ThemedText style={{ fontSize: 12, fontWeight: '700', color: Brand[500], ...MONO }}>+${bet.expectedReturn}</ThemedText>
        </View>
      </View>
    </View>
  );
}

function TrackedPreview(): React.ReactElement {
  const theme = useTheme();
  const [pull] = useState(() => new Animated.Value(0));
  const [spin] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pull, { toValue: 1, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.delay(400),
        Animated.timing(pull, { toValue: 0, duration: 600, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
        Animated.delay(1200),
      ])
    );
    const spinner = Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 900, easing: Easing.linear, useNativeDriver: true })
    );
    loop.start();
    spinner.start();
    return () => {
      loop.stop();
      spinner.stop();
    };
  }, [pull, spin]);

  const translateY = pull.interpolate({ inputRange: [0, 1], outputRange: [0, 28] });
  const refreshOpacity = pull.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 1, 1] });
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  const won = DEMO_TRACKED_BETS.filter((b) => b.status === 'won').reduce((s, b) => s + b.expectedReturn, 0);
  const wagered = DEMO_TRACKED_BETS.reduce((s, b) => s + b.amountWagered, 0);

  return (
    <View className="flex-1 justify-center gap-3">
      <Animated.View style={{ transform: [{ translateY }] }} className="gap-3">
        <Animated.View style={{ opacity: refreshOpacity, alignItems: 'center', marginBottom: -8 }}>
          <Animated.View style={{ transform: [{ rotate }] }}>
            <ThemedText style={{ fontSize: 22, color: Brand[500] }}>↻</ThemedText>
          </Animated.View>
          <ThemedText style={{ fontSize: 11, fontWeight: '700', color: Brand[500], letterSpacing: 0.3 }}>
            PULL TO REFRESH
          </ThemedText>
        </Animated.View>

        <View
          style={{
            borderRadius: Radius.xl,
            backgroundColor: theme.backgroundElevated,
            borderWidth: 1,
            borderColor: theme.border,
            padding: 16,
            gap: 4,
            ...Shadow.card,
          }}>
          <ThemedText style={{ fontSize: 10, fontWeight: '700', color: theme.textTertiary, letterSpacing: 0.8 }}>
            TOTAL P&L
          </ThemedText>
          <ThemedText style={{ fontSize: 34, fontWeight: '800', letterSpacing: -0.8, color: Brand[500], ...MONO }}>
            +${won.toFixed(0)}
          </ThemedText>
          <ThemedText style={{ fontSize: 11, color: theme.textTertiary, ...MONO }}>
            ${wagered.toFixed(0)} wagered · 1 active
          </ThemedText>
        </View>

        {DEMO_TRACKED_BETS.map((bet) => (
          <PreviewBetCard key={bet.id} bet={bet} />
        ))}

        <View
          style={{
            borderRadius: Radius.md,
            backgroundColor: Accent.gold + '18',
            borderWidth: 1,
            borderColor: Accent.gold + '44',
            padding: 10,
            gap: 4,
          }}>
          <ThemedText style={{ fontSize: 10, fontWeight: '800', color: Accent.gold, letterSpacing: 0.4 }}>
            SELL NOW · GOAL HIT
          </ThemedText>
          <ThemedText style={{ fontSize: 11, color: theme.textSecondary }}>
            Heat up 20 at half · +$30 locked — sell before final
          </ThemedText>
        </View>
      </Animated.View>
    </View>
  );
}

export function renderOnboardingPreview(kind: OnboardingSlide['kind']): React.ReactElement {
  switch (kind) {
    case 'welcome':
      return <WelcomePreview />;
    case 'goal':
      return <GoalPreview />;
    case 'safety':
      return <SafetyPreview />;
    case 'routes':
      return <RoutesPreview />;
    case 'tracked':
      return <TrackedPreview />;
  }
}
