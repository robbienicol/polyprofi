export interface RawPick {
  category: string;
  pick: string;
  reasoning: string;
  source: string;
  sourceQuality: 'high' | 'medium' | 'low';
}
