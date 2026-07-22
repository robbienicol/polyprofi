import type { MetaculusEdge, TaggedPolymarketEvent, WhaleTrade } from '@/api/client/polymarket-pick-types';

export function formatPolymarketTaggedEvents(events: TaggedPolymarketEvent[]): string {
  if (events.length === 0) return 'Unavailable';
  const byTag = events.reduce<Record<string, TaggedPolymarketEvent[]>>((groups, event) => {
    (groups[event.tag] ??= []).push(event);
    return groups;
  }, {});
  return Object.entries(byTag).map(([tag, list]) => `[${tag}]\n${list.map((event) => `  • ${event.title}${event.yesPrice != null ? ` — Yes ${(event.yesPrice * 100).toFixed(0)}¢` : ''} | vol $${(event.volume / 1e6).toFixed(1)}M`).join('\n')}`).join('\n\n');
}

export function formatMetaculusEdges(edges: MetaculusEdge[]): string {
  if (edges.length === 0) return 'Unavailable (add EXPO_PUBLIC_METACULUS_API_TOKEN and overlapping questions)';
  return edges.map((edge) => {
    const action = edge.direction === 'buy_yes' ? 'Buy Yes' : 'Buy No';
    return `• PM: "${edge.polymarketQuestion}" @ ${edge.pmYesPct.toFixed(0)}¢\n  Metaculus: ${edge.metaculusYesPct.toFixed(0)}% → ${edge.edgePts >= 0 ? '+' : ''}${edge.edgePts.toFixed(0)}pt edge → ${action}`;
  }).join('\n\n');
}

export function formatWhaleTrades(trades: WhaleTrade[]): string {
  return trades.length === 0 ? 'Unavailable' : trades.map((trade) => `• #${trade.rank} ${trade.trader} (${trade.leaderboardPeriod} leaderboard): ${trade.action} ${trade.side} "${trade.market}" @ ${(trade.price * 100).toFixed(0)}¢ (~$${Math.round(trade.size * trade.price).toLocaleString()} notional)`).join('\n');
}
