export interface PolymarketEntry {
  question: string;
  outcomes: string[];
  prices: number[];
  volumeM: number;
  liquidityM?: number;
  spread?: number;
  bestBid?: number;
  bestAsk?: number;
  oneDayPriceChange?: number;
  oneWeekPriceChange?: number;
  oneMonthPriceChange?: number;
  slug?: string;
  endDate?: string;
}

export interface KalshiEntry {
  ticker: string;
  eventTicker: string;
  seriesTicker: string;
  title: string;
  yesSubTitle?: string;
  noSubTitle?: string;
  yesBid?: number;
  yesAsk?: number;
  noBid?: number;
  noAsk?: number;
  volume?: number;
  volume24h?: number;
  liquidity?: number;
  closeTime?: string;
  openTime?: string;
  expectedExpirationTime?: string;
  status: string;
}

export interface SportsGame {
  sport: string;
  home: string;
  away: string;
  date: string;
  status: string;
  homeScore?: number;
  awayScore?: number;
}

export interface StockQuote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePct: number;
  volume: number;
  change1wPct: number | null;
  change1mPct: number | null;
  change3mPct: number | null;
  change1yPct: number | null;
  annualized5yPct?: number | null;
  dailyVol: number | null;
  yieldPct?: number;
  yieldLabel?: string;
  yieldAsOf?: string;
  yieldSource?: string;
  yieldSourceUrl?: string;
  expenseRatioPct?: number;
}

export interface TreasuryBillYield {
  label: string;
  days: number;
  yieldPct: number;
  yieldLabel: string;
  yieldAsOf: string;
  yieldSource: string;
  yieldSourceUrl: string;
}

export interface MetaculusQuestion {
  question: string;
  probability: number;
  url: string;
}

export interface MarketContext {
  polymarket: PolymarketEntry[];
  stocks: StockQuote[];
  metaculus: MetaculusQuestion[];
  treasuryBillYields: TreasuryBillYield[];
  fetchedAt: string;
}
