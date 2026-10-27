import type { PriceSeries } from '@/api/client/price-history';
import { rangeStartTime, type ChartRange } from '@/lib/chart-range';
import type { PortfolioProgressPoint } from '@/api/client/storage';
import { effectiveEntryPrice } from '@/lib/bet-monitor-match';
import { isPredictionMarketBet } from '@/lib/parse-bet-line';
import { projectedAccrual, stockIdentity, type PositionValuation } from '@/lib/portfolio-progress';
import { isSavingsOrTreasuryCategory, isStockOrEtfCategory } from '@/lib/tracked-assets';
import type { TrackedBet } from '@/types/bets';

/**
 * What the portfolio chart draws, and how.
 *
 * `time` places each point at its moment on a fixed axis — the 1D chart, where the
 * whole trading day is laid out and the line walks across it as the day goes on.
 * `index` spaces points evenly, the way a brokerage draws every longer range, so
 * nights and weekends (when nothing trades) take up no width.
 */
export interface ChartSeries {
  points: PortfolioProgressPoint[];
  /** What the range is measured from: the prior close on 1D, the first point otherwise. The dotted line. */
  baseline: PortfolioProgressPoint | null;
  xMode: 'time' | 'index';
  /** Time axis, for `time` mode. */
  domain?: { start: number; end: number };
  /** Pre-market and after-hours, drawn fainter than the regular session. */
  extendedHours?: { start: number; end: number }[];
  /** `market` when drawn from price history; `recorded` when it fell back to what the app saw while open. */
  source: 'market' | 'recorded';
}

export interface SeriesInput {
  range: ChartRange;
  bets: TrackedBet[];
  stockHistory: Record<string, PriceSeries>;
  /** Keyed by bet id: the outcome token that position holds. */
  outcomeHistory: Record<string, PriceSeries>;
  /** Today's valuation per position — the flat fallback for anything without a history. */
  positionById: Record<string, PositionValuation>;
  /** Now, as the header shows it. Appended so the line ends where the number is. */
  live: PortfolioProgressPoint | null;
  /** Values seen live this session, newer than the fetched history. Makes the tip move in real time. */
  liveTail: PortfolioProgressPoint[];
  /** What the app recorded while open. Only used when no price history came back. */
  recorded: PortfolioProgressPoint[];
  now: number;
}

const DAY_MS = 24 * 60 * 60 * 1_000;

/** Price in force at `time`: the last print at or before it, else the first one. */
function priceAt(series: PriceSeries, time: number): number {
  const { times, prices } = series;
  if (time <= times[0]) return prices[0];
  let low = 0;
  let high = times.length - 1;
  while (low < high) {
    const mid = (low + high + 1) >> 1;
    if (times[mid] <= time) low = mid;
    else high = mid - 1;
  }
  return prices[low];
}

function createdAt(bet: TrackedBet): number {
  const time = Date.parse(bet.createdAt);
  return Number.isFinite(time) ? time : 0;
}

function valueAt(
  bets: TrackedBet[],
  time: number,
  input: SeriesInput,
  override?: (bet: TrackedBet) => number | null,
): PortfolioProgressPoint {
  let value = 0;
  let basisValue = 0;
  let livePnl = 0;
  let projectedPnl = 0;

  for (const bet of bets) {
    if (createdAt(bet) > time) continue;
    const costBasis = bet.costBasis ?? bet.amountWagered;
    basisValue += costBasis;

    if (isPredictionMarketBet(bet)) {
      const series = input.outcomeHistory[bet.id];
      const entry = effectiveEntryPrice(bet);
      const price = override?.(bet) ?? (series ? priceAt(series, time) : null);
      if (price != null && entry != null && entry > 0) {
        // The same arithmetic the monitor prices the live position with.
        const pnl = (bet.amountWagered / entry) * price - bet.amountWagered;
        value += costBasis + pnl;
        livePnl += pnl;
        continue;
      }
    } else if (isStockOrEtfCategory(bet.category)) {
      const { symbol, entryPrice, quantity } = stockIdentity(bet);
      const series = symbol ? input.stockHistory[symbol] : undefined;
      const price = override?.(bet) ?? (series ? priceAt(series, time) : null);
      if (price != null && entryPrice && entryPrice > 0 && quantity != null) {
        const pnl = quantity * (price - entryPrice);
        value += costBasis + pnl;
        livePnl += pnl;
        continue;
      }
    } else if (isSavingsOrTreasuryCategory(bet.category)) {
      const pnl = projectedAccrual(bet, time);
      value += costBasis + pnl;
      projectedPnl += pnl;
      continue;
    }

    // No history for this one: hold it at today's value rather than invent a path.
    const today = input.positionById[bet.id];
    value += today?.value ?? costBasis;
    if (today?.pricing === 'live') livePnl += today.unrealizedPnl;
  }

  return { time, value, basisValue, livePnl, projectedPnl };
}

function uniqueSorted(times: number[]): number[] {
  const sorted = [...times].sort((a, b) => a - b);
  return sorted.filter((time, index) => index === 0 || time !== sorted[index - 1]);
}

/** The recorded fallback: what the app saw, restricted to the range. */
function recordedSeries(input: SeriesInput, start: number): ChartSeries {
  const inRange = input.recorded.filter((point) => point.time >= start);
  const before = input.recorded.filter((point) => point.time < start).slice(-1);
  const points = [...before, ...inRange];
  const last = points[points.length - 1];
  if (input.live && (!last || input.live.time > last.time)) points.push(input.live);
  return {
    points,
    baseline: points[0] ?? null,
    xMode: 'index',
    source: 'recorded',
  };
}

export function buildPortfolioSeries(input: SeriesInput): ChartSeries {
  const { bets, range, now } = input;
  if (bets.length === 0) return { points: [], baseline: null, xMode: 'index', source: 'market' };

  const since = Math.min(...bets.map(createdAt));
  const sessions = Object.values(input.stockHistory).flatMap((series) => (series.session ? [series.session] : []));
  const session = range === '1D' && sessions.length > 0
    ? {
      preStart: Math.min(...sessions.map((entry) => entry.preStart)),
      regularStart: Math.min(...sessions.map((entry) => entry.regularStart)),
      regularEnd: Math.max(...sessions.map((entry) => entry.regularEnd)),
      postEnd: Math.max(...sessions.map((entry) => entry.postEnd)),
    }
    : null;
  const start = session ? session.preStart : rangeStartTime(range, now, since);

  const stockSeries = Object.values(input.stockHistory);
  const outcomeSeries = Object.values(input.outcomeHistory);
  // Equities set the grid when there are any: their bars carry the trading calendar,
  // and a 24/7 market's overnight prints would otherwise stretch every night open.
  const gridSource = stockSeries.length > 0 ? stockSeries : outcomeSeries;
  const pricedByMarket = bets.some((bet) => isPredictionMarketBet(bet) || isStockOrEtfCategory(bet.category));

  let grid: number[];
  if (gridSource.length > 0) {
    grid = uniqueSorted(gridSource.flatMap((series) => series.times));
  } else if (pricedByMarket) {
    return recordedSeries(input, start);
  } else {
    // Only yield-bearing cash: its value is a function of time, so it can be drawn
    // exactly at any resolution without a feed.
    const from = Math.max(start, since);
    const steps = 120;
    grid = Array.from({ length: steps }, (_, index) => from + ((now - from) * index) / (steps - 1));
  }

  // Nothing before the first position: a portfolio that did not exist yet is not worth $0.
  const first = Math.max(start, since);
  grid = grid.filter((time) => time >= first && time <= now + 60_000);
  let points = grid.map((time) => valueAt(bets, time, input));

  const lastTime = points[points.length - 1]?.time ?? 0;
  const inSession = !session || (now >= session.regularStart && now <= session.regularEnd);
  // Live values newer than the last bar, then now. Skipped outside the regular
  // session on 1D: the live quote is the regular-hours price, and pinning it after
  // an after-hours bar would draw a jump that never traded.
  if (inSession) {
    const tail = input.liveTail.filter((point) => point.time > lastTime && point.time < now);
    points = [...points, ...tail];
    if (input.live) {
      const end = points[points.length - 1];
      if (!end || input.live.time > end.time) points.push({ ...input.live, time: Math.max(input.live.time, now) });
      else points[points.length - 1] = { ...input.live, time: end.time };
    }
  }
  if (points.length === 1) points = [{ ...points[0], time: points[0].time - 60_000 }, points[0]];
  if (points.length === 0) return recordedSeries(input, start);

  // 1D is measured from the prior close, the way every brokerage measures "today".
  // Only positions already held at that close count toward it.
  let baseline = points[0];
  if (session && since < session.preStart) {
    baseline = valueAt(bets, session.preStart - 1, input, (bet) => {
      if (!isStockOrEtfCategory(bet.category)) return null;
      const { symbol } = stockIdentity(bet);
      return (symbol && input.stockHistory[symbol]?.previousClose) || null;
    });
  }

  return range === '1D'
    ? {
      points,
      baseline,
      xMode: 'time',
      domain: session
        ? { start: session.preStart, end: session.postEnd }
        : { start: now - DAY_MS, end: now },
      extendedHours: session
        ? [
          { start: session.preStart, end: session.regularStart },
          { start: session.regularEnd, end: session.postEnd },
        ]
        : undefined,
      source: 'market',
    }
    : { points, baseline, xMode: 'index', source: 'market' };
}

function invariant(condition: boolean, message: string): void {
  if (!condition) throw new Error(`[portfolio-series] ${message}`);
}

export function __selfCheck(): void {
  const t0 = Date.parse('2026-09-22T08:00:00.000Z');
  const bet: TrackedBet = {
    id: 'voo',
    category: 'Stocks & ETFs',
    emoji: '📈',
    description: 'Put $1,000 in VOO at $100',
    platform: 'Robinhood',
    strategy: 'Buy VOO at $100',
    riskLevel: 2,
    probability: 60,
    expectedReturn: 100,
    amountWagered: 1_000,
    status: 'active',
    createdAt: '2026-09-01T00:00:00.000Z',
    assetSymbol: 'VOO',
    assetEntryPrice: 100,
  };
  const minute = 60_000;
  const history: PriceSeries = {
    times: [t0, t0 + 5 * minute, t0 + 10 * minute, t0 + 15 * minute],
    prices: [101, 99, 102, 98],
    previousClose: 100,
    session: {
      preStart: t0,
      regularStart: t0 + 5 * minute,
      regularEnd: t0 + 60 * minute,
      postEnd: t0 + 120 * minute,
    },
  };
  const now = t0 + 17 * minute;
  const series = buildPortfolioSeries({
    range: '1D',
    bets: [bet],
    stockHistory: { VOO: history },
    outcomeHistory: {},
    positionById: {},
    live: { time: now, value: 975, basisValue: 1_000, livePnl: -25, projectedPnl: 0 },
    liveTail: [{ time: t0 + 16 * minute, value: 985, basisValue: 1_000, livePnl: -15, projectedPnl: 0 }],
    recorded: [],
    now,
  });

  invariant(series.xMode === 'time', '1D is laid out on the session clock');
  invariant(series.domain?.end === history.session!.postEnd, '1D spans the whole extended session');
  invariant(series.points.length === 6, 'every bar is kept — nothing is resampled away');
  invariant(series.points.map((point) => Math.round(point.value)).join(',') === '1010,990,1020,980,985,975',
    'values follow each print exactly, then the live tail, then now');
  invariant(series.baseline?.value === 1_000, '1D is measured from the prior close');

  const later = buildPortfolioSeries({
    range: '1D',
    bets: [{ ...bet, createdAt: new Date(t0 + 7 * minute).toISOString() }],
    stockHistory: { VOO: history },
    outcomeHistory: {},
    positionById: {},
    live: null,
    liveTail: [],
    recorded: [],
    now,
  });
  invariant(later.points[0].time === t0 + 10 * minute, 'nothing is drawn before the first position existed');
  invariant(later.baseline?.value === later.points[0].value, 'a position opened today is measured from its first print');
}
