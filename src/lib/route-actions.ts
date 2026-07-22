import * as Linking from 'expo-linking';

import { Route } from '@/types/routes';

type TradeDestination = 'polymarket' | 'robinhood';

function searchText(route: Route): string {
  return [route.description, route.line, route.category].filter(Boolean).join(' ');
}

function urlsFor(route: Route, destination: TradeDestination): string[] {
  const query = encodeURIComponent(searchText(route));
  if (destination === 'polymarket') {
    return [
      `polymarket://search?query=${query}`,
      `https://polymarket.com/search?query=${query}`,
    ];
  }

  return [
    `robinhood://search?query=${query}`,
    `https://robinhood.com/search/?query=${query}`,
  ];
}

export async function openTradeDestination(route: Route, destination: TradeDestination): Promise<boolean> {
  for (const url of urlsFor(route, destination)) {
    try {
      const canOpen = url.startsWith('http') || (await Linking.canOpenURL(url));
      if (!canOpen) continue;
      await Linking.openURL(url);
      return true;
    } catch {
      // Try the next URL, usually the web fallback after an app scheme fails.
    }
  }
  return false;
}
