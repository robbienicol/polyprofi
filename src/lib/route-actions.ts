import * as Linking from 'expo-linking';

import { tradeUrlsFor } from '@/lib/acquisition-routing';
import type { TradeDestination, TradeDestinationOptions } from '@/lib/acquisition-routing';
import type { Route } from '@/types/routes';

export { preferredTradeDestination, tradeDestinationLabel } from '@/lib/acquisition-routing';
export type { TradeDestination, TradeDestinationOptions } from '@/lib/acquisition-routing';

export async function openTradeDestination(
  route: Route,
  destination: TradeDestination,
  options: TradeDestinationOptions = {},
): Promise<boolean> {
  for (const url of tradeUrlsFor(route, destination, options)) {
    try {
      const canOpen = url.startsWith('http') || (await Linking.canOpenURL(url));
      if (!canOpen) continue;
      await Linking.openURL(url);
      return true;
    } catch {
      // Try the next URL, usually the generic marketplace after an exact market fails.
    }
  }
  return false;
}
