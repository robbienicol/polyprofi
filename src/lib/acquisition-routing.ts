import { cancellationTargetFor } from '@/lib/cancel-links';
import { inferAssetSymbol } from '@/lib/tracked-assets';
import type { AcquisitionPlatform } from '@/types/bets';
import type { Route } from '@/types/routes';

/**
 * Where a route is actually acquired. A superset of AcquisitionPlatform on purpose:
 * the preference list in Settings is only the apps a person trades in, but a cash
 * instrument is bought somewhere no preference can name. Those extra venues are forced
 * by the instrument, never chosen, so they never appear as a Settings toggle.
 */
export type TradeDestination = AcquisitionPlatform | 'treasurydirect' | 'bank' | 'cancel' | 'apply' | 'self';

export interface TradeDestinationOptions {
  kalshiEventTicker?: string;
  kalshiSeriesTicker?: string;
}

const ROBINHOOD_AFFILIATE_URL = process.env.EXPO_PUBLIC_ROBINHOOD_AFFILIATE_URL ?? '';

function searchText(route: Route): string {
  return [route.description, route.line, route.category].filter(Boolean).join(' ');
}

function isPredictionMarketRoute(route: Route): boolean {
  return route.lossProfile === 'binary'
    || /polymarket|prediction|sports bet/i.test(`${route.category} ${route.platform}`);
}

function routeAssetSymbol(route: Route): string | undefined {
  const cryptoTicker = route.id.match(/^crypto-([a-z0-9]+)/i)?.[1]?.toUpperCase();
  return cryptoTicker ?? inferAssetSymbol(route.description, route.strategy, route.line);
}

/** Reads after the word "Open", which is how every call site renders it. */
export function tradeDestinationLabel(destination: TradeDestination): string {
  return ({
    robinhood: 'Robinhood',
    polymarket: 'Polymarket',
    kalshi: 'Kalshi',
    treasurydirect: 'TreasuryDirect',
    bank: 'a savings account',
    // Overridden at the call site with the merchant's name; this is the generic form,
    // for the rare place that renders a destination without a route to hand.
    cancel: 'the cancellation page',
    apply: 'the application',
    // A spending habit has no venue at all. Nothing opens; the commitment is the act.
    self: 'nothing to open',
  })[destination];
}

/**
 * The venue that actually lists this instrument, when the route itself says so.
 * Only `@/lib/polymarket-routes` sets a sourceSlug, so carrying one is proof the
 * contract is a Polymarket market — and a Polymarket contract is fillable nowhere
 * else. A route whose venue is genuinely open (a stock, an ETF, a generic bet)
 * returns null and lets the user's preference decide.
 */
function nativeVenue(route: Route): TradeDestination | null {
  // A cut is forced to its venue like a T-bill is, and for the same reason: no broker
  // in the preference list can act on it. Without this a "Cancel Spotify" route fell
  // through to the tiebreak below and offered to open Robinhood.
  if (route.spendingCut) return route.spendingCut.kind === 'subscription' ? 'cancel' : 'self';
  // Same reasoning for cards: a new one is applied for at the issuer, and re-routing
  // the ones you hold happens at the register, with nothing to open.
  if (route.cardRewards) return route.cardRewards.kind === 'new-card' && route.cardRewards.applyUrl ? 'apply' : 'self';
  if (route.sourceSlug) return 'polymarket';
  const venue = `${route.platform} ${route.category}`;
  if (/kalshi/i.test(venue)) return 'kalshi';
  if (/polymarket/i.test(venue)) return 'polymarket';
  // Cash instruments. No broker in the preference list sells these: a T-bill comes from
  // the Treasury, an HYSA is a bank account you open. Routing either to a Robinhood
  // search is the same bug as sending a Polymarket contract there. A bond *ETF* is
  // excluded — that genuinely is a brokerage order despite the category.
  if (/savings|treasur/i.test(venue) && !/\betf\b/i.test(`${route.description} ${route.strategy}`)) {
    return /\bbanks?\b|savings account|hysa/i.test(`${route.platform} ${route.description}`)
      ? 'bank'
      : 'treasurydirect';
  }
  return null;
}

export function preferredTradeDestination(
  route: Route,
  preferredPlatforms: AcquisitionPlatform[] | undefined,
): TradeDestination {
  // Where the contract lives outranks where the user likes to trade. A platform
  // preference is a tiebreak between venues that can each fill the order, never a
  // licence to send a Polymarket market to a broker that does not list it — doing
  // so also throws away the exact market URL we already resolved.
  const native = nativeVenue(route);
  if (native) return native;

  const preferences = new Set(preferredPlatforms ?? []);
  // Narrower than TradeDestination on purpose: this branch is the preference tiebreak,
  // and only venues a user can actually express a preference for belong in it. Anything
  // forced by the instrument has already returned above.
  const compatible: AcquisitionPlatform[] = isPredictionMarketRoute(route)
    ? ['polymarket', 'kalshi', 'robinhood']
    : ['robinhood'];
  return compatible.find((destination) => preferences.has(destination)) ?? compatible[0];
}

function withAffiliateDestination(affiliateUrl: string, destination: string): string {
  const separator = affiliateUrl.includes('?') ? '&' : '?';
  return `${affiliateUrl}${separator}u=${encodeURIComponent(destination)}`;
}

function robinhoodUrls(route: Route): string[] {
  const symbol = routeAssetSymbol(route);
  const directDestination = symbol
    ? route.category.toLowerCase().includes('crypto')
      ? `https://robinhood.com/crypto/${symbol}`
      : `https://robinhood.com/stocks/${symbol}`
    : `https://robinhood.com/search/?query=${encodeURIComponent(searchText(route))}`;

  if (ROBINHOOD_AFFILIATE_URL) {
    return [withAffiliateDestination(ROBINHOOD_AFFILIATE_URL, directDestination), directDestination];
  }
  return [directDestination];
}

function kalshiCategoryUrl(route: Route): string {
  const text = searchText(route);
  if (/sport| vs |game|nba|wnba|nfl|nhl|mlb/i.test(text)) return 'https://kalshi.com/category/sports/all-sports';
  if (/bitcoin|ethereum|solana|crypto|btc|eth|sol/i.test(text)) return 'https://kalshi.com/category/crypto';
  if (/election|president|politic|congress|senate|mayor/i.test(text)) return 'https://kalshi.com/category/elections';
  if (/fed|rate|econom|finance|treasur/i.test(text)) return 'https://kalshi.com/category/financials';
  return 'https://kalshi.com/browse';
}

/** One place the user can open this route, and what it costs there. */
export interface TradeVenue {
  destination: TradeDestination;
  label: string;
  /**
   * Net-of-fee price to enter this side at this venue, in cents. Null when we hold no
   * comparable quote — a single-venue route has nothing to be cheap or expensive against.
   */
  priceCents: number | null;
  /**
   * Estimated fee already folded into `priceCents`, broken back out for display, in cents
   * per contract. Null alongside `priceCents`. Zero is a real value (Polymarket has none),
   * not "unknown" — always render it rather than hiding a zero-fee line.
   */
  feeCents: number | null;
  /** Cheapest venue carrying a quote. Never set when there is only one venue, or on a tie. */
  cheapest: boolean;
}

/**
 * Every venue that can actually fill this route, cheapest first.
 *
 * Only a Polymarket contract we have matched to a Kalshi market has a second venue: the
 * same outcome, two order books, two prices. Everything else has exactly one place it can
 * be bought, and returning a one-entry list keeps the caller from special-casing that.
 *
 * The ordering IS the recommendation, and it is safe to make because it ranks venues on a
 * like-for-like price for an identical contract — not instruments against each other. Note
 * that neither Polymarket nor Kalshi carries an affiliate link (only Robinhood does, and it
 * is never a venue here), so nothing but price decides the order.
 *
 * `comparison` is structural on purpose: @/lib/market-comparison pulls in network clients,
 * and this module has no business importing those to describe its own return type.
 */
export function tradeVenuesForRoute(
  route: Route,
  preferredPlatforms: AcquisitionPlatform[] | undefined,
  comparison: {
    polymarketPrice: number;
    kalshiPrice: number;
    polymarketRawPrice: number;
    kalshiRawPrice: number;
    betterPlatform: 'polymarket' | 'kalshi' | 'tie';
  } | null,
): TradeVenue[] {
  const single = (destination: TradeDestination): TradeVenue[] => [
    { destination, label: tradeDestinationLabel(destination), priceCents: null, feeCents: null, cheapest: false },
  ];
  if (!comparison || nativeVenue(route) !== 'polymarket') {
    return single(preferredTradeDestination(route, preferredPlatforms));
  }
  const venues: TradeVenue[] = [
    {
      destination: 'polymarket',
      label: tradeDestinationLabel('polymarket'),
      priceCents: Math.round(comparison.polymarketPrice * 100),
      feeCents: Math.round((comparison.polymarketPrice - comparison.polymarketRawPrice) * 100),
      cheapest: comparison.betterPlatform === 'polymarket',
    },
    {
      destination: 'kalshi',
      label: tradeDestinationLabel('kalshi'),
      priceCents: Math.round(comparison.kalshiPrice * 100),
      feeCents: Math.round((comparison.kalshiPrice - comparison.kalshiRawPrice) * 100),
      cheapest: comparison.betterPlatform === 'kalshi',
    },
  ];
  // Cheapest first, and a tie leaves the native venue in front rather than shuffling.
  return [...venues].sort((a, b) => Number(b.cheapest) - Number(a.cheapest));
}

export function tradeUrlsFor(
  route: Route,
  destination: TradeDestination,
  options: TradeDestinationOptions = {},
): string[] {
  const query = encodeURIComponent(searchText(route));
  if (destination === 'polymarket') {
    return [
      ...(route.sourceSlug ? [`https://polymarket.com/event/${encodeURIComponent(route.sourceSlug)}`] : []),
      `https://polymarket.com/predictions?query=${query}`,
    ];
  }

  if (destination === 'cancel') {
    return route.spendingCut ? cancellationTargetFor(route.spendingCut.merchant).urls : [];
  }

  // Cutting back on a category is a promise to yourself. There is no page for that, and
  // inventing one — a budgeting article, a search — would be filler.
  if (destination === 'self') return [];

  if (destination === 'apply') return route.cardRewards?.applyUrl ? [route.cardRewards.applyUrl] : [];

  if (destination === 'treasurydirect') {
    return ['https://www.treasurydirect.gov/marketable-securities/treasury-bills/'];
  }

  if (destination === 'bank') {
    // The FDIC's own institution finder — neutral and authoritative. Deliberately not a
    // rate-comparison site: those are affiliate-funded and the app does not rank banks.
    return ['https://banks.data.fdic.gov/bankfind-suite/bankfind'];
  }

  if (destination === 'kalshi') {
    const exactMarket = options.kalshiSeriesTicker && options.kalshiEventTicker
      ? `https://kalshi.com/markets/${options.kalshiSeriesTicker.toLowerCase()}/${options.kalshiEventTicker.toLowerCase()}`
      : null;
    return exactMarket ? [exactMarket, kalshiCategoryUrl(route)] : [kalshiCategoryUrl(route)];
  }

  return robinhoodUrls(route);
}

export { __selfCheck } from '@/lib/acquisition-routing.check';
