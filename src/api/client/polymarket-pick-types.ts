import type { RawPick } from '@/types/picks';

export interface TaggedPolymarketEvent {
  id: string;
  title: string;
  tag: string;
  volume: number;
  yesPrice: number | null;
  marketQuestion: string;
}

export interface MetaculusEdge {
  polymarketQuestion: string;
  metaculusQuestion: string;
  pmYesPct: number;
  metaculusYesPct: number;
  edgePts: number;
  direction: 'buy_yes' | 'buy_no';
}

export interface WhaleTrade {
  trader: string;
  rank: number;
  leaderboardPnl: number;
  leaderboardPeriod: 'month' | 'all-time';
  market: string;
  side: 'Yes' | 'No';
  action: 'BUY' | 'SELL';
  price: number;
  size: number;
}

export interface PolymarketPickBundle {
  taggedEvents: TaggedPolymarketEvent[];
  commentPicks: RawPick[];
  edges: MetaculusEdge[];
  whaleTrades: WhaleTrade[];
}
