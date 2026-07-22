export function routeDisplayTitle(route: { line?: string; description: string; category: string }): string {
  if (route.line) return route.line;
  return route.description
    .replace(/^put your \$[\d,]+ (on|in|into)\s*/i, '')
    .split('—')[0]
    .replace(/[.!]\s*$/, '')
    .trim() || route.category;
}

export function volatilityLabel(riskLevel: number): 'Low' | 'Medium' | 'High' {
  if (riskLevel <= 2) return 'Low';
  if (riskLevel === 3) return 'Medium';
  return 'High';
}

export function liquidityLabel(probability: number): 'Low' | 'Medium' | 'High' {
  if (probability >= 65) return 'High';
  if (probability >= 40) return 'Medium';
  return 'Low';
}
