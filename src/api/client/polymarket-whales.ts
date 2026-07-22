import type { WhaleTrade } from '@/api/client/polymarket-pick-types';
import { isRecord, responseJson } from '@/lib/runtime-validation';
import type { RawPick } from '@/types/picks';

const DATA_API = 'https://data-api.polymarket.com';
const FOLLOWED_TRADERS = new Set(['swisstony']);
const LEADERBOARD_TRADERS = 3;
const RECENT_TRADES_PER_TRADER = 8;
const REQUEST_GAP_MS = 350;

interface LeaderboardRow {
  rank?: string;
  userName?: string;
  proxyWallet?: string;
  pnl?: number;
}

interface RawTrade {
  side?: string;
  outcome?: string;
  title?: string;
  price?: number;
  size?: number;
}

export async function fetchWhaleTrades(): Promise<WhaleTrade[]> {
  const [leaders, allTimeLeaders] = await Promise.all([
    fetchLeaderboard('POLITICS'),
    fetchLeaderboard('OVERALL', 'ALL', 100),
  ]);
  const followed = allTimeLeaders.filter((row) => FOLLOWED_TRADERS.has((row.userName ?? '').toLowerCase()));
  const sources = [
    ...leaders.slice(0, LEADERBOARD_TRADERS).map((row) => ({ row, period: 'month' as const })),
    ...followed.map((row) => ({ row, period: 'all-time' as const })),
  ];
  const trades: WhaleTrade[] = [];
  const seenWallets = new Set<string>();

  for (const { row, period } of sources) {
    if (!row.proxyWallet || seenWallets.has(row.proxyWallet)) continue;
    seenWallets.add(row.proxyWallet);
    await sleep(REQUEST_GAP_MS);
    const recentTrades = await fetchRecentTrades(row.proxyWallet);
    for (const trade of recentTrades) {
      if (trade.side !== 'BUY' || !trade.title || !trade.outcome) continue;
      if ((trade.price ?? 0) <= 0.02 || (trade.price ?? 0) >= 0.98) continue;
      trades.push({
        trader: row.userName ?? row.proxyWallet.slice(0, 8),
        rank: Number(row.rank ?? 0),
        leaderboardPnl: row.pnl ?? 0,
        leaderboardPeriod: period,
        market: trade.title,
        side: trade.outcome === 'Yes' ? 'Yes' : 'No',
        action: 'BUY',
        price: trade.price ?? 0,
        size: trade.size ?? 0,
      });
    }
  }
  return trades.sort((a, b) => b.size * b.price - a.size * a.price).slice(0, 24);
}

export function whaleTradesToPicks(trades: WhaleTrade[]): RawPick[] {
  return trades.map((trade) => ({
    category: 'Polymarket',
    pick: `${trade.action} ${trade.side} on "${trade.market}" @ ${(trade.price * 100).toFixed(0)}¢`,
    reasoning: `Leaderboard trader #${trade.rank} (${trade.trader}, +$${Math.round(trade.leaderboardPnl).toLocaleString()} ${trade.leaderboardPeriod} PnL) opened $${Math.round(trade.size * trade.price).toLocaleString()} on this side.`,
    source: `Polymarket leaderboard · ${trade.trader} · rank #${trade.rank}`,
    sourceQuality: trade.rank <= 3 ? 'high' : 'medium',
  }));
}

async function fetchLeaderboard(category: string, timePeriod: 'MONTH' | 'ALL' = 'MONTH', limit = LEADERBOARD_TRADERS + 2): Promise<LeaderboardRow[]> {
  try {
    const response = await fetch(`${DATA_API}/v1/leaderboard?category=${category}&timePeriod=${timePeriod}&orderBy=PNL&limit=${limit}`, { headers: { Accept: 'application/json' } });
    if (!response.ok) return [];
    const payload = await responseJson(response);
    return Array.isArray(payload) ? payload.filter(isLeaderboardRow) : [];
  } catch {
    return [];
  }
}

async function fetchRecentTrades(wallet: string): Promise<RawTrade[]> {
  try {
    const response = await fetch(`${DATA_API}/trades?user=${wallet}&limit=${RECENT_TRADES_PER_TRADER}`, { headers: { Accept: 'application/json' } });
    if (!response.ok) return [];
    const payload = await responseJson(response);
    return Array.isArray(payload) ? payload.filter(isRawTrade) : [];
  } catch {
    return [];
  }
}

function isLeaderboardRow(value: unknown): value is LeaderboardRow {
  return isRecord(value) && (value.proxyWallet === undefined || typeof value.proxyWallet === 'string');
}

function isRawTrade(value: unknown): value is RawTrade {
  return isRecord(value) && (value.title === undefined || typeof value.title === 'string');
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
