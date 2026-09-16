import type { Route } from '@/types/routes';

export function routeDisplayTitle(route: { line?: string; description: string; category: string }): string {
  if (route.line) return route.line;
  return route.description
    .replace(/^put your \$[\d,]+ (on|in|into)\s*/i, '')
    .split('—')[0]
    .replace(/[.!]\s*$/, '')
    .trim() || route.category;
}

export function liquidityLabel(route: Route): 'Low' | 'Medium' | 'High' {
  const executionScore = route.marketQuality?.executionScore;
  if (executionScore != null) {
    if (executionScore >= 75) return 'High';
    if (executionScore >= 45) return 'Medium';
    return 'Low';
  }
  if (route.probability >= 65) return 'High';
  if (route.probability >= 40) return 'Medium';
  return 'Low';
}

export function pricePositionLabel(route: Route): string {
  switch (route.marketQuality?.pricePosition) {
    case 'near_recent_low': return 'Near recent low';
    case 'middle': return 'Middle of range';
    case 'near_recent_high': return 'Near recent high';
    case 'steady': return 'Little movement';
    default: return 'Unavailable';
  }
}

export function formatMarketLiquidity(liquidityUsd: number): string {
  if (liquidityUsd >= 1_000_000) return `$${(liquidityUsd / 1_000_000).toFixed(1)}M`;
  if (liquidityUsd >= 1_000) return `$${Math.round(liquidityUsd / 1_000)}K`;
  return `$${Math.round(liquidityUsd)}`;
}
