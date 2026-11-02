import { View } from 'react-native';

import { Brand } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Route } from '@/types/routes';

/** Routes counted into 5-point chance bins, matching the slider's step: 0–4 … 85–89, 90+. */
const CHANCE_BINS = 19;
const HISTOGRAM_HEIGHT = 36;

/**
 * How the routes spread across chance of hitting the goal, drawn right on top of the
 * slider so dragging it visibly greys out the bars it cuts. Without it the slider was
 * a blind number: nothing said whether 60% kept three routes or thirty.
 */
export function ChanceHistogram({ routes, threshold }: { routes: Route[]; threshold: number }): React.ReactElement {
  const theme = useTheme();
  const counts = new Array<number>(CHANCE_BINS).fill(0);
  for (const route of routes) {
    const bin = Math.min(CHANCE_BINS - 1, Math.max(0, Math.floor(route.probability / 5)));
    counts[bin] += 1;
  }
  const max = Math.max(1, ...counts);
  return (
    <View
      className="flex-row items-end"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      // Inset by roughly the slider thumb's radius, so bin 0 sits over 0% and the last
      // bin over 90%.
      style={{ height: HISTOGRAM_HEIGHT, gap: 2, paddingHorizontal: 10, marginTop: 4 }}>
      {counts.map((count, bin) => (
        <View
          key={bin}
          style={{
            flex: 1,
            height: count === 0 ? 2 : Math.max(4, (count / max) * HISTOGRAM_HEIGHT),
            borderTopLeftRadius: 2,
            borderTopRightRadius: 2,
            backgroundColor: count === 0
              ? theme.border
              : bin * 5 >= threshold ? Brand[500] : theme.borderControl,
          }}
        />
      ))}
    </View>
  );
}
