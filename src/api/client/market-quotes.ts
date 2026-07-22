import type { StockQuote, TreasuryBillYield } from '@/api/client/market-data-types';
import { isRecord, responseJson } from '@/lib/runtime-validation';
import { dailyVolatility } from '@/lib/volatility-probability';

const STOCK_SYMBOLS = [
  'SPY', 'VOO', 'VTI', 'QQQ', 'DIA', 'IWM', 'BND', 'SGOV', 'SHY', 'TLT', 'GLD', 'BRK-B',
  'AAPL', 'TSLA', 'NVDA', 'MSFT', 'AMZN', 'META', '^IRX', '^FVX', '^TNX',
];
const TREASURY_YEAR = new Date().getFullYear();
const TREASURY_URL = `https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/${TREASURY_YEAR}/all?type=daily_treasury_bill_rates&field_tdr_date_value=${TREASURY_YEAR}&page&_format=csv`;
const SGOV_URL = 'https://www.ishares.com/us/products/314116/ishares-0-3-month-treasury-bond-etf';
const TREASURY_TERMS = [
  { label: '4-week T-bill', days: 28, column: '4 WEEKS COUPON EQUIVALENT' },
  { label: '6-week T-bill', days: 42, column: '6 WEEKS COUPON EQUIVALENT' },
  { label: '8-week T-bill', days: 56, column: '8 WEEKS COUPON EQUIVALENT' },
  { label: '13-week T-bill', days: 91, column: '13 WEEKS COUPON EQUIVALENT' },
  { label: '17-week T-bill', days: 119, column: '17 WEEKS COUPON EQUIVALENT' },
  { label: '26-week T-bill', days: 182, column: '26 WEEKS COUPON EQUIVALENT' },
  { label: '52-week T-bill', days: 364, column: '52 WEEKS COUPON EQUIVALENT' },
];

interface YieldFact {
  symbol: string;
  yieldPct: number;
  yieldLabel: string;
  yieldAsOf: string;
  yieldSource: string;
  yieldSourceUrl: string;
  expenseRatioPct?: number;
}

interface YahooQuotePayload {
  symbol: string;
  name: string;
  current: number;
  previous: number;
  volume: number;
  closes: number[];
}

let treasuryRequest: Promise<TreasuryBillYield[]> | null = null;

export async function fetchTreasuryBillYields(): Promise<TreasuryBillYield[]> {
  if (treasuryRequest) return treasuryRequest;
  treasuryRequest = fetchTreasuryBillYieldsUncached();
  return treasuryRequest;
}

async function fetchTreasuryBillYieldsUncached(): Promise<TreasuryBillYield[]> {
  try {
    const response = await fetch(TREASURY_URL, { headers: { Accept: 'text/csv' } });
    if (!response.ok) return [];
    const [headerLine, latestLine] = (await response.text()).trim().split(/\r?\n/);
    if (!headerLine || !latestLine) return [];
    const headers = parseCsvLine(headerLine);
    const latest = parseCsvLine(latestLine);
    const yieldAsOf = latest[headers.findIndex((header) => header.toUpperCase() === 'DATE')];
    if (!yieldAsOf) return [];
    return TREASURY_TERMS.flatMap((term) => {
      const yieldPct = Number(latest[headers.findIndex((header) => header.toUpperCase() === term.column)]);
      return Number.isFinite(yieldPct) && yieldPct > 0 ? [{
        label: term.label,
        days: term.days,
        yieldPct,
        yieldLabel: `${term.label} coupon-equivalent yield`,
        yieldAsOf,
        yieldSource: 'U.S. Treasury',
        yieldSourceUrl: TREASURY_URL,
      }] : [];
    });
  } catch (error) {
    console.warn(`[market-data:treasury] ${error instanceof Error ? error.message : String(error)}`);
    return [];
  }
}

export async function fetchStocks(): Promise<StockQuote[]> {
  const [yieldResults, quoteResults] = await Promise.all([
    Promise.allSettled([fetchTreasuryYieldFact(), fetchSgovYieldFact()]),
    Promise.allSettled(STOCK_SYMBOLS.map(fetchStockQuote)),
  ]);
  const yields = new Map(yieldResults
    .map((result) => result.status === 'fulfilled' ? result.value : null)
    .filter((fact): fact is YieldFact => fact !== null)
    .map((fact) => [fact.symbol, fact]));
  return quoteResults
    .map((result) => result.status === 'fulfilled' ? result.value : null)
    .filter((quote): quote is StockQuote => quote !== null)
    .map((quote) => ({ ...quote, ...yields.get(quote.symbol) }));
}

async function fetchStockQuote(symbol: string): Promise<StockQuote | null> {
  const response = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=5y`, { headers: { Accept: 'application/json' } });
  if (!response.ok) return null;
  const payload = readYahooQuote(await responseJson(response));
  if (!payload) return null;
  const { closes, current, previous } = payload;
  const historyYears = Math.min(5, closes.length / 252);
  const firstClose = closes[0] ?? null;
  return {
    symbol: payload.symbol,
    name: payload.name,
    price: current,
    change: current - previous,
    changePct: previous ? ((current - previous) / previous) * 100 : 0,
    volume: payload.volume,
    change1wPct: percentChange(current, nthFromEnd(closes, 5)),
    change1mPct: percentChange(current, nthFromEnd(closes, 21)),
    change3mPct: percentChange(current, nthFromEnd(closes, 63)),
    change1yPct: percentChange(current, nthFromEnd(closes, 252)),
    annualized5yPct: firstClose && historyYears >= 1 ? (Math.pow(current / firstClose, 1 / historyYears) - 1) * 100 : null,
    dailyVol: dailyVolatility(closes),
  };
}

function readYahooQuote(value: unknown): YahooQuotePayload | null {
  if (!isRecord(value) || !isRecord(value.chart) || !Array.isArray(value.chart.result)) return null;
  const result = value.chart.result[0];
  if (!isRecord(result) || !isRecord(result.meta)) return null;
  const { meta } = result;
  if (typeof meta.symbol !== 'string' || typeof meta.regularMarketPrice !== 'number') return null;
  const indicators = isRecord(result.indicators) ? result.indicators : null;
  const adjcloseGroups = indicators && Array.isArray(indicators.adjclose) ? indicators.adjclose : [];
  const firstGroup = isRecord(adjcloseGroups[0]) ? adjcloseGroups[0] : null;
  const rawCloses = firstGroup && Array.isArray(firstGroup.adjclose) ? firstGroup.adjclose : [];
  return {
    symbol: meta.symbol,
    name: typeof meta.shortName === 'string'
      ? meta.shortName
      : typeof meta.longName === 'string' ? meta.longName : meta.symbol,
    current: meta.regularMarketPrice,
    previous: typeof meta.previousClose === 'number' ? meta.previousClose : meta.regularMarketPrice,
    volume: typeof meta.regularMarketVolume === 'number' ? meta.regularMarketVolume : 0,
    closes: rawCloses.filter((close): close is number => typeof close === 'number' && close > 0),
  };
}

async function fetchTreasuryYieldFact(): Promise<YieldFact | null> {
  const term = (await fetchTreasuryBillYields()).find((item) => item.label === '13-week T-bill');
  return term ? { symbol: '^IRX', ...term } : null;
}

async function fetchSgovYieldFact(): Promise<YieldFact | null> {
  try {
    const response = await fetch(SGOV_URL, { headers: { Accept: 'text/html' } });
    if (!response.ok) return null;
    const html = await response.text();
    const yieldMatch = html.match(/"name":"30 Day SEC Yield as of","value":"([\d.]+)%","valueReference":\{"@type":"PropertyValue","name":"As of Dates","value":"([^"]+)"/);
    const expenseMatch = html.match(/"name":"Expense Ratio:","value":"([\d.]+)"/);
    const yieldPct = Number(yieldMatch?.[1]);
    const yieldAsOf = yieldMatch?.[2];
    return Number.isFinite(yieldPct) && yieldAsOf ? {
      symbol: 'SGOV',
      yieldPct,
      yieldLabel: '30-day SEC yield',
      yieldAsOf,
      yieldSource: 'iShares / BlackRock',
      yieldSourceUrl: SGOV_URL,
      expenseRatioPct: expenseMatch?.[1] ? Number(expenseMatch[1]) : undefined,
    } : null;
  } catch {
    return null;
  }
}

function nthFromEnd<T>(values: T[], offset: number): T | null {
  return values.length > offset ? values[values.length - 1 - offset] : values[0] ?? null;
}

function percentChange(current: number, past: number | null): number | null {
  return past && past > 0 ? ((current - past) / past) * 100 : null;
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let quoted = false;
  for (const character of line) {
    if (character === '"') quoted = !quoted;
    else if (character === ',' && !quoted) { cells.push(current); current = ''; }
    else current += character;
  }
  cells.push(current);
  return cells.map((cell) => cell.trim());
}
