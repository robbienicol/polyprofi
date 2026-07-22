import { fetchStocks, fetchTreasuryBillYields } from '@/api/client/market-quotes';
import { fetchPolymarket } from '@/api/client/polymarket-market-data';
import type { MarketContext, MetaculusQuestion, PolymarketEntry } from '@/api/client/market-data-types';
import { isRecord, responseJson } from '@/lib/runtime-validation';

export type * from '@/api/client/market-data-types';
export * from '@/api/client/market-context-formatters';
export { fetchPolymarketUniverse } from '@/api/client/polymarket-market-data';

const METACULUS_TOKEN = process.env.EXPO_PUBLIC_METACULUS_API_TOKEN ?? '';
let warnedAboutMetaculusToken = false;

export async function fetchMarketContext(options: { polymarket?: Promise<PolymarketEntry[]> } = {}): Promise<MarketContext> {
  const results = await Promise.allSettled([
    options.polymarket ?? fetchPolymarket(),
    fetchStocks(),
    fetchMetaculus(),
    fetchTreasuryBillYields(),
  ] as const);
  const [polymarket, stocks, metaculus, treasury] = results;
  return {
    polymarket: fulfilledOr(polymarket, []),
    stocks: fulfilledOr(stocks, []),
    metaculus: fulfilledOr(metaculus, []),
    treasuryBillYields: fulfilledOr(treasury, []),
    fetchedAt: new Date().toISOString(),
  };
}

async function fetchMetaculus(): Promise<MetaculusQuestion[]> {
  if (!METACULUS_TOKEN) {
    if (!warnedAboutMetaculusToken) console.warn('[market-data:metaculus] no token, skipped');
    warnedAboutMetaculusToken = true;
    return [];
  }
  try {
    const response = await fetch('https://www.metaculus.com/api2/questions/?order_by=-activity&type=forecast&status=open&limit=25', { headers: { Accept: 'application/json', Authorization: `Token ${METACULUS_TOKEN}` } });
    if (!response.ok) return [];
    const payload = await responseJson(response);
    if (!isRecord(payload) || !Array.isArray(payload.results)) return [];
    return payload.results.flatMap((question) => {
      if (!isRecord(question) || typeof question.title !== 'string' || !isRecord(question.community_prediction) || !isRecord(question.community_prediction.full)) return [];
      const probability = question.community_prediction.full.q2;
      return typeof probability === 'number' ? [{ question: question.title, probability, url: typeof question.page_url === 'string' ? question.page_url : '' }] : [];
    });
  } catch {
    return [];
  }
}

function fulfilledOr<T>(result: PromiseSettledResult<T>, fallback: T): T {
  return result.status === 'fulfilled' ? result.value : fallback;
}
