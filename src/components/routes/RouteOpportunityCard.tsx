import { Pressable, View } from 'react-native';

import { formatMaturity, riskColor, riskLabel } from '@/components/molecules/RouteCard';
import { ThemedText } from '@/components/themed-text';
import { Accent, Brand, Radius, Shadow } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { debtLiquidityLabel, debtYieldLabel, isDebtRoute } from '@/lib/route-investment-metrics';
import { liquidityLabel, routeDisplayTitle, volatilityLabel } from '@/lib/route-detail';
import type { Route } from '@/types/routes';

const MONO = { fontVariant: ['tabular-nums' as const] };

interface RouteOpportunityCardProps {
  route: Route;
  stake: number;
  neededToHitGoal: number | null;
  added: boolean;
  adding: boolean;
  onAdd: () => void;
}

export function RouteOpportunityCard({ route, stake, neededToHitGoal, added, adding, onAdd }: RouteOpportunityCardProps): React.ReactElement {
  const theme = useTheme();
  const color = riskColor(route.riskLevel);
  const binary = route.lossProfile === 'binary';
  const returnPct = stake > 0 ? (route.expectedReturn / stake) * 100 : 0;
  const volatility = volatilityLabel(route.riskLevel);
  const liquidity = liquidityLabel(route.probability);
  const correlation = route.category.match(/treasur|savings|cash/i) ? 'High' : 'Low';
  const debt = isDebtRoute(route);

  return (
    <View style={{ borderRadius: Radius.xl, overflow: 'hidden', backgroundColor: theme.backgroundElevated, borderWidth: 1, borderColor: theme.border, padding: 16, gap: 14, ...Shadow.card }}>
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          <View style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: Radius.pill, backgroundColor: color + '18' }}><ThemedText style={{ fontSize: 11, color, fontWeight: '900' }}>{riskLabel(route.riskLevel).toUpperCase()}</ThemedText></View>
          {route.maturesInDays ? <View style={{ paddingHorizontal: 10, paddingVertical: 7, borderRadius: Radius.pill, backgroundColor: theme.backgroundElement, borderWidth: 1, borderColor: theme.border }}><ThemedText style={{ fontSize: 11, color: theme.textSecondary, fontWeight: '800' }}>⏳ {formatMaturity(route.maturesInDays)}</ThemedText></View> : null}
        </View>
        <ThemedText style={{ fontSize: 13, color: Brand[500], fontWeight: '700' }}>{route.platform || route.category}</ThemedText>
      </View>

      <View className="flex-row items-center gap-4">
        <View style={{ width: 76, height: 76, borderRadius: Radius.xl, backgroundColor: color + '20', alignItems: 'center', justifyContent: 'center', ...Shadow.card }}><ThemedText style={{ fontSize: 38 }}>{route.emoji}</ThemedText></View>
        <View className="flex-1"><ThemedText style={{ fontSize: 19, lineHeight: 25, fontWeight: '900', color: Brand[500], letterSpacing: -0.2, ...MONO }}>{routeDisplayTitle(route)}</ThemedText><ThemedText style={{ fontSize: 13, lineHeight: 18, color: theme.textSecondary, marginTop: 6 }}>{route.description}</ThemedText></View>
      </View>

      <View className="flex-row items-center">
        <Metric value={route.meetsTarget ? `${route.probability}%` : 'No'} label={route.meetsTarget ? 'Chance of goal' : 'Hits goal'} />
        <Divider />
        <Metric value={`+$${route.expectedReturn}`} label={debt ? 'Projected profit' : 'Potential profit'} subLabel={`(${returnPct.toFixed(1)}% return)`} />
        <Divider />
        <Metric value={`+$${Math.round((route.probability / 100) * route.expectedReturn)}`} label="Expected return" subLabel="prob × profit" />
      </View>
      <ThemedText style={{ fontSize: 13, color: theme.textSecondary }}>Based on historical data & live market odds</ThemedText>

      {neededToHitGoal ? <View className="flex-row items-center justify-between" style={{ borderRadius: Radius.lg, backgroundColor: theme.backgroundElement, borderWidth: 1, borderColor: route.meetsTarget ? Brand[500] + '35' : Accent.gold + '55', padding: 13 }}><View><ThemedText style={{ fontSize: 11, color: theme.textTertiary, fontWeight: '800' }}>NEED TO HIT GOAL</ThemedText><ThemedText style={{ fontSize: 12, color: theme.textSecondary, marginTop: 3 }}>Current amount: ${stake.toLocaleString()}</ThemedText></View><ThemedText style={{ fontSize: 24, color: route.meetsTarget ? Brand[500] : theme.text, fontWeight: '900', ...MONO }}>${neededToHitGoal.toLocaleString()}</ThemedText></View> : null}

      <Section title="Risk Breakdown">
        <RiskRow label="Probability" value={`${route.probability}%`} percent={route.probability} color={Brand[500]} />
        <RiskRow label="Volatility" value={volatility} percent={route.riskLevel * 20} color={volatility === 'High' ? Accent.red : volatility === 'Medium' ? Accent.gold : Brand[500]} />
        <RiskRow label="Liquidity" value={liquidity} percent={liquidity === 'High' ? 95 : liquidity === 'Medium' ? 62 : 32} color={Brand[500]} />
        <RiskRow label="Correlation" value={correlation} percent={correlation === 'High' ? 80 : 34} color={correlation === 'High' ? Accent.gold : Brand[500]} />
      </Section>

      {debt && <Section title="Investment Facts"><View className="flex-row gap-2"><Fact label="Yield" value={debtYieldLabel(route, stake) ?? 'Check quote'} /><Fact label="Maturity" value={route.maturesInDays ? formatMaturity(route.maturesInDays) : 'Flexible'} /></View><View className="flex-row gap-2"><Fact label="Capital risk" value={route.lossProfile === 'partial' ? 'Lower downside' : 'Stake at risk'} /><Fact label="Liquidity" value={debtLiquidityLabel(route) ?? 'Check exit terms'} /></View><View className="flex-row gap-2"><Fact label="Source" value={route.investmentFacts?.yieldSource ?? 'Unavailable'} /><Fact label="As of" value={route.investmentFacts?.yieldAsOf ?? 'Unavailable'} /></View>{route.investmentFacts?.projectionBasis && <ThemedText style={{ fontSize: 12, lineHeight: 17, color: theme.textSecondary }}>Projection: {route.investmentFacts.projectionBasis}.</ThemedText>}<ThemedText style={{ fontSize: 12, lineHeight: 17, color: theme.textSecondary }}>Also compare after-tax yield, fees, lockup/early-exit terms, issuer/backing, and whether the maturity matches your goal date.</ThemedText></Section>}

      <Section title="Potential Outcome">
        {binary ? <><Outcome color={Brand[500]} label="Bet hits" chance={`${route.probability}% chance`} value={`+$${route.expectedReturn}`} /><Outcome color={Accent.red} label="Bet misses — stake gone" chance={`${100 - route.probability}% chance`} value={`−$${stake}`} /></> : <><Outcome color={Brand[500]} label="Target hit" chance={`${route.probability}% chance`} value={`+$${route.expectedReturn}`} /><Outcome color={Accent.gold} label="Probability-weighted average" chance="what this is worth on average" value={`+$${Math.round((route.probability / 100) * route.expectedReturn)}`} /><Outcome color={Accent.red} label="Rough downside if it goes wrong" chance={`~${route.riskLevel * 8}% drawdown`} value={`−$${Math.round(stake * route.riskLevel * 0.08)}`} /></>}
      </Section>

      <Pressable onPress={onAdd} disabled={added || adding} className="py-4 items-center active:opacity-85" style={{ borderRadius: Radius.lg, backgroundColor: Brand[500], opacity: added || adding ? 0.65 : 1, ...Shadow.card }}><ThemedText style={{ fontSize: 16, fontWeight: '900', color: '#06140C' }}>{added ? 'Added to portfolio' : adding ? 'Adding...' : 'Add to portfolio →'}</ThemedText></Pressable>
    </View>
  );
}

function Section({ title, children }: React.PropsWithChildren<{ title: string }>): React.ReactElement { const theme = useTheme(); return <View style={{ borderRadius: Radius.lg, backgroundColor: theme.backgroundElement, borderWidth: 1, borderColor: theme.border, padding: 13, gap: 12 }}><ThemedText style={{ fontSize: 15, fontWeight: '800', color: theme.text }}>{title}</ThemedText>{children}</View>; }
function Divider(): React.ReactElement { const theme = useTheme(); return <View style={{ width: 1, height: 58, backgroundColor: theme.border }} />; }
function Metric({ value, label, subLabel }: { value: string; label: string; subLabel?: string }): React.ReactElement { const theme = useTheme(); return <View className="flex-1 items-center gap-1"><ThemedText style={{ fontSize: 34, fontWeight: '900', color: Brand[500], ...MONO }}>{value}</ThemedText><ThemedText style={{ fontSize: 13, color: theme.textSecondary, fontWeight: '600' }}>{label}</ThemedText>{subLabel && <ThemedText style={{ fontSize: 11, color: Brand[500], fontWeight: '700' }}>{subLabel}</ThemedText>}</View>; }
function RiskRow({ label, value, percent, color }: { label: string; value: string; percent: number; color: string }): React.ReactElement { const theme = useTheme(); return <View className="flex-row items-center gap-3"><ThemedText style={{ width: 92, fontSize: 13, color: theme.textSecondary, fontWeight: '600' }}>{label}</ThemedText><View className="flex-1" style={{ height: 6, borderRadius: Radius.pill, backgroundColor: theme.backgroundSelected, overflow: 'hidden' }}><View style={{ width: `${Math.max(0, Math.min(100, percent))}%`, height: '100%', borderRadius: Radius.pill, backgroundColor: color }} /></View><ThemedText style={{ width: 46, textAlign: 'right', fontSize: 13, color: theme.text, fontWeight: '800', ...MONO }}>{value}</ThemedText></View>; }
function Fact({ label, value }: { label: string; value: string }): React.ReactElement { const theme = useTheme(); return <View className="flex-1" style={{ borderRadius: Radius.md, backgroundColor: theme.backgroundSelected, paddingHorizontal: 12, paddingVertical: 10 }}><ThemedText style={{ fontSize: 10, color: theme.textTertiary, fontWeight: '800' }}>{label.toUpperCase()}</ThemedText><ThemedText style={{ fontSize: 13, color: theme.text, fontWeight: '800', marginTop: 4 }} numberOfLines={2}>{value}</ThemedText></View>; }
function Outcome({ color, label, chance, value }: { color: string; label: string; chance: string; value: string }): React.ReactElement { const theme = useTheme(); return <View className="flex-row items-center gap-3"><View style={{ width: 9, height: 9, borderRadius: 999, backgroundColor: color }} /><View className="flex-1"><ThemedText style={{ fontSize: 13, fontWeight: '700', color: theme.text }}>{label}</ThemedText><ThemedText style={{ fontSize: 11, color: theme.textTertiary }}>{chance}</ThemedText></View><ThemedText style={{ fontSize: 15, fontWeight: '900', color, ...MONO }}>{value}</ThemedText></View>; }
