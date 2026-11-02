import { View } from 'react-native';

import { routeFeed, useRouteLive } from '@/api/hooks/useRouteLive';
import { LiveBadge, LiveQuote, Sparkline, SparklinePlaceholder } from '@/components/molecules/Sparkline';
import { ThemedText } from '@/components/themed-text';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Route } from '@/types/routes';

const MONO = { fontVariant: ['tabular-nums' as const] };
const CHART_HEIGHT = 90;

/**
 * The market for what this route buys, large: the latest print, its move, and the
 * line it took to get there. Where there is no tradable price, or none came back,
 * it shows `fallback` — the route's own words — instead of an empty chart.
 */
export function RouteLiveChart({ route, fallback }: { route: Route; fallback: React.ReactElement }): React.ReactElement {
  const theme = useTheme();
  const { live, loading } = useRouteLive(route);
  const feed = routeFeed(route);
  // No market to draw, or the feed came back empty: the plain words instead.
  if (!feed || (!live && !loading)) return fallback;

  const title = feed.kind === 'outcome' ? `${feed.side} price` : feed.symbol.replace(/-USD$/, '');
  const price = live
    ? live.kind === 'outcome'
      ? `${(live.last * 100).toFixed(1)}¢`
      : `$${live.last.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: live.last >= 1_000 ? 0 : 2 })}`
    : '—';

  return (
    <View
      style={{
        backgroundColor: theme.backgroundElement,
        borderRadius: Radius.lg,
        borderWidth: 1,
        borderColor: theme.border,
        padding: 13,
        gap: 8,
      }}>
      <View className="flex-row items-start justify-between" style={{ gap: 10 }}>
        <View style={{ gap: 3, flex: 1 }}>
          <ThemedText style={{ fontSize: 10, color: theme.textTertiary, fontWeight: '700', letterSpacing: 0.6 }}>
            {title.toUpperCase()}
          </ThemedText>
          <ThemedText style={{ fontSize: 20, fontWeight: '800', color: theme.text, letterSpacing: -0.4, ...MONO }}>
            {price}
          </ThemedText>
          {live ? <LiveQuote live={live} showPrice={false} /> : null}
        </View>
        {live ? <LiveBadge /> : null}
      </View>
      {live ? <Sparkline live={live} height={CHART_HEIGHT} strokeWidth={2} /> : <SparklinePlaceholder height={CHART_HEIGHT} />}
    </View>
  );
}
