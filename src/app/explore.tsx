import React from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

const CATEGORIES = [
  { emoji: '📈', name: 'Stocks & Options', desc: 'ETFs, covered calls, and low-risk options on blue-chip stocks.', color: '#22c55e' },
  { emoji: '₿', name: 'Crypto', desc: 'Spot trades and momentum plays on BTC, ETH, and top altcoins.', color: '#f59e0b' },
  { emoji: '⚽', name: 'Sports Predictions', desc: 'Moneyline, spread, and prop markets on major sports.', color: '#22c55e' },
  { emoji: '🔮', name: 'Polymarket', desc: 'Prediction markets on politics, sports outcomes, and world events.', color: '#a855f7' },
  { emoji: '💱', name: 'Forex', desc: 'Major currency pairs with tight spreads and high liquidity.', color: '#f97316' },
] as const;

export default function LearnScreen(): React.ReactElement {
  const theme = useTheme();

  return (
    <View className="flex-1" style={{ backgroundColor: theme.background }}>
      <SafeAreaView className="flex-1">
        <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="px-4 pt-6 pb-16 gap-4">

          <View className="items-center gap-2 pb-2">
            <ThemedText type="subtitle">How it works</ThemedText>
            <ThemedText type="small" themeColor="textSecondary" className="text-center" style={{ maxWidth: 300 }}>
              Set a profit goal. PolyProfit uses AI to find the best routes across every market — sorted safest to riskiest.
            </ThemedText>
          </View>

          <ThemedText
            type="small"
            themeColor="textSecondary"
            className="tracking-widest"
            style={{ fontSize: 11, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase' }}>
            Markets Covered
          </ThemedText>

          {CATEGORIES.map((cat) => (
            <View
              key={cat.name}
              className="rounded-2xl p-4 flex-row items-start gap-3 border"
              style={{ backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }}>
              <View
                className="w-11 h-11 rounded-2xl items-center justify-center mt-0.5"
                style={{ backgroundColor: cat.color + '22' }}>
                <ThemedText style={{ fontSize: 20 }}>{cat.emoji}</ThemedText>
              </View>
              <View className="flex-1 gap-0.5">
                <ThemedText type="smallBold">{cat.name}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">{cat.desc}</ThemedText>
              </View>
            </View>
          ))}

          <ThemedText type="small" themeColor="textSecondary" className="text-center" style={{ opacity: 0.5 }}>
            PolyProfit is for entertainment purposes only. Always research before investing or betting real money.
          </ThemedText>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
