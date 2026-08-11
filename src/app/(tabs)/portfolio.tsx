import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSavedRoutes } from '@/api/hooks/useSavedRoutes';
import { useTrackedBets } from '@/api/hooks/useTrackedBets';
import { AllocationDonut, buildAllocationRows, buildEquitySeries, compactAssetClass, PerformanceChart } from '@/components/portfolio/PortfolioVisuals';
import { ThemedText } from '@/components/themed-text';
import { Accent, Brand, Radius, Shadow } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { portfolioStats } from '@/lib/portfolio';

const MONO = { fontVariant: ['tabular-nums' as const] };

export default function PortfolioScreen(): React.ReactElement {
  const theme = useTheme();
  const router = useRouter();
  const { bets } = useTrackedBets();
  const { history } = useSavedRoutes();
  const [conservative, setConservative] = useState(false);
  const latestSearch = history[0] ?? null;
  const fallbackCash = latestSearch?.quizSnapshot.balance ?? 0;
  const activeBets = useMemo(() => bets.filter((bet) => bet.status === 'active'), [bets]);
  const stats = useMemo(() => portfolioStats(bets, conservative), [bets, conservative]);
  const rows = useMemo(() => buildAllocationRows(bets, fallbackCash, conservative), [bets, conservative, fallbackCash]);
  const equity = useMemo(() => buildEquitySeries(bets, fallbackCash, conservative), [bets, conservative, fallbackCash]);
  const totalValue = activeBets.length > 0 ? activeBets.reduce((sum, bet) => sum + bet.amountWagered, 0) : fallbackCash;
  const chartValue = equity.at(-1)?.value ?? totalValue;
  const startingValue = equity[0]?.value ?? chartValue;
  const chartChange = chartValue - startingValue;
  const chartChangePct = startingValue > 0 ? (chartChange / startingValue) * 100 : 0;
  const targetValue = latestSearch ? latestSearch.quizSnapshot.balance + latestSearch.quizSnapshot.target : totalValue;

  return (
    <View className="flex-1" style={{ backgroundColor: theme.background }}>
      <SafeAreaView className="flex-1">
        <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="px-4 pt-6 pb-16 gap-4">
          <View>
            <ThemedText style={{ fontSize: 26, fontWeight: '800', color: Brand[500], letterSpacing: -0.5 }}>Portfolio Overview</ThemedText>
            <ThemedText style={{ fontSize: 14, color: theme.textSecondary, marginTop: 4 }}>Weighted avg return & allocation</ThemedText>
          </View>

          <View style={{ borderRadius: Radius.xl, backgroundColor: theme.backgroundElevated, borderWidth: 1, borderColor: theme.border, padding: 18, gap: 16, ...Shadow.card }}>
            <View className="flex-row justify-between items-start gap-3">
              <View className="flex-1"><ThemedText style={{ fontSize: 24, fontWeight: '800', color: theme.text, letterSpacing: -0.4 }}>My Portfolio</ThemedText><ThemedText style={{ fontSize: 14, color: theme.textSecondary, marginTop: 3 }}>Overview</ThemedText></View>
              <View className="items-end"><ThemedText style={{ fontSize: 11, color: theme.textTertiary, fontWeight: '700' }}>Total Value</ThemedText><ThemedText style={{ fontSize: 22, fontWeight: '800', color: theme.text, marginTop: 5, ...MONO }}>${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</ThemedText></View>
            </View>

            <View style={{ borderRadius: Radius.lg, backgroundColor: theme.background, borderWidth: 1, borderColor: theme.border, padding: 14, gap: 12 }}>
              <View className="flex-row items-end justify-between gap-3">
                <View><ThemedText style={{ fontSize: 12, fontWeight: '800', color: theme.textTertiary }}>POSITION CURVE</ThemedText><ThemedText style={{ fontSize: 32, fontWeight: '900', color: theme.text, marginTop: 5, ...MONO }}>${chartValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</ThemedText></View>
                <View className="items-end"><ChangeText value={chartChange} suffix={`$${Math.abs(chartChange).toFixed(0)}`} /><ChangeText value={chartChangePct} suffix={`${Math.abs(chartChangePct).toFixed(1)}%`} small /></View>
              </View>
              <PerformanceChart points={equity} />
            </View>

            <View className="flex-row gap-3">
              <MetricCard label="Weighted Avg Return" value={`${stats.weightedReturnPct < 0 ? '-' : ''}${Math.abs(activeBets.length ? stats.weightedReturnPct : 0).toFixed(1)}%`} valueColor={stats.weightedReturnPct >= 0 ? Brand[500] : Accent.red}>
                <Pressable onPress={() => setConservative((current) => !current)} className="active:opacity-70"><ThemedText style={{ fontSize: 12, color: conservative ? Accent.gold : theme.textSecondary, fontWeight: conservative ? '700' : '400', marginTop: 4 }}>{conservative ? '🛡 Stocks/crypto → 0%' : 'Projected · tap for conservative'}</ThemedText></Pressable>
              </MetricCard>
              <MetricCard label="Probability of Goal" value={`${activeBets.length ? stats.goalProbability.toFixed(0) : '0'}%`} valueColor={Brand[500]}><ThemedText style={{ fontSize: 12, color: theme.textSecondary, marginTop: 4 }}>To reach ${targetValue.toLocaleString()}</ThemedText></MetricCard>
            </View>
          </View>

          <View style={{ borderRadius: Radius.xl, backgroundColor: theme.backgroundElevated, borderWidth: 1, borderColor: theme.border, padding: 18, gap: 18, ...Shadow.card }}>
            <ThemedText style={{ fontSize: 15, fontWeight: '800', color: theme.text }}>Allocation by Asset Class</ThemedText>
            <View className="flex-row items-center" style={{ gap: 18 }}>
              <AllocationDonut rows={rows} />
              <View className="flex-1" style={{ gap: 10 }}>
                {rows.map((row) => <View key={row.category} className="flex-row items-center gap-2"><View style={{ width: 9, height: 9, borderRadius: 999, backgroundColor: row.color }} /><ThemedText style={{ flex: 1, fontSize: 13, fontWeight: '700', color: theme.text }}>{row.category}</ThemedText><ThemedText style={{ width: 42, textAlign: 'right', fontSize: 13, color: theme.text, ...MONO }}>{row.pct.toFixed(0)}%</ThemedText><ThemedText style={{ width: 58, textAlign: 'right', fontSize: 13, color: theme.textSecondary, ...MONO }}>${row.staked.toFixed(0)}</ThemedText></View>)}
              </View>
            </View>
            <View className="gap-3">
              <ThemedText style={{ fontSize: 15, fontWeight: '800', color: theme.text }}>Expected Return Contribution</ThemedText>
              {rows.map((row) => <View key={`${row.category}-ev`} className="flex-row items-center gap-2"><View style={{ width: 8, height: 8, borderRadius: 999, backgroundColor: row.color }} /><ThemedText style={{ flex: 1, fontSize: 13, fontWeight: '600', color: theme.text }}>{row.category}</ThemedText><ThemedText style={{ fontSize: 13, fontWeight: '700', color: theme.text, ...MONO }}>{row.evPct.toFixed(1)}%</ThemedText></View>)}
            </View>
          </View>

          {activeBets.length === 0 ? (
            <Pressable onPress={() => router.push('/(tabs)/routes')} className="py-3 items-center active:opacity-80" style={{ borderRadius: Radius.lg, backgroundColor: Brand[500], ...Shadow.card }}><ThemedText style={{ fontSize: 14, fontWeight: '800', color: '#06140C' }}>Acquire a route to build your portfolio</ThemedText></Pressable>
          ) : (
            <View className="gap-3">
              <View className="flex-row justify-between items-center" style={{ paddingHorizontal: 4 }}><ThemedText style={{ fontSize: 15, fontWeight: '800', color: theme.text }}>Active Positions</ThemedText><Pressable onPress={() => router.push('/positions')} className="active:opacity-60"><ThemedText style={{ fontSize: 13, fontWeight: '700', color: Brand[500] }}>Manage →</ThemedText></Pressable></View>
              {activeBets.slice(0, 5).map((bet) => <View key={bet.id} style={{ borderRadius: Radius.lg, backgroundColor: theme.backgroundElement, borderWidth: 1, borderColor: theme.border, padding: 14, gap: 4 }}><View className="flex-row justify-between gap-3"><ThemedText style={{ flex: 1, fontSize: 13, fontWeight: '800', color: theme.text }} numberOfLines={1}>{compactAssetClass(bet.category)} · {bet.description}</ThemedText><ThemedText style={{ fontSize: 13, fontWeight: '700', color: Brand[500], ...MONO }}>${bet.amountWagered.toFixed(0)}</ThemedText></View><ThemedText style={{ fontSize: 12, color: theme.textSecondary }} numberOfLines={1}>{bet.platform} · {bet.probability}% chance · +${bet.expectedReturn}</ThemedText></View>)}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function ChangeText({ value, suffix, small = false }: { value: number; suffix: string; small?: boolean }): React.ReactElement {
  return <ThemedText style={{ fontSize: small ? 12 : 15, fontWeight: '900', color: value >= 0 ? Brand[500] : Accent.red, ...MONO }}>{value >= 0 ? '+' : '-'}{suffix}</ThemedText>;
}

function MetricCard({ label, value, valueColor, children }: React.PropsWithChildren<{ label: string; value: string; valueColor: string }>): React.ReactElement {
  const theme = useTheme();
  return <View className="flex-1" style={{ borderRadius: Radius.lg, backgroundColor: theme.backgroundElement, borderWidth: 1, borderColor: theme.border, padding: 14 }}><ThemedText style={{ fontSize: 12, fontWeight: '700', color: theme.textTertiary }}>{label}</ThemedText><ThemedText style={{ fontSize: 34, fontWeight: '800', color: valueColor, marginTop: 8, ...MONO }}>{value}</ThemedText>{children}</View>;
}
