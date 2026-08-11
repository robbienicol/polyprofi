import { inferAssetSymbol } from '@/lib/tracked-assets';
import type { AcquisitionPlatform } from '@/types/bets';
import type { Route } from '@/types/routes';

export type TradeDestination = AcquisitionPlatform;

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

export function tradeDestinationLabel(destination: TradeDestination): string {
  return ({ robinhood: 'Robinhood', polymarket: 'Polymarket', kalshi: 'Kalshi' })[destination];
}

export function preferredTradeDestination(
  route: Route,
  preferredPlatforms: AcquisitionPlatform[] | undefined,
): TradeDestination {
  const preferences = new Set(preferredPlatforms ?? []);
  const compatible: TradeDestination[] = isPredictionMarketRoute(route)
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
    preferredTradeDestination(prediction, ['robinhood']) === 'robinhood',
    'Robinhood-only preference applies to prediction routes',
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
}
