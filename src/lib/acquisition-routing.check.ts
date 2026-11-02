import type { Route } from '@/types/routes';
import { tradeDestinationLabel, preferredTradeDestination, tradeVenuesForRoute, tradeUrlsFor } from '@/lib/acquisition-routing';

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

  // ── venue list ────────────────────────────────────────────────────────────
  const cheaperOnKalshi = {
    polymarketPrice: 0.62, kalshiPrice: 0.59,
    polymarketRawPrice: 0.62, kalshiRawPrice: 0.57, betterPlatform: 'kalshi' as const,
  };
  const bothVenues = tradeVenuesForRoute(prediction, undefined, cheaperOnKalshi);
  console.assert(
    bothVenues.length === 2 && bothVenues[0].destination === 'kalshi' && bothVenues[0].cheapest,
    'a matched contract lists both venues with the cheaper one first',
  );
  console.assert(
    bothVenues[0].priceCents === 59 && bothVenues[1].priceCents === 62,
    'each venue reports its own net price in cents',
  );
  console.assert(
    bothVenues[0].feeCents === 2 && bothVenues[1].feeCents === 0,
    'the fee folded into a venue\'s net price is broken back out for display',
  );
  console.assert(
    bothVenues.filter((venue) => venue.cheapest).length === 1,
    'exactly one venue is flagged cheapest',
  );
  const tied = tradeVenuesForRoute(prediction, undefined, {
    polymarketPrice: 0.6, kalshiPrice: 0.6,
    polymarketRawPrice: 0.6, kalshiRawPrice: 0.6, betterPlatform: 'tie',
  });
  console.assert(
    tied.length === 2 && tied[0].destination === 'polymarket' && tied.every((venue) => !venue.cheapest),
    'a tie flags nothing and leaves the native venue first',
  );
  console.assert(
    tradeVenuesForRoute(prediction, undefined, null).length === 1,
    'with no cross-platform match the route keeps its single venue',
  );
  console.assert(
    tradeVenuesForRoute(stock, ['robinhood'], cheaperOnKalshi)[0].destination === 'robinhood',
    'a stock is never given prediction-market venues, even when a comparison is passed',
  );
  console.assert(
    tradeVenuesForRoute(stock, ['robinhood'], null)[0].priceCents === null,
    'a single-venue route quotes no price — there is nothing to compare it against',
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
