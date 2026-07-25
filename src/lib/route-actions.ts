import * as Linking from 'expo-linking';

import { Route } from '@/types/routes';

type TradeDestination = 'polymarket' | 'robinhood';

/**
 * Robinhood affiliate (Impact) tracking link. Referral commissions are only attributed
 * when the user arrives through this link, so drop your approved Impact link here — or,
 * preferably, set EXPO_PUBLIC_ROBINHOOD_AFFILIATE_URL in .env and leave this default.
 *
 * The Impact link looks like `https://robinhood.pxf.io/c/<partnerId>/<campaignId>/<adId>`
 * (or an `imp.pxf.io` / `.sjv.io` variant). Impact forwards a `u` query param as the final
 * landing page, so we append the specific Robinhood page the user was headed to — the click
 * is tracked AND lands them in the right place. While this is empty, referrals fall back to
 * the plain (untracked) Robinhood links, so nothing breaks before you're approved.
 */
const ROBINHOOD_AFFILIATE_URL = process.env.EXPO_PUBLIC_ROBINHOOD_AFFILIATE_URL ?? '';

function searchText(route: Route): string {
  return [route.description, route.line, route.category].filter(Boolean).join(' ');
}

/** Append the intended destination as Impact's `u` deep-link param. */
function withAffiliateDestination(affiliateUrl: string, destination: string): string {
  const separator = affiliateUrl.includes('?') ? '&' : '?';
  return `${affiliateUrl}${separator}u=${encodeURIComponent(destination)}`;
}

function urlsFor(route: Route, destination: TradeDestination): string[] {
  const query = encodeURIComponent(searchText(route));
  if (destination === 'polymarket') {
    return [
      `polymarket://search?query=${query}`,
      `https://polymarket.com/search?query=${query}`,
    ];
  }

  const robinhoodWeb = `https://robinhood.com/search/?query=${query}`;
  if (ROBINHOOD_AFFILIATE_URL) {
    // Affiliate web link first so the referral cookie is set in the browser; the plain
    // web page is a fallback if the tracking link fails. We skip the robinhood:// app
    // scheme here on purpose — an in-app deep link wouldn't record the referral.
    return [withAffiliateDestination(ROBINHOOD_AFFILIATE_URL, robinhoodWeb), robinhoodWeb];
  }

  return [
    `robinhood://search?query=${query}`,
    robinhoodWeb,
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
