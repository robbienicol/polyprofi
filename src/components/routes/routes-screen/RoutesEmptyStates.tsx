import { Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon } from '@/components/ui/Icon';
import { ThemedText } from '@/components/themed-text';
import { Brand, OnBrand, Radius, Semantic, Shadow } from '@/constants/theme';
import { useSemanticText, useTheme } from '@/hooks/use-theme';
import type { RouteFilters as Filters } from '@/lib/route-results';

export function Screen({ children }: React.PropsWithChildren): React.ReactElement {
  const theme = useTheme();
  return <View className="flex-1" style={{ backgroundColor: theme.background }}><SafeAreaView className="flex-1">{children}</SafeAreaView></View>;
}

export function EmptyRoutes({ hasSavedQuiz, onStart }: { hasSavedQuiz: boolean; onStart: () => void }): React.ReactElement {
  const theme = useTheme();
  return <Screen><View className="flex-1 justify-center px-6"><View className="items-center gap-4 py-10 px-6" style={{ borderRadius: Radius.xl, backgroundColor: theme.backgroundElevated, borderWidth: 1, borderColor: theme.border, ...Shadow.card }}><Icon glyph="🎯" size={38} color={Brand[500]} strokeWidth={1.5} /><ThemedText style={{ fontSize: 22, fontWeight: '800', color: theme.text, textAlign: 'center' }}>Price every route to your goal</ThemedText><ThemedText className="text-center" style={{ fontSize: 14, color: theme.textSecondary, lineHeight: 21, maxWidth: 300 }}>{hasSavedQuiz ? 'Use your saved goal and preferences to price a fresh set of routes.' : 'Set your number and your deadline. We price every route to it — savings, treasuries, funds, coins, card rewards, spending cuts and prediction markets — and rank them safest first.'}</ThemedText><Pressable onPress={onStart} className="self-stretch py-4 items-center active:opacity-85 mt-2" style={{ borderRadius: Radius.lg, backgroundColor: Brand[500], ...Shadow.card }}><ThemedText style={{ fontSize: 16, fontWeight: '800', color: OnBrand }}>{hasSavedQuiz ? 'Find routes from saved quiz →' : 'Set goal & search →'}</ThemedText></Pressable></View></View></Screen>;
}

export function RoutesError({ message, onRetry }: { message: string; onRetry: () => void }): React.ReactElement {
  const theme = useTheme();
  return <View className="items-center gap-2 py-10 px-6" style={{ borderRadius: Radius.lg, backgroundColor: Semantic.negative + '12', borderWidth: 1, borderColor: Semantic.negative + '30' }}><Icon glyph="⚠️" size={23} color={Semantic.negative} /><ThemedText style={{ fontSize: 14, fontWeight: '700', color: theme.text }}>Couldn&apos;t load routes</ThemedText><ThemedText className="text-center" style={{ fontSize: 13, color: theme.textSecondary }}>{message}</ThemedText><Pressable onPress={onRetry} accessibilityRole="button" className="active:opacity-70 mt-1 justify-center" style={{ borderRadius: Radius.md, paddingHorizontal: 20, minHeight: 44, backgroundColor: Brand[500] }}><ThemedText style={{ fontSize: 14, fontWeight: '700', color: OnBrand }}>Try again</ThemedText></Pressable></View>;
}

/**
 * A search that found nothing anywhere. This is a coverage answer, not a filter one:
 * clearing filters would not help, because there is no route behind them. Saying what
 * we DO cover is the useful half — "we don't have that" alone reads as a bug.
 *
 * Prediction markets are searched live across the whole Polymarket catalog, so a miss
 * there means the market genuinely doesn't exist or has already settled. Funds, stocks
 * and coins come from a curated universe, so a miss there means we deliberately don't
 * carry it — and that distinction is not worth explaining to the user mid-search.
 */
export function EmptyUncovered({ keyword, onClear }: { keyword: string; onClear: () => void }): React.ReactElement {
  const theme = useTheme();
  const semantic = useSemanticText();
  return (
    <View className="items-center gap-2 py-10 px-6">
      <Icon glyph="🔍" size={25} color={theme.textSecondary} />
      <ThemedText type="smallBold" className="text-center">Nothing we can price for “{keyword}”</ThemedText>
      <ThemedText type="small" themeColor="textSecondary" className="text-center" style={{ lineHeight: 19, maxWidth: 320 }}>
        We searched every open Polymarket contract plus the funds, stocks and coins we
        cover. Either no live market matches, or it&apos;s an asset we don&apos;t carry —
        we only route to things we can price honestly.
      </ThemedText>
      <Pressable
        onPress={onClear}
        accessibilityRole="button"
        className="active:opacity-60 justify-center"
        style={{ minHeight: 44, paddingHorizontal: 12 }}>
        <ThemedText type="small" style={{ color: semantic.brand, fontWeight: '700' }}>Clear search</ThemedText>
      </Pressable>
      <ThemedText type="small" style={{ color: theme.textSecondary, fontSize: 11 }}>
        Try a team, a person, a ticker, or what a fund holds.
      </ThemedText>
    </View>
  );
}

/**
 * Empty results. When the chance filter is what emptied the list, the honest advice is
 * rarely "clear your filters" — the high-chance routes are real, they just need more
 * capital than the user said they would put in. Offer the amount that brings one back.
 */
export function EmptyFiltered({ filters, unlockAmount, onRaiseInvestment, onClear }: {
  filters: Filters;
  unlockAmount: number | null;
  onRaiseInvestment: (amount: number) => void;
  onClear: () => void;
}): React.ReactElement {
  const semantic = useSemanticText();
  /*
   * Every branch names the filter that emptied the list. Interpolating a possibly-null
   * category straight into the string is what produced "No  routes" — a double space
   * and no explanation — on the one screen whose job is to be legible when the answer
   * is bad news.
   */
  const title = filters.minimumProbability > 0
    ? `No routes with a ${filters.minimumProbability}% chance or better`
    : filters.category
      ? `No ${filters.category.toLowerCase()} routes match your filters`
      : 'Your filters are hiding every route';
  return (
    <View className="items-center gap-2 py-8 px-6">
      <ThemedText type="smallBold">{title}</ThemedText>
      {unlockAmount != null && (
        <>
          <ThemedText type="small" themeColor="textSecondary" className="text-center" style={{ lineHeight: 19 }}>
            A high chance of hitting the goal comes from safe, low-yield routes, and those need
            more capital. Raising what you&apos;re willing to invest to ${unlockAmount.toLocaleString()} brings one back.
          </ThemedText>
          <Pressable
            onPress={() => onRaiseInvestment(unlockAmount)}
            accessibilityRole="button"
            accessibilityHint="Sets what you are willing to invest to that amount and re-ranks the list"
            className="active:opacity-85 mt-1 justify-center"
            style={{ borderRadius: Radius.md, paddingHorizontal: 16, minHeight: 44, backgroundColor: Brand[500] }}>
            <ThemedText style={{ fontSize: 14, fontWeight: '800', color: OnBrand }}>
              Invest up to ${unlockAmount.toLocaleString()}
            </ThemedText>
          </Pressable>
        </>
      )}
      <Pressable
        onPress={onClear}
        accessibilityRole="button"
        className="active:opacity-60 justify-center"
        style={{ minHeight: 44, paddingHorizontal: 12 }}>
        <ThemedText type="small" style={{ color: semantic.brand, fontWeight: '700' }}>Clear filters</ThemedText>
      </Pressable>
    </View>
  );
}

/**
 * The line that closes the list. It was 40% opacity over secondary text — 1.7:1, the
 * least legible thing in the app — carrying the one disclosure on the screen that
 * ranks things. It reads at full strength now, and leads with what Pathey is rather
 * than with "AI-generated", which is the half most likely to be misread as a warning
 * about the numbers rather than a statement about how they were assembled.
 */
export function RoutesDisclosure({ historical }: { historical: boolean }): React.ReactElement {
  const theme = useTheme();
  return (
    <View style={{ alignItems: 'center', gap: 3, paddingTop: 4 }}>
      <ThemedText style={{ fontSize: 13, fontWeight: '700', color: theme.textSecondary, textAlign: 'center' }}>
        Not advice. Just the math.
      </ThemedText>
      <ThemedText style={{ fontSize: 12, lineHeight: 17, color: theme.textSecondary, textAlign: 'center' }}>
        {`${historical ? 'Saved search. ' : 'Pull down to refresh. '}Not financial advice. Figures are estimates, assembled with AI from live market data.`}
      </ThemedText>
    </View>
  );
}
