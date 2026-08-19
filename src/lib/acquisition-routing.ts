import { inferAssetSymbol } from '@/lib/tracked-assets';
import type { AcquisitionPlatform } from '@/types/bets';
import type { Route } from '@/types/routes';

/**
 * Where a route is actually acquired. A superset of AcquisitionPlatform on purpose:
 * the preference list in Settings is only the apps a person trades in, but a cash
 * instrument is bought somewhere no preference can name. Those extra venues are forced
 * by the instrument, never chosen, so they never appear as a Settings toggle.
 */
export type TradeDestination = AcquisitionPlatform | 'treasurydirect' | 'bank';

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

export function __selfCheck(): void {
  const prediction: Route = {
    id: 'pm-live-test', category: 'Polymarket', emoji: '🔮', description: 'Test market',
    riskLevel: 3, probability: 60, expectedReturn: 25, platform: 'Polymarket', strategy: '',
    lossProfile: 'binary', meetsTarget: true, sourceSlug: 'test-market',
  };
  const stock: Route = {
    ...prediction, id: 'etf-voo', category: 'Stocks & ETFs', description: 'Buy VOO',
    platform: 'Brokerage', lossProfile: 'partial', sourceSlug: undefined,
  };
  console.assert(
    preferredTradeDestination(prediction, ['robinhood']) === 'polymarket',
    'a Polymarket contract ignores a Robinhood preference — no other venue can fill it',
  );
  const kalshiRoute: Route = {
    ...prediction, id: 'kalshi-1', platform: 'Kalshi', category: 'Kalshi', sourceSlug: undefined,
  };
  console.assert(
    preferredTradeDestination(kalshiRoute, ['polymarket']) === 'kalshi',
    'a Kalshi market is not sent to Polymarket just because Polymarket is preferred',
  );
  const genericBet: Route = {
    ...prediction, id: 'sports-1', platform: 'Sportsbook', category: 'Sports Betting', sourceSlug: undefined,
  };
  console.assert(
    preferredTradeDestination(genericBet, ['kalshi']) === 'kalshi',
    'a route with no native venue still follows the user preference',
  );
  console.assert(
    preferredTradeDestination(prediction, ['robinhood', 'polymarket']) === 'polymarket',
    'a specialized preferred prediction market wins when available',
  );
  console.assert(
    preferredTradeDestination(stock, ['polymarket']) === 'robinhood',
    'stock routes fall back to their supported marketplace',
  );
  console.assert(
    tradeUrlsFor(prediction, 'polymarket')[0] === 'https://polymarket.com/event/test-market',
    'traceable Polymarket routes open the exact market',
  );
  console.assert(
    tradeUrlsFor(stock, 'robinhood')[0].includes('/stocks/VOO'),
    'stock routes open the exact Robinhood symbol',
  );

  // ── cash instruments ──────────────────────────────────────────────────────
  // These are the routes @/lib/savings-treasury-routes actually emits, verbatim.
  const tbill: Route = {
    ...stock, id: 'treasury-91d', category: 'Savings & Treasuries',
    description: 'Buy a 13-week T-bill — 4.20% sourced yield projects +$10 in 3mo.',
    platform: 'TreasuryDirect / brokerage',
  };
  const hysa: Route = {
    ...stock, id: 'savings-account-hysa', category: 'Savings & Treasuries',
    description: 'Park your $1,000 in a high-yield online savings account — withdrawable anytime.',
    platform: 'Online bank (e.g. Marcus, Ally, Discover)',
  };
  console.assert(
    preferredTradeDestination(tbill, ['robinhood']) === 'treasurydirect',
    'a T-bill is bought from the Treasury, not searched for on Robinhood',
  );
  console.assert(
    preferredTradeDestination(hysa, ['robinhood']) === 'bank',
    'a high-yield savings account is a bank account, not a Robinhood order',
  );
  console.assert(
    tradeUrlsFor(tbill, 'treasurydirect')[0].startsWith('https://www.treasurydirect.gov/'),
    'the T-bill route opens TreasuryDirect',
  );
  console.assert(
    tradeUrlsFor(hysa, 'bank')[0].includes('fdic.gov'),
    'the savings route opens the FDIC bank finder, not an affiliate rate table',
  );
  console.assert(
    tradeDestinationLabel('bank') === 'a savings account'
      && tradeDestinationLabel('treasurydirect') === 'TreasuryDirect',
    'labels read correctly after the word "Open"',
  );

  // A bond ETF sits in the same category but is a genuine brokerage order.
  const bondEtf: Route = {
    ...stock, id: 'etf-bil', category: 'Savings & Treasuries',
    description: 'Put your $1,000 in BIL (SPDR 1-3 Month T-Bill ETF) — an ETF tracking short bills.',
    platform: 'Brokerage',
  };
  console.assert(
    preferredTradeDestination(bondEtf, ['robinhood']) === 'robinhood',
    'a bond ETF is still a brokerage order despite the treasury category',
  );
}
